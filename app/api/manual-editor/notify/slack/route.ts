import { NextRequest, NextResponse } from "next/server";

type SlackNotifyPayload = {
  event?: unknown;
  userName?: unknown;
  userEmail?: unknown;
  requestedAt?: unknown;
};

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: NextRequest) {
  let body: SlackNotifyPayload = {};
  try {
    body = (await req.json()) as SlackNotifyPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const event = asTrimmedString(body.event);
  const userName = asTrimmedString(body.userName);
  const userEmail = asTrimmedString(body.userEmail);
  const requestedAt = asTrimmedString(body.requestedAt) || new Date().toISOString();

  if (event !== "user_signup_pending_approval") {
    return NextResponse.json({ ok: false, error: "unsupported_event" }, { status: 400 });
  }
  if (!userName || !userEmail) {
    return NextResponse.json({ ok: false, error: "missing_required_fields" }, { status: 400 });
  }

  const webhookUrl = process.env.SLACK_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    return NextResponse.json({ ok: false, error: "slack_not_configured" }, { status: 200 });
  }

  const message = [
    "🔔 施工計画書ツール: 新規ユーザー申請",
    `・名前: ${userName}`,
    `・メール: ${userEmail}`,
    `・申請時刻: ${requestedAt}`,
    "・状態: 承認待ち（管理者の承認が必要）",
  ].join("\n");

  try {
    const slackResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
      cache: "no-store",
    });
    if (!slackResponse.ok) {
      return NextResponse.json({ ok: false, error: "slack_request_failed" }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "slack_request_failed" }, { status: 502 });
  }
}
