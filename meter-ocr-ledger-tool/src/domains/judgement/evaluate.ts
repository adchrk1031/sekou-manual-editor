import { AppSettings, LedgerRow, OcrExtract, PhotoRecord, ProcessRecord, ProcessStatus, RoomUpdateCandidate } from "@/types/domain";
import { createId } from "@/lib/storage/fs-store";
import { normalizeMeterNo } from "@/lib/normalize/room";

export interface EvaluateInput {
  runId: string;
  roomNo: string | null;
  ledgerRow: LedgerRow | null;
  settings: AppSettings;
  removalPhoto: PhotoRecord | null;
  removalOcr: OcrExtract | null;
  installPhoto: PhotoRecord | null;
  installOcr: OcrExtract | null;
  siblingPhotoIds: string[];
}

function withDefaultCandidate(): RoomUpdateCandidate {
  return {
    removalReading: null,
    installMeterNo: null,
    installReading: null
  };
}

export function evaluateRoom(input: EvaluateInput): ProcessRecord {
  const reasons: string[] = [];
  const candidate = withDefaultCandidate();

  const checks = {
    roomDetected: Boolean(input.roomNo),
    roomExistsInLedger: Boolean(input.ledgerRow),
    removalReadingValid: false,
    installMeterNoValid: false,
    installReadingValid: false,
    deltaValid: false,
    confidenceValid: false
  };

  if (!input.roomNo) {
    reasons.push("部屋番号が一意に抽出できません");
  }
  if (!input.ledgerRow) {
    reasons.push("台帳に該当部屋がありません");
  }
  if (!input.removalPhoto) {
    reasons.push("取り外し写真が不足しています");
  }
  if (!input.installPhoto) {
    reasons.push("取り付け写真が不足しています");
  }

  if (input.removalOcr?.error) {
    reasons.push(`取り外しOCRエラー: ${input.removalOcr.error}`);
  }
  if (input.installOcr?.error) {
    reasons.push(`取り付けOCRエラー: ${input.installOcr.error}`);
  }

  if (input.removalOcr?.reading !== null && input.removalOcr?.reading !== undefined) {
    candidate.removalReading = input.removalOcr.reading;
    checks.removalReadingValid = true;
  } else {
    reasons.push("取り外し検針値をOCR抽出できません");
  }

  if (input.installOcr?.meterNo) {
    candidate.installMeterNo = normalizeMeterNo(input.installOcr.meterNo);
    checks.installMeterNoValid = true;
  } else {
    reasons.push("取付メーターNoをOCR抽出できません");
  }

  if (input.installOcr?.reading !== null && input.installOcr?.reading !== undefined) {
    candidate.installReading = input.installOcr.reading;
    checks.installReadingValid = true;
  } else {
    reasons.push("取り付け検針値をOCR抽出できません");
  }

  const removalConfidence = input.removalOcr?.readingConfidence ?? 0;
  const installMeterConfidence = input.installOcr?.meterNoConfidence ?? 0;
  const installReadingConfidence = input.installOcr?.readingConfidence ?? 0;

  checks.confidenceValid =
    removalConfidence >= input.settings.ocrConfidenceThreshold &&
    installMeterConfidence >= input.settings.ocrConfidenceThreshold &&
    installReadingConfidence >= input.settings.ocrConfidenceThreshold;

  if (!checks.confidenceValid) {
    reasons.push("OCR信頼度が閾値未満です");
  }

  if (input.ledgerRow && input.ledgerRow.previousReading !== null && candidate.removalReading !== null) {
    if (candidate.removalReading < input.ledgerRow.previousReading) {
      reasons.push("取り外し検針値が前回値を下回っています");
    } else {
      const delta = candidate.removalReading - input.ledgerRow.previousReading;
      if (delta > input.settings.maxDeltaThreshold) {
        reasons.push("取り外し検針値の差分が閾値を超えています");
      } else {
        checks.deltaValid = true;
      }
    }
  } else {
    checks.deltaValid = true;
  }

  if (input.ledgerRow?.plannedInstallMeterNo && candidate.installMeterNo) {
    if (input.ledgerRow.plannedInstallMeterNo !== candidate.installMeterNo) {
      reasons.push("取付メーターNoが台帳の予定値と一致しません");
    }
  }

  const hardNg = reasons.some(
    (reason) =>
      reason.includes("前回値を下回") || reason.includes("一致しません") || reason.includes("台帳に該当部屋がありません")
  );

  const hasError = reasons.some((reason) => reason.includes("OCRエラー"));

  let status: ProcessStatus = "OK_AUTO";

  if (hasError) {
    status = "ERROR";
  } else if (hardNg) {
    status = "NG";
  } else if (reasons.length > 0) {
    status = "NEED_REVIEW";
  }

  const approvedForOutput = false;

  return {
    recordId: createId("rec"),
    runId: input.runId,
    roomNormalized: input.roomNo,
    ledgerRowIndex: input.ledgerRow?.rowIndex ?? null,
    removalPhotoId: input.removalPhoto?.fileId ?? null,
    installPhotoId: input.installPhoto?.fileId ?? null,
    photoIds: input.siblingPhotoIds,
    candidate,
    status,
    reasons,
    confidence: {
      removalReading: removalConfidence,
      installMeterNo: installMeterConfidence,
      installReading: installReadingConfidence
    },
    checks,
    approvedForOutput
  };
}
