import { PhotoRecord, RoomPhotoPair, RunData } from "@/types/domain";

interface PairCandidates {
  removalPhotoIds: string[];
  installPhotoIds: string[];
}

function sortPhotoIds(photoIds: string[], photoMap: Map<string, PhotoRecord>): string[] {
  return [...photoIds].sort((a, b) => {
    const left = photoMap.get(a);
    const right = photoMap.get(b);
    if (!left || !right) {
      return a.localeCompare(b);
    }
    const byTime = right.uploadedAt.localeCompare(left.uploadedAt);
    if (byTime !== 0) {
      return byTime;
    }
    return left.fileName.localeCompare(right.fileName);
  });
}

function selectPhotoId(candidates: string[], previous: string | null | undefined): string | null {
  if (candidates.length === 1) {
    return candidates[0];
  }
  if (previous && candidates.includes(previous)) {
    return previous;
  }
  return null;
}

function buildPairStatus(args: {
  roomNormalized: string;
  candidates: PairCandidates;
  previous?: RoomPhotoPair;
  selectedRemovalPhotoId?: string | null;
  selectedInstallPhotoId?: string | null;
  userId?: string;
}): RoomPhotoPair {
  const now = new Date().toISOString();

  const selectedRemovalPhotoId =
    args.selectedRemovalPhotoId !== undefined
      ? args.selectedRemovalPhotoId
      : selectPhotoId(args.candidates.removalPhotoIds, args.previous?.selectedRemovalPhotoId);
  const selectedInstallPhotoId =
    args.selectedInstallPhotoId !== undefined
      ? args.selectedInstallPhotoId
      : selectPhotoId(args.candidates.installPhotoIds, args.previous?.selectedInstallPhotoId);

  const reasons: string[] = [];

  if (!args.candidates.removalPhotoIds.length) {
    reasons.push("取り外し前写真がありません");
  }
  if (!args.candidates.installPhotoIds.length) {
    reasons.push("取り付け後写真がありません");
  }

  if (args.candidates.removalPhotoIds.length > 1 && !selectedRemovalPhotoId) {
    reasons.push("取り外し前写真が複数あるため1枚選択してください");
  }
  if (args.candidates.installPhotoIds.length > 1 && !selectedInstallPhotoId) {
    reasons.push("取り付け後写真が複数あるため1枚選択してください");
  }

  let status: RoomPhotoPair["status"] = "READY";
  if (!args.candidates.removalPhotoIds.length || !args.candidates.installPhotoIds.length) {
    status = "MISSING";
  } else if (!selectedRemovalPhotoId || !selectedInstallPhotoId) {
    status = "DUPLICATE";
  }

  return {
    roomNormalized: args.roomNormalized,
    removalPhotoIds: args.candidates.removalPhotoIds,
    installPhotoIds: args.candidates.installPhotoIds,
    selectedRemovalPhotoId,
    selectedInstallPhotoId,
    status,
    reasons,
    updatedAt: now,
    updatedBy: args.userId ?? args.previous?.updatedBy
  };
}

export function rebuildPhotoPairs(run: RunData): RoomPhotoPair[] {
  const photoMap = new Map(run.photos.map((photo) => [photo.fileId, photo]));
  const previousMap = new Map(run.photoPairs.map((pair) => [pair.roomNormalized, pair]));
  const grouped = new Map<string, PairCandidates>();

  for (const photo of run.photos) {
    if (!photo.roomNormalized) {
      continue;
    }
    if (photo.photoType !== "REMOVAL" && photo.photoType !== "INSTALL") {
      continue;
    }
    const bucket = grouped.get(photo.roomNormalized) ?? { removalPhotoIds: [], installPhotoIds: [] };
    if (photo.photoType === "REMOVAL") {
      bucket.removalPhotoIds.push(photo.fileId);
    }
    if (photo.photoType === "INSTALL") {
      bucket.installPhotoIds.push(photo.fileId);
    }
    grouped.set(photo.roomNormalized, bucket);
  }

  const rooms = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b));
  const pairs = rooms.map((roomNormalized) => {
    const candidates = grouped.get(roomNormalized) ?? { removalPhotoIds: [], installPhotoIds: [] };
    const normalizedCandidates: PairCandidates = {
      removalPhotoIds: sortPhotoIds(candidates.removalPhotoIds, photoMap),
      installPhotoIds: sortPhotoIds(candidates.installPhotoIds, photoMap)
    };
    return buildPairStatus({
      roomNormalized,
      candidates: normalizedCandidates,
      previous: previousMap.get(roomNormalized)
    });
  });

  run.photoPairs = pairs;
  return pairs;
}

export function resolvePhotoPairSelection(args: {
  run: RunData;
  roomNormalized: string;
  selectedRemovalPhotoId?: string | null;
  selectedInstallPhotoId?: string | null;
  userId: string;
}): RoomPhotoPair {
  const photoMap = new Map(args.run.photos.map((photo) => [photo.fileId, photo]));
  rebuildPhotoPairs(args.run);
  const index = args.run.photoPairs.findIndex((pair) => pair.roomNormalized === args.roomNormalized);
  if (index < 0) {
    throw new Error("指定された部屋の写真ペアが見つかりません");
  }

  const current = args.run.photoPairs[index];
  const nextRemoval =
    args.selectedRemovalPhotoId !== undefined ? args.selectedRemovalPhotoId : current.selectedRemovalPhotoId;
  const nextInstall =
    args.selectedInstallPhotoId !== undefined ? args.selectedInstallPhotoId : current.selectedInstallPhotoId;

  if (nextRemoval && !current.removalPhotoIds.includes(nextRemoval)) {
    throw new Error("選択された取り外し写真が候補に存在しません");
  }
  if (nextInstall && !current.installPhotoIds.includes(nextInstall)) {
    throw new Error("選択された取り付け写真が候補に存在しません");
  }

  const updated = buildPairStatus({
    roomNormalized: current.roomNormalized,
    candidates: {
      removalPhotoIds: sortPhotoIds(current.removalPhotoIds, photoMap),
      installPhotoIds: sortPhotoIds(current.installPhotoIds, photoMap)
    },
    previous: current,
    selectedRemovalPhotoId: nextRemoval,
    selectedInstallPhotoId: nextInstall,
    userId: args.userId
  });

  args.run.photoPairs[index] = updated;
  return updated;
}

export function summarizePhotoPairs(pairs: RoomPhotoPair[]): {
  totalRooms: number;
  ready: number;
  missing: number;
  duplicate: number;
} {
  return {
    totalRooms: pairs.length,
    ready: pairs.filter((pair) => pair.status === "READY").length,
    missing: pairs.filter((pair) => pair.status === "MISSING").length,
    duplicate: pairs.filter((pair) => pair.status === "DUPLICATE").length
  };
}
