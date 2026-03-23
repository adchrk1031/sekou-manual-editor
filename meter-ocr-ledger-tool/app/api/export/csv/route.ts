import fs from "node:fs/promises";
import path from "node:path";
import { recordsToAllCsv, recordsToUpdateCsv } from "@/lib/csv/export";
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

    const allCsv = recordsToAllCsv(run.processRecords);
    const updateCsv = recordsToUpdateCsv(run.processRecords);

    const outDir = path.join(process.cwd(), "storage", "runs", run.runId, "exports");
    await fs.mkdir(outDir, { recursive: true });

    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const allPath = path.join(outDir, `result-all-${ts}.csv`);
    const updatePath = path.join(outDir, `result-updatable-${ts}.csv`);

    await fs.writeFile(allPath, allCsv, "utf-8");
    await fs.writeFile(updatePath, updateCsv, "utf-8");

    await appendAuditLog(
      createAuditLog({
        runId,
        userId,
        action: "EXPORT_CSV",
        payload: {
          allPath,
          updatePath,
          approved: run.processRecords.filter((record) => record.approvedForOutput).length
        }
      })
    );

    return ok({
      runId,
      allPath,
      updatePath,
      dryRun: run.settings.dryRun
    });
  } catch (error) {
    return fail("CSV出力に失敗しました", 500, error instanceof Error ? error.message : error);
  }
}
