"use client";

import type { ProjectRevision } from "../../planner/types";

type RevisionPanelProps = {
  currentUserName: string;
  canEdit: boolean;
  projectName: string;
  revisions: ProjectRevision[];
  selectedRevisionId: string;
  onSelectRevision: (revisionId: string) => void;
  onSaveRevision: () => void;
  onRestoreRevision: () => void;
  notice: { type: "ok" | "error"; text: string } | null;
};

function formatRevisionAt(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "日時不明";
  }
  return parsed.toLocaleString("ja-JP");
}

export default function RevisionPanel({
  currentUserName,
  canEdit,
  projectName,
  revisions,
  selectedRevisionId,
  onSelectRevision,
  onSaveRevision,
  onRestoreRevision,
  notice,
}: RevisionPanelProps) {
  const selectedRevision = revisions.find((revision) => revision.id === selectedRevisionId) ?? null;
  const recentRevisions = revisions.slice(0, 5);

  return (
    <section style={{ borderRadius: "18px", background: "#ffffff", border: "1px solid #d7dee6", padding: "18px", display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1rem" }}>履歴プレビュー</h3>
          <p style={{ margin: "8px 0 0", color: "#5f6f82", lineHeight: 1.6 }}>
            {projectName || "選択中案件"} の状態を手動保存し、必要な時だけこのワークスペースから復元できます。
          </p>
        </div>
        <span style={{ borderRadius: "999px", background: "#e2e8f0", color: "#0f172a", padding: "8px 12px", fontSize: "0.82rem", fontWeight: 700 }}>
          操作ユーザー: {currentUserName || "不明"}
        </span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "end" }}>
        <button
          type="button"
          onClick={onSaveRevision}
          disabled={!canEdit}
          style={{
            border: 0,
            borderRadius: "12px",
            background: canEdit ? "#0f172a" : "#cbd5e1",
            color: "#ffffff",
            padding: "12px 16px",
            fontWeight: 700,
            cursor: canEdit ? "pointer" : "not-allowed",
          }}
        >
          現在内容を履歴保存
        </button>

        <label style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "280px", flex: "1 1 320px" }}>
          <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#5f6f82" }}>復元する履歴</span>
          <select
            value={selectedRevisionId}
            onChange={(event) => onSelectRevision(event.target.value)}
            style={{ minHeight: "44px", borderRadius: "12px", border: "1px solid #cbd5e1", background: "#ffffff", padding: "10px 12px" }}
          >
            <option value="">履歴を選択</option>
            {revisions.map((revision) => (
              <option key={revision.id} value={revision.id}>
                {formatRevisionAt(revision.at)} / {revision.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={onRestoreRevision}
          disabled={!canEdit || !selectedRevision}
          style={{
            border: "1px solid #cbd5e1",
            borderRadius: "12px",
            background: !canEdit || !selectedRevision ? "#f8fafc" : "#eff6ff",
            color: !canEdit || !selectedRevision ? "#94a3b8" : "#1d4ed8",
            padding: "12px 16px",
            fontWeight: 700,
            cursor: !canEdit || !selectedRevision ? "not-allowed" : "pointer",
          }}
        >
          この時点に戻す
        </button>
      </div>

      {notice ? (
        <div
          style={{
            borderRadius: "12px",
            border: `1px solid ${notice.type === "error" ? "#fecdd3" : "#bfdbfe"}`,
            background: notice.type === "error" ? "#fff1f2" : "#eff6ff",
            color: notice.type === "error" ? "#9f1239" : "#1d4ed8",
            padding: "12px 14px",
            lineHeight: 1.6,
          }}
        >
          {notice.text}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 340px)", gap: "16px" }}>
        <div style={{ borderRadius: "14px", background: "#f8fafc", border: "1px solid #e2e8f0", padding: "14px 16px" }}>
          <h4 style={{ margin: 0, fontSize: "0.92rem" }}>選択中の履歴</h4>
          {selectedRevision ? (
            <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px", color: "#334155" }}>
              <div>保存日時: {formatRevisionAt(selectedRevision.at)}</div>
              <div>保存者: {selectedRevision.userName}</div>
              <div>ラベル: {selectedRevision.label}</div>
            </div>
          ) : (
            <p style={{ margin: "12px 0 0", color: "#64748b", lineHeight: 1.6 }}>
              まだ履歴が選択されていません。
            </p>
          )}
        </div>

        <div style={{ borderRadius: "14px", background: "#f8fafc", border: "1px solid #e2e8f0", padding: "14px 16px" }}>
          <h4 style={{ margin: 0, fontSize: "0.92rem" }}>最新 5 件</h4>
          {recentRevisions.length ? (
            <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {recentRevisions.map((revision) => (
                <button
                  key={revision.id}
                  type="button"
                  onClick={() => onSelectRevision(revision.id)}
                  style={{
                    textAlign: "left",
                    border: revision.id === selectedRevisionId ? "1px solid #93c5fd" : "1px solid #d7dee6",
                    borderRadius: "12px",
                    background: revision.id === selectedRevisionId ? "#eff6ff" : "#ffffff",
                    padding: "12px",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 700, color: "#0f172a" }}>{revision.label}</div>
                  <div style={{ marginTop: "6px", color: "#64748b", fontSize: "0.85rem", lineHeight: 1.5 }}>
                    {formatRevisionAt(revision.at)} / {revision.userName}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p style={{ margin: "12px 0 0", color: "#64748b", lineHeight: 1.6 }}>
              履歴はまだありません。まずは現在内容を履歴保存してください。
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
