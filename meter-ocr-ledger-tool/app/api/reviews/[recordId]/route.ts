import { appendAuditLog, getActiveRunId, getRun, saveRun } from "@/lib/storage/fs-store";
import { fail, ok } from "@/lib/http";
import { reviewUpdateSchema } from "@/lib/validation/schemas";
import { createAuditLog } from "@/server/services/run-service";
import { parseUserId } from "@/lib/validation/form";

function refreshSummary(run: Awaited<ReturnType<typeof getRun>>): void {
  if (!run) {
    return;
  }
  run.summary = {
    total: run.processRecords.length,
    okAuto: run.processRecords.filter((record) => record.status === "OK_AUTO").length,
    needReview: run.processRecords.filter((record) => record.status === "NEED_REVIEW").length,
    ng: run.processRecords.filter((record) => record.status === "NG").length,
    error: run.processRecords.filter((record) => record.status === "ERROR").length
  };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ recordId: string }> }
): Promise<Response> {
  const runId = new URL(request.url).searchParams.get("runId") ?? (await getActiveRunId());
  if (!runId) {
    return fail("runId が未指定です", 400);
  }

  const run = await getRun(runId);
  if (!run) {
    return fail("run が見つかりません", 404);
  }

  const { recordId } = await context.params;
  const record = run.processRecords.find((item) => item.recordId === recordId);
  if (!record) {
    return fail("record が見つかりません", 404);
  }

  return ok({ runId, record });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ recordId: string }> }
): Promise<Response> {
  try {
    const userId = parseUserId(request);
    const payload = (await request.json()) as {
      runId?: string;
      approvedForOutput?: boolean;
      reviewedBy?: string;
      removalReading?: number | null;
      installMeterNo?: string | null;
      installReading?: number | null;
    };

    const runId = payload.runId ?? (await getActiveRunId());
    if (!runId) {
      return fail("runId が未指定です", 400);
    }

    const run = await getRun(runId);
    if (!run) {
      return fail("run が見つかりません", 404);
    }

    const parsed = reviewUpdateSchema.safeParse({
      approvedForOutput: payload.approvedForOutput,
      reviewedBy: payload.reviewedBy ?? userId,
      removalReading: payload.removalReading,
      installMeterNo: payload.installMeterNo,
      installReading: payload.installReading
    });

    if (!parsed.success) {
      return fail("レビュー更新内容が不正です", 400, parsed.error.flatten());
    }

    const { recordId } = await context.params;
    const record = run.processRecords.find((item) => item.recordId === recordId);

    if (!record) {
      return fail("record が見つかりません", 404);
    }

    record.approvedForOutput = parsed.data.approvedForOutput;
    record.reviewedBy = parsed.data.reviewedBy;
    record.reviewedAt = new Date().toISOString();
    record.manualOverride = {
      removalReading: parsed.data.removalReading ?? record.candidate.removalReading,
      installMeterNo: parsed.data.installMeterNo ?? record.candidate.installMeterNo,
      installReading: parsed.data.installReading ?? record.candidate.installReading
    };

    refreshSummary(run);

    await saveRun(run);
    await appendAuditLog(
      createAuditLog({
        runId: run.runId,
        recordId,
        userId,
        action: "REVIEW_UPDATE",
        payload: {
          approvedForOutput: record.approvedForOutput,
          manualOverride: record.manualOverride
        }
      })
    );

    return ok({ runId, record });
  } catch (error) {
    return fail("レビュー更新に失敗しました", 500, error instanceof Error ? error.message : error);
  }
}
