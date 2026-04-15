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
  | "locked";

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

export const USERS_STORAGE_KEY = "sekou-tool-users-v1";
export const SESSION_STORAGE_KEY = "sekou-tool-session-v1";
export const ACCESS_LOG_STORAGE_KEY = "sekou-auth-attempts-v1";
export const LOGIN_GUARD_STORAGE_KEY = "sekou-auth-login-guard-v1";
const MAX_ACCESS_LOGS = 500;
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const SESSION_INACTIVITY_TIMEOUT_MS = 1000 * 60 * 60;
const SESSION_ACTIVITY_WRITE_THROTTLE_MS = 15000;
const LOGIN_LOCK_WINDOW_MS = 1000 * 60 * 15;
const MAX_FAILED_ATTEMPTS = 5;
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
      password: typeof user.password === "string" ? user.password : "",
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
  void pushSharedStorageSnapshot();
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
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(normalized));
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

export function registerInitialAdmin(_name: string, _email: string, _password: string): AuthUser | null {
  if (typeof window === "undefined") {
    return null;
  }
  const name = _name.trim();
  const email = normalizeEmail(_email);
  const password = _password.trim();
  if (!name || !email || !password) {
    return null;
  }
  const users = ensureUsers();
  if (users.length > 0) {
    return null;
  }
  const next: AuthUser = {
    id: uid("user"),
    name,
    email,
    password,
    role: "system_admin",
    active: true,
    approvalStatus: "approved",
    approvedAt: new Date().toISOString(),
    approvedById: "self",
    approvedByName: "システム管理者",
    createdAt: new Date().toISOString(),
    createdById: "self",
    createdByName: "初期登録",
  };
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(sanitizeUsers([next])));
  syncSharedSnapshotInBackground();
  return next;
}

export function registerInitialAdminWithGoogle(_name: string, _email: string): AuthUser | null {
  if (typeof window === "undefined") {
    return null;
  }
  const name = canonicalizeKnownPersonName(_name.trim(), _email);
  const email = normalizeEmail(_email);
  if (!name || !email) {
    return null;
  }
  const users = ensureUsers();
  if (users.length > 0) {
    return null;
  }
  const now = new Date().toISOString();
  const next: AuthUser = {
    id: uid("user"),
    name,
    email,
    password: uid("google_login"),
    role: "system_admin",
    active: true,
    approvalStatus: "approved",
    approvedAt: now,
    approvedById: "self_google",
    approvedByName: "Google認証",
    createdAt: now,
    createdById: "self_google",
    createdByName: "Google認証",
  };
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(sanitizeUsers([next])));
  syncSharedSnapshotInBackground();
  return next;
}

