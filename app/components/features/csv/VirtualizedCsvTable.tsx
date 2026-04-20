"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CSV_PROJECT_FIELD_ALIASES, getCsvHeaderLabel } from "../../planner/constants";
import type { CsvRecord } from "../../planner/types";
import { createCsvValueGetter } from "../../planner/utils/csv";
import { UiIcon } from "../../planner/ui/UiIcon";
import type { CsvVisibleRow } from "./useCsvTableView";

type VirtualizedCsvTableProps = {
  canEdit: boolean;
  csvHeaders: string[];
  csvVisibleRows: CsvVisibleRow[];
  csvAllVisibleSelected: boolean;
  toggleCsvVisibleSelection: (checked: boolean) => void;
  csvColumnWidthMap: Record<string, CSSProperties>;
  csvSelectedSet: Set<number>;
  toggleCsvRowSelection: (index: number) => void;
  updateCsvCell: (index: number, header: string, value: string) => void;
  deleteCsvRow: (index: number) => void;
  projectExportMetaById: Map<string, { exported: boolean }>;
};

const CSV_VIRTUAL_ROW_HEIGHT = 58;
const CSV_VIRTUAL_OVERSCAN = 8;
const CSV_VIRTUAL_MAX_VIEWPORT_HEIGHT = 420;

function getColumnMinWidth(width: CSSProperties | undefined): string {
  return typeof width?.minWidth === "string" ? width.minWidth : "12ch";
}

export function VirtualizedCsvTable({
  canEdit,
  csvHeaders,
  csvVisibleRows,
  csvAllVisibleSelected,
  toggleCsvVisibleSelection,
  csvColumnWidthMap,
  csvSelectedSet,
  toggleCsvRowSelection,
  updateCsvCell,
  deleteCsvRow,
  projectExportMetaById,
}: VirtualizedCsvTableProps) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    setScrollTop(0);
    bodyRef.current?.scrollTo({ top: 0 });
  }, [csvVisibleRows]);

  const gridTemplateColumns = useMemo(
    () => [
      "56px",
      ...csvHeaders.map((header) => getColumnMinWidth(csvColumnWidthMap[header])),
      "132px",
    ].join(" "),
    [csvColumnWidthMap, csvHeaders],
  );

  const viewportHeight = Math.min(
    Math.max(csvVisibleRows.length, 1) * CSV_VIRTUAL_ROW_HEIGHT,
    CSV_VIRTUAL_MAX_VIEWPORT_HEIGHT,
  );
  const totalHeight = csvVisibleRows.length * CSV_VIRTUAL_ROW_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / CSV_VIRTUAL_ROW_HEIGHT) - CSV_VIRTUAL_OVERSCAN);
  const visibleCount = Math.ceil(viewportHeight / CSV_VIRTUAL_ROW_HEIGHT) + CSV_VIRTUAL_OVERSCAN * 2;
  const endIndex = Math.min(csvVisibleRows.length, startIndex + visibleCount);
  const renderedRows = csvVisibleRows.slice(startIndex, endIndex);

  const tableStyle = useMemo(
    () => ({ ["--csv-grid-template" as string]: gridTemplateColumns }),
    [gridTemplateColumns],
  );

  return (
    <div className="table-wrap csv-editor-wrap csv-virtual-wrap">
      <div className="csv-virtual-table" style={tableStyle}>
        <div className="csv-virtual-header csv-virtual-grid-row">
          <div className="csv-virtual-cell csv-virtual-checkbox-cell">
            <input
              type="checkbox"
              aria-label="表示中の行を全選択"
              checked={csvAllVisibleSelected}
              onChange={(event) => toggleCsvVisibleSelection(event.target.checked)}
              disabled={!canEdit || !csvVisibleRows.length}
            />
          </div>
          {csvHeaders.map((header) => (
            <div key={`csv_header_${header}`} className="csv-virtual-cell csv-virtual-header-cell">
              {getCsvHeaderLabel(header)}
            </div>
          ))}
          <div className="csv-virtual-cell csv-virtual-header-cell csv-virtual-op-cell">操作</div>
        </div>

        {csvVisibleRows.length ? (
          <div
            ref={bodyRef}
            className="csv-virtual-body"
            style={{ height: `${viewportHeight}px` }}
            onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
          >
            <div className="csv-virtual-spacer" style={{ height: `${totalHeight}px` }}>
              {renderedRows.map(({ row, index }, offset) => {
                const absoluteIndex = startIndex + offset;
                const getField = createCsvValueGetter(row);
                const rowProjectId = getField(...CSV_PROJECT_FIELD_ALIASES.projectId).trim();
                const exported = projectExportMetaById.get(rowProjectId)?.exported ?? false;
                return (
                  <div
                    key={`csv_row_${index}`}
                    className={`csv-virtual-grid-row csv-virtual-data-row${exported ? " csv-row-exported" : ""}`}
                    style={{ transform: `translateY(${absoluteIndex * CSV_VIRTUAL_ROW_HEIGHT}px)` }}
                  >
                    <div className="csv-virtual-cell csv-virtual-checkbox-cell">
                      <input
                        type="checkbox"
                        aria-label={`${index + 1}行目を選択`}
                        checked={csvSelectedSet.has(index)}
                        onChange={() => toggleCsvRowSelection(index)}
                        disabled={!canEdit}
                      />
                    </div>
                    {csvHeaders.map((header) => (
                      <div key={`csv_cell_${index}_${header}`} className="csv-virtual-cell">
                        <input
                          className="control csv-cell-input"
                          value={(row as CsvRecord)[header] ?? ""}
                          onChange={(event) => updateCsvCell(index, header, event.target.value)}
                          disabled={!canEdit}
                        />
                      </div>
                    ))}
                    <div className="csv-virtual-cell csv-virtual-op-cell">
                      <button
                        type="button"
                        className="btn btn-danger csv-row-delete-btn"
                        onClick={() => deleteCsvRow(index)}
                        disabled={!canEdit}
                      >
                        <span className="btn-icon"><UiIcon name="delete" /></span>削除
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="csv-virtual-empty">該当データがありません</div>
        )}
      </div>
    </div>
  );
}
