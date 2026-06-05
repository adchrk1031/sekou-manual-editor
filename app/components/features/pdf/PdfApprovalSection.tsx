import { APPROVAL_REQUEST_TEMPLATES } from "../../planner/approvalTemplates";
import type { ApprovalRequestItem, PdfTemplatePreset, Project, ScheduleRow } from "../../planner/types";
import { CardPreview } from "../../planner/ui/CardPreview";
import { UiIcon } from "../../planner/ui/UiIcon";

type PdfApprovalSectionProps = {
  className: string;
  selectedProject: Project;
  canEdit: boolean;
  approvalScheduleChunks: ScheduleRow[][];
  approvalSelectedPrintItems: ApprovalRequestItem[];
  approvalRequestItems: ApprovalRequestItem[];
  approvalHasUnselectedRows: boolean;
  approvalHasEmptyBodyRows: boolean;
  approvalDuplicateTemplateIds: Set<string>;
  formatDateWithWeekday: (date: string) => string;
  addApprovalRequestItem: () => void;
  removeApprovalRequestItem: (rowId: string) => void;
  updateApprovalRequestTemplate: (rowId: string, templateId: string) => void;
  updateApprovalRequestBody: (rowId: string, body: string) => void;
  onNoteApprovalExtraChange: (value: string) => void;
};

type PdfApprovalPrintPagesProps = {
  activePdfTemplate: PdfTemplatePreset;
  selectedProject: Project;
  approvalScheduleChunks: ScheduleRow[][];
  approvalSelectedPrintItems: ApprovalRequestItem[];
  formatDateWithWeekday: (date: string) => string;
};

