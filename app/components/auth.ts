"use client";

import { pushSharedStorageSnapshot } from "./sharedStorage";

export type AuthRole = "system_admin" | "admin" | "editor" | "viewer";
export type UserApprovalStatus = "approved" | "pending" | "rejected";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: AuthRole;
  active: boolean;
  approvalStatus: UserApprovalStatus;
  approvedAt?: string;
  approvedById?: string;
  approvedByName?: string;
  createdAt?: string;
  createdById?: string;
  createdByName?: string;
  lastLoginAt?: string;
};

export type AuthLoginFailureReason =
  | "missing"
  | "not_registered"
  | "invalid_password"
  | "inactive"
  | "pending_approval"
  | "rejected"
  | "locked"
  | "unavailable";

export type AuthLoginResult = {
  user: AuthUser | null;
  reason?: AuthLoginFailureReason;
};

export type LoginAttemptLog = {
  id: string;
  at: string;
  email: string;
  userName: string;
  result: "success" | "failed";
  source: "login_page" | "tracking_page";
};

export type SessionStateReason = "active" | "missing" | "expired" | "inactive_timeout" | "user_unavailable";

export const USERS_STORAGE_KEY = "sekou-tool-users-v1";
export const SESSION_STORAGE_KEY = "sekou-tool-session-v1";
export const ACCESS_LOG_STORAGE_KEY = "sekou-auth-attempts-v1";
export const LOGIN_GUARD_STORAGE_KEY = "sekou-auth-login-guard-v1";
const AUTH_USERS_API_PATH = "/api/manual-editor/auth-users";
const AUTH_LOGIN_API_PATH = "/api/manual-editor/session/login";
const AUTH_GOOGLE_LOGIN_API_PATH = "/api/manual-editor/session/google-login";
const AUTH_REGISTER_API_PATH = "/api/manual-editor/session/register";
const AUTH_LOGOUT_API_PATH = "/api/manual-editor/session/logout";
const MAX_ACCESS_LOGS = 500;
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const SESSION_INACTIVITY_TIMEOUT_MS = 1000 * 60 * 60;
const SESSION_ACTIVITY_WRITE_THROTTLE_MS = 15000;
const LOGIN_LOCK_WINDOW_MS = 1000 * 60 * 15;
const MAX_FAILED_ATTEMPTS = 5;

type AuthUsersSnapshot = {
  users: AuthUser[];
};

type AuthUsersPullResponse = {
  ok?: unknown;
  exists?: unknown;
  count?: unknown;
  access?: unknown;
  payload?: unknown;
  updatedAt?: unknown;
};

type AuthUsersPushResponse = {
  ok?: unknown;
  payload?: unknown;
  updatedAt?: unknown;
};

type AuthSessionResponse = {
  ok?: unknown;
  user?: unknown;
  users?: unknown;
  reason?: unknown;
  error?: unknown;
};

let lastPulledAuthUsersUpdatedAt: string | null = null;
const KNOWN_USER_NAME_BY_EMAIL: Record<string, string> = {
  "h.adachi@denryoku.co.jp": "安達広樹",
};

function canonicalizeKnownPersonName(name: string, email?: string): string {
  const normalizedEmail = normalizeEmail(typeof email === "string" ? email : "");
  if (normalizedEmail && KNOWN_USER_NAME_BY_EMAIL[normalizedEmail]) {
    return KNOWN_USER_NAME_BY_EMAIL[normalizedEmail];
  }
  if (name === "安達宏樹") {
    return "安達広樹";
  }
  return name;
}

function isApproverRole(role: AuthRole): boolean {
  return role === "system_admin" || role === "admin";
}

function getRolePriority(role: AuthRole): number {
  if (role === "system_admin") {
    return 40;
  }
  if (role === "admin") {
    return 30;
  }
  if (role === "editor") {
    return 20;
  }
  return 10;
}

function getApprovalPriority(status: UserApprovalStatus): number {
  if (status === "approved") {
    return 30;
  }
  if (status === "pending") {
    return 20;
  }
  return 10;
}

function getUserPriorityScore(user: AuthUser): number {
  return getRolePriority(user.role) + getApprovalPriority(user.approvalStatus) + (user.active ? 5 : 0);
}

