import { NextRequest, NextResponse } from "next/server";
import {
  applyManualEditorSessionCookie,
  readAuthUsersState,
  writeAuthUsersState,
} from "../../../../../lib/manualEditorServerAuth";

type RegisterMode = "initial" | "self";

type RegisterRequestBody = {
  mode?: unknown;
  name?: unknown;
  email?: unknown;
  password?: unknown;
};

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
}

export async function POST(request: NextRequest) {
  let body: RegisterRequestBody = {};
  try {
    body = (await request.json()) as RegisterRequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const mode = body.mode === "initial" || body.mode === "self" ? body.mode as RegisterMode : null;
  const name = normalizeText(body.name);
  const email = normalizeEmail(body.email);
  const password = normalizeText(body.password);
  if (!mode || !name || !email || !password) {
    return NextResponse.json({ ok: false, error: "missing" }, { status: 400 });
  }

  const stored = await readAuthUsersState();
  const users = stored.payload.users;

  if (mode === "initial") {
    if (stored.exists && users.length > 0) {
      return NextResponse.json({ ok: false, error: "already_initialized" }, { status: 409 });
    }
    const now = new Date().toISOString();
    const user = {
      id: uid("user"),
      name,
      email,
      password,
      role: "system_admin" as const,
      active: true,
      approvalStatus: "approved" as const,
      approvedAt: now,
      approvedById: "self",
      approvedByName: "システム管理者",
      createdAt: now,
      createdById: "self",
      createdByName: "初期登録",
      lastLoginAt: now,
    };
    await writeAuthUsersState({ users: [user] }, stored.updatedAt ?? null);
    const response = NextResponse.json({ ok: true, user, users: [user] });
    applyManualEditorSessionCookie(response, user.id);
    return response;
  }

  if (users.some((user) => user.email === email)) {
    return NextResponse.json({ ok: false, error: "duplicate_email" }, { status: 409 });
  }

  const user = {
    id: uid("user"),
    name,
    email,
    password,
    role: "editor" as const,
    active: true,
    approvalStatus: "pending" as const,
    createdAt: new Date().toISOString(),
    createdById: "self_signup",
    createdByName: "本人申請（セルフ登録）",
  };

  await writeAuthUsersState({ users: [user, ...users] }, stored.updatedAt ?? null);
  return NextResponse.json({ ok: true, user });
}
