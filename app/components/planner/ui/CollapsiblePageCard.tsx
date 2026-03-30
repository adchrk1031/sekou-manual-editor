import type { ReactNode } from "react";
import { UiIcon } from "./UiIcon";

export type PageCardStatusTone = "done" | "todo";

type CollapsiblePageCardProps = {
  id: string;
  indexLabel: string;
  title: string;
  description: ReactNode;
  statusLabel: string;
  statusTone: PageCardStatusTone;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
};

export function CollapsiblePageCard({
  id,
  indexLabel,
  title,
  description,
  statusLabel,
  statusTone,
  isOpen,
  onToggle,
  children,
}: CollapsiblePageCardProps) {
  const bodyId = `${id}-body`;

  return (
    <section className={`panel page-card ${isOpen ? "is-open" : "is-collapsed"}`} id={id}>
      <button
        type="button"
        className="page-card-toggle"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={bodyId}
      >
        <div className="page-card-head">
          <p className="page-card-index">{indexLabel}</p>
          <div className="page-card-title-block">
            <h2>{title}</h2>
            <p className="mini">{description}</p>
          </div>
        </div>
        <div className="page-card-toggle-meta">
          <span className={`page-card-status ${statusTone}`}>{statusLabel}</span>
          <span className="page-card-toggle-text">{isOpen ? "閉じる" : "開く"}</span>
          <span className="page-card-toggle-icon" aria-hidden="true">
            <UiIcon name={isOpen ? "up" : "down"} />
          </span>
        </div>
      </button>
      <div id={bodyId} className="page-card-body" hidden={!isOpen}>
        {children}
      </div>
    </section>
  );
}