function pickPreferredCandidate(candidates: AuthUser[]): AuthUser | null {
  if (!candidates.length) {
    return null;
  }
  const approvedAndActive = candidates.filter((user) => user.active && user.approvalStatus === "approved");
  const source = approvedAndActive.length ? approvedAndActive : candidates;
  return [...source].sort((a, b) => {
    const scoreDiff = getUserPriorityScore(b) - getUserPriorityScore(a);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    const aTime = Date.parse(a.createdAt ?? "") || 0;
    const bTime = Date.parse(b.createdAt ?? "") || 0;
    return bTime - aTime;
  })[0] ?? null;
}

export function getLoginFailureMessage(reason?: AuthLoginFailureReason): string {
  if (reason === "unavailable") {
    return "認証サービスへ接続できませんでした。時間をおいて再試行してください。";
  }
  if (reason === "not_registered") {
    return "このメールアドレスは未登録です。管理者にユーザー追加を依頼してください。";
  }
  if (reason === "pending_approval") {
    return "現在は管理者承認待ちです。承認後にログインできます。";
  }
  if (reason === "inactive") {
    return "このアカウントは現在停止中です。管理者に有効化を依頼してください。";
  }
  if (reason === "rejected") {
    return "このアカウントは利用不可に設定されています。管理者へご連絡ください。";
  }
  if (reason === "locked") {
    return "ログイン失敗が一定回数を超えたため、一時的にロック中です。15分後に再試行してください。";
  }
  return "メールアドレスまたはパスワードが一致しません。";
}

function normalizeApprovalStatus(value: unknown): UserApprovalStatus {
  if (value === "approved" || value === "pending" || value === "rejected") {
    return value;
  }
  return "approved";
}

function canUseTool(user: AuthUser): boolean {
  return user.active && user.approvalStatus === "approved";
}

type LoginGuard = {
  failedCount: number;
  lockUntil?: number;
  updatedAt: number;
};

type LoginGuardMap = Record<string, LoginGuard>;

function nowMs(): number {
  return Date.now();
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isAuthUsersSnapshot(value: unknown): value is AuthUsersSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }
  const users = (value as { users?: unknown }).users;
  return Array.isArray(users);
}

function isAuthUserLike(value: unknown): value is AuthUser {
  if (!value || typeof value !== "object") {
    return false;
  }
  const user = value as Partial<AuthUser>;
  return typeof user.id === "string"
    && typeof user.name === "string"
    && typeof user.email === "string"
    && typeof user.role === "string"
    && typeof user.active === "boolean"
    && typeof user.approvalStatus === "string";
}

function normalizeAuthFailureReason(value: unknown): AuthLoginFailureReason | undefined {
  if (
    value === "missing"
    || value === "not_registered"
    || value === "invalid_password"
    || value === "inactive"
    || value === "pending_approval"
    || value === "rejected"
    || value === "locked"
    || value === "unavailable"
  ) {
    return value;
  }
  return undefined;
}

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<{ ok: boolean; status: number; body: T | null }> {
  try {
    const response = await fetch(input, {
      credentials: "same-origin",
      cache: "no-store",
      ...init,
    });
    const body = (await response.json().catch(() => null)) as T | null;
    return {
      ok: response.ok,
      status: response.status,
      body,
    };
  } catch {
    return {
      ok: false,
      status: 0,
      body: null,
    };
  }
}

function storeAuthenticatedUsers(users: AuthUser[], currentUserId?: string): AuthUser[] {
  const normalized = persistUsers(users, { syncRemote: false });
  const resolvedCurrentUserId = currentUserId ?? normalized[0]?.id ?? "";
  if (resolvedCurrentUserId) {
    writeSession(resolvedCurrentUserId);
  }
  return normalized;
}

function loadLoginGuardMap(): LoginGuardMap {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = localStorage.getItem(LOGIN_GUARD_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as LoginGuardMap) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveLoginGuardMap(map: LoginGuardMap): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(LOGIN_GUARD_STORAGE_KEY, JSON.stringify(map));
}

function getLoginGuard(email: string): LoginGuard | null {
  const key = normalizeEmail(email);
  if (!key) {
    return null;
  }
  const map = loadLoginGuardMap();
  const guard = map[key];
  if (!guard) {
    return null;
  }
  if (guard.lockUntil && guard.lockUntil <= nowMs()) {
    delete map[key];
    saveLoginGuardMap(map);
    return null;
  }
  return guard;
}

