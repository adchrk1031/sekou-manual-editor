import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFilename } from "../../src/lib/filename/parse.ts";

test("parseFilename extracts room 101 from common patterns", () => {
  const samples = ["101.jpg", "101_1.jpg", "101-1.jpg", "101号室.jpg", "room101.jpg", "R101.png"];

  for (const name of samples) {
    const parsed = parseFilename(name);
    assert.equal(parsed.roomNormalized, "101", name);
  }
});

test("parseFilename detects photo type from keyword", () => {
  const oldParsed = parseFilename("101_old.jpg");
  const newParsed = parseFilename("101_new.jpg");

  assert.equal(oldParsed.photoType, "REMOVAL");
  assert.equal(newParsed.photoType, "INSTALL");
});
