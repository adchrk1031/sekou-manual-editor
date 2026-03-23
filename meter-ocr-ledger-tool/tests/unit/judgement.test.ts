import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateRoom } from "../../src/domains/judgement/evaluate.ts";
import { AppSettings, LedgerRow, OcrExtract, PhotoRecord } from "../../src/types/domain.ts";

const settings: AppSettings = {
  ocrConfidenceThreshold: 0.8,
  maxDeltaThreshold: 2000,
  dryRun: true,
  productionWriteEnabled: false
};

const ledger: LedgerRow = {
  rowIndex: 12,
  roomRaw: "101",
  roomNormalized: "101",
  previousReading: 1000,
  plannedInstallMeterNo: "072089",
  currentRemovalReading: null,
  currentInstallMeterNo: null,
  currentInstallReading: null
};

const removalPhoto: PhotoRecord = {
  fileId: "p1",
  fileName: "101_old.jpg",
  filePath: "/tmp/p1.jpg",
  sha256: "x",
  uploadedAt: new Date().toISOString(),
  roomNormalized: "101",
  roomCandidates: ["101"],
  roomParseConfidence: 1,
  photoType: "REMOVAL"
};

const installPhoto: PhotoRecord = {
  ...removalPhoto,
  fileId: "p2",
  fileName: "101_new.jpg",
  photoType: "INSTALL"
};

const removalOcr: OcrExtract = {
  engine: "google-vision",
  fullText: "",
  meterNo: null,
  meterNoConfidence: 0,
  meterCandidates: [],
  reading: 1200,
  readingRaw: "1200",
  readingConfidence: 0.95,
  readingCandidates: [],
  error: undefined
};

const installOcr: OcrExtract = {
  engine: "google-vision",
  fullText: "",
  meterNo: "072089",
  meterNoConfidence: 0.95,
  meterCandidates: [],
  reading: 5.2,
  readingRaw: "5.2",
  readingConfidence: 0.95,
  readingCandidates: [],
  error: undefined
};

test("evaluateRoom returns OK_AUTO when all checks pass", () => {
  const record = evaluateRoom({
    runId: "run_1",
    roomNo: "101",
    ledgerRow: ledger,
    settings,
    removalPhoto,
    removalOcr,
    installPhoto,
    installOcr,
    siblingPhotoIds: ["p1", "p2"]
  });

  assert.equal(record.status, "OK_AUTO");
  assert.equal(record.reasons.length, 0);
});

test("evaluateRoom returns NG when removal reading is lower than previous", () => {
  const record = evaluateRoom({
    runId: "run_1",
    roomNo: "101",
    ledgerRow: ledger,
    settings,
    removalPhoto,
    removalOcr: { ...removalOcr, reading: 999 },
    installPhoto,
    installOcr,
    siblingPhotoIds: ["p1", "p2"]
  });

  assert.equal(record.status, "NG");
});
