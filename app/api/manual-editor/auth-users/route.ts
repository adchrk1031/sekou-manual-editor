import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedManualEditorUser,
  isAuthUsersPayload,
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
        payload: stored.payload,
        updatedAt: stored.updatedAt,
      });
    }

    const selfUser = stored.payload.users.find((user) => user.id === sessionUser.id) ?? sessionUser;
    return NextResponse.json({
      ok: true,
      exists: true,
      count: stored.payload.users.length,
      access: "self",
      payload: { users: [selfUser] },
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
