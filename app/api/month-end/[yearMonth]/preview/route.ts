import { NextRequest, NextResponse } from "next/server";
import { buildMonthEndPreview } from "../../../../../lib/month-end";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ yearMonth: string }> }) {
  const params = await ctx.params;

  try {
    const preview = await buildMonthEndPreview(params.yearMonth);
    return NextResponse.json(preview);
  } catch (error) {
    if (error instanceof Error && error.message === "invalid_year_month") {
      return NextResponse.json({ error: "invalid_year_month" }, { status: 400 });
    }
    throw error;
  }
}
