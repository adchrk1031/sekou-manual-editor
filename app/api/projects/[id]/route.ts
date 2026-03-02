import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const projectId = Number(params.id);
  if (!Number.isFinite(projectId)) {
    return NextResponse.json({ error: "invalid_project_id" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      salesforceRecordId: true,
      projectName: true,
      customerName: true,
      status: true,
      startDate: true,
      dueDate: true,
      constructionType: {
        select: { id: true, code: true, name: true },
      },
      owner: {
        select: { id: true, name: true },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const steps = await prisma.projectStep.findMany({
    where: { projectId },
    orderBy: { stepOrder: "asc" },
    select: {
      id: true,
      stepOrder: true,
      stepCode: true,
      stepName: true,
      status: true,
      dueDate: true,
      completedAt: true,
      zone: {
        select: { id: true, code: true, name: true },
      },
      assignee: {
        select: { id: true, name: true },
      },
    },
  });

  const current = steps.find((s) => s.status === "TODO" || s.status === "IN_PROGRESS");

  return NextResponse.json({
    ...project,
    currentPosition: current
      ? {
          stepId: current.id,
          stepOrder: current.stepOrder,
          stepCode: current.stepCode,
          stepName: current.stepName,
          zone: current.zone,
        }
      : null,
    steps,
  });
}
