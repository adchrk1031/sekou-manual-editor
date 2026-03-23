import path from "node:path";
import {
  appendAuditLog,
  createId,
  getOrCreateActiveRun,
  getRun,
  hashBuffer,
  saveBinaryFile,
  saveRun,
  setActiveRunId
} from "@/lib/storage/fs-store";
import { readLedgerRows } from "@/lib/excel/reader";
import { excelMappingSchema } from "@/lib/validation/schemas";
import { fail, ok } from "@/lib/http";
import { createAuditLog } from "@/server/services/run-service";
import { parseUserId } from "@/lib/validation/form";

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function POST(request: Request): Promise<Response> {
  try {
    const formData = await request.formData();
    const runIdInput = formData.get("runId");
    const userId = parseUserId(request);

    let run =
      runIdInput && String(runIdInput).trim()
        ? await getRun(String(runIdInput))
        : await getOrCreateActiveRun(userId);

    if (!run) {
      return fail("指定された runId が存在しません", 404);
    }

    const parsed = excelMappingSchema.safeParse({
      sheetName: formData.get("sheetName"),
      headerRow: formData.get("headerRow"),
      roomColumn: formData.get("roomColumn"),
      previousReadingColumn: formData.get("previousReadingColumn") || undefined,
      plannedInstallMeterNoColumn: formData.get("plannedInstallMeterNoColumn") || undefined,
      removalReadingOutputColumn: formData.get("removalReadingOutputColumn"),
      installMeterNoOutputColumn: formData.get("installMeterNoOutputColumn"),
      installReadingOutputColumn: formData.get("installReadingOutputColumn")
    });

    if (!parsed.success) {
      return fail("マッピング設定が不正です", 400, parsed.error.flatten());
    }

    const file = formData.get("excel");
    if (!(file instanceof File)) {
      return fail("Excelファイルが必要です", 400);
    }

    const fileId = createId("excel");
    const fileName = sanitizeFileName(file.name);
    const targetPath = path.join(process.cwd(), "storage", "runs", run.runId, `${fileId}-${fileName}`);
    const buffer = Buffer.from(await file.arrayBuffer());

    await saveBinaryFile(targetPath, buffer);

    const mapping = {
      ...parsed.data,
      previousReadingColumn: parsed.data.previousReadingColumn || undefined,
      plannedInstallMeterNoColumn: parsed.data.plannedInstallMeterNoColumn || undefined
    };

    const ledgerRows = readLedgerRows(targetPath, mapping);

    run.excelFile = {
      fileId,
      fileName,
      filePath: targetPath,
      sha256: hashBuffer(buffer),
      uploadedAt: new Date().toISOString()
    };
    run.mapping = mapping;
    run.ledgerRows = ledgerRows;

    await saveRun(run);
    await setActiveRunId(run.runId);

    await appendAuditLog(
      createAuditLog({
        runId: run.runId,
        userId,
        action: "UPLOAD_EXCEL",
        payload: {
          fileName,
          mapping,
          ledgerRows: ledgerRows.length
        }
      })
    );

    return ok({
      runId: run.runId,
      ledgerRows: ledgerRows.length,
      excelFile: run.excelFile,
      mapping
    });
  } catch (error) {
    return fail("Excel取込に失敗しました", 500, error instanceof Error ? error.message : error);
  }
}
