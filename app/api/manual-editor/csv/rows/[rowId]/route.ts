import { NextRequest, NextResponse } from "next/server.js";
import { requireManualEditorUser } from "../../../../../../lib/manualEditorServerAuth";
import {
  deleteStructuredCsvRow,
  readStructuredCsvRow,
  writeStructuredCsvRow,
} from "../../../../../../lib/manualEditorStructuredStore";

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

function normalizeRowId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ rowId: string }> },
) {
  const auth = await requireManualEditorUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const { rowId } = await context.params;
  const normalizedRowId = normalizeRowId(rowId);
  if (!normalizedRowId) {
    return NextResponse.json({ ok: false, error: "invalid_row_id" }, { status: 400 });
  }

  const stored = await readStructuredCsvRow(normalizedRowId);
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
  context: { params: Promise<{ rowId: string }> },
) {
  const auth = await requireManualEditorUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const { rowId } = await context.params;
  const normalizedRowId = normalizeRowId(rowId);
  if (!normalizedRowId) {
    return NextResponse.json({ ok: false, error: "invalid_row_id" }, { status: 400 });
  }

  let body: { payload?: { rowOrder?: unknown; rawJson?: unknown }; baseUpdatedAt?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const rowOrder = Number(body.payload?.rowOrder);
  const rawJson = typeof body.payload?.rawJson === "string" ? body.payload.rawJson : "";
  if (!Number.isFinite(rowOrder) || !rawJson) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const result = await writeStructuredCsvRow(
    {
      rowId: normalizedRowId,
      rowOrder,
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
  context: { params: Promise<{ rowId: string }> },
) {
  const auth = await requireManualEditorUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const { rowId } = await context.params;
  const normalizedRowId = normalizeRowId(rowId);
  if (!normalizedRowId) {
    return NextResponse.json({ ok: false, error: "invalid_row_id" }, { status: 400 });
  }

  let body: { baseUpdatedAt?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // optional body
  }

  const result = await deleteStructuredCsvRow(
    normalizedRowId,
    normalizeTimestamp(body.baseUpdatedAt),
  );

  return NextResponse.json({
    ok: true,
    updatedAt: result.updatedAt,
    resolvedConflict: result.resolvedConflict,
  });
}