function markLoginFailed(email: string): void {
  const key = normalizeEmail(email);
  if (!key) {
    return;
  }
  const map = loadLoginGuardMap();
  const current = map[key];
  const nextFailed = (current?.failedCount ?? 0) + 1;
  const next: LoginGuard = {
    failedCount: nextFailed,
    updatedAt: nowMs(),
    lockUntil: nextFailed >= MAX_FAILED_ATTEMPTS ? nowMs() + LOGIN_LOCK_WINDOW_MS : current?.lockUntil,
  };
  map[key] = next;
  saveLoginGuardMap(map);
}

function clearLoginGuard(email: string): void {
  const key = normalizeEmail(email);
  if (!key) {
    return;
  }
  const map = loadLoginGuardMap();
  if (map[key]) {
    delete map[key];
    saveLoginGuardMap(map);
  }
}

type SessionPayload = {
  userId: string;
  expiresAt: number;
  lastActivityAt: number;
};

function parseSessionPayload(raw: string | null): SessionPayload | null {
  if (!raw) {
    return null;
  }
  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as Partial<SessionPayload>;
      if (!parsed?.userId || typeof parsed.userId !== "string") {
        return null;
      }
      if (typeof parsed.expiresAt !== "number") {
        return null;
      }
      return {
        userId: parsed.userId,
        expiresAt: parsed.expiresAt,
        lastActivityAt: typeof parsed.lastActivityAt === "number" ? parsed.lastActivityAt : parsed.expiresAt,
      };
    } catch {
      return null;
    }
  }
  // legacy: previous versions stored userId directly
  const now = nowMs();
  return { userId: raw, expiresAt: now + SESSION_TTL_MS, lastActivityAt: now };
}

function writeSession(userId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  const now = nowMs();
  const payload: SessionPayload = {
    userId,
    expiresAt: now + SESSION_TTL_MS,
    lastActivityAt: now,
  };
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
}

let lastSessionTouchAt = 0;

export function touchSessionActivity(): void {
  if (typeof window === "undefined") {
    return;
  }
  const now = nowMs();
  if (now - lastSessionTouchAt < SESSION_ACTIVITY_WRITE_THROTTLE_MS) {
    return;
  }
  const sessionRaw = localStorage.getItem(SESSION_STORAGE_KEY);
  const session = parseSessionPayload(sessionRaw);
  if (!session) {
    return;
  }
  if (session.expiresAt < now) {
    clearSession();
    return;
  }
  if (now - session.lastActivityAt > SESSION_INACTIVITY_TIMEOUT_MS) {
    clearSession();
    return;
  }
  const nextPayload: SessionPayload = {
    userId: session.userId,
    expiresAt: session.expiresAt,
    lastActivityAt: now,
  };
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextPayload));
  lastSessionTouchAt = now;
}

