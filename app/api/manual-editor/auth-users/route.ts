import { NextRequest, NextResponse } from "next/server.js";
import {
  getAuthenticatedManualEditorUser,
  isAuthUsersPayload,
  redactAuthUsers,
  redactAuthUser,
  readAuthUsersState,
  requireManualEditorUser,
  writeAuthUsersState,
} from "../../../../lib/manualEditorServerAuth";

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
}

export async function GET(request: NextRequest) {
  try {
    const stored = await readAuthUsersState();
    const sessionUser = await getAuthenticatedManualEditorUser(request);

    if (!sessionUser) {
      return NextResponse.json({
        ok: true,
        exists: stored.exists,
        count: stored.payload.users.length,
        access: "metadata",
        payload: { users: [] },
        updatedAt: stored.updatedAt,
      });
    }

    if (sessionUser.role === "system_admin" || sessionUser.role === "admin") {
      return NextResponse.json({
        ok: true,
        exists: stored.exists,
        count: stored.payload.users.length,
        access: "admin",
        payload: { users: redactAuthUsers(stored.payload.users) },
        updatedAt: stored.updatedAt,
      });
    }

    const selfUser = stored.payload.users.find((user) => user.id === sessionUser.id) ?? sessionUser;
    return NextResponse.json({
      ok: true,
      exists: true,
      count: stored.payload.users.length,
      access: "self",
      payload: { users: [redactAuthUser(selfUser)] },
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

export async function PUT(request: NextRequest) {
  const auth = await requireManualEditorUser(request, { adminOnly: true });
  if (!auth.ok) {
    return auth.response;
  }

  let body: { payload?: unknown; baseUpdatedAt?: unknown } = {};
  try {
    body = (await request.json()) as { payload?: unknown; baseUpdatedAt?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (!isAuthUsersPayload(body.payload)) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  try {
    const baseUpdatedAt = normalizeTimestamp(body.baseUpdatedAt);
    const result = await writeAuthUsersState(body.payload, baseUpdatedAt);

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "conflict",
          exists: true,
          payload: { users: redactAuthUsers(result.payload.users) },
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

export async function POST(request: NextRequest) {
  const auth = await requireManualEditorUser(request, { adminOnly: true });
  if (!auth.ok) {
    return auth.response;
  }

  let body: { name?: unknown; email?: unknown; password?: unknown; role?: unknown } = {};
  try {
    body = (await request.json()) as { name?: unknown; email?: unknown; password?: unknown; role?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const name = normalizeText(body.name);
  const email = normalizeEmail(body.email);
  const password = normalizeText(body.password);
  const role = body.role === "system_admin" || body.role === "admin" || body.role === "editor" || body.role === "viewer"
    ? body.role
    : "editor";

  if (!name || !email || !password) {
    return NextResponse.json({ ok: false, error: "missing" }, { status: 400 });
  }
  if (role === "system_admin" && auth.user.role !== "system_admin") {
    return NextResponse.json({ ok: false, error: "forbidden_role" }, { status: 403 });
  }

  const stored = await readAuthUsersState();
  if (stored.payload.users.some((user) => user.email === email)) {
    return NextResponse.json({ ok: false, error: "duplicate_email" }, { status: 409 });
  }

  const now = new Date().toISOString();
  const createdUser = {
    id: uid("user"),
    name,
    email,
    password,
    role: role as "system_admin" | "admin" | "editor" | "viewer",
    active: true,
    approvalStatus: "approved" as const,
    approvedAt: now,
    approvedById: auth.user.id,
    approvedByName: auth.user.name,
    createdAt: now,
    createdById: auth.user.id,
    createdByName: auth.user.name,
  };

  const nextUsers = [createdUser, ...stored.payload.users];
  const result = await writeAuthUsersState({ users: nextUsers }, stored.updatedAt ?? null);

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "conflict",
        exists: true,
        payload: { users: redactAuthUsers(result.payload.users) },
        updatedAt: result.updatedAt,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    user: redactAuthUser(createdUser),
    users: redactAuthUsers(nextUsers),
    updatedAt: result.updatedAt,
  });
}
