import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

type ConstructionTypeSummaryRow = {
  constructionTypeId: number;
  constructionTypeCode: string;
  constructionTypeName: string;
  projectTotal: number;
  projectDone: number;
  stepTotal: number;
  stepDone: number;
  openStepCount: number;
};

function isYearMonth(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function parseYearMonthOrThrow(yearMonth: string) {
  if (!isYearMonth(yearMonth)) {
    throw new Error("invalid_year_month");
  }

  const [yearStr, monthStr] = yearMonth.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);

  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { yearMonth, start, end };
}

export async function buildMonthEndPreview(yearMonth: string) {
  const { start, end } = parseYearMonthOrThrow(yearMonth);

  const [
    projectTotal,
    projectDone,
    stepTotal,
    stepDone,
    openStepTotal,
    overdueOpenStepTotal,
    dueInMonthTotal,
    dueInMonthDone,
    constructionTypeRows,
  ] = await prisma.$transaction([
    prisma.project.count(),
    prisma.project.count({ where: { status: "DONE" } }),
    prisma.projectStep.count(),
    prisma.projectStep.count({ where: { status: "DONE" } }),
    prisma.projectStep.count({ where: { status: { in: ["TODO", "IN_PROGRESS"] } } }),
    prisma.projectStep.count({
      where: {
        status: { in: ["TODO", "IN_PROGRESS"] },
        dueDate: { lte: end },
      },
    }),
    prisma.projectStep.count({
      where: {
        dueDate: { gte: start, lte: end },
      },
    }),
    prisma.projectStep.count({
      where: {
        status: "DONE",
        dueDate: { gte: start, lte: end },
      },
    }),
    prisma.$queryRaw<ConstructionTypeSummaryRow[]>(Prisma.sql`
      SELECT
        ct.id AS constructionTypeId,
        ct.code AS constructionTypeCode,
        ct.name AS constructionTypeName,
        COUNT(DISTINCT p.id) AS projectTotal,
        SUM(CASE WHEN p.status = 'DONE' THEN 1 ELSE 0 END) AS projectDone,
        COUNT(ps.id) AS stepTotal,
        SUM(CASE WHEN ps.status = 'DONE' THEN 1 ELSE 0 END) AS stepDone,
        SUM(CASE WHEN ps.status IN ('TODO', 'IN_PROGRESS') THEN 1 ELSE 0 END) AS openStepCount
      FROM construction_types ct
      LEFT JOIN projects p ON p.construction_type_id = ct.id
      LEFT JOIN project_steps ps ON ps.project_id = p.id
      GROUP BY ct.id, ct.code, ct.name
      ORDER BY ct.id
    `),
  ]);

  const projectCompletionRate = projectTotal > 0 ? Math.round((projectDone / projectTotal) * 1000) / 10 : 0;
  const stepCompletionRate = stepTotal > 0 ? Math.round((stepDone / stepTotal) * 1000) / 10 : 0;
  const dueInMonthCompletionRate = dueInMonthTotal > 0 ? Math.round((dueInMonthDone / dueInMonthTotal) * 1000) / 10 : 0;

  return {
    yearMonth,
    range: {
      start: start.toISOString(),
      end: end.toISOString(),
    },
    totals: {
      projects: {
        total: projectTotal,
        done: projectDone,
        completionRate: projectCompletionRate,
      },
      steps: {
        total: stepTotal,
        done: stepDone,
        open: openStepTotal,
        overdueOpen: overdueOpenStepTotal,
        completionRate: stepCompletionRate,
      },
      dueInMonth: {
        total: dueInMonthTotal,
        done: dueInMonthDone,
        completionRate: dueInMonthCompletionRate,
      },
    },
    byConstructionType: constructionTypeRows.map((row) => ({
      constructionType: {
        id: row.constructionTypeId,
        code: row.constructionTypeCode,
        name: row.constructionTypeName,
      },
      projects: {
        total: Number(row.projectTotal),
        done: Number(row.projectDone),
      },
      steps: {
        total: Number(row.stepTotal),
        done: Number(row.stepDone),
        open: Number(row.openStepCount),
      },
    })),
    generatedAt: new Date().toISOString(),
  };
}
