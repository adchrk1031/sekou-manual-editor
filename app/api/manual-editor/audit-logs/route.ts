import { NextRequest, NextResponse } from "next/server.js";
import { requireManualEditorUser } from "../../../../lib/manualEditorServerAuth";
import { appendStructuredAuditLog } from "../../../../lib/manualEditorStructuredStore";

export async function POST(request: NextRequest) {
  const auth = await requireManualEditorUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  let body: { payload?: { rawJson?: unknown } } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const rawJson = typeof body.payload?.rawJson === "string" ? body.payload.rawJson : "";
  if (!rawJson) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  try {
    const result = await appendStructuredAuditLog(rawJson);
    return NextResponse.json({ ok: true, updatedAt: result.updatedAt });
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_audit_log" }, { status: 400 });
  }
}
