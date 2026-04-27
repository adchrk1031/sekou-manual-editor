import type { CSSProperties, ChangeEvent, Dispatch, SetStateAction } from "react";
import { CSV_PAGE_SIZE_OPTIONS, getCsvHeaderLabel } from "../constants";
import type { CsvExportFilter, CsvRecord, UserCreateNotice } from "../types";
import { VirtualizedCsvTable } from "../../features/csv/VirtualizedCsvTable";
import type { CsvVisibleRow } from "../../features/csv/useCsvTableView";
import { UiIcon } from "./UiIcon";

type CsvEditorSectionProps = {
  isCsvMode: boolean;
  importStatus: string;
  canEdit: boolean;
  handleCsvImport: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  applyCsvRowsToProjects: (rows: CsvRecord[], sourceLabel: "import" | "editor") => void;
  csvDraftRows: CsvRecord[];
  exportCsvEditor: () => void;
  exportCsvEditorForExcel: () => void;
  addCsvRow: () => void;
  deleteSelectedCsvRows: () => void;
  csvSelectedRows: number[];
  deleteAllCsvRows: () => void;
  csvSearch: string;
  setCsvSearch: Dispatch<SetStateAction<string>>;
  csvExportFilter: CsvExportFilter;
  setCsvExportFilter: Dispatch<SetStateAction<CsvExportFilter>>;
  csvPageSize: number;
  setCsvPageSize: Dispatch<SetStateAction<number>>;
  newCsvColumn: string;
  setNewCsvColumn: Dispatch<SetStateAction<string>>;
  addCsvColumn: () => void;
  csvDeleteHeader: string;
  setCsvDeleteHeader: Dispatch<SetStateAction<string>>;
  csvHeaders: string[];
  deleteCsvColumn: () => void;
  csvBulkHeader: string;
  setCsvBulkHeader: Dispatch<SetStateAction<string>>;
  csvBulkValue: string;
  setCsvBulkValue: Dispatch<SetStateAction<string>>;
  applyBulkCsvEdit: () => void;
  csvBulkNotice: UserCreateNotice | null;
  setCsvBulkNotice: Dispatch<SetStateAction<UserCreateNotice | null>>;
  csvAllVisibleSelected: boolean;
  toggleCsvVisibleSelection: (checked: boolean) => void;
  csvVisibleRows: CsvVisibleRow[];
  csvColumnWidthMap: Record<string, CSSProperties>;
  csvSelectedSet: Set<number>;
  toggleCsvRowSelection: (index: number) => void;
  updateCsvCell: (index: number, header: string, value: string) => void;
  deleteCsvRow: (index: number) => void;
  projectExportMetaById: Map<string, { exported: boolean }>;
  csvPage: number;
  setCsvPage: Dispatch<SetStateAction<number>>;
  csvTotalPages: number;
};

