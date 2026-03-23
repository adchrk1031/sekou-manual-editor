import { appendAuditLog, getActiveRunId, getRun, saveRun } from "@/lib/storage/fs-store";
import { fail, ok } from "@/lib/http";
import { createAuditLog, executePhotoOnlyScan } from "@/server/services/run-service";
import { parseUserId } from "@/lib/validation/form";
import { getOcrRuntimeStatus } from "@/lib/ocr/runner";
import { rebuildPhotoPairs, summarizePhotoPairs } from "@/server/services/photo-pair-service";

export async function POST(request: Request): Promise<Response> {
  try {
    const userId = parseUserId(request);
    const body = (await request.json().catch(() => ({}))) as { runId?: string };
    const runId = body.runId ?? (await getActiveRunId());

    if (!runId) {
      return fail("runId が見つかりません。先に写真を取り込んでください", 400);
    }

    const run = await getRun(runId);
    if (!run) {
      return fail("run が存在しません", 404);
    }

    if (!run.photos.length) {
      return fail("写真が未アップロードです", 400);
    }

    const pairSummary = summarizePhotoPairs(rebuildPhotoPairs(run));
    if (pairSummary.totalRooms > 0 && pairSummary.ready < pairSummary.totalRooms) {
      return fail("写真ペアが未確定です。Step 2Cで1部屋1枚ずつ確定してください", 400, pairSummary);
    }

    const ocrStatus = getOcrRuntimeStatus();
    if (!ocrStatus.available) {
      return fail(ocrStatus.message ?? "OCR設定を確認してください", 400, { engine: ocrStatus.engine });
    }

    const executed = await executePhotoOnlyScan(run);
    await saveRun(executed);

    await appendAuditLog(
      createAuditLog({
        runId: run.runId,
        userId,
        action: "RUN_SCAN_PHOTOS",
        payload: {
          summary: executed.summary,
          records: executed.processRecords.length
        }
      })
    );

    return ok({
      runId: executed.runId,
      summary: executed.summary,
      totalRecords: executed.processRecords.length
    });
  } catch (error) {
    return fail("写真のみOCR実行に失敗しました", 500, error instanceof Error ? error.message : error);
  }
}
