import { NextRequest, NextResponse } from "next/server";

type TrackEvent = {
  event?: string;
  detail?: Record<string, string | null>;
  path?: string;
  ts?: string;
};

export async function POST(req: NextRequest) {
  let payload: TrackEvent = {};

  try {
    payload = (await req.json()) as TrackEvent;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  console.info("[track]", {
    event: payload.event ?? "unknown_event",
    detail: payload.detail ?? {},
    path: payload.path ?? "unknown_path",
    ts: payload.ts ?? new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
