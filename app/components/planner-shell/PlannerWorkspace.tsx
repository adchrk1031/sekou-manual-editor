"use client";

import { APPROVAL_STATUS_LABELS, PDF_TEMPLATE_PRESET_MAP, WORK_MASTER } from "../planner/constants";
import { formatDateRange, formatDateTimeRange } from "../planner/utils/dateTime";
import ProjectListPanel from "../features/project-core/ProjectListPanel";
import { useProjectWorkspace } from "../features/project-core/useProjectWorkspace";

function Field({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#5f6f82", letterSpacing: "0.03em" }}>{label}</span>
      <div style={{ minHeight: "44px", borderRadius: "12px", border: "1px solid #d7dee6", background: "#ffffff", padding: "12px 14px", lineHeight: 1.5 }}>
        {value || "-"}
      </div>
    </div>
  );
}

export default function PlannerWorkspace() {
  const {
    projects,
    selectedProject,
    selectedProjectId,
    setSelectedProjectId,
    loading,
    sharedReady,
    error,
  } = useProjectWorkspace();

  const selectedWorkLabels = selectedProject
    ? WORK_MASTER.filter((item) => selectedProject.selectedWorkCodes.includes(item.code)).map((item) => item.name)
    : [];

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f5f7fb 0%, #eef3f8 100%)",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: "1240px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        <section
          style={{
            borderRadius: "24px",
            background: "#0f172a",
            color: "#ffffff",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.8rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "#93c5fd" }}>
            Planner Workspace Preview
          </p>
          <h1 style={{ margin: 0, fontSize: "clamp(1.8rem, 4vw, 2.6rem)", lineHeight: 1.15 }}>
            既存 `/editor` を壊さずに、新しい骨組みへ移すための read-only preview
          </h1>
          <p style={{ margin: 0, maxWidth: "760px", lineHeight: 1.7, color: "#d6e3f5" }}>
            ここでは保存済み案件を安全に読み込み、新しい UI 構造で表示します。書き込みはまだ行わないので、分割初期段階の事故を減らせます。
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
            <span style={{ borderRadius: "999px", background: "rgba(147, 197, 253, 0.16)", padding: "8px 12px", fontSize: "0.85rem" }}>
              既存 `/editor` は現役のまま
            </span>
            <span style={{ borderRadius: "999px", background: "rgba(147, 197, 253, 0.16)", padding: "8px 12px", fontSize: "0.85rem" }}>
              localStorage を read-only で確認
            </span>
            <span style={{ borderRadius: "999px", background: "rgba(147, 197, 253, 0.16)", padding: "8px 12px", fontSize: "0.85rem" }}>
              次段階で編集と保存を移植
            </span>
          </div>
        </section>

        {error ? (
          <section style={{ borderRadius: "16px", background: "#fff1f2", color: "#9f1239", padding: "16px 18px", border: "1px solid #fecdd3" }}>
            {error}
          </section>
        ) : null}

        {!sharedReady ? (
          <section style={{ borderRadius: "16px", background: "#fff7ed", color: "#9a3412", padding: "16px 18px", border: "1px solid #fed7aa" }}>
            共有データとの同期に失敗しました。この端末の localStorage を基準に preview を表示しています。
          </section>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(320px, 420px) minmax(0, 1fr)",
            gap: "24px",
            alignItems: "start",
          }}
        >
          <aside style={{ borderRadius: "24px", background: "#f8fafc", border: "1px solid #d7dee6", padding: "20px" }}>
            <ProjectListPanel
              projects={projects}
              selectedProjectId={selectedProjectId}
              onSelect={setSelectedProjectId}
            />
          </aside>

          <section style={{ borderRadius: "24px", background: "#f8fafc", border: "1px solid #d7dee6", padding: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <p style={{ margin: 0, fontSize: "0.8rem", color: "#5f6f82", letterSpacing: "0.04em" }}>Selected Project</p>
                <h2 style={{ margin: "6px 0 0", fontSize: "1.5rem" }}>
                  {selectedProject?.propertyName || selectedProject?.titleSubject || (loading ? "読み込み中..." : "案件を選択してください")}
                </h2>
              </div>
              {selectedProject ? (
                <span style={{ borderRadius: "999px", background: "#e2e8f0", color: "#1e293b", padding: "8px 12px", fontWeight: 700 }}>
                  {APPROVAL_STATUS_LABELS[selectedProject.approvalStatus]}
                </span>
              ) : null}
            </div>

            {selectedProject ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
                  <Field label="案件ID" value={selectedProject.projectId} />
                  <Field label="件名" value={selectedProject.titleSubject} />
                  <Field label="住所" value={selectedProject.propertyAddress} />
                  <Field label="PDF テンプレート" value={PDF_TEMPLATE_PRESET_MAP[selectedProject.pdfTemplateId]?.label ?? selectedProject.pdfTemplateId} />
                  <Field label="工事期間" value={formatDateRange(selectedProject.workDateStart, selectedProject.workDateEnd)} />
                  <Field
                    label="停電予定"
                    value={formatDateTimeRange(
                      selectedProject.outageDateStart,
                      selectedProject.outageTimeStart,
                      selectedProject.outageDateEnd,
                      selectedProject.outageTimeEnd,
                    )}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "16px" }}>
                  <section style={{ borderRadius: "18px", background: "#ffffff", border: "1px solid #d7dee6", padding: "18px" }}>
                    <h3 style={{ margin: 0, fontSize: "1rem" }}>工事項目</h3>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "14px" }}>
                      {selectedWorkLabels.length ? selectedWorkLabels.map((label) => (
                        <span key={label} style={{ borderRadius: "999px", background: "#dbeafe", color: "#1d4ed8", padding: "8px 12px", fontWeight: 700, fontSize: "0.85rem" }}>
                          {label}
                        </span>
                      )) : <span style={{ color: "#5f6f82" }}>工事項目はまだ選択されていません。</span>}
                    </div>
                  </section>

                  <section style={{ borderRadius: "18px", background: "#ffffff", border: "1px solid #d7dee6", padding: "18px" }}>
                    <h3 style={{ margin: 0, fontSize: "1rem" }}>運用メモ</h3>
                    <p style={{ margin: "14px 0 0", lineHeight: 1.7, color: "#334155" }}>
                      PDF 出力回数: {selectedProject.pdfExportCount} 回
                    </p>
                    <p style={{ margin: "10px 0 0", lineHeight: 1.7, color: "#334155" }}>
                      特記事項: {selectedProject.noteSpecial || "未入力"}
                    </p>
                  </section>
                </div>
              </>
            ) : (
              <section style={{ borderRadius: "18px", background: "#ffffff", border: "1px solid #d7dee6", padding: "24px", color: "#5f6f82", lineHeight: 1.7 }}>
                {loading
                  ? "案件データを読み込んでいます..."
                  : "左側の案件一覧から選択すると、基本情報の read-only preview を確認できます。"}
              </section>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
