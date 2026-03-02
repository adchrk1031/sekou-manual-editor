import { NextRequest, NextResponse } from "next/server";
import { buildMonthEndPreview, parseYearMonthOrThrow } from "../../../../../lib/month-end";
import { prisma } from "../../../../../lib/prisma";

type CloseMonthEndBody = {
  closedBy?: number | null;
  force?: boolean;
};

export async function POST(req: NextRequest, ctx: { params: Promise<{ yearMonth: string }> }) {
  const params = await ctx.params;
  try {
    parseYearMonthOrThrow(params.yearMonth);
  } catch {
    return NextResponse.json({ error: "invalid_year_month" }, { status: 400 });
  }

  let body: CloseMonthEndBody = {};
  try {
    body = (await req.json()) as CloseMonthEndBody;
  } catch {
    body = {};
  }

  const force = body.force === true;
  const existing = await prisma.monthEndClosing.findUnique({
    where: { yearMonth: params.yearMonth },
    select: { id: true, status: true, closedAt: true },
  });

  if (existing?.status === "CLOSED" && !force) {
    return NextResponse.json(
      {
        error: "already_closed",
        yearMonth: params.yearMonth,
        closedAt: existing.closedAt,
      },
      { status: 409 },
    );
  }

  const summary = await buildMonthEndPreview(params.yearMonth);
  const closedAt = new Date();

  const saved = await prisma.monthEndClosing.upsert({
    where: { yearMonth: params.yearMonth },
    create: {
      yearMonth: params.yearMonth,
      status: "CLOSED",
      closedBy: body.closedBy ?? null,
      closedAt,
      summaryJson: summary,
    },
    update: {
      status: "CLOSED",
      closedBy: body.closedBy ?? null,
      closedAt,
      summaryJson: summary,
    },
    select: {
      id: true,
      yearMonth: true,
      status: true,
      closedAt: true,
      closedBy: true,
      summaryJson: true,
    },
  });

  return NextResponse.json({
    id: saved.id,
    yearMonth: saved.yearMonth,
    status: saved.status,
    closedAt: saved.closedAt,
    closedBy: saved.closedBy,
    summary: saved.summaryJson,
    overwritten: Boolean(existing),
  });
}
