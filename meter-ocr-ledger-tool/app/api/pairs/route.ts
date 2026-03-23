import { appendAuditLog, getActiveRunId, getRun, saveRun } from "@/lib/storage/fs-store";
import { fail, ok } from "@/lib/http";
import { parseUserId } from "@/lib/validation/form";
import { createAuditLog } from "@/server/services/run-service";
import { rebuildPhotoPairs, resolvePhotoPairSelection, summarizePhotoPairs } from "@/server/services/photo-pair-service";

interface ResolvePairPayload {
  runId?: string;
  roomNormalized?: string;
  selectedRemovalPhotoId?: string | null;
  selectedInstallPhotoId?: string | null;
}

export async function GET(request: Request): Promise<Response> {
  const runId = new URL(request.url).searchParams.get("runId") ?? (await getActiveRunId());
  if (!runId) {
    return ok({
      runId: null,
      pairs: [],
      pairSummary: { totalRooms: 0, ready: 0, missing: 0, duplicate: 0 }
    });
  }

  const run = await getRun(runId);
  if (!run) {
    return fail("run が見つかりません", 404);
  }

  const pairs = rebuildPhotoPairs(run);
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

  return ok({
    runId,
    pairs: pairs.map((pair) => ({
      ...pair,
      removalCandidates: pair.removalPhotoIds.map((photoId) => photoMap.get(photoId)).filter(Boolean),
      installCandidates: pair.installPhotoIds.map((photoId) => photoMap.get(photoId)).filter(Boolean)
    })),
    pairSummary: summarizePhotoPairs(pairs)
  });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const userId = parseUserId(request);
    const body = (await request.json().catch(() => ({}))) as ResolvePairPayload;
    const runId = body.runId ?? (await getActiveRunId());

    if (!runId) {
      return fail("runId が見つかりません", 400);
    }
    if (!body.roomNormalized?.trim()) {
      return fail("roomNormalized は必須です", 400);
    }

    const run = await getRun(runId);
    if (!run) {
      return fail("run が見つかりません", 404);
    }

    const updated = resolvePhotoPairSelection({
      run,
      roomNormalized: body.roomNormalized.trim(),
      selectedRemovalPhotoId: body.selectedRemovalPhotoId ?? undefined,
      selectedInstallPhotoId: body.selectedInstallPhotoId ?? undefined,
      userId
    });

    await saveRun(run);
    await appendAuditLog(
      createAuditLog({
        runId: run.runId,
        userId,
        action: "PAIR_RESOLVE",
        payload: {
          roomNormalized: updated.roomNormalized,
          selectedRemovalPhotoId: updated.selectedRemovalPhotoId,
          selectedInstallPhotoId: updated.selectedInstallPhotoId,
          status: updated.status
        }
      })
    );

    return ok({
      runId: run.runId,
      pair: updated,
      pairSummary: summarizePhotoPairs(run.photoPairs)
    });
  } catch (error) {
    return fail("写真ペアの確定に失敗しました", 500, error instanceof Error ? error.message : error);
  }
}