export function registerSelfUser(name: string, email: string, password: string): { user: AuthUser | null; error?: string } {
  if (typeof window === "undefined") {
    return { user: null, error: "client_only" };
  }
  const trimmedName = name.trim();
  const trimmedEmail = normalizeEmail(email);
  const trimmedPassword = password.trim();
  if (!trimmedName || !trimmedEmail || !trimmedPassword) {
    return { user: null, error: "missing" };
  }
  const users = ensureUsers();
  if (users.some((user) => normalizeEmail(user.email) === trimmedEmail)) {
    return { user: null, error: "duplicate_email" };
  }
  const next: AuthUser = {
    id: uid("user"),
    name: trimmedName,
    email: trimmedEmail,
    password: trimmedPassword,
    role: "editor",
    active: true,
    approvalStatus: "pending",
    createdAt: new Date().toISOString(),
    createdById: "self_signup",
    createdByName: "本人申請（セルフ登録）",
  };
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(sanitizeUsers([next, ...users])));
  syncSharedSnapshotInBackground();
  return { user: next };
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
  if (typeof window === "undefined") {
    return null;
  }
  const users = ensureUsers();
  const sessionRaw = localStorage.getItem(SESSION_STORAGE_KEY);
  const session = parseSessionPayload(sessionRaw);
  if (!session) {
    return null;
  }
  if (session.expiresAt < nowMs()) {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
  if (nowMs() - session.lastActivityAt > SESSION_INACTIVITY_TIMEOUT_MS) {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
  const found = users.find((user) => user.id === session.userId);
  if (!found || !canUseTool(found)) {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
  return found;
}

export function loginWithCredentials(
  email: string,
  password: string,
  source: "login_page" | "tracking_page" = "login_page",
): AuthLoginResult {
  if (typeof window === "undefined") {
    return { user: null, reason: "missing" };
  }
  const users = ensureUsers();
  const targetEmail = normalizeEmail(email);
  if (!targetEmail || !password.trim()) {
    return { user: null, reason: "missing" };
  }
  const guard = getLoginGuard(targetEmail);
  if (guard?.lockUntil && guard.lockUntil > nowMs()) {
    appendLoginAttempt({ email: targetEmail, userName: "-", result: "failed", source });
    return { user: null, reason: "locked" };
  }
  const candidates = users.filter((user) => normalizeEmail(user.email) === targetEmail);
  if (!candidates.length) {
    markLoginFailed(targetEmail);
    appendLoginAttempt({ email: targetEmail, userName: "-", result: "failed", source });
    return { user: null, reason: "not_registered" };
  }
  const passwordMatched = candidates.filter((user) => user.password === password);
  const foundByEmail = pickPreferredCandidate(passwordMatched.length ? passwordMatched : candidates);
  if (!foundByEmail) {
    markLoginFailed(targetEmail);
    appendLoginAttempt({ email: targetEmail, userName: "-", result: "failed", source });
    return { user: null, reason: "invalid_password" };
  }
  if (foundByEmail.password !== password) {
    markLoginFailed(targetEmail);
    appendLoginAttempt({ email: targetEmail, userName: "-", result: "failed", source });
    return { user: null, reason: "invalid_password" };
  }
  if (!foundByEmail.active) {
    appendLoginAttempt({ email: targetEmail, userName: foundByEmail.name, result: "failed", source });
    return { user: null, reason: "inactive" };
  }
  if (foundByEmail.approvalStatus === "pending") {
    appendLoginAttempt({ email: targetEmail, userName: foundByEmail.name, result: "failed", source });
    return { user: null, reason: "pending_approval" };
  }
  if (foundByEmail.approvalStatus === "rejected") {
    appendLoginAttempt({ email: targetEmail, userName: foundByEmail.name, result: "failed", source });
    return { user: null, reason: "rejected" };
  }
  const nextUsers = users.map((user) =>
    user.id === foundByEmail.id
      ? { ...user, lastLoginAt: new Date().toISOString() }
      : user,
  );
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(sanitizeUsers(nextUsers)));
  writeSession(foundByEmail.id);
  clearLoginGuard(targetEmail);
  appendLoginAttempt({ email: foundByEmail.email, userName: foundByEmail.name, result: "success", source });
  syncSharedSnapshotInBackground();
  return { user: { ...foundByEmail, lastLoginAt: new Date().toISOString() } };
}

export function loginWithGoogleEmail(
  email: string,
  source: "login_page" | "tracking_page" = "login_page",
): AuthLoginResult {
  if (typeof window === "undefined") {
    return { user: null, reason: "missing" };
  }
  const users = ensureUsers();
  const targetEmail = normalizeEmail(email);
  if (!targetEmail) {
    return { user: null, reason: "missing" };
  }
  const guard = getLoginGuard(targetEmail);
  if (guard?.lockUntil && guard.lockUntil > nowMs()) {
    appendLoginAttempt({ email: targetEmail, userName: "-", result: "failed", source });
    return { user: null, reason: "locked" };
  }
  const found = pickPreferredCandidate(users.filter((user) => normalizeEmail(user.email) === targetEmail));
  if (!found) {
    markLoginFailed(targetEmail);
    appendLoginAttempt({ email: targetEmail, userName: "-", result: "failed", source });
    return { user: null, reason: "not_registered" };
  }
  if (!found.active) {
    appendLoginAttempt({ email: targetEmail, userName: found.name, result: "failed", source });
    return { user: null, reason: "inactive" };
  }
  if (found.approvalStatus === "pending") {
    appendLoginAttempt({ email: targetEmail, userName: found.name, result: "failed", source });
    return { user: null, reason: "pending_approval" };
  }
  if (found.approvalStatus === "rejected") {
    appendLoginAttempt({ email: targetEmail, userName: found.name, result: "failed", source });
    return { user: null, reason: "rejected" };
  }
  const nextUsers = users.map((user) =>
    user.id === found.id
      ? { ...user, lastLoginAt: new Date().toISOString() }
      : user,
  );
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(sanitizeUsers(nextUsers)));
  writeSession(found.id);
  clearLoginGuard(targetEmail);
  appendLoginAttempt({ email: found.email, userName: found.name, result: "success", source });
  syncSharedSnapshotInBackground();
  return { user: { ...found, lastLoginAt: new Date().toISOString() } };
}

export function clearSession(): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.removeItem(SESSION_STORAGE_KEY);
}
