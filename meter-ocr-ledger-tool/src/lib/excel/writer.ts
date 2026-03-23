import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { ProcessRecord, RunData } from "@/types/domain";

function updateCell(
  sheet: XLSX.WorkSheet,
  column: string,
  row: number,
  value: string | number | null
): void {
  if (value === null || value === undefined) {
    return;
  }
  const cellAddress = `${column.toUpperCase()}${row}`;
  sheet[cellAddress] = {
    t: typeof value === "number" ? "n" : "s",
    v: value
  };
}

export function writeUpdatedWorkbookCopy(run: RunData, outputPath: string): string {
  if (!run.mapping || !run.excelFile) {
    throw new Error("Excelとマッピング設定が必要です");
  }

  const workbook = XLSX.readFile(run.excelFile.filePath, { cellStyles: true, cellDates: true });
  const sheet = workbook.Sheets[run.mapping.sheetName];
  if (!sheet) {
    throw new Error(`指定シートが存在しません: ${run.mapping.sheetName}`);
  }

  const approved = run.processRecords.filter((record) => record.approvedForOutput);

  for (const record of approved) {
    if (record.ledgerRowIndex === null) {
      continue;
    }

    const finalRemoval = record.manualOverride?.removalReading ?? record.candidate.removalReading;
    const finalInstallMeter = record.manualOverride?.installMeterNo ?? record.candidate.installMeterNo;
    const finalInstallReading = record.manualOverride?.installReading ?? record.candidate.installReading;

    updateCell(sheet, run.mapping.removalReadingOutputColumn, record.ledgerRowIndex, finalRemoval);
    updateCell(sheet, run.mapping.installMeterNoOutputColumn, record.ledgerRowIndex, finalInstallMeter);
    updateCell(sheet, run.mapping.installReadingOutputColumn, record.ledgerRowIndex, finalInstallReading);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  XLSX.writeFile(workbook, outputPath, { bookType: "xlsx" });
  return outputPath;
}

export function buildSheetUpdateRows(records: ProcessRecord[]): Array<[string, string, string, string]> {
  return records
    .filter((record) => record.approvedForOutput && record.roomNormalized)
    .map((record) => {
      const removal = record.manualOverride?.removalReading ?? record.candidate.removalReading;
      const meter = record.manualOverride?.installMeterNo ?? record.candidate.installMeterNo;
      const install = record.manualOverride?.installReading ?? record.candidate.installReading;
      return [
        record.roomNormalized ?? "",
        removal !== null ? String(removal) : "",
        meter ?? "",
        install !== null ? String(install) : ""
      ];
    });
}
