import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

type SharedStatePayload = {
  items: Record<string, string>;
};

type SharedStateRow = {
  id: string;
  payload: string;
  updated_at: string;
};

const SHARED_STATE_ID = "global";
const MAX_SHARED_ITEMS = 3000;
const MAX_SHARED_VALUE_LENGTH = 2_000_000;
const MAX_SHARED_KEY_LENGTH = 256;

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

function isSharedStatePayload(value: unknown): value is SharedStatePayload {
  if (!value || typeof value !== "object") {
    return false;
  }
  const items = (value as { items?: unknown }).items;
  if (!items || typeof items !== "object" || Array.isArray(items)) {
    return false;
  }
  const entries = Object.entries(items);
  if (entries.length > MAX_SHARED_ITEMS) {
    return false;
  }
  return entries.every(([key, itemValue]) =>
    typeof key === "string"
    && key.length > 0
    && key.length <= MAX_SHARED_KEY_LENGTH
    && typeof itemValue === "string"
    && itemValue.length <= MAX_SHARED_VALUE_LENGTH,
  );
}

async function ensureSharedStateTable(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS manual_editor_states (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export async function GET() {
  try {
    await ensureSharedStateTable();
    const rows = await prisma.$queryRawUnsafe<SharedStateRow[]>(
      "SELECT id, payload, updated_at FROM manual_editor_states WHERE id = ? LIMIT 1",
      SHARED_STATE_ID,
    );
    const row = rows[0];
    if (!row) {
      return NextResponse.json({
        ok: true,
        exists: false,
        payload: { items: {} },
        updatedAt: null,
      });
    }
    const parsed = JSON.parse(row.payload);
    if (!isSharedStatePayload(parsed)) {
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
    return NextResponse.json({ ok: false, error: "failed_to_load_shared_state" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  let body: { payload?: unknown; baseUpdatedAt?: unknown } = {};
  try {
    body = (await req.json()) as { payload?: unknown; baseUpdatedAt?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (!isSharedStatePayload(body.payload)) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  try {
    await ensureSharedStateTable();
    const existingRows = await prisma.$queryRawUnsafe<SharedStateRow[]>(
      "SELECT id, payload, updated_at FROM manual_editor_states WHERE id = ? LIMIT 1",
      SHARED_STATE_ID,
    );
    const existingRow = existingRows[0];
    const baseUpdatedAt = normalizeTimestamp(body.baseUpdatedAt);
    const currentUpdatedAt = normalizeTimestamp(existingRow?.updated_at);

    if (existingRow && currentUpdatedAt !== baseUpdatedAt) {
      const parsed = JSON.parse(existingRow.payload);
      if (!isSharedStatePayload(parsed)) {
        return NextResponse.json(
          { ok: false, error: "invalid_stored_payload" },
          { status: 500 },
        );
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

    const serialized = JSON.stringify(body.payload);
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO manual_editor_states (id, payload, created_at, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        payload = excluded.payload,
        updated_at = CURRENT_TIMESTAMP
      `,
      SHARED_STATE_ID,
      serialized,
    );

    const updatedRows = await prisma.$queryRawUnsafe<SharedStateRow[]>(
      "SELECT id, payload, updated_at FROM manual_editor_states WHERE id = ? LIMIT 1",
      SHARED_STATE_ID,
    );
    const updatedRow = updatedRows[0];

    return NextResponse.json({
      ok: true,
      updatedAt: normalizeTimestamp(updatedRow?.updated_at),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "failed_to_save_shared_state" }, { status: 500 });
  }
}
