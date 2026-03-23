import fs from "node:fs/promises";
import path from "node:path";
import { EMPTY_SUMMARY } from "@/constants/defaults";
import { evaluateRoom } from "@/domains/judgement/evaluate";
import { resolveOcrEngine, runOcr } from "@/lib/ocr/runner";
import { createId } from "@/lib/storage/fs-store";
import { rebuildPhotoPairs } from "@/server/services/photo-pair-service";
import {
  AppSettings,
  AuditLog,
  LedgerRow,
  PhotoProcessingResult,
  PhotoRecord,
  ProcessRecord,
  RoomPhotoPair,
  RunData,
  RunSummary
} from "@/types/domain";

function summarize(records: ProcessRecord[]): RunSummary {
  const summary = { ...EMPTY_SUMMARY };
  summary.total = records.length;

  for (const record of records) {
    if (record.status === "OK_AUTO") summary.okAuto += 1;
    if (record.status === "NEED_REVIEW") summary.needReview += 1;
    if (record.status === "NG") summary.ng += 1;
    if (record.status === "ERROR") summary.error += 1;
  }

  return summary;
}

function findLedgerRow(ledgerRows: LedgerRow[], roomNo: string | null): LedgerRow | null {
  if (!roomNo) {
    return null;
  }
  const rows = ledgerRows.filter((row) => row.roomNormalized === roomNo);
  if (rows.length !== 1) {
    return null;
  }
  return rows[0];
}

function findPhotoById(photos: PhotoRecord[], photoId: string | null): PhotoRecord | null {
  if (!photoId) {
    return null;
  }
  return photos.find((photo) => photo.fileId === photoId) ?? null;
}

async function collectPhotoResults(run: RunData): Promise<PhotoProcessingResult[]> {
  const photoResults: PhotoProcessingResult[] = [];
  const fallbackEngine = resolveOcrEngine();

  for (const photo of run.photos) {
    try {
      const binary = await fs.readFile(photo.filePath);
      const ocr = await runOcr(binary);
      const resolvedRoom = photo.roomNormalized ?? ocr.roomNo ?? null;
      photoResults.push({
        photoId: photo.fileId,
        roomNormalized: resolvedRoom,
        photoType: photo.photoType,
        ocr
      });
    } catch (error) {
      photoResults.push({
        photoId: photo.fileId,
        roomNormalized: photo.roomNormalized,
        photoType: photo.photoType,
        ocr: {
          engine: fallbackEngine,
          fullText: "",
          roomNo: null,
          roomConfidence: 0,
          roomCandidates: [],
          meterNo: null,
          meterNoConfidence: 0,
          meterCandidates: [],
          reading: null,
          readingRaw: null,
          readingConfidence: 0,
          readingCandidates: [],
          error: error instanceof Error ? error.message : "OCR実行に失敗しました"
        }
      });
    }
  }

  return photoResults;
}

function listNoRoomPhotos(run: RunData): PhotoRecord[] {
  return run.photos.filter((photo) => !photo.roomNormalized);
}

function buildPairNeedReviewRecord(args: {
  runId: string;
  pair: RoomPhotoPair;
  removalPhoto: PhotoRecord | null;
  installPhoto: PhotoRecord | null;
  removalOcr: PhotoProcessingResult["ocr"] | null;
  installOcr: PhotoProcessingResult["ocr"] | null;
  ledgerRow: LedgerRow | null;
}): ProcessRecord {
  const reasons = [...args.pair.reasons, "写真ペア未確定のため処理対象外です"];
  const hasOcrError = Boolean(args.removalOcr?.error || args.installOcr?.error);

  return {
    recordId: createId("rec"),
    runId: args.runId,
    roomNormalized: args.pair.roomNormalized,
    ledgerRowIndex: args.ledgerRow?.rowIndex ?? null,
    removalPhotoId: args.removalPhoto?.fileId ?? null,
    installPhotoId: args.installPhoto?.fileId ?? null,
    photoIds: [...args.pair.removalPhotoIds, ...args.pair.installPhotoIds],
    candidate: {
      removalReading: args.removalOcr?.reading ?? null,
      installMeterNo: args.installOcr?.meterNo ?? null,
      installReading: args.installOcr?.reading ?? null
    },
    status: hasOcrError ? "ERROR" : "NEED_REVIEW",
    reasons,
    confidence: {
      removalReading: args.removalOcr?.readingConfidence ?? 0,
      installMeterNo: args.installOcr?.meterNoConfidence ?? 0,
      installReading: args.installOcr?.readingConfidence ?? 0
    },
    checks: {
      roomDetected: true,
      roomExistsInLedger: Boolean(args.ledgerRow),
      removalReadingValid: false,
      installMeterNoValid: false,
      installReadingValid: false,
      deltaValid: false,
      confidenceValid: false
    },
    approvedForOutput: false
  };
}

