import { NextRequest, NextResponse } from "next/server";
import { clearManualEditorSessionCookie } from "../../../../../lib/manualEditorServerAuth";

export async function POST(_request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  clearManualEditorSessionCookie(response);
  return response;
}
