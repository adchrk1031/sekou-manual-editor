import { test } from "node:test";
import assert from "node:assert/strict";
import { buildOcrExtract } from "../../src/lib/ocr/extract.ts";

test("buildOcrExtract extracts room, meter no and reading from meter sample text", () => {
  const fullText = [
    "OSAKI",
    "契約情報(検定外) kWh",
    "368949",
    "普通電力量計",
    "No.A17 G002 998",
    "MSE-3-0824-701",
    "701"
  ].join("\n");

  const out = buildOcrExtract(fullText, 0.95);

  assert.equal(out.roomNo, "701");
  assert.equal(out.meterNo, "A17G002998");
  assert.equal(out.reading, 368949);
});

test("buildOcrExtract reads digital meter display value like 00005.2", () => {
  const fullText = [
    "普通電力量計",
    "kWh",
    "000O5.2",
    "No. 072 516",
    "MSE-3-0824-201",
    "201"
  ].join("\n");

  const out = buildOcrExtract(fullText, 0.94);

  assert.equal(out.roomNo, "201");
  assert.equal(out.meterNo, "072516");
  assert.equal(out.reading, 5.2);
});