export async function executePhotoOnlyScan(run: RunData): Promise<RunData> {
  const photoResults = await collectPhotoResults(run);
  run.photoResults = photoResults;
  const photoResultMap = new Map(photoResults.map((result) => [result.photoId, result]));
  const pairs = rebuildPhotoPairs(run);
  const noRoomPhotos = listNoRoomPhotos(run);
  const records: ProcessRecord[] = [];

  for (const pair of pairs) {
    const removalPhoto = findPhotoById(run.photos, pair.selectedRemovalPhotoId);
    const installPhoto = findPhotoById(run.photos, pair.selectedInstallPhotoId);
    const removalOcr = removalPhoto ? photoResultMap.get(removalPhoto.fileId)?.ocr ?? null : null;
    const installOcr = installPhoto ? photoResultMap.get(installPhoto.fileId)?.ocr ?? null : null;
    const hasOcrError = Boolean(removalOcr?.error || installOcr?.error);

    if (pair.status !== "READY") {
      records.push(
        buildPairNeedReviewRecord({
          runId: run.runId,
          pair,
          removalPhoto,
          installPhoto,
          removalOcr,
          installOcr,
          ledgerRow: null
        })
      );
      continue;
    }

    const reasons: string[] = [];
    const removalReading = removalOcr?.reading ?? null;
    const installMeterNo = installOcr?.meterNo ?? null;
    const installReading = installOcr?.reading ?? null;

    if (removalPhoto && removalReading === null) {
      reasons.push("取り外し前の検針値を抽出できません");
    }
    if (installPhoto && !installMeterNo) {
      reasons.push("取り付け後のメーターNoを抽出できません");
    }
    if (installPhoto && installReading === null) {
      reasons.push("取り付け後の検針値を抽出できません");
    }

    const confidenceValid =
      (removalOcr?.readingConfidence ?? 0) >= run.settings.ocrConfidenceThreshold &&
      (installOcr?.meterNoConfidence ?? 0) >= run.settings.ocrConfidenceThreshold &&
      (installOcr?.readingConfidence ?? 0) >= run.settings.ocrConfidenceThreshold;

    if (!confidenceValid) {
      reasons.push("OCR信頼度が閾値未満です");
    }

    let status: ProcessRecord["status"] = "OK_AUTO";
    if (hasOcrError) {
      status = "ERROR";
    } else if (reasons.length > 0) {
      status = "NEED_REVIEW";
    }

    records.push({
      recordId: createId("rec"),
      runId: run.runId,
      roomNormalized: pair.roomNormalized,
      ledgerRowIndex: null,
      removalPhotoId: removalPhoto?.fileId ?? null,
      installPhotoId: installPhoto?.fileId ?? null,
      photoIds: [...pair.removalPhotoIds, ...pair.installPhotoIds],
      candidate: {
        removalReading,
        installMeterNo,
        installReading
      },
      status,
      reasons,
      confidence: {
        removalReading: removalOcr?.readingConfidence ?? 0,
        installMeterNo: installOcr?.meterNoConfidence ?? 0,
        installReading: installOcr?.readingConfidence ?? 0
      },
      checks: {
        roomDetected: true,
        roomExistsInLedger: true,
        removalReadingValid: removalReading !== null,
        installMeterNoValid: Boolean(installMeterNo),
        installReadingValid: installReading !== null,
        deltaValid: true,
        confidenceValid
      },
      approvedForOutput: false
    });
  }

  for (const photo of noRoomPhotos) {
    const result = photoResults.find((item) => item.photoId === photo.fileId);
    records.push({
      recordId: createId("rec"),
      runId: run.runId,
      roomNormalized: null,
      ledgerRowIndex: null,
      removalPhotoId: photo.photoType === "REMOVAL" ? photo.fileId : null,
      installPhotoId: photo.photoType === "INSTALL" ? photo.fileId : null,
      photoIds: [photo.fileId],
      candidate: {
        removalReading: result?.ocr.reading ?? null,
        installMeterNo: result?.ocr.meterNo ?? null,
        installReading: result?.ocr.reading ?? null
      },
      status: result?.ocr.error ? "ERROR" : "NEED_REVIEW",
      reasons: [photo.parseReason ?? "部屋番号を特定できません"],
      confidence: {
        removalReading: result?.ocr.readingConfidence ?? 0,
        installMeterNo: result?.ocr.meterNoConfidence ?? 0,
        installReading: result?.ocr.readingConfidence ?? 0
      },
      checks: {
        roomDetected: false,
        roomExistsInLedger: false,
        removalReadingValid: false,
        installMeterNoValid: false,
        installReadingValid: false,
        deltaValid: false,
        confidenceValid: false
      },
      approvedForOutput: false
    });
  }

  run.processRecords = records.sort((a, b) => (a.roomNormalized ?? "").localeCompare(b.roomNormalized ?? ""));
  run.summary = summarize(run.processRecords);

  return run;
}