function sanitizeUsers(users: AuthUser[]): AuthUser[] {
  if (!Array.isArray(users)) {
    return [];
  }
  const sanitized = users.map((user) => {
    const normalizedEmail = normalizeEmail(typeof user.email === "string" ? user.email : "");
    const normalizedRole: AuthRole =
      user.role === "system_admin" || user.role === "admin" || user.role === "editor" || user.role === "viewer"
        ? user.role
        : "editor";
    const normalizedApprovalStatus: UserApprovalStatus =
      normalizedRole === "system_admin" ? "approved" : normalizeApprovalStatus(user.approvalStatus);
    const createdAt =
      typeof user.createdAt === "string" && user.createdAt
        ? user.createdAt
        : (typeof user.approvedAt === "string" && user.approvedAt
          ? user.approvedAt
          : (typeof user.lastLoginAt === "string" && user.lastLoginAt ? user.lastLoginAt : new Date().toISOString()));
    return {
      ...user,
      name: canonicalizeKnownPersonName(typeof user.name === "string" ? user.name : "", normalizedEmail || user.email),
      email: normalizedEmail || user.email,
      password: "",
      active: normalizedRole === "system_admin" ? true : (typeof user.active === "boolean" ? user.active : true),
      role: normalizedRole,
      approvalStatus: normalizedApprovalStatus,
      createdAt,
      approvedAt:
        normalizedApprovalStatus === "approved"
          ? (typeof user.approvedAt === "string" && user.approvedAt
            ? user.approvedAt
            : (typeof createdAt === "string" && createdAt ? createdAt : undefined))
          : undefined,
      approvedById:
        normalizedApprovalStatus === "approved"
          ? (typeof user.approvedById === "string" && user.approvedById ? user.approvedById : user.createdById || "system")
          : user.approvedById,
      approvedByName:
        normalizedApprovalStatus === "approved"
          ? (() => {
              if (normalizedRole === "system_admin") {
                return "システム管理者";
              }
              const label = canonicalizeKnownPersonName(typeof user.approvedByName === "string" ? user.approvedByName.trim() : "");
              if (normalizedRole === "admin" && (!label || label === "システム" || label === "システム登録")) {
                return "管理者";
              }
              if (label) {
                return label;
              }
              return canonicalizeKnownPersonName(user.createdByName || "システム登録");
            })()
          : canonicalizeKnownPersonName(typeof user.approvedByName === "string" ? user.approvedByName : ""),
      createdByName: canonicalizeKnownPersonName(typeof user.createdByName === "string" ? user.createdByName : "", normalizedEmail || user.email),
    };
  });

  const dedupedByEmail = new Map<string, AuthUser>();
  sanitized.forEach((user) => {
    const key = normalizeEmail(user.email);
    if (!key) {
      return;
    }
    const previous = dedupedByEmail.get(key);
    if (!previous || getUserPriorityScore(user) > getUserPriorityScore(previous)) {
      dedupedByEmail.set(key, user);
    }
  });
  const dedupedUsers = Array.from(dedupedByEmail.values());

  const hasActiveApprover = dedupedUsers.some(
    (user) => isApproverRole(user.role) && user.active && user.approvalStatus === "approved",
  );
  if (hasActiveApprover) {
    return dedupedUsers;
  }

  const promoteIndex = dedupedUsers.findIndex((user) => user.active);
  if (promoteIndex < 0) {
    return dedupedUsers;
  }

  return dedupedUsers.map((user, index) =>
    index === promoteIndex
      ? { ...user, role: "admin" as const }
      : user,
  );
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
}

function syncSharedSnapshotInBackground(): void {
  if (typeof window === "undefined") {
    return;
  }
  if (!getSessionUser()) {
    return;
  }
  void pushSharedStorageSnapshot();
}

function persistUsers(users: AuthUser[], options?: { syncRemote?: boolean }): AuthUser[] {
  if (typeof window === "undefined") {
    return sanitizeUsers(users);
  }
  const normalized = sanitizeUsers(users);
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(normalized));
  if (options?.syncRemote !== false && normalized.length > 0) {
    void pushAuthUsersSnapshot(normalized);
  }
  return normalized;
}

async function requestAuthUsersPush(
  users: AuthUser[],
  baseUpdatedAt: string | null,
): Promise<{ ok: true; updatedAt?: string } | { ok: false; status?: number; payload?: AuthUser[]; updatedAt?: string }> {
  try {
    const response = await fetch(AUTH_USERS_API_PATH, {
      method: "PUT",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payload: { users },
        baseUpdatedAt,
      }),
    });
    const body = (await response.json().catch(() => null)) as AuthUsersPushResponse | null;
    if (response.ok) {
      return {
        ok: true,
        updatedAt: typeof body?.updatedAt === "string" ? body.updatedAt : undefined,
      };
    }
    if (response.status === 409 && isAuthUsersSnapshot(body?.payload)) {
      return {
        ok: false,
        status: 409,
        payload: sanitizeUsers(body.payload.users),
        updatedAt: typeof body?.updatedAt === "string" ? body.updatedAt : undefined,
      };
    }
    return { ok: false, status: response.status };
  } catch {
    return { ok: false };
  }
}

