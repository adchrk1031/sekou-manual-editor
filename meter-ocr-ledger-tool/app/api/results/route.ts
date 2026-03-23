import { getActiveRunId, getRun } from "@/lib/storage/fs-store";
import { fail, ok } from "@/lib/http";
import { rebuildPhotoPairs, summarizePhotoPairs } from "@/server/services/photo-pair-service";

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const runId = searchParams.get("runId") ?? (await getActiveRunId());
  const status = searchParams.get("status");

  if (!runId) {
    return ok({
      runId: null,
      summary: { total: 0, okAuto: 0, needReview: 0, ng: 0, error: 0 },
      records: []
    });
  }

  const run = await getRun(runId);
  if (!run) {
    return fail("run が見つかりません", 404);
  }

  const records = status
    ? run.processRecords.filter((record) => record.status === status)
    : run.processRecords;

  if (!run.photoPairs.length && run.photos.length) {
    rebuildPhotoPairs(run);
  }

  const photoMap = new Map(
    run.photos.map((photo) => [
      photo.fileId,
      {
        fileId: photo.fileId,
        fileName: photo.fileName,
        photoType: photo.photoType,
        uploadedAt: photo.uploadedAt
      }
    ])
  );

  const photoPairs = run.photoPairs.map((pair) => ({
    ...pair,
    removalCandidates: pair.removalPhotoIds.map((photoId) => photoMap.get(photoId)).filter(Boolean),
    installCandidates: pair.installPhotoIds.map((photoId) => photoMap.get(photoId)).filter(Boolean)
  }));

  return ok({
    runId,
    summary: run.summary,
    records,
    photoPairs,
    pairSummary: summarizePhotoPairs(run.photoPairs),
    photos: run.photos.length,
    ledgerRows: run.ledgerRows.length,
    settings: run.settings,
    mapping: run.mapping
  });
}
