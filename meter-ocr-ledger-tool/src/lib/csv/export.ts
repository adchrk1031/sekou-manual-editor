import { ProcessRecord } from "@/types/domain";

function esc(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function recordsToAllCsv(records: ProcessRecord[]): string {
  const header = [
    "recordId",
    "roomNo",
    "status",
    "reasons",
    "removalReading",
    "installMeterNo",
    "installReading",
    "approvedForOutput"
  ];

  const rows = records.map((record) => [
    record.recordId,
    record.roomNormalized,
    record.status,
    record.reasons.join(" | "),
    record.candidate.removalReading,
    record.candidate.installMeterNo,
    record.candidate.installReading,
    record.approvedForOutput ? "YES" : "NO"
  ]);

  return [header, ...rows].map((row) => row.map((v) => esc(v)).join(",")).join("\n");
}

export function recordsToUpdateCsv(records: ProcessRecord[]): string {
  const header = ["roomNo", "removalReading", "installMeterNo", "installReading", "recordId"];

  const rows = records
    .filter((record) => record.approvedForOutput)
    .map((record) => [
      record.roomNormalized,
      record.manualOverride?.removalReading ?? record.candidate.removalReading,
      record.manualOverride?.installMeterNo ?? record.candidate.installMeterNo,
      record.manualOverride?.installReading ?? record.candidate.installReading,
      record.recordId
    ]);

  return [header, ...rows].map((row) => row.map((v) => esc(v)).join(",")).join("\n");
}