export function PdfApprovalSection({
  className,
  selectedProject,
  canEdit,
  approvalScheduleChunks,
  approvalSelectedPrintItems,
  approvalRequestItems,
  approvalHasUnselectedRows,
  approvalHasEmptyBodyRows,
  approvalDuplicateTemplateIds,
  formatDateWithWeekday,
  addApprovalRequestItem,
  removeApprovalRequestItem,
  updateApprovalRequestTemplate,
  updateApprovalRequestBody,
  onNoteApprovalExtraChange,
}: PdfApprovalSectionProps) {
  return (
    <div className={className}>
      <section className="panel page-card" id="card-pdf5">
        <div className="page-card-head">
          <p className="page-card-index">PDF 5</p>
          <div>
            <h2>ご承認いただきたい事項</h2>
            <p className="mini">表の内容に加えて、承認事項テンプレートを行追加してPDF5ページへ反映できます</p>
          </div>
        </div>
        <CardPreview title="PDF5 ご承認いただきたい事項">
          <article className="preview-page">
            <h3>3．ご承認いただきたい事項</h3>
            <div className="table-wrap">
              <table className="schedule-table preview-table">
                <thead>
                  <tr><th style={{ width: "56px" }}>No</th><th style={{ width: "180px" }}>項目</th><th>内容</th></tr>
                </thead>
                <tbody>
                  {approvalScheduleChunks[0]?.map((row, idx) => (
                    <tr key={`preview_pdf5_${row.id}`}>
                      <td>{idx + 1}</td>
                      <td>{row.label}</td>
                      <td>{`時間: ${formatDateWithWeekday(row.startDate)} ${row.start}〜${formatDateWithWeekday(row.endDate)} ${row.end}`}</td>
                    </tr>
                  ))}
                  <tr>
                    <td>{(approvalScheduleChunks[0]?.length ?? 0) + 1}</td>
                    <td>特記事項</td>
                    <td>{selectedProject.noteSpecial || "なし"}</td>
                  </tr>
                  <tr>
                    <td>{(approvalScheduleChunks[0]?.length ?? 0) + 2}</td>
                    <td>承認事項追記</td>
                    <td>{selectedProject.noteApprovalExtra || "なし"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {approvalScheduleChunks.length > 1 ? <p className="mini">残りの工程は印刷時に続きページへ自動で分割されます。</p> : null}
            <div className="approval-request-preview">
              <h4>【ご承認いただきたい事項】</h4>
              {approvalSelectedPrintItems.length ? (
                <div className="approval-request-print-list">
                  {approvalSelectedPrintItems.map((item) => (
                    <section key={`approval_preview_${item.id}`} className="approval-request-print-item">
                      <p className="approval-request-print-title">■ {item.title}</p>
                      <p>{item.body}</p>
                    </section>
                  ))}
                </div>
              ) : (
                <p className="mini">テンプレートから選択された承認事項がここに表示されます。</p>
              )}
            </div>
          </article>
        </CardPreview>
        <div className="approval-request-editor">
          <div className="inline-row wrap approval-request-toolbar">
            <div>
              <h3 className="subsection-title">承認事項テンプレート</h3>
              <p className="mini">四角い表の4項目はそのままにし、対象の12件だけを追加行で管理します。</p>
            </div>
            <button type="button" className="btn btn-accent" onClick={addApprovalRequestItem} disabled={!canEdit}>
              <span className="btn-icon"><UiIcon name="addRow" /></span>行を追加
            </button>
          </div>
          <div className="approval-request-notices">
            {approvalHasUnselectedRows ? <p className="mini warn-text">承認事項テンプレートが未選択です。</p> : null}
            {approvalHasEmptyBodyRows ? <p className="mini warn-text">本文が空です。出力前に内容を入力してください。</p> : null}
            {approvalDuplicateTemplateIds.size ? <p className="mini warn-text">同じ承認事項が複数行で選択されています。</p> : null}
          </div>
          {approvalRequestItems.length ? (
            <div className="approval-request-list">
              {approvalRequestItems.map((item, index) => {
                const isDuplicate = item.templateId ? approvalDuplicateTemplateIds.has(item.templateId) : false;
                return (
                  <section key={item.id} className={`approval-request-row ${isDuplicate ? "is-duplicate" : ""}`}>
                    <div className="approval-request-row-head">
                      <p className="approval-request-row-no">No.{index + 1}</p>
                      <button type="button" className="btn btn-danger" onClick={() => removeApprovalRequestItem(item.id)} disabled={!canEdit}>
                        <span className="btn-icon"><UiIcon name="delete" /></span>削除
                      </button>
                    </div>
                    <label className="field">
                      <span>承認事項テンプレート</span>
                      <select
                        className={`control ${!item.templateId ? "control-missing" : ""}`}
                        value={item.templateId}
                        onChange={(event) => updateApprovalRequestTemplate(item.id, event.target.value)}
                      >
                        <option value="">テンプレートを選択してください</option>
                        {APPROVAL_REQUEST_TEMPLATES.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="approval-request-meta">
                      <p className="approval-request-selected-title">{item.title || "未選択"}</p>
                      {item.category ? <span className="status-chip subtle">{item.category}</span> : null}
                      {isDuplicate ? <span className="status-chip warn">重複選択</span> : null}
                    </div>
                    <label className="field">
                      <span>本文</span>
                      <textarea
                        className={`control textarea approval-request-textarea ${item.templateId && !item.body.trim() ? "control-missing" : ""}`}
                        value={item.body}
                        onChange={(event) => updateApprovalRequestBody(item.id, event.target.value)}
                        placeholder="テンプレートを選択すると本文が自動入力されます"
                      />
                    </label>
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="empty-state approval-request-empty">
              <p>承認事項の行がまだありません。</p>
              <p className="mini">「行を追加」から、12個のテンプレート候補を必要な分だけ選択してください。</p>
            </div>
          )}
          <label className="field">
            <span>自由追記（旧データ互換・任意）</span>
            <textarea className="control textarea" value={selectedProject.noteApprovalExtra} onChange={(event) => onNoteApprovalExtraChange(event.target.value)} />
          </label>
        </div>
      </section>
    </div>
  );
}

export function PdfApprovalPrintPages({
  activePdfTemplate,
  selectedProject,
  approvalScheduleChunks,
  approvalSelectedPrintItems,
  formatDateWithWeekday,
}: PdfApprovalPrintPagesProps) {
  return (
    <>
      <article className="print-page">
        <h2>3．{activePdfTemplate.sectionApproval}</h2>
        <table className="schedule-table approval-table">
          <thead>
            <tr><th style={{ width: "48px" }}>No</th><th style={{ width: "180px" }}>項目</th><th>内容</th></tr>
          </thead>
          <tbody>
            {approvalScheduleChunks[0]?.map((row, idx) => (
              <tr key={`approval_${row.id}`}>
                <td>{idx + 1}</td>
                <td>{row.label}</td>
                <td>
                  {row.label || "内容未入力"}
                  {row.note ? ` / 備考: ${row.note}` : ""}
                  {` / 時間: ${formatDateWithWeekday(row.startDate)} ${row.start}〜${formatDateWithWeekday(row.endDate)} ${row.end}`}
                </td>
              </tr>
            ))}
            <tr>
              <td>{(approvalScheduleChunks[0]?.length ?? 0) + 1}</td>
              <td>特記事項</td>
              <td>{selectedProject.noteSpecial || "なし"}</td>
            </tr>
            <tr>
              <td>{(approvalScheduleChunks[0]?.length ?? 0) + 2}</td>
              <td>承認事項追記</td>
              <td>{selectedProject.noteApprovalExtra || "なし"}</td>
            </tr>
          </tbody>
        </table>
        <section className="approval-request-print-section">
          <h3>【ご承認いただきたい事項】</h3>
          {approvalSelectedPrintItems.length ? (
            <div className="approval-request-print-list">
              {approvalSelectedPrintItems.map((item) => (
                <section key={`approval_print_${item.id}`} className="approval-request-print-item">
                  <p className="approval-request-print-title">■ {item.title}</p>
                  <p>{item.body}</p>
                </section>
              ))}
            </div>
          ) : selectedProject.noteApprovalExtra.trim() ? (
            <div className="approval-request-print-list">
              <section className="approval-request-print-item">
                <p className="approval-request-print-title">■ 自由追記</p>
                <p>{selectedProject.noteApprovalExtra}</p>
              </section>
            </div>
          ) : (
            <p className="mini">承認事項の追加選択はありません。</p>
          )}
        </section>
      </article>

      {approvalScheduleChunks.slice(1).map((chunk, chunkIndex) => (
        <article className="print-page" key={`approval_schedule_page_${chunkIndex}`}>
          <h2>3．{activePdfTemplate.sectionApproval}（工程表続き）</h2>
          <table className="schedule-table approval-table">
            <thead>
              <tr><th style={{ width: "48px" }}>No</th><th style={{ width: "180px" }}>項目</th><th>内容</th></tr>
            </thead>
            <tbody>
              {chunk.map((row, idx) => {
                const displayIndex = 5 + (chunkIndex * 10) + idx + 1;
                return (
                  <tr key={`approval_more_${row.id}`}>
                    <td>{displayIndex}</td>
                    <td>{row.label}</td>
                    <td>
                      {row.label || "内容未入力"}
                      {row.note ? ` / 備考: ${row.note}` : ""}
                      {` / 時間: ${formatDateWithWeekday(row.startDate)} ${row.start}〜${formatDateWithWeekday(row.endDate)} ${row.end}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </article>
      ))}
    </>
  );
}
