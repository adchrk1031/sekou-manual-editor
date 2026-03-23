import * as XLSX from "xlsx";
import { ExcelMappingConfig, LedgerRow } from "@/types/domain";
import { normalizeMeterNo, normalizeRoom, toNumericReading } from "@/lib/normalize/room";

function cellAddress(column: string, row: number): string {
  return `${column.toUpperCase()}${row}`;
}

function getCellValue(sheet: XLSX.WorkSheet, column: string, row: number): string | number | null {
  const cell = sheet[cellAddress(column, row)];
  if (!cell) {
    return null;
  }
  if (cell.v === undefined || cell.v === null) {
    return null;
  }
  return cell.v as string | number;
}

export function readLedgerRows(filePath: string, mapping: ExcelMappingConfig): LedgerRow[] {
  const workbook = XLSX.readFile(filePath, { cellFormula: false, cellNF: false, cellText: true });
  const sheet = workbook.Sheets[mapping.sheetName];

  if (!sheet) {
    throw new Error(`指定シートが見つかりません: ${mapping.sheetName}`);
  }

  const rangeRef = sheet["!ref"];
  if (!rangeRef) {
    return [];
  }

  const range = XLSX.utils.decode_range(rangeRef);
  const lastRow = range.e.r + 1;

  const rows: LedgerRow[] = [];

  for (let row = mapping.headerRow + 1; row <= lastRow; row++) {
    const roomRawCell = getCellValue(sheet, mapping.roomColumn, row);
    if (roomRawCell === null || String(roomRawCell).trim() === "") {
      continue;
    }

    const roomRaw = String(roomRawCell).trim();
    const roomNormalized = normalizeRoom(roomRaw);
    if (!roomNormalized) {
      continue;
    }

    const prevRaw = mapping.previousReadingColumn
      ? getCellValue(sheet, mapping.previousReadingColumn, row)
      : null;
    const plannedMeterRaw = mapping.plannedInstallMeterNoColumn
      ? getCellValue(sheet, mapping.plannedInstallMeterNoColumn, row)
      : null;

    const currentRemoval = getCellValue(sheet, mapping.removalReadingOutputColumn, row);
    const currentInstallMeter = getCellValue(sheet, mapping.installMeterNoOutputColumn, row);
    const currentInstallReading = getCellValue(sheet, mapping.installReadingOutputColumn, row);

    rows.push({
      rowIndex: row,
      roomRaw,
      roomNormalized,
      previousReading: toNumericReading(prevRaw),
      plannedInstallMeterNo: plannedMeterRaw ? normalizeMeterNo(String(plannedMeterRaw)) : null,
      currentRemovalReading: toNumericReading(currentRemoval),
      currentInstallMeterNo: currentInstallMeter ? normalizeMeterNo(String(currentInstallMeter)) : null,
      currentInstallReading: toNumericReading(currentInstallReading)
    });
  }

  return rows;
}
