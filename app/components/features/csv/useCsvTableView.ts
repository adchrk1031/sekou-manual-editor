"use client";

import type { CSSProperties } from "react";
import { useDeferredValue, useMemo } from "react";
import { CSV_PROJECT_FIELD_ALIASES, getCsvHeaderLabel } from "../../planner/constants";
import type { CsvExportFilter, CsvRecord } from "../../planner/types";
import { createCsvValueGetter } from "../../planner/utils/csv";

export type CsvVisibleRow = {
  row: CsvRecord;
  index: number;
};

type UseCsvTableViewArgs = {
  csvDraftRows: CsvRecord[];
  csvHeaders: string[];
  csvSearch: string;
  csvExportFilter: CsvExportFilter;
  csvPage: number;
  csvPageSize: number;
  csvSelectedRows: number[];
  projectExportMetaById: Map<string, { exported: boolean }>;
};

const CSV_COLUMN_WIDTH_MIN_CHARS = 10;
const CSV_COLUMN_WIDTH_MAX_CHARS = 36;
const CSV_COLUMN_WIDTH_SAMPLE_LIMIT = 120;

function clampCsvWidth(value: number): number {
  return Math.max(CSV_COLUMN_WIDTH_MIN_CHARS, Math.min(CSV_COLUMN_WIDTH_MAX_CHARS, value));
}

export function useCsvTableView({
  csvDraftRows,
  csvHeaders,
  csvSearch,
  csvExportFilter,
  csvPage,
  csvPageSize,
  csvSelectedRows,
  projectExportMetaById,
}: UseCsvTableViewArgs) {
  const deferredCsvSearch = useDeferredValue(csvSearch);

  const csvFilteredRows = useMemo(() => {
    const keyword = deferredCsvSearch.trim().toLowerCase();
    const rows = csvDraftRows.map((row, index) => ({ row, index }));
    return rows.filter(({ row }) => {
      const keywordMatched = !keyword
        || csvHeaders.some((header) => String(row[header] ?? "").toLowerCase().includes(keyword));
      if (!keywordMatched) {
        return false;
      }
      if (csvExportFilter === "all") {
        return true;
      }
      const getField = createCsvValueGetter(row);
      const projectId = getField(...CSV_PROJECT_FIELD_ALIASES.projectId).trim();
      const exported = projectExportMetaById.get(projectId)?.exported ?? false;
      return csvExportFilter === "exported" ? exported : !exported;
    });
  }, [csvDraftRows, csvHeaders, deferredCsvSearch, csvExportFilter, projectExportMetaById]);

  const csvTotalPages = Math.max(1, Math.ceil(csvFilteredRows.length / csvPageSize));

  const csvVisibleRows = useMemo(() => {
    const start = csvPage * csvPageSize;
    return csvFilteredRows.slice(start, start + csvPageSize);
  }, [csvFilteredRows, csvPage, csvPageSize]);

  const csvSelectedSet = useMemo(() => new Set(csvSelectedRows), [csvSelectedRows]);

  const csvAllVisibleSelected = useMemo(() => {
    if (!csvVisibleRows.length) {
      return false;
    }
    return csvVisibleRows.every(({ index }) => csvSelectedSet.has(index));
  }, [csvSelectedSet, csvVisibleRows]);

  const widthSampleRows = useMemo(() => {
    const sampledRows: CsvVisibleRow[] = [];
    const seenIndices = new Set<number>();

    const pushRow = (candidate: CsvVisibleRow): void => {
      if (seenIndices.has(candidate.index) || sampledRows.length >= CSV_COLUMN_WIDTH_SAMPLE_LIMIT) {
        return;
      }
      sampledRows.push(candidate);
      seenIndices.add(candidate.index);
    };

    csvVisibleRows.forEach(pushRow);
    csvFilteredRows.forEach(pushRow);

    return sampledRows;
  }, [csvFilteredRows, csvVisibleRows]);

  const csvColumnWidthMap = useMemo(() => {
    const map: Record<string, CSSProperties> = {};

    csvHeaders.forEach((header) => {
      const headerLength = getCsvHeaderLabel(header).length;
      const maxValueLength = widthSampleRows.reduce((max, { row }) => {
        const nextLength = String(row[header] ?? "").length;
        return Math.max(max, nextLength);
      }, 0);
      const charWidth = clampCsvWidth(Math.max(headerLength, maxValueLength) + 2);
      map[header] = { minWidth: `${charWidth}ch` };
    });

    return map;
  }, [csvHeaders, widthSampleRows]);

  return {
    csvFilteredRows,
    csvTotalPages,
    csvVisibleRows,
    csvSelectedSet,
    csvAllVisibleSelected,
    csvColumnWidthMap,
  };
}