export async function pullAuthUsersSnapshot(): Promise<{ ok: boolean; exists: boolean; count: number; access?: "metadata" | "admin" | "self" }> {
  if (typeof window === "undefined") {
    return { ok: false, exists: false, count: 0 };
  }
  try {
    const response = await fetch(AUTH_USERS_API_PATH, {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) {
      return { ok: false, exists: false, count: 0 };
    }
    const body = (await response.json()) as AuthUsersPullResponse;
    if (body.ok !== true) {
      return { ok: false, exists: false, count: 0 };
    }
    const access = body.access === "metadata" || body.access === "admin" || body.access === "self" ? body.access : undefined;
    const count = typeof body.count === "number" && Number.isFinite(body.count) ? body.count : 0;
    if (body.exists === false) {
      lastPulledAuthUsersUpdatedAt = null;
      return { ok: true, exists: false, count: 0, access };
    }
    if (access === "metadata") {
      if (typeof body.updatedAt === "string") {
        lastPulledAuthUsersUpdatedAt = body.updatedAt;
      }
      return { ok: true, exists: true, count, access };
    }
    if (!isAuthUsersSnapshot(body.payload)) {
      return { ok: false, exists: true, count, access };
    }
    const users = persistUsers(body.payload.users, { syncRemote: false });
    lastPulledAuthUsersUpdatedAt = typeof body.updatedAt === "string" ? body.updatedAt : null;
    return { ok: true, exists: true, count: count || users.length, access };
  } catch {
    return { ok: false, exists: false, count: 0 };
  }
}

export async function pushAuthUsersSnapshot(usersArg?: AuthUser[]): Promise<boolean> {
  if (typeof window === "undefined") {
    return false;
  }
  const localUsers = sanitizeUsers(usersArg ?? ensureUsers());
  if (!localUsers.length) {
    return false;
  }

  const firstAttempt = await requestAuthUsersPush(localUsers, lastPulledAuthUsersUpdatedAt);
  if (firstAttempt.ok) {
    if (firstAttempt.updatedAt) {
      lastPulledAuthUsersUpdatedAt = firstAttempt.updatedAt;
    }
    return true;
  }

  if (firstAttempt.status !== 409 || !firstAttempt.payload) {
    return false;
  }

  if (firstAttempt.updatedAt) {
    lastPulledAuthUsersUpdatedAt = firstAttempt.updatedAt;
  }
  const mergedUsers = sanitizeUsers([...localUsers, ...firstAttempt.payload]);
  persistUsers(mergedUsers, { syncRemote: false });

  if (JSON.stringify(mergedUsers) === JSON.stringify(firstAttempt.payload)) {
    return true;
  }

  const retryAttempt = await requestAuthUsersPush(mergedUsers, lastPulledAuthUsersUpdatedAt);
  if (retryAttempt.ok) {
    if (retryAttempt.updatedAt) {
      lastPulledAuthUsersUpdatedAt = retryAttempt.updatedAt;
    }
    return true;
  }
  return false;
}

export function ensureUsers(): AuthUser[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as AuthUser[]) : [];
    if (Array.isArray(parsed)) {
      const normalized = sanitizeUsers(parsed);
      if (JSON.stringify(normalized) !== JSON.stringify(parsed)) {
        persistUsers(normalized, { syncRemote: false });
      }
      return normalized;
    }
  } catch {
    return [];
  }
  return [];
}

export function hasRegisteredUsers(): boolean {
  return ensureUsers().length > 0;
}

export async function registerInitialAdmin(_name: string, _email: string, _password: string): Promise<AuthUser | null> {
  if (typeof window === "undefined") {
    return null;
  }
  const name = _name.trim();
  const email = normalizeEmail(_email);
  const password = _password.trim();
  if (!name || !email || !password) {
    return null;
  }
  const response = await requestJson<AuthSessionResponse>(AUTH_REGISTER_API_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "initial",
      name,
      email,
      password,
    }),
  });
  if (!response.ok || response.body?.ok !== true || !isAuthUserLike(response.body.user)) {
    return null;
  }
  const authenticatedUser = response.body.user;
  const users = Array.isArray(response.body.users) && response.body.users.every((user) => isAuthUserLike(user))
    ? response.body.users
    : [authenticatedUser];
  const persistedUsers = storeAuthenticatedUsers(users, authenticatedUser.id);
  return persistedUsers.find((user) => user.id === authenticatedUser.id) ?? authenticatedUser;
}

export async function registerInitialAdminWithGoogle(_name: string, _email: string): Promise<AuthUser | null> {
  const result = await loginWithGoogleEmail(_email, "login_page", _name);
  return result.user;
}

export async function registerSelfUser(name: string, email: string, password: string): Promise<{ user: AuthUser | null; error?: string }> {
  if (typeof window === "undefined") {
    return { user: null, error: "client_only" };
  }
  const trimmedName = name.trim();
  const trimmedEmail = normalizeEmail(email);
  const trimmedPassword = password.trim();
  if (!trimmedName || !trimmedEmail || !trimmedPassword) {
    return { user: null, error: "missing" };
  }
  const response = await requestJson<AuthSessionResponse>(AUTH_REGISTER_API_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "self",
      name: trimmedName,
      email: trimmedEmail,
      password: trimmedPassword,
    }),
  });
  if (!response.ok || response.body?.ok !== true || !isAuthUserLike(response.body.user)) {
    if (response.status === 409 && response.body?.error === "duplicate_email") {
      return { user: null, error: "duplicate_email" };
    }
    return { user: null, error: "request_failed" };
  }
  const createdUser = response.body.user;
  persistUsers([
    createdUser,
    ...ensureUsers().filter((user) => normalizeEmail(user.email) !== trimmedEmail),
  ], { syncRemote: false });
  return { user: createdUser };
}