export async function executeRun(run: RunData): Promise<RunData> {
  const photoResults = await collectPhotoResults(run);
  run.photoResults = photoResults;
  const photoResultMap = new Map(photoResults.map((result) => [result.photoId, result]));
  const pairs = rebuildPhotoPairs(run);
  const noRoomPhotos = listNoRoomPhotos(run);
  const records: ProcessRecord[] = [];

  for (const pair of pairs) {
    const removalPhoto = findPhotoById(run.photos, pair.selectedRemovalPhotoId);
    const installPhoto = findPhotoById(run.photos, pair.selectedInstallPhotoId);
    const removalOcr = removalPhoto ? photoResultMap.get(removalPhoto.fileId)?.ocr ?? null : null;
    const installOcr = installPhoto ? photoResultMap.get(installPhoto.fileId)?.ocr ?? null : null;
    const ledgerRow = findLedgerRow(run.ledgerRows, pair.roomNormalized);

    if (pair.status !== "READY") {
      records.push(
        buildPairNeedReviewRecord({
          runId: run.runId,
          pair,
          removalPhoto,
          installPhoto,
          removalOcr,
          installOcr,
          ledgerRow
        })
      );
      continue;
    }

    const record = evaluateRoom({
      runId: run.runId,
      roomNo: pair.roomNormalized,
      ledgerRow,
      settings: run.settings,
      removalPhoto,
      removalOcr,
      installPhoto,
      installOcr,
      siblingPhotoIds: [...pair.removalPhotoIds, ...pair.installPhotoIds]
    });

    records.push(record);
  }

  for (const photo of noRoomPhotos) {
    const result = photoResults.find((item) => item.photoId === photo.fileId);
    records.push({
      recordId: createId("rec"),
      runId: run.runId,
      roomNormalized: null,
      ledgerRowIndex: null,
      removalPhotoId: photo.photoType === "REMOVAL" ? photo.fileId : null,
      installPhotoId: photo.photoType === "INSTALL" ? photo.fileId : null,
      photoIds: [photo.fileId],
      candidate: {
        removalReading: result?.ocr.reading ?? null,
        installMeterNo: result?.ocr.meterNo ?? null,
        installReading: result?.ocr.reading ?? null
      },
      status: result?.ocr.error ? "ERROR" : "NEED_REVIEW",
      reasons: [photo.parseReason ?? "部屋番号を特定できません"],
      confidence: {
        removalReading: result?.ocr.readingConfidence ?? 0,
        installMeterNo: result?.ocr.meterNoConfidence ?? 0,
        installReading: result?.ocr.readingConfidence ?? 0
      },
      checks: {
        roomDetected: false,
        roomExistsInLedger: false,
        removalReadingValid: false,
        installMeterNoValid: false,
        installReadingValid: false,
        deltaValid: false,
        confidenceValid: false
      },
      approvedForOutput: false
    });
  }

  run.processRecords = records.sort((a, b) => (a.roomNormalized ?? "").localeCompare(b.roomNormalized ?? ""));
  run.summary = summarize(run.processRecords);

  return run;
}

export function updateRunSettings(run: RunData, settings: AppSettings): RunData {
  run.settings = settings;
  return run;
}

export function createAuditLog(args: Omit<AuditLog, "logId" | "createdAt">): AuditLog {
  return {
    ...args,
    logId: createId("log"),
    createdAt: new Date().toISOString()
  };
}

export function createRunFilePath(runId: string, ...parts: string[]): string {
  return path.join(process.cwd(), "storage", "runs", runId, ...parts);
}
