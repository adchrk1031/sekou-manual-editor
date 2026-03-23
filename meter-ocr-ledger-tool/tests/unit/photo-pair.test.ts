import { test } from "node:test";
import assert from "node:assert/strict";
import { rebuildPhotoPairs, resolvePhotoPairSelection } from "../../src/server/services/photo-pair-service.ts";
import { RunData } from "../../src/types/domain.ts";

function makeRun(): RunData {
  const now = new Date().toISOString();
  return {
    runId: "run_test",
    createdAt: now,
    updatedAt: now,
    createdBy: "tester",
    excelFile: null,
    mapping: null,
    settings: {
      ocrConfidenceThreshold: 0.8,
      maxDeltaThreshold: 1500,
      dryRun: true,
      productionWriteEnabled: false
    },
    ledgerRows: [],
    photos: [
      {
        fileId: "r1",
        fileName: "201-old-a.jpg",
        filePath: "/tmp/r1.jpg",
        sha256: "r1",
        uploadedAt: now,
        roomNormalized: "201",
        roomCandidates: ["201"],
        roomParseConfidence: 1,
        photoType: "REMOVAL"
      },
      {
        fileId: "r2",
        fileName: "201-old-b.jpg",
        filePath: "/tmp/r2.jpg",
        sha256: "r2",
        uploadedAt: now,
        roomNormalized: "201",
        roomCandidates: ["201"],
        roomParseConfidence: 1,
        photoType: "REMOVAL"
      },
      {
        fileId: "i1",
        fileName: "201-new.jpg",
        filePath: "/tmp/i1.jpg",
        sha256: "i1",
        uploadedAt: now,
        roomNormalized: "201",
        roomCandidates: ["201"],
        roomParseConfidence: 1,
        photoType: "INSTALL"
      }
    ],
    photoPairs: [],
    photoResults: [],
    processRecords: [],
    summary: { total: 0, okAuto: 0, needReview: 0, ng: 0, error: 0 }
  };
}

test("rebuildPhotoPairs marks duplicate when removal has multiple candidates", () => {
  const run = makeRun();
  const pairs = rebuildPhotoPairs(run);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].roomNormalized, "201");
  assert.equal(pairs[0].status, "DUPLICATE");
  assert.equal(pairs[0].selectedInstallPhotoId, "i1");
  assert.equal(pairs[0].selectedRemovalPhotoId, null);
});

test("resolvePhotoPairSelection sets READY after selecting one removal photo", () => {
  const run = makeRun();
  rebuildPhotoPairs(run);
  const updated = resolvePhotoPairSelection({
    run,
    roomNormalized: "201",
    selectedRemovalPhotoId: "r2",
    userId: "operator-1"
  });

  assert.equal(updated.status, "READY");
  assert.equal(updated.selectedRemovalPhotoId, "r2");
  assert.equal(updated.selectedInstallPhotoId, "i1");
  assert.equal(updated.updatedBy, "operator-1");
});
