import { NextRequest, NextResponse } from "next/server";
import {
  applyManualEditorSessionCookie,
  pickPreferredCandidate,
  readAuthUsersState,
  writeAuthUsersState,
} from "../../../../../lib/manualEditorServerAuth";

type GoogleLoginRequestBody = {
  email?: unknown;
  name?: unknown;
};

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeName(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return fallback;
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
}

export async function POST(request: NextRequest) {
  let body: GoogleLoginRequestBody = {};
  try {
    body = (await request.json()) as GoogleLoginRequestBody;
  } catch {
    return NextResponse.json({ ok: false, reason: "missing" }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  if (!email) {
    return NextResponse.json({ ok: false, reason: "missing" }, { status: 400 });
  }

  const stored = await readAuthUsersState();
  let users = stored.payload.users;
  let user = pickPreferredCandidate(users.filter((entry) => entry.email === email));

  if (!user && !stored.exists) {
    const now = new Date().toISOString();
    user = {
      id: uid("user"),
      name: normalizeName(body.name, email),
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
      lastLoginAt: now,
    };
    users = [user];
  }

  if (!user) {
    return NextResponse.json({ ok: false, reason: "not_registered" }, { status: 401 });
  }
  if (!user.active) {
    return NextResponse.json({ ok: false, reason: "inactive" }, { status: 403 });
  }
  if (user.approvalStatus === "pending") {
    return NextResponse.json({ ok: false, reason: "pending_approval" }, { status: 403 });
  }
  if (user.approvalStatus === "rejected") {
    return NextResponse.json({ ok: false, reason: "rejected" }, { status: 403 });
  }

  const nextUsers = users.map((entry) =>
    entry.id === user.id
      ? { ...entry, lastLoginAt: new Date().toISOString() }
      : entry,
  );
  const writeResult = await writeAuthUsersState({ users: nextUsers }, stored.updatedAt ?? null);
  const persistedUsers = writeResult.ok ? nextUsers : writeResult.payload.users;
  const persistedUser = persistedUsers.find((entry) => entry.id === user.id) ?? user;

  const response = NextResponse.json({
    ok: true,
    user: persistedUser,
    users:
      persistedUser.role === "system_admin" || persistedUser.role === "admin"
        ? persistedUsers
        : [persistedUser],
  });
  applyManualEditorSessionCookie(response, persistedUser.id);
  return response;
}