export async function createUserByAdmin(
  name: string,
  email: string,
  password: string,
  role: AuthRole,
): Promise<{ user: AuthUser | null; users: AuthUser[]; error?: string }> {
  if (typeof window === "undefined") {
    return { user: null, users: [], error: "client_only" };
  }
  const trimmedName = name.trim();
  const trimmedEmail = normalizeEmail(email);
  const trimmedPassword = password.trim();
  if (!trimmedName || !trimmedEmail || !trimmedPassword) {
    return { user: null, users: [], error: "missing" };
  }

  const response = await requestJson<AuthSessionResponse>(AUTH_USERS_API_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: trimmedName,
      email: trimmedEmail,
      password: trimmedPassword,
      role,
    }),
  });

  if (!response.ok || response.body?.ok !== true || !isAuthUserLike(response.body.user)) {
    if (response.status === 409 && response.body?.error === "duplicate_email") {
      return { user: null, users: [], error: "duplicate_email" };
    }
    if (response.status === 403) {
      return { user: null, users: [], error: "forbidden" };
    }
    return { user: null, users: [], error: "request_failed" };
  }

  const createdUser = response.body.user;
  const users = Array.isArray(response.body.users) && response.body.users.every((user) => isAuthUserLike(user))
    ? persistUsers(response.body.users, { syncRemote: false })
    : persistUsers([createdUser, ...ensureUsers().filter((user) => user.id !== createdUser.id)], { syncRemote: false });

  return {
    user: users.find((user) => user.id === createdUser.id) ?? createdUser,
    users,
  };
}

export function getLoginAttempts(): LoginAttemptLog[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = localStorage.getItem(ACCESS_LOG_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as LoginAttemptLog[]) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }
    const normalized = parsed.map((entry) => ({
      ...entry,
      userName: canonicalizeKnownPersonName(typeof entry.userName === "string" ? entry.userName : "", entry.email),
    }));
    if (JSON.stringify(normalized) !== JSON.stringify(parsed)) {
      localStorage.setItem(ACCESS_LOG_STORAGE_KEY, JSON.stringify(normalized));
    }
    return normalized;
  } catch {
    return [];
  }
}

export function appendLoginAttempt(entry: Omit<LoginAttemptLog, "id" | "at">): void {
  if (typeof window === "undefined") {
    return;
  }
  const next: LoginAttemptLog = {
    id: uid("access"),
    at: new Date().toISOString(),
    ...entry,
    userName: canonicalizeKnownPersonName(entry.userName, entry.email),
  };
  const logs = getLoginAttempts();
  localStorage.setItem(ACCESS_LOG_STORAGE_KEY, JSON.stringify([next, ...logs].slice(0, MAX_ACCESS_LOGS)));
  syncSharedSnapshotInBackground();
}

export function getSessionUser(): AuthUser | null {
  const state = getSessionState();
  return state.user;
}

export function getSessionState(): { user: AuthUser | null; reason: SessionStateReason } {
  if (typeof window === "undefined") {
    return { user: null, reason: "missing" };
  }
  const users = ensureUsers();
  const sessionRaw = localStorage.getItem(SESSION_STORAGE_KEY);
  const session = parseSessionPayload(sessionRaw);
  if (!session) {
    return { user: null, reason: "missing" };
  }
  if (session.expiresAt < nowMs()) {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return { user: null, reason: "expired" };
  }
  if (nowMs() - session.lastActivityAt > SESSION_INACTIVITY_TIMEOUT_MS) {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return { user: null, reason: "inactive_timeout" };
  }
  const found = users.find((user) => user.id === session.userId);
  if (!found || !canUseTool(found)) {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return { user: null, reason: "user_unavailable" };
  }
  return { user: found, reason: "active" };
}