export function CsvEditorSection({
  isCsvMode,
  importStatus,
  canEdit,
  handleCsvImport,
  applyCsvRowsToProjects,
  csvDraftRows,
  exportCsvEditor,
  exportCsvEditorForExcel,
  addCsvRow,
  deleteSelectedCsvRows,
  csvSelectedRows,
  deleteAllCsvRows,
  csvSearch,
  setCsvSearch,
  csvExportFilter,
  setCsvExportFilter,
  csvPageSize,
  setCsvPageSize,
  newCsvColumn,
  setNewCsvColumn,
  addCsvColumn,
  csvDeleteHeader,
  setCsvDeleteHeader,
  csvHeaders,
  deleteCsvColumn,
  csvBulkHeader,
  setCsvBulkHeader,
  csvBulkValue,
  setCsvBulkValue,
  applyBulkCsvEdit,
  csvBulkNotice,
  setCsvBulkNotice,
  csvAllVisibleSelected,
  toggleCsvVisibleSelection,
  csvVisibleRows,
  csvColumnWidthMap,
  csvSelectedSet,
  toggleCsvRowSelection,
  updateCsvCell,
  deleteCsvRow,
  projectExportMetaById,
  csvPage,
  setCsvPage,
  csvTotalPages,
}: CsvEditorSectionProps) {
  if (!isCsvMode) {
    return null;
  }

  return (
    <>
      <p className="import-status">{importStatus}</p>
      <section className="panel csv-editor-panel">
        <div className="panel-head">
          <h3 className="section-title"><span className="section-icon"><UiIcon name="template" /></span>CSV編集スペース</h3>
          <p className="mini">取込後にこの画面で修正し、案件データへ再反映できます。反映後は `/notice` で停電案内文も起こせます。</p>
        </div>
        <details className="csv-mapping-guide">
          <summary>CSVカラム対応表（ここだけ埋めれば、ほぼ自動でPDF化）</summary>
          <div className="csv-mapping-body">
            <p className="mini">必須: <code>project_id（または 案件ID）</code></p>
            <p className="mini">推奨: <code>案件名 / 物件名</code>、<code>件名</code>、<code>工事開始日・工事終了日</code>、<code>停電開始日・停電終了日・停電開始時間・停電終了時間</code>、工事項目フラグ</p>
            <div className="table-wrap">
              <table className="schedule-table csv-mapping-table">
                <thead>
                  <tr>
                    <th>反映先</th>
                    <th>CSVカラム（どれか1つで可）</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>案件ID</td><td><code>project_id</code>, <code>案件ID</code></td></tr>
                  <tr><td>物件名</td><td><code>property_name</code>, <code>物件名</code>, <code>案件名</code>, <code>建物名</code></td></tr>
                  <tr><td>住所</td><td><code>property_address</code>, <code>住所</code>, <code>所在地</code>, <code>工事場所</code></td></tr>
                  <tr><td>件名</td><td><code>title_subject</code>, <code>件名</code>, <code>工事件名</code>, <code>工事名</code></td></tr>
                  <tr><td>工事期間</td><td><code>work_date_start</code>, <code>work_date_end</code>, <code>工事開始日</code>, <code>工事終了日</code></td></tr>
                  <tr><td>停電期間</td><td><code>outage_date_start</code>, <code>outage_date_end</code>, <code>停電開始日</code>, <code>停電終了日</code></td></tr>
                  <tr><td>停電時間</td><td><code>outage_time_start</code>, <code>outage_time_end</code>, <code>停電開始時間</code>, <code>停電終了時間</code></td></tr>
                  <tr><td>停電バー表示</td><td><code>outage_enabled</code>, <code>停電あり</code>, <code>停電有無</code>（例: 1/0, true/false, 有/無）</td></tr>
                  <tr><td>工事項目</td><td><code>flag_kouatsu_cable</code>, <code>flag_ugs</code>, <code>flag_pas</code>, <code>flag_ground_a</code>, <code>flag_ground_b</code>, <code>flag_ground_c</code> または <code>工事項目</code>（カンマ区切り）</td></tr>
                  <tr><td>特記事項・承認事項</td><td><code>note_special</code>, <code>note_approval_extra</code></td></tr>
                  <tr><td>PDF連絡先</td><td><code>pdf_company_name</code>, <code>pdf_team</code>, <code>pdf_contact_person</code>, <code>pdf_address</code>, <code>pdf_email</code>, <code>pdf_tel</code>, <code>pdf_fax</code></td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </details>
        <div className="csv-editor-toolbar">
          <div className="inline-row wrap">
            <label className="btn btn-subtle file-btn">
              <span className="btn-icon"><UiIcon name="upload" /></span>
              CSV取込
              <input type="file" accept=".csv,text/csv" onChange={handleCsvImport} disabled={!canEdit} />
            </label>
            <a
              className="btn btn-subtle"
              href="/test-data/sekou_csv_test_200.csv"
              download="sekou_csv_test_200.csv"
            >
              <span className="btn-icon"><UiIcon name="save" /></span>200件テストCSVをダウンロード
            </a>
            <button type="button" className="btn btn-accent" onClick={() => applyCsvRowsToProjects(csvDraftRows, "editor")} disabled={!canEdit || !csvDraftRows.length}>
              <span className="btn-icon"><UiIcon name="apply" /></span>この編集内容を案件に反映
            </button>
            <button type="button" className="btn btn-subtle" onClick={exportCsvEditor} disabled={!csvDraftRows.length}>
              <span className="btn-icon"><UiIcon name="save" /></span>CSVファイルを保存（ダウンロード）
            </button>
            <button type="button" className="btn btn-subtle" onClick={exportCsvEditorForExcel} disabled={!csvDraftRows.length}>
              <span className="btn-icon"><UiIcon name="save" /></span>Excelで保存
            </button>
            <button type="button" className="btn btn-subtle" onClick={addCsvRow} disabled={!canEdit || !csvHeaders.length}>
              <span className="btn-icon"><UiIcon name="plus" /></span>行追加
            </button>
            <button type="button" className="btn btn-danger" onClick={deleteSelectedCsvRows} disabled={!canEdit || !csvSelectedRows.length}>
              <span className="btn-icon"><UiIcon name="delete" /></span>選択削除
            </button>
            <button type="button" className="btn btn-danger" onClick={deleteAllCsvRows} disabled={!canEdit || !csvDraftRows.length}>
              <span className="btn-icon"><UiIcon name="clear" /></span>一括削除
            </button>
          </div>
          <div className="inline-row wrap">
            <label className="field csv-small-field">
              <span>検索</span>
              <input className="control" value={csvSearch} onChange={(event) => setCsvSearch(event.target.value)} placeholder="案件ID・物件名など" />
            </label>
            <label className="field csv-small-field">
              <span>出力状態</span>
              <select className="control" value={csvExportFilter} onChange={(event) => setCsvExportFilter(event.target.value as CsvExportFilter)}>
                <option value="all">全件</option>
                <option value="exported">PDF出力済み</option>
                <option value="unexported">未出力</option>
              </select>
            </label>
            <label className="field csv-small-field">
              <span>表示件数</span>
              <select className="control" value={csvPageSize} onChange={(event) => setCsvPageSize(Number(event.target.value))}>
                {CSV_PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={`csv_size_${size}`} value={size}>{size}件</option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="csv-editor-toolbar">
          <div className="inline-row wrap csv-column-add-row">
            <label className="field csv-small-field">
              <span>列追加（任意）</span>
              <input className="control" value={newCsvColumn} onChange={(event) => setNewCsvColumn(event.target.value)} placeholder="new_column" />
            </label>
            <button type="button" className="btn btn-subtle" onClick={addCsvColumn} disabled={!canEdit || !newCsvColumn.trim()}>
              <span className="btn-icon"><UiIcon name="plus" /></span>列追加
            </button>
            <label className="field csv-small-field">
              <span>列削除（任意）</span>
              <select
                className="control"
                value={csvDeleteHeader}
                onChange={(event) => {
                  setCsvDeleteHeader(event.target.value);
                  setCsvBulkNotice(null);
                }}
                disabled={!canEdit || !csvHeaders.length}
              >
                {!csvHeaders.length ? <option value="">削除できる列がありません</option> : null}
                {csvHeaders.map((header) => (
                  <option key={`delete_col_${header}`} value={header}>
                    {getCsvHeaderLabel(header)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn btn-danger"
              onClick={deleteCsvColumn}
              disabled={!canEdit || !csvHeaders.length || !csvDeleteHeader}
            >
              <span className="btn-icon"><UiIcon name="delete" /></span>列削除
            </button>
          </div>
          <div className="inline-row wrap csv-bulk-edit-row">
            <label className="field csv-small-field">
              <span>選択編集（列）</span>
              <select
                className="control"
                value={csvBulkHeader}
                onChange={(event) => {
                  setCsvBulkHeader(event.target.value);
                  setCsvBulkNotice(null);
                }}
                disabled={!canEdit || !csvHeaders.length}
              >
                {csvHeaders.map((header) => (
                  <option key={`bulk_col_${header}`} value={header}>
                    {getCsvHeaderLabel(header)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field csv-small-field">
              <span>一括入力する値</span>
              <input
                className="control"
                value={csvBulkValue}
                onChange={(event) => {
                  setCsvBulkValue(event.target.value);
                  setCsvBulkNotice(null);
                }}
                placeholder="選択行に入力する値"
                disabled={!canEdit}
              />
            </label>
            <div className="field csv-bulk-action-field">
              <span className="csv-bulk-action-label">実行</span>
              <button
                type="button"
                className="btn btn-subtle csv-bulk-action-btn"
                onClick={applyBulkCsvEdit}
                disabled={!canEdit || !csvSelectedRows.length || !csvHeaders.length}
              >
                <span className="btn-icon"><UiIcon name="apply" /></span>選択行へ一括反映
              </button>
            </div>
          </div>
          {csvBulkNotice ? <p className={`mini ${csvBulkNotice.type === "error" ? "error-text" : "ok-text"}`}>{csvBulkNotice.text}</p> : null}
          <p className="mini">行: {csvDraftRows.length} / 列: {csvHeaders.length} / 選択: {csvSelectedRows.length}</p>
        </div>

        {!csvHeaders.length ? (
          <p className="mini">CSVを取り込むと、ここで編集できるようになります。</p>
        ) : (
          <>
            <VirtualizedCsvTable
              canEdit={canEdit}
              csvHeaders={csvHeaders}
              csvVisibleRows={csvVisibleRows}
              csvAllVisibleSelected={csvAllVisibleSelected}
              toggleCsvVisibleSelection={toggleCsvVisibleSelection}
              csvColumnWidthMap={csvColumnWidthMap}
              csvSelectedSet={csvSelectedSet}
              toggleCsvRowSelection={toggleCsvRowSelection}
              updateCsvCell={updateCsvCell}
              deleteCsvRow={deleteCsvRow}
              projectExportMetaById={projectExportMetaById}
            />
            <div className="csv-pagination">
              <button type="button" className="btn btn-subtle" onClick={() => setCsvPage((prev) => Math.max(0, prev - 1))} disabled={csvPage <= 0}>
                <span className="btn-icon"><UiIcon name="arrowLeft" /></span>前へ
              </button>
              <span className="mini">{csvPage + 1} / {csvTotalPages}</span>
              <button type="button" className="btn btn-subtle" onClick={() => setCsvPage((prev) => Math.min(csvTotalPages - 1, prev + 1))} disabled={csvPage >= csvTotalPages - 1}>
                <span className="btn-icon"><UiIcon name="arrowRight" /></span>次へ
              </button>
            </div>
          </>
        )}
      </section>
    </>
  );
}
