import type { Project, ScheduleRow, TimelineWindow } from "../types";
import { CardPreview } from "./CardPreview";

type PdfWorkOverviewPreviewProps = {
  selectedProject: Project;
  dateRangeLabel: string;
  outageDateTimeLabel: string;
  timeline: {
    baseDate: string;
    fullSpan: number;
    windows: TimelineWindow[];
  };
  graphRows: ScheduleRow[];
  formatDateRange: (start: string, end: string) => string;
  fromTimelineOffset: (offset: number, baseDate: string) => { date: string; time: string };
  formatShortDate: (date: string) => string;
  tickLabel: (minutes: number) => string;
  toMinutes: (time: string) => number;
  normalizeRowRange: (start: number, end: number, span: number) => { start: number; end: number };
  toTimelineOffset: (date: string, time: string, baseDate: string) => number;
  clamp: (value: number, min: number, max: number) => number;
  getRowColorType: (row: Pick<ScheduleRow, "id" | "label"> & { outage?: boolean }) => "outage" | "main" | "additional";
  formatDateWithWeekday: (date: string) => string;
};

export function PdfWorkOverviewPreview({
  selectedProject,
  dateRangeLabel,
  outageDateTimeLabel,
  timeline,
  graphRows,
  formatDateRange,
  fromTimelineOffset,
  formatShortDate,
  tickLabel,
  toMinutes,
  normalizeRowRange,
  toTimelineOffset,
  clamp,
  getRowColorType,
  formatDateWithWeekday,
}: PdfWorkOverviewPreviewProps) {
  return (
    <CardPreview title="PDF3 工事概要・工程表">
      <article className="preview-page">
        <h3>1．工事概要</h3>
        <div className="preview-summary-lines">
          <p><strong>■ 工事件名</strong> {selectedProject.titleSubject}</p>
          <p><strong>■ 工事場所</strong> {selectedProject.propertyAddress || "-"}</p>
          <p><strong>■ 工事期間</strong> {dateRangeLabel}</p>
          <p><strong>■ 停電期間</strong> {outageDateTimeLabel}</p>
        </div>
        <h4>工事工程グラフ</h4>
        <div className="preview-timeline-stack">
          {timeline.windows.map((window, windowIndex) => (
            <div className="preview-timeline" key={`preview_window_${window.id}`}>
              {timeline.windows.length > 1 ? (
                <p className="mini timeline-split-caption">工程表 {windowIndex + 1}/{timeline.windows.length}（{formatDateRange(window.startDate, window.endDate)}）</p>
              ) : null}
              <div className="preview-timeline-scale">
                {window.labelTicks.map((tick) => {
                  const left = ((tick - window.viewStart) / window.viewSpan) * 100;
                  const point = fromTimelineOffset(tick, timeline.baseDate);
                  const labelDate = formatShortDate(point.date);
                  const labelTime = tickLabel(toMinutes(point.time));
                  const labelText = labelTime === "00:00" || tick === window.viewStart || tick === window.viewEnd ? `${labelDate} ${labelTime}` : labelTime;
                  return (
                    <span
                      key={`preview_pdf3_${window.id}_tick_${tick}`}
                      className={tick === window.viewStart ? "edge-left" : tick === window.viewEnd ? "edge-right" : ""}
                      style={{ left: `${Math.max(0, Math.min(100, left))}%` }}
                    >
                      {labelText}
                    </span>
                  );
                })}
              </div>
              <div className="preview-timeline-grid">
                {window.lineTicks.map((tick) => {
                  const left = ((tick - window.viewStart) / window.viewSpan) * 100;
                  return <i key={`preview_pdf3_${window.id}_line_${tick}`} style={{ left: `${Math.max(0, Math.min(100, left))}%` }} />;
                })}
                {graphRows.map((row) => {
                  const normalized = normalizeRowRange(
                    toTimelineOffset(row.startDate, row.start, timeline.baseDate),
                    toTimelineOffset(row.endDate, row.end, timeline.baseDate),
                    timeline.fullSpan,
                  );
                  const clippedStart = clamp(normalized.start, window.viewStart, window.viewEnd);
                  const clippedEnd = clamp(normalized.end, window.viewStart, window.viewEnd);
                  const visibleSpan = clippedEnd - clippedStart;
                  if (visibleSpan <= 0) {
                    return (
                      <div className="preview-timeline-row" key={`preview_pdf3_${window.id}_row_${row.id}`}>
                        <span className="preview-row-label">{row.label}</span>
                        <div className="preview-row-track" />
                      </div>
                    );
                  }
                  const left = ((clippedStart - window.viewStart) / window.viewSpan) * 100;
                  const width = Math.max(0.5, (visibleSpan / window.viewSpan) * 100);
                  const colorType = getRowColorType(row);
                  return (
                    <div className="preview-timeline-row" key={`preview_pdf3_${window.id}_row_${row.id}`}>
                      <span className="preview-row-label">{row.label}</span>
                      <div className="preview-row-track">
                        <div className={`preview-row-bar is-${colorType}`} style={{ left: `${left}%`, width: `${width}%` }}>
                          {row.label}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <h4>工事工程表</h4>
        <div className="table-wrap">
          <table className="schedule-table preview-table">
            <thead>
              <tr><th>項目</th><th>開始日時</th><th>終了日時</th><th>停電</th><th>備考</th></tr>
            </thead>
            <tbody>
              {selectedProject.outageEnabled ? (
                <tr>
                  <td>停電時間</td>
                  <td>{`${formatDateWithWeekday(selectedProject.outageDateStart)} ${selectedProject.outageTimeStart}`}</td>
                  <td>{`${formatDateWithWeekday(selectedProject.outageDateEnd)} ${selectedProject.outageTimeEnd}`}</td>
                  <td>有</td>
                  <td>全館停電</td>
                </tr>
              ) : null}
              {selectedProject.scheduleRows.slice(0, 5).map((row) => (
                <tr key={`preview_pdf3_table_${row.id}`}>
                  <td>{row.label}</td>
                  <td>{`${formatDateWithWeekday(row.startDate)} ${row.start}`}</td>
                  <td>{`${formatDateWithWeekday(row.endDate)} ${row.end}`}</td>
                  <td>{row.outage ? "有" : "無"}</td>
                  <td>{row.note || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </CardPreview>
  );
}
