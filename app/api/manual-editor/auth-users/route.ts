import { NextRequest, NextResponse } from "next/server";
import {
  readManualEditorState,
  writeManualEditorState,
} from "../../../../lib/manualEditorStateStore";

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

const AUTH_USERS_STATE_ID = "auth_users_v1";
const MAX_USERS = 500;

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

export async function GET() {
  try {
    const stored = await readManualEditorState(AUTH_USERS_STATE_ID, isAuthUsersPayload);
    if (!stored.exists || !stored.payload) {
      return NextResponse.json({
        ok: true,
        exists: false,
        payload: { users: [] },
        updatedAt: null,
      });
    }
    return NextResponse.json({
      ok: true,
      exists: true,
      payload: stored.payload,
      updatedAt: stored.updatedAt,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "invalid_stored_payload") {
      return NextResponse.json({
        ok: false,
        exists: true,
        error: "invalid_stored_payload",
      }, { status: 500 });
    }
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
    const baseUpdatedAt = normalizeTimestamp(body.baseUpdatedAt);
    const result = await writeManualEditorState(
      AUTH_USERS_STATE_ID,
      body.payload,
      baseUpdatedAt,
      isAuthUsersPayload,
    );

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "conflict",
          exists: true,
          payload: result.payload,
          updatedAt: result.updatedAt,
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      ok: true,
      updatedAt: result.updatedAt,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "invalid_stored_payload") {
      return NextResponse.json({ ok: false, error: "invalid_stored_payload" }, { status: 500 });
    }
    return NextResponse.json({ ok: false, error: "failed_to_save_auth_users" }, { status: 500 });
  }
}
