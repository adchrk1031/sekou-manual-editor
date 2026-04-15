import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

type AuthRole = "system_admin" | "admin" | "editor" | "viewer";
type UserApprovalStatus = "approved" | "pending" | "rejected";

type AuthUser = {
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

type SharedStateRow = {
  id: string;
  payload: string;
  updated_at: string;
};

const AUTH_USERS_STATE_ID = "auth_users_v1";
const MAX_USERS = 500;
let ensureSharedStateTablePromise: Promise<void> | null = null;

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

function isAuthRole(value: unknown): value is AuthRole {
  return value === "system_admin" || value === "admin" || value === "editor" || value === "viewer";
}

function isApprovalStatus(value: unknown): value is UserApprovalStatus {
  return value === "approved" || value === "pending" || value === "rejected";
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
    && isApprovalStatus(user.approvalStatus)
    && isOptionalString(user.approvedAt)
    && isOptionalString(user.approvedById)
    && isOptionalString(user.approvedByName)
    && isOptionalString(user.createdAt)
    && isOptionalString(user.createdById)
    && isOptionalString(user.createdByName)
    && isOptionalString(user.lastLoginAt);
}

function isAuthUsersPayload(value: unknown): value is AuthUsersPayload {
  if (!value || typeof value !== "object") {
    return false;
  }
  const users = (value as { users?: unknown }).users;
  return Array.isArray(users) && users.length <= MAX_USERS && users.every((user) => isAuthUser(user));
}

async function ensureSharedStateTable(): Promise<void> {
  if (!ensureSharedStateTablePromise) {
    ensureSharedStateTablePromise = prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS manual_editor_states (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `).then(() => undefined).catch((error) => {
      ensureSharedStateTablePromise = null;
      throw error;
    });
  }
  await ensureSharedStateTablePromise;
}

export async function GET() {
  try {
    await ensureSharedStateTable();
    const rows = await prisma.$queryRawUnsafe<SharedStateRow[]>(
      "SELECT id, payload, updated_at FROM manual_editor_states WHERE id = ? LIMIT 1",
      AUTH_USERS_STATE_ID,
    );
    const row = rows[0];
    if (!row) {
      return NextResponse.json({
        ok: true,
        exists: false,
        payload: { users: [] },
        updatedAt: null,
      });
    }
    const parsed = JSON.parse(row.payload);
    if (!isAuthUsersPayload(parsed)) {
      return NextResponse.json({
        ok: false,
        exists: true,
        error: "invalid_stored_payload",
      }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      exists: true,
      payload: parsed,
      updatedAt: row.updated_at,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "failed_to_load_auth_users" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  let body: { payload?: unknown; baseUpdatedAt?: unknown } = {};
  try {
    body = (await req.json()) as { payload?: unknown; baseUpdatedAt?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (!isAuthUsersPayload(body.payload)) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  try {
    await ensureSharedStateTable();
    const existingRows = await prisma.$queryRawUnsafe<SharedStateRow[]>(
      "SELECT id, payload, updated_at FROM manual_editor_states WHERE id = ? LIMIT 1",
      AUTH_USERS_STATE_ID,
    );
    const existingRow = existingRows[0];
    const baseUpdatedAt = normalizeTimestamp(body.baseUpdatedAt);
    const currentUpdatedAt = normalizeTimestamp(existingRow?.updated_at);

    if (existingRow && currentUpdatedAt !== baseUpdatedAt) {
      const parsed = JSON.parse(existingRow.payload);
      if (!isAuthUsersPayload(parsed)) {
        return NextResponse.json({ ok: false, error: "invalid_stored_payload" }, { status: 500 });
      }
      return NextResponse.json(
        {
          ok: false,
          error: "conflict",
          exists: true,
          payload: parsed,
          updatedAt: currentUpdatedAt,
        },
        { status: 409 },
      );
    }

    await prisma.$executeRawUnsafe(
      `
      INSERT INTO manual_editor_states (id, payload, created_at, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        payload = excluded.payload,
        updated_at = CURRENT_TIMESTAMP
      `,
      AUTH_USERS_STATE_ID,
      JSON.stringify(body.payload),
    );

    const updatedRows = await prisma.$queryRawUnsafe<SharedStateRow[]>(
      "SELECT id, payload, updated_at FROM manual_editor_states WHERE id = ? LIMIT 1",
      AUTH_USERS_STATE_ID,
    );
    const updatedRow = updatedRows[0];

    return NextResponse.json({
      ok: true,
      updatedAt: normalizeTimestamp(updatedRow?.updated_at),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "failed_to_save_auth_users" }, { status: 500 });
  }
}
