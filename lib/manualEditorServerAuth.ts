import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server.js";
import { readManualEditorState, writeManualEditorState } from "./manualEditorStateStore";

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

type AuthUsersPayload = {
  users: AuthUser[];
};

type SessionClaims = {
  userId: string;
  expiresAt: number;
};

const AUTH_USERS_STATE_ID = "auth_users_v1";
const SESSION_COOKIE_NAME = "sekou_manual_editor_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const PASSWORD_HASH_PREFIX = "scrypt_v1";
const PASSWORD_HASH_BYTES = 64;
const KNOWN_USER_NAME_BY_EMAIL: Record<string, string> = {
  "h.adachi@denryoku.co.jp": "安達広樹",
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

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

function normalizeApprovalStatus(value: unknown): UserApprovalStatus {
  if (value === "approved" || value === "pending" || value === "rejected") {
    return value;
  }
  return "approved";
}

function isAuthRole(value: unknown): value is AuthRole {
  return value === "system_admin" || value === "admin" || value === "editor" || value === "viewer";
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

function constantTimeStringEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function isPasswordHash(value: string): boolean {
  return value.startsWith(`${PASSWORD_HASH_PREFIX}$`);
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("base64url");
  const digest = scryptSync(password, salt, PASSWORD_HASH_BYTES).toString("base64url");
  return `${PASSWORD_HASH_PREFIX}$${salt}$${digest}`;
}

function normalizeStoredPassword(inputPassword: string, previousPassword: string): string {
  const trimmedInput = inputPassword.trim();
  if (trimmedInput) {
    return isPasswordHash(trimmedInput) ? trimmedInput : hashPassword(trimmedInput);
  }
  if (!previousPassword) {
    return "";
  }
  return isPasswordHash(previousPassword) ? previousPassword : hashPassword(previousPassword);
}

function resolvePreviousUser(previousUsers: AuthUser[], nextUser: Partial<AuthUser>): AuthUser | undefined {
  const byId = typeof nextUser.id === "string" && nextUser.id
    ? previousUsers.find((user) => user.id === nextUser.id)
    : undefined;
  if (byId) {
    return byId;
  }
  const normalizedEmail = normalizeEmail(typeof nextUser.email === "string" ? nextUser.email : "");
  if (!normalizedEmail) {
    return undefined;
  }
  return previousUsers.find((user) => normalizeEmail(user.email) === normalizedEmail);
}

export function verifyManualEditorPassword(password: string, storedPassword: string): boolean {
  const normalizedPassword = password.trim();
  if (!normalizedPassword || !storedPassword) {
    return false;
  }
  if (!isPasswordHash(storedPassword)) {
    return constantTimeStringEquals(storedPassword, normalizedPassword);
  }
  const [, salt, digest] = storedPassword.split("$");
  if (!salt || !digest) {
    return false;
  }
  const expected = Buffer.from(digest, "base64url");
  const actual = Buffer.from(scryptSync(normalizedPassword, salt, PASSWORD_HASH_BYTES).toString("base64url"), "base64url");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function redactAuthUser(user: AuthUser): AuthUser {
  return {
    ...user,
    password: "",
  };
}

export function redactAuthUsers(users: AuthUser[]): AuthUser[] {
  return users.map((user) => redactAuthUser(user));
}

export function pickPreferredCandidate(candidates: AuthUser[]): AuthUser | null {
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

function sanitizeUsers(users: AuthUser[], previousUsers: AuthUser[] = []): AuthUser[] {
  if (!Array.isArray(users)) {
    return [];
  }
  const sanitized = users.map((user) => {
    const normalizedEmail = normalizeEmail(typeof user.email === "string" ? user.email : "");
    const previousUser = resolvePreviousUser(previousUsers, user);
    const normalizedRole: AuthRole =
      user.role === "system_admin" || user.role === "admin" || user.role === "editor" || user.role === "viewer"
        ? user.role
        : "editor";
    const normalizedApproval = normalizedRole === "system_admin" ? "approved" : normalizeApprovalStatus(user.approvalStatus);
    const createdAt =
      typeof user.createdAt === "string" && user.createdAt
        ? user.createdAt
        : (typeof user.approvedAt === "string" && user.approvedAt ? user.approvedAt : new Date().toISOString());
    return {
      ...user,
      name: canonicalizeKnownPersonName(typeof user.name === "string" ? user.name : "", normalizedEmail || user.email),
      email: normalizedEmail || user.email,
      password: normalizeStoredPassword(
        typeof user.password === "string" ? user.password : "",
        typeof previousUser?.password === "string" ? previousUser.password : "",
      ),
      active: normalizedRole === "system_admin" ? true : (typeof user.active === "boolean" ? user.active : true),
      role: normalizedRole,
      approvalStatus: normalizedApproval,
      createdAt,
      approvedAt:
        normalizedApproval === "approved"
          ? (typeof user.approvedAt === "string" && user.approvedAt ? user.approvedAt : createdAt)
          : undefined,
      approvedById:
        normalizedApproval === "approved"
          ? (typeof user.approvedById === "string" && user.approvedById ? user.approvedById : user.createdById || "system")
          : user.approvedById,
      approvedByName:
        normalizedApproval === "approved"
          ? (() => {
              if (normalizedRole === "system_admin") {
                return "システム管理者";
              }
              const label = canonicalizeKnownPersonName(typeof user.approvedByName === "string" ? user.approvedByName.trim() : "");
              return label || canonicalizeKnownPersonName(user.createdByName || "システム登録");
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

  return Array.from(dedupedByEmail.values());
}

function isOptionalString(value: unknown): value is string | undefined {
  return typeof value === "undefined" || typeof value === "string";
}

function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== "object") {
    return false;
  }
  const user = value as Record<string, unknown>;
  return typeof user.id === "string"
    && typeof user.name === "string"
    && typeof user.email === "string"
    && typeof user.password === "string"
    && isAuthRole(user.role)
    && typeof user.active === "boolean"
    && (user.approvalStatus === "approved" || user.approvalStatus === "pending" || user.approvalStatus === "rejected")
    && isOptionalString(user.approvedAt)
    && isOptionalString(user.approvedById)
    && isOptionalString(user.approvedByName)
    && isOptionalString(user.createdAt)
    && isOptionalString(user.createdById)
    && isOptionalString(user.createdByName)
    && isOptionalString(user.lastLoginAt);
}

export function isAuthUsersPayload(value: unknown): value is AuthUsersPayload {
  if (!value || typeof value !== "object") {
    return false;
  }
  const users = (value as { users?: unknown }).users;
  return Array.isArray(users) && users.every((user) => isAuthUser(user));
}

export async function readAuthUsersState() {
  const stored = await readManualEditorState(AUTH_USERS_STATE_ID, isAuthUsersPayload);
  if (!stored.exists || !stored.payload) {
    return {
      exists: false,
      updatedAt: stored.updatedAt,
      payload: { users: [] as AuthUser[] },
    };
  }
  return {
    exists: true,
    updatedAt: stored.updatedAt,
    payload: { users: sanitizeUsers(stored.payload.users) },
  };
}

export async function writeAuthUsersState(payload: AuthUsersPayload, baseUpdatedAt: string | null) {
  const existing = await readAuthUsersState();
  return writeManualEditorState(
    AUTH_USERS_STATE_ID,
    { users: sanitizeUsers(payload.users, existing.payload.users) },
    baseUpdatedAt,
    isAuthUsersPayload,
  );
}

function getSessionSecret(): string {
  const candidates = [
    process.env.MANUAL_EDITOR_SESSION_SECRET,
    process.env.NEXTAUTH_SECRET,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.BLOB_READ_WRITE_TOKEN,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return "dev-only-manual-editor-session-secret";
}

function signValue(value: string): string {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function encodeSessionToken(claims: SessionClaims): string {
  const payload = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  const signature = signValue(payload);
  return `${payload}.${signature}`;
}

function decodeSessionToken(token: string | undefined): SessionClaims | null {
  if (!token) {
    return null;
  }
  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return null;
  }
  const expected = signValue(payload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<SessionClaims>;
    if (!parsed.userId || typeof parsed.userId !== "string" || typeof parsed.expiresAt !== "number") {
      return null;
    }
    if (parsed.expiresAt < Date.now()) {
      return null;
    }
    return {
      userId: parsed.userId,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

export function applyManualEditorSessionCookie(response: NextResponse, userId: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, encodeSessionToken({
    userId,
    expiresAt: Date.now() + SESSION_TTL_MS,
  }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export function clearManualEditorSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getAuthenticatedManualEditorUser(request: NextRequest): Promise<AuthUser | null> {
  const claims = decodeSessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!claims) {
    return null;
  }
  const stored = await readAuthUsersState();
  const user = stored.payload.users.find((item) => item.id === claims.userId) ?? null;
  if (!user || !user.active || user.approvalStatus !== "approved") {
    return null;
  }
  return user;
}

export async function requireManualEditorUser(
  request: NextRequest,
  options?: { adminOnly?: boolean },
): Promise<{ ok: true; user: AuthUser } | { ok: false; response: NextResponse }> {
  const user = await getAuthenticatedManualEditorUser(request);
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }),
    };
  }
  if (options?.adminOnly && user.role !== "system_admin" && user.role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }),
    };
  }
  return { ok: true, user };
}
