import { RunSummary } from "@/types/domain";

export function SummaryCards({ summary }: { summary: RunSummary }) {
  return (
    <div className="summary-grid" style={{ marginBottom: 16 }}>
      <div className="summary-item">
        <div style={{ fontSize: 12, color: "var(--muted)" }}>総件数</div>
        <div style={{ fontSize: 24, fontWeight: 800 }}>{summary.total}</div>
      </div>
      <div className="summary-item">
        <div style={{ fontSize: 12, color: "var(--muted)" }}>自動反映候補</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: "var(--ok)" }}>{summary.okAuto}</div>
      </div>
      <div className="summary-item">
        <div style={{ fontSize: 12, color: "var(--muted)" }}>要確認</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: "var(--review)" }}>{summary.needReview}</div>
      </div>
      <div className="summary-item">
        <div style={{ fontSize: 12, color: "var(--muted)" }}>NG / ERROR</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: "var(--ng)" }}>
          {summary.ng} / {summary.error}
        </div>
      </div>
    </div>
  );
}
