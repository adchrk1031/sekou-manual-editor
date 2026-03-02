import { ProjectStepStatus, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

type CurrentStepRow = {
  projectId: number;
  stepId: number;
};

function parsePositiveInt(raw: string | null, fallback: number) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function parseDate(raw: string | null) {
  if (!raw) return undefined;
  const date = new Date(raw);
  if (Number.isNaN(date.valueOf())) return null;
  return date;
}

function resolveGroupCount(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (!raw || typeof raw !== "object") return 0;
  const count = (raw as { _all?: unknown })._all;
  return typeof count === "number" ? count : 0;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const userIdRaw = sp.get("userId");
  const userId = Number(userIdRaw);
  if (!userIdRaw || !Number.isFinite(userId)) {
    return NextResponse.json({ error: "userId_is_required" }, { status: 400 });
  }

  const statusParam = sp.get("status")?.trim().toLowerCase() ?? "open";
  const page = parsePositiveInt(sp.get("page"), 1);
  const pageSize = Math.min(parsePositiveInt(sp.get("pageSize"), 50), 200);

  const fromDate = parseDate(sp.get("from"));
  const toDate = parseDate(sp.get("to"));
  if (fromDate === null || toDate === null) {
    return NextResponse.json({ error: "invalid_date_query" }, { status: 400 });
  }

  let statusFilter: ProjectStepStatus[] | undefined;
  if (statusParam === "open") statusFilter = ["TODO", "IN_PROGRESS"];
  if (statusParam === "done") statusFilter = ["DONE"];
  if (statusParam !== "open" && statusParam !== "done" && statusParam !== "all") {
    return NextResponse.json({ error: "invalid_status_query" }, { status: 400 });
  }

  const where: Prisma.ProjectStepWhereInput = {
    assigneeUserId: userId,
    ...(statusFilter ? { status: { in: statusFilter } } : {}),
    ...((fromDate || toDate)
      ? {
          dueDate: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
          },
        }
      : {}),
  };

  const [total, rows, statusCounts] = await prisma.$transaction([
    prisma.projectStep.count({ where }),
    prisma.projectStep.findMany({
      where,
      orderBy: [{ dueDate: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        projectId: true,
        stepOrder: true,
        stepCode: true,
        stepName: true,
        status: true,
        plannedDate: true,
        dueDate: true,
        completedAt: true,
        project: {
          select: {
            id: true,
            projectName: true,
            status: true,
            constructionType: { select: { id: true, code: true, name: true } },
          },
        },
        zone: { select: { id: true, code: true, name: true } },
      },
    }),
    prisma.projectStep.groupBy({
      by: ["status"],
      where: { assigneeUserId: userId },
      orderBy: { status: "asc" },
      _count: { _all: true },
    }),
  ]);

  const projectIds = [...new Set(rows.map((r) => r.projectId))];

  const currentRows = projectIds.length
    ? await prisma.$queryRaw<CurrentStepRow[]>(Prisma.sql`
      SELECT
        ps.project_id AS projectId,
        ps.id AS stepId
      FROM project_steps ps
      JOIN (
        SELECT project_id, MIN(step_order) AS min_step_order
        FROM project_steps
        WHERE project_id IN (${Prisma.join(projectIds)})
          AND status IN ('TODO', 'IN_PROGRESS')
        GROUP BY project_id
      ) cp ON cp.project_id = ps.project_id AND cp.min_step_order = ps.step_order
    `)
    : [];

  const currentMap = new Map<number, number>();
  for (const row of currentRows) {
    currentMap.set(row.projectId, row.stepId);
  }

  const now = new Date();
  const items = rows.map((row) => ({
    id: row.id,
    stepOrder: row.stepOrder,
    stepCode: row.stepCode,
    stepName: row.stepName,
    status: row.status,
    plannedDate: row.plannedDate,
    dueDate: row.dueDate,
    completedAt: row.completedAt,
    overdue: Boolean(row.dueDate && row.dueDate < now && row.status !== "DONE" && row.status !== "SKIPPED"),
    isCurrentPosition: currentMap.get(row.projectId) === row.id,
    zone: row.zone,
    project: row.project,
  }));

  const summaryByStatus = Object.fromEntries(statusCounts.map((s) => [s.status, resolveGroupCount(s._count)]));
  const overdueCount = items.filter((i) => i.overdue).length;

  return NextResponse.json({
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
    summary: {
      byStatus: summaryByStatus,
      overdueCount,
    },
  });
}
