import { NextRequest, NextResponse } from "next/server.js";
import { requireManualEditorUser } from "../../../../../../lib/manualEditorServerAuth";
import {
  deleteStructuredTemplateItem,
  readStructuredTemplateItem,
  writeStructuredTemplateItem,
} from "../../../../../../lib/manualEditorStructuredStore";

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

function normalizePathValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ storageKey: string; itemId: string }> },
) {
  const auth = await requireManualEditorUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const { storageKey, itemId } = await context.params;
  const normalizedStorageKey = normalizePathValue(storageKey);
  const normalizedItemId = normalizePathValue(itemId);
  if (!normalizedStorageKey || !normalizedItemId) {
    return NextResponse.json({ ok: false, error: "invalid_params" }, { status: 400 });
  }

  const stored = await readStructuredTemplateItem(normalizedStorageKey, normalizedItemId);
  if (!stored.exists || !stored.payload) {
    return NextResponse.json({ ok: true, exists: false, payload: null, updatedAt: null });
  }

  return NextResponse.json({
    ok: true,
    exists: true,
    payload: stored.payload,
    updatedAt: stored.updatedAt,
  });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ storageKey: string; itemId: string }> },
) {
  const auth = await requireManualEditorUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const { storageKey, itemId } = await context.params;
  const normalizedStorageKey = normalizePathValue(storageKey);
  const normalizedItemId = normalizePathValue(itemId);
  if (!normalizedStorageKey || !normalizedItemId) {
    return NextResponse.json({ ok: false, error: "invalid_params" }, { status: 400 });
  }

  let body: {
    payload?: {
      itemName?: unknown;
      itemScope?: unknown;
      itemCategory?: unknown;
      itemOrder?: unknown;
      rawJson?: unknown;
    };
    baseUpdatedAt?: unknown;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const itemName = typeof body.payload?.itemName === "string" ? body.payload.itemName.trim() : "";
  const itemScope = typeof body.payload?.itemScope === "string" ? body.payload.itemScope.trim() : "";
  const itemCategory = typeof body.payload?.itemCategory === "string" ? body.payload.itemCategory.trim() : "";
  const itemOrder = Number(body.payload?.itemOrder);
  const rawJson = typeof body.payload?.rawJson === "string" ? body.payload.rawJson : "";
  if (!itemName || !Number.isFinite(itemOrder) || !rawJson) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const result = await writeStructuredTemplateItem(
    {
      storageKey: normalizedStorageKey,
      itemId: normalizedItemId,
      itemName,
      itemScope,
      itemCategory,
      itemOrder,
      rawJson,
    },
    normalizeTimestamp(body.baseUpdatedAt),
  );

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "conflict",
        payload: result.payload,
        updatedAt: result.updatedAt,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    payload: result.payload,
    updatedAt: result.updatedAt,
    resolvedConflict: result.resolvedConflict,
  });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ storageKey: string; itemId: string }> },
) {
  const auth = await requireManualEditorUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const { storageKey, itemId } = await context.params;
  const normalizedStorageKey = normalizePathValue(storageKey);
  const normalizedItemId = normalizePathValue(itemId);
  if (!normalizedStorageKey || !normalizedItemId) {
    return NextResponse.json({ ok: false, error: "invalid_params" }, { status: 400 });
  }

  let body: { baseUpdatedAt?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // ignore optional delete body
  }

  const result = await deleteStructuredTemplateItem(
    normalizedStorageKey,
    normalizedItemId,
    normalizeTimestamp(body.baseUpdatedAt),
  );

  return NextResponse.json({
    ok: true,
    updatedAt: result.updatedAt,
    resolvedConflict: result.resolvedConflict,
  });
}
