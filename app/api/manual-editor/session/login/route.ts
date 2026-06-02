import { NextRequest, NextResponse } from "next/server.js";
import {
  applyManualEditorSessionCookie,
  pickPreferredCandidate,
  redactAuthUsers,
  redactAuthUser,
  readAuthUsersState,
  verifyManualEditorPassword,
  writeAuthUsersState,
} from "../../../../../lib/manualEditorServerAuth";

type LoginRequestBody = {
  email?: unknown;
  password?: unknown;
};

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizePassword(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  let body: LoginRequestBody = {};
  try {
    body = (await request.json()) as LoginRequestBody;
  } catch {
    return NextResponse.json({ ok: false, reason: "missing" }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  const password = normalizePassword(body.password);
  if (!email || !password) {
    return NextResponse.json({ ok: false, reason: "missing" }, { status: 400 });
  }

  const stored = await readAuthUsersState();
  const candidates = stored.payload.users.filter((user) => user.email === email);
  if (!candidates.length) {
    return NextResponse.json({ ok: false, reason: "not_registered" }, { status: 401 });
  }

  const passwordMatched = candidates.filter((user) => verifyManualEditorPassword(password, user.password));
  const user = pickPreferredCandidate(passwordMatched.length ? passwordMatched : candidates);
  if (!user || !verifyManualEditorPassword(password, user.password)) {
    return NextResponse.json({ ok: false, reason: "invalid_password" }, { status: 401 });
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

  const nextUsers = stored.payload.users.map((entry) =>
    entry.id === user.id
      ? { ...entry, lastLoginAt: new Date().toISOString() }
      : entry,
  );
  const writeResult = await writeAuthUsersState({ users: nextUsers }, stored.updatedAt ?? null);
  const persistedUsers = writeResult.ok ? nextUsers : writeResult.payload.users;
  const persistedUser = persistedUsers.find((entry) => entry.id === user.id) ?? user;

  const response = NextResponse.json({
    ok: true,
    user: redactAuthUser(persistedUser),
    users:
      persistedUser.role === "system_admin" || persistedUser.role === "admin"
        ? redactAuthUsers(persistedUsers)
        : [redactAuthUser(persistedUser)],
  });
  applyManualEditorSessionCookie(response, persistedUser.id);
  return response;
}