export function getSessionStateMessage(reason: SessionStateReason): string {
  if (reason === "expired") {
    return "セッションの有効期限が切れたため、再ログインしてください。";
  }
  if (reason === "inactive_timeout") {
    return "操作が一定時間なかったため、再ログインしてください。";
  }
  if (reason === "user_unavailable") {
    return "利用権限が確認できなかったため、再ログインしてください。";
  }
  return "ログインして続行してください。";
}

export async function loginWithCredentials(
  email: string,
  password: string,
  source: "login_page" | "tracking_page" = "login_page",
): Promise<AuthLoginResult> {
  if (typeof window === "undefined") {
    return { user: null, reason: "missing" };
  }
  const targetEmail = normalizeEmail(email);
  if (!targetEmail || !password.trim()) {
    return { user: null, reason: "missing" };
  }
  const guard = getLoginGuard(targetEmail);
  if (guard?.lockUntil && guard.lockUntil > nowMs()) {
    appendLoginAttempt({ email: targetEmail, userName: "-", result: "failed", source });
    return { user: null, reason: "locked" };
  }
  const response = await requestJson<AuthSessionResponse>(AUTH_LOGIN_API_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: targetEmail,
      password,
    }),
  });
  const body = response.body;
  const failureReason = normalizeAuthFailureReason(body?.reason) ?? (!response.ok ? "unavailable" : undefined);
  if (!response.ok || body?.ok !== true || !isAuthUserLike(body.user)) {
    if (failureReason === "not_registered" || failureReason === "invalid_password") {
      markLoginFailed(targetEmail);
    }
    appendLoginAttempt({ email: targetEmail, userName: "-", result: "failed", source });
    return { user: null, reason: failureReason ?? "unavailable" };
  }
  const authenticatedUser = body.user;
  const responseUsers = Array.isArray(body.users) && body.users.every((user) => isAuthUserLike(user))
    ? body.users
    : [authenticatedUser];
  const persistedUsers = storeAuthenticatedUsers(responseUsers, authenticatedUser.id);
  const loggedInUser = persistedUsers.find((user) => user.id === authenticatedUser.id) ?? authenticatedUser;
  clearLoginGuard(targetEmail);
  appendLoginAttempt({ email: loggedInUser.email, userName: loggedInUser.name, result: "success", source });
  syncSharedSnapshotInBackground();
  return { user: loggedInUser };
}

export async function loginWithGoogleEmail(
  email: string,
  source: "login_page" | "tracking_page" = "login_page",
  name?: string,
): Promise<AuthLoginResult> {
  if (typeof window === "undefined") {
    return { user: null, reason: "missing" };
  }
  const targetEmail = normalizeEmail(email);
  if (!targetEmail) {
    return { user: null, reason: "missing" };
  }
  const guard = getLoginGuard(targetEmail);
  if (guard?.lockUntil && guard.lockUntil > nowMs()) {
    appendLoginAttempt({ email: targetEmail, userName: "-", result: "failed", source });
    return { user: null, reason: "locked" };
  }
  const response = await requestJson<AuthSessionResponse>(AUTH_GOOGLE_LOGIN_API_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: targetEmail,
      name: name ? canonicalizeKnownPersonName(name, targetEmail) : undefined,
    }),
  });
  const body = response.body;
  const failureReason = normalizeAuthFailureReason(body?.reason) ?? (!response.ok ? "unavailable" : undefined);
  if (!response.ok || body?.ok !== true || !isAuthUserLike(body.user)) {
    if (failureReason === "not_registered") {
      markLoginFailed(targetEmail);
    }
    appendLoginAttempt({ email: targetEmail, userName: "-", result: "failed", source });
    return { user: null, reason: failureReason ?? "unavailable" };
  }
  const authenticatedUser = body.user;
  const responseUsers = Array.isArray(body.users) && body.users.every((user) => isAuthUserLike(user))
    ? body.users
    : [authenticatedUser];
  const persistedUsers = storeAuthenticatedUsers(responseUsers, authenticatedUser.id);
  const loggedInUser = persistedUsers.find((user) => user.id === authenticatedUser.id) ?? authenticatedUser;
  clearLoginGuard(targetEmail);
  appendLoginAttempt({ email: loggedInUser.email, userName: loggedInUser.name, result: "success", source });
  syncSharedSnapshotInBackground();
  return { user: loggedInUser };
}

export function clearSession(): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.removeItem(SESSION_STORAGE_KEY);
  void fetch(AUTH_LOGOUT_API_PATH, {
    method: "POST",
    credentials: "same-origin",
  }).catch(() => undefined);
}
