import { ProjectStepStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

type UpdateProjectStepBody = {
  status?: ProjectStepStatus;
  assigneeUserId?: number | null;
  dueDate?: string | null;
  comment?: string;
  changedBy?: number | null;
};

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const projectStepId = Number(params.id);
  if (!Number.isFinite(projectStepId)) {
    return NextResponse.json({ error: "invalid_project_step_id" }, { status: 400 });
  }

  let body: UpdateProjectStepBody = {};
  try {
    body = (await req.json()) as UpdateProjectStepBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const before = await tx.projectStep.findUnique({
      where: { id: projectStepId },
      select: {
        id: true,
        projectId: true,
        status: true,
      },
    });

    if (!before) {
      return null;
    }

    const statusChanged = body.status !== undefined && body.status !== before.status;
    const nextStatus = body.status ?? before.status;

    const updated = await tx.projectStep.update({
      where: { id: projectStepId },
      data: {
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.assigneeUserId !== undefined ? { assigneeUserId: body.assigneeUserId } : {}),
        ...(body.dueDate !== undefined ? { dueDate: body.dueDate ? new Date(body.dueDate) : null } : {}),
        completedAt:
          nextStatus === "DONE"
            ? new Date()
            : statusChanged
            ? null
            : undefined,
      },
      select: {
        id: true,
        projectId: true,
        status: true,
        completedAt: true,
      },
    });

    const needsHistory = statusChanged || Boolean(body.comment);
    if (needsHistory) {
      await tx.projectStepHistory.create({
        data: {
          projectStepId: projectStepId,
          oldStatus: before.status,
          newStatus: nextStatus,
          changedBy: body.changedBy ?? null,
          comment: body.comment ?? null,
        },
      });
    }

    const currentPosition = await tx.projectStep.findFirst({
      where: {
        projectId: before.projectId,
        status: { in: ["TODO", "IN_PROGRESS"] },
      },
      orderBy: { stepOrder: "asc" },
      select: {
        id: true,
        stepOrder: true,
        stepCode: true,
        stepName: true,
        zone: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    return {
      updated,
      currentPosition,
      historyCreated: needsHistory,
    };
  });

  if (!result) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    id: result.updated.id,
    projectId: result.updated.projectId,
    status: result.updated.status,
    completedAt: result.updated.completedAt,
    historyCreated: result.historyCreated,
    currentPosition: result.currentPosition
      ? {
          stepId: result.currentPosition.id,
          stepOrder: result.currentPosition.stepOrder,
          stepCode: result.currentPosition.stepCode,
          stepName: result.currentPosition.stepName,
          zone: result.currentPosition.zone,
        }
      : null,
  });
}
