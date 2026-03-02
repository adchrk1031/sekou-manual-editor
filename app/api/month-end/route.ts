import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET(req: NextRequest) {
  const pageRaw = req.nextUrl.searchParams.get("page");
  const pageSizeRaw = req.nextUrl.searchParams.get("pageSize");
  const page = Math.max(1, Number(pageRaw ?? 1) || 1);
  const pageSize = Math.min(Math.max(1, Number(pageSizeRaw ?? 20) || 20), 100);

  const [total, rows] = await prisma.$transaction([
    prisma.monthEndClosing.count(),
    prisma.monthEndClosing.findMany({
      orderBy: { yearMonth: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        yearMonth: true,
        status: true,
        closedAt: true,
        createdAt: true,
        closer: {
          select: { id: true, name: true },
        },
      },
    }),
  ]);

  return NextResponse.json({
    items: rows,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}
