import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

type CurrentStepRow = {
  projectId: number;
  stepId: number;
  stepOrder: number;
  stepCode: string;
  stepName: string;
  zoneId: number;
  zoneCode: string;
  zoneName: string;
};

function toPositiveInt(raw: string | null, fallback: number) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function resolveGroupCount(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (!raw || typeof raw !== "object") return 0;
  const count = (raw as { _all?: unknown })._all;
  return typeof count === "number" ? count : 0;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const page = toPositiveInt(sp.get("page"), 1);
  const pageSize = Math.min(toPositiveInt(sp.get("pageSize"), 20), 100);

  const q = sp.get("q")?.trim() ?? "";
  const ownerUserId = sp.get("ownerUserId");
  const status = sp.get("status")?.trim();
  const constructionTypeCode = sp.get("constructionTypeCode")?.trim();
  const zoneCode = sp.get("zoneCode")?.trim();

  const ownerUserIdNum = ownerUserId ? Number(ownerUserId) : undefined;
  if (ownerUserId && !Number.isFinite(ownerUserIdNum)) {
    return NextResponse.json({ error: "invalid_owner_user_id" }, { status: 400 });
  }

  let zoneFilteredProjectIds: number[] | undefined;
  if (zoneCode) {
    const filtered = await prisma.$queryRaw<{ projectId: number }[]>(Prisma.sql`
      SELECT ps.project_id AS projectId
      FROM project_steps ps
      JOIN zones z ON z.id = ps.zone_id
      JOIN (
        SELECT project_id, MIN(step_order) AS min_step_order
        FROM project_steps
        WHERE status IN ('TODO', 'IN_PROGRESS')
        GROUP BY project_id
      ) cp ON cp.project_id = ps.project_id AND cp.min_step_order = ps.step_order
      WHERE z.code = ${zoneCode}
    `);

    zoneFilteredProjectIds = filtered.map((f) => f.projectId);
    if (zoneFilteredProjectIds.length === 0) {
      return NextResponse.json({
        items: [],
        pagination: { page, pageSize, total: 0, totalPages: 0 },
        summary: { byStatus: {}, byZone: {} },
      });
    }
  }

  const where: Prisma.ProjectWhereInput = {
    ...(q
      ? {
          OR: [
            { projectName: { contains: q } },
            { customerName: { contains: q } },
            { salesforceRecordId: { contains: q } },
          ],
        }
      : {}),
    ...(ownerUserIdNum ? { ownerUserId: ownerUserIdNum } : {}),
    ...(status ? { status: status as never } : {}),
    ...(constructionTypeCode ? { constructionType: { code: constructionTypeCode } } : {}),
    ...(zoneFilteredProjectIds ? { id: { in: zoneFilteredProjectIds } } : {}),
  };

  const [total, projects] = await prisma.$transaction([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        salesforceRecordId: true,
        projectName: true,
        customerName: true,
        status: true,
        startDate: true,
        dueDate: true,
        updatedAt: true,
        constructionType: { select: { id: true, code: true, name: true } },
        owner: { select: { id: true, name: true } },
      },
    }),
  ]);

  if (projects.length === 0) {
    return NextResponse.json({
      items: [],
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      summary: { byStatus: {}, byZone: {} },
    });
  }

  const projectIds = projects.map((p) => p.id);

  const [statusCounts, stepCounts, currentRows] = await prisma.$transaction([
    prisma.project.groupBy({
      by: ["status"],
      where,
      orderBy: { status: "asc" },
      _count: { _all: true },
    }),
    prisma.projectStep.groupBy({
      by: ["projectId", "status"],
      where: { projectId: { in: projectIds } },
      orderBy: [{ projectId: "asc" }, { status: "asc" }],
      _count: { _all: true },
    }),
    prisma.$queryRaw<CurrentStepRow[]>(Prisma.sql`
      SELECT
        ps.project_id AS projectId,
        ps.id AS stepId,
        ps.step_order AS stepOrder,
        ps.step_code AS stepCode,
        ps.step_name AS stepName,
        z.id AS zoneId,
        z.code AS zoneCode,
        z.name AS zoneName
      FROM project_steps ps
      JOIN zones z ON z.id = ps.zone_id
      JOIN (
        SELECT project_id, MIN(step_order) AS min_step_order
        FROM project_steps
        WHERE project_id IN (${Prisma.join(projectIds)})
          AND status IN ('TODO', 'IN_PROGRESS')
        GROUP BY project_id
      ) cp ON cp.project_id = ps.project_id AND cp.min_step_order = ps.step_order
    `),
  ]);

  const stepCountMap = new Map<number, { total: number; done: number; inProgress: number; todo: number }>();
  for (const row of stepCounts) {
    const count = resolveGroupCount(row._count);
    const current = stepCountMap.get(row.projectId) ?? {
      total: 0,
      done: 0,
      inProgress: 0,
      todo: 0,
    };
    current.total += count;
    if (row.status === "DONE") current.done += count;
    if (row.status === "IN_PROGRESS") current.inProgress += count;
    if (row.status === "TODO") current.todo += count;
    stepCountMap.set(row.projectId, current);
  }

  const currentRowMap = new Map<number, CurrentStepRow>();
  for (const row of currentRows) {
    currentRowMap.set(row.projectId, row);
  }

  const items = projects.map((project) => {
    const currentPosition = currentRowMap.get(project.id);
    const progress = stepCountMap.get(project.id) ?? { total: 0, done: 0, inProgress: 0, todo: 0 };
    const completionRate = progress.total > 0 ? Math.round((progress.done / progress.total) * 1000) / 10 : 0;

    return {
      ...project,
      currentPosition: currentPosition
        ? {
            stepId: currentPosition.stepId,
            stepOrder: currentPosition.stepOrder,
            stepCode: currentPosition.stepCode,
            stepName: currentPosition.stepName,
            zone: {
              id: currentPosition.zoneId,
              code: currentPosition.zoneCode,
              name: currentPosition.zoneName,
            },
          }
        : null,
      progress: {
        ...progress,
        completionRate,
      },
    };
  });

  const byStatus = Object.fromEntries(statusCounts.map((s) => [s.status, resolveGroupCount(s._count)]));
  const byZone = currentRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.zoneName] = (acc[row.zoneName] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
    summary: {
      byStatus,
      byZone,
    },
  });
}
