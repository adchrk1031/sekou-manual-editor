import { NextRequest, NextResponse } from "next/server.js";
import { requireManualEditorUser } from "../../../../../lib/manualEditorServerAuth";
import {
  readStructuredCsvHeaders,
  writeStructuredCsvHeaders,
} from "../../../../../lib/manualEditorStructuredStore";

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

function normalizeHeaders(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function GET(request: NextRequest) {
  const auth = await requireManualEditorUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const stored = await readStructuredCsvHeaders();
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

export async function PUT(request: NextRequest) {
  const auth = await requireManualEditorUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  let body: { payload?: { headers?: unknown }; baseUpdatedAt?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const headers = normalizeHeaders(body.payload?.headers);
  if (!headers.length) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const result = await writeStructuredCsvHeaders(
    { headers },
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
