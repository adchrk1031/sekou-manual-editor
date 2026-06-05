import { NextRequest, NextResponse } from "next/server.js";
import {
  readManualEditorState,
  writeManualEditorState,
} from "../../../../lib/manualEditorStateStore";
import { requireManualEditorUser } from "../../../../lib/manualEditorServerAuth";

type SharedStatePayload = {
  items: Record<string, string>;
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

export async function GET(request: NextRequest) {
  const auth = await requireManualEditorUser(request);
  if (!auth.ok) {
    return auth.response;
  }
  try {
    const stored = await readManualEditorState(SHARED_STATE_ID, isSharedStatePayload);
    if (!stored.exists || !stored.payload) {
      return NextResponse.json({
        ok: true,
        exists: false,
        payload: { items: {} },
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
    return NextResponse.json({ ok: false, error: "failed_to_load_shared_state" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireManualEditorUser(req);
  if (!auth.ok) {
    return auth.response;
  }
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
    const baseUpdatedAt = normalizeTimestamp(body.baseUpdatedAt);
    const result = await writeManualEditorState(
      SHARED_STATE_ID,
      body.payload,
      baseUpdatedAt,
      isSharedStatePayload,
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
    return NextResponse.json({ ok: false, error: "failed_to_save_shared_state" }, { status: 500 });
  }
}
