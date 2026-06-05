import type { ReactNode } from "react";
import type { StatusTone } from "../operationPolicy";

export type StatusSummaryItem = {
  id: string;
  label: string;
  value: string;
  detail?: string;
  tone?: StatusTone;
};

type StatusSummaryPanelProps = {
  title: string;
  lead?: string;
  items: StatusSummaryItem[];
  footnote?: ReactNode;
  compact?: boolean;
};

export function StatusSummaryPanel({ title, lead, items, footnote, compact = false }: StatusSummaryPanelProps) {
  return (
    <section className={`status-summary-panel ${compact ? "is-compact" : ""}`}>
      <div className="status-summary-head">
        <h3>{title}</h3>
        {lead ? <p className="mini">{lead}</p> : null}
      </div>
      <div className="status-summary-grid">
        {items.map((item) => (
          <article key={item.id} className={`status-summary-card ${item.tone ? `is-${item.tone}` : ""}`}>
            <p className="status-summary-label">{item.label}</p>
            <p className="status-summary-value">{item.value}</p>
            {item.detail ? <p className="status-summary-detail">{item.detail}</p> : null}
          </article>
        ))}
      </div>
      {footnote ? <div className="status-summary-footnote">{footnote}</div> : null}
    </section>
  );
}
