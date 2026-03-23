import path from "node:path";
import { writeUpdatedWorkbookCopy } from "@/lib/excel/writer";
import { appendAuditLog, getActiveRunId, getRun } from "@/lib/storage/fs-store";
import { fail, ok } from "@/lib/http";
import { createAuditLog } from "@/server/services/run-service";
import { parseUserId } from "@/lib/validation/form";

export async function POST(request: Request): Promise<Response> {
  try {
    const userId = parseUserId(request);
    const body = (await request.json().catch(() => ({}))) as { runId?: string };
    const runId = body.runId ?? (await getActiveRunId());

    if (!runId) {
      return fail("runId が見つかりません", 400);
    }

    const run = await getRun(runId);
    if (!run) {
      return fail("run が見つかりません", 404);
    }

    if (!run.excelFile || !run.mapping) {
      return fail("Excel設定がありません", 400);
    }

    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const outputPath = path.join(process.cwd(), "storage", "runs", run.runId, "exports", `updated-copy-${ts}.xlsx`);
    writeUpdatedWorkbookCopy(run, outputPath);

    await appendAuditLog(
      createAuditLog({
        runId,
        userId,
        action: "EXPORT_EXCEL",
        payload: {
          outputPath,
          approved: run.processRecords.filter((record) => record.approvedForOutput).length,
          dryRun: run.settings.dryRun
        }
      })
    );

    return ok({
      runId,
      outputPath,
      dryRun: run.settings.dryRun
    });
  } catch (error) {
    return fail("Excel出力に失敗しました", 500, error instanceof Error ? error.message : error);
  }
}
