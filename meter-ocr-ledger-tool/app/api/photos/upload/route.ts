import {
  appendAuditLog,
  getActiveRunId,
  getOrCreateActiveRun,
  getRun,
  saveRun
} from "@/lib/storage/fs-store";
import { fail, ok } from "@/lib/http";
import { createAuditLog } from "@/server/services/run-service";
import { parseUserId } from "@/lib/validation/form";
import { PhotoType } from "@/types/domain";
import { ingestPhotosToRun } from "@/server/services/photo-ingest-service";
import { rebuildPhotoPairs, summarizePhotoPairs } from "@/server/services/photo-pair-service";

export async function POST(request: Request): Promise<Response> {
  try {
    const formData = await request.formData();
    const userId = parseUserId(request);
    const runIdParam = formData.get("runId");

    let run = null;
    if (runIdParam) {
      run = await getRun(String(runIdParam));
      if (!run) {
        return fail("runId が見つかりません", 404);
      }
    } else {
      const active = await getActiveRunId();
      run = active ? await getRun(active) : null;
      if (!run) {
        run = await getOrCreateActiveRun(userId);
      }
    }

    const genericFiles = formData
      .getAll("photos")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0)
      .map((file) => ({ file, forceType: null as PhotoType | null }));

    const removalFiles = formData
      .getAll("removalPhotos")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0)
      .map((file) => ({ file, forceType: "REMOVAL" as PhotoType }));

    const installFiles = formData
      .getAll("installPhotos")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0)
      .map((file) => ({ file, forceType: "INSTALL" as PhotoType }));

    const files = [...genericFiles, ...removalFiles, ...installFiles];

    if (!files.length) {
      return fail("写真ファイルを1件以上指定してください", 400);
    }

    const ingestResult = await ingestPhotosToRun(
      run,
      await Promise.all(
        files.map(async (item) => ({
          fileName: item.file.name,
          buffer: Buffer.from(await item.file.arrayBuffer()),
          forceType: item.forceType
        }))
      )
    );
    const pairs = rebuildPhotoPairs(run);
    const pairSummary = summarizePhotoPairs(pairs);

    await saveRun(run);

    await appendAuditLog(
      createAuditLog({
        runId: run.runId,
        userId,
        action: "UPLOAD_PHOTOS",
        payload: {
          source: "local-upload",
          ...ingestResult,
          pairSummary,
          totalPhotos: run.photos.length
        }
      })
    );

    return ok({
      runId: run.runId,
      ...ingestResult,
      pairSummary,
      totalPhotos: run.photos.length
    });
  } catch (error) {
    return fail("写真アップロードに失敗しました", 500, error instanceof Error ? error.message : error);
  }
}
