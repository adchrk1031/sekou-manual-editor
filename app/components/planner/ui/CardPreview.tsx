import type { ReactNode } from "react";

export function CardPreview({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="card-preview">
      <summary>
        <span className="card-preview-title">このカードの出力プレビュー</span>
        <span className="card-preview-hint">{title}</span>
      </summary>
      <div className="card-preview-canvas">{children}</div>
    </details>
  );
}
