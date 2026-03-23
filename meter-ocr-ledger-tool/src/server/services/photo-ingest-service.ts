import path from "node:path";
import { PhotoType, RunData } from "@/types/domain";
import { parseFilename } from "@/lib/filename/parse";
import { createId, hashBuffer, saveBinaryFile } from "@/lib/storage/fs-store";

export interface IngestPhotoSource {
  fileName: string;
  buffer: Buffer;
  forceType?: PhotoType | null;
}

export interface IngestPhotoResult {
  uploaded: number;
  added: number;
  addedRemoval: number;
  addedInstall: number;
  addedUnknown: number;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function withForcedType(originalType: PhotoType, forced: PhotoType | null | undefined): PhotoType {
  if (!forced || forced === "UNKNOWN") {
    return originalType;
  }
  return forced;
}

export async function ingestPhotosToRun(run: RunData, sources: IngestPhotoSource[]): Promise<IngestPhotoResult> {
  const initialCount = run.photos.length;

  for (const source of sources) {
    const fileId = createId("photo");
    const fileName = sanitizeFileName(source.fileName);
    const parsed = parseFilename(fileName);
    const photoType = withForcedType(parsed.photoType, source.forceType ?? null);

    const targetPath = path.join(process.cwd(), "storage", "runs", run.runId, "photos", `${fileId}-${fileName}`);
    await saveBinaryFile(targetPath, source.buffer);

    const record = {
      fileId,
      fileName,
      filePath: targetPath,
      sha256: hashBuffer(source.buffer),
      uploadedAt: new Date().toISOString(),
      roomNormalized: parsed.roomNormalized,
      roomCandidates: parsed.candidates,
      roomParseConfidence: parsed.confidence,
      photoType,
      parseReason: parsed.reason
    } as const;

    const duplicated = run.photos.some((photo) => photo.sha256 === record.sha256);
    if (!duplicated) {
      run.photos.push(record);
    }
  }

  const added = run.photos.length - initialCount;
  const newlyAdded = run.photos.slice(initialCount);

  return {
    uploaded: sources.length,
    added,
    addedRemoval: newlyAdded.filter((photo) => photo.photoType === "REMOVAL").length,
    addedInstall: newlyAdded.filter((photo) => photo.photoType === "INSTALL").length,
    addedUnknown: newlyAdded.filter((photo) => photo.photoType === "UNKNOWN").length
  };
}
