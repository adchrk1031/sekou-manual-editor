"use client";

import { formatDateRange } from "../../planner/utils/dateTime";
import type { PlannerWorkspaceProject } from "./useProjectWorkspace";

const panelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
} as const;

const listButtonStyle = {
  width: "100%",
  borderRadius: "16px",
  border: "1px solid #d7dee6",
  background: "#ffffff",
  padding: "16px",
  textAlign: "left",
  cursor: "pointer",
} as const;

export default function ProjectListPanel({
  projects,
  selectedProjectId,
  onSelect,
}: {
  projects: PlannerWorkspaceProject[];
  selectedProjectId: string;
  onSelect: (projectId: string) => void;
}) {
  if (!projects.length) {
    return (
      <section style={panelStyle} aria-labelledby="workspace-projects-title">
        <div>
          <h2 id="workspace-projects-title" style={{ margin: 0, fontSize: "1.1rem" }}>案件一覧</h2>
          <p style={{ margin: "8px 0 0", color: "#5f6f82", lineHeight: 1.6 }}>
            保存済み案件がまだありません。既存の `/editor` かログイン管理画面からデモデータを投入すると、この preview に一覧が表示されます。
          </p>
        </div>
      </section>
    );
  }

  return (
    <section style={panelStyle} aria-labelledby="workspace-projects-title">
      <div>
        <h2 id="workspace-projects-title" style={{ margin: 0, fontSize: "1.1rem" }}>案件一覧</h2>
        <p style={{ margin: "8px 0 0", color: "#5f6f82" }}>
          {projects.length} 件の案件を読み込みました。ここでは安全に read-only で確認できます。
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {projects.map((project) => {
          const active = project.projectId === selectedProjectId;
          return (
            <button
              key={project.projectId}
              type="button"
              onClick={() => onSelect(project.projectId)}
              aria-pressed={active}
              style={{
                ...listButtonStyle,
                borderColor: active ? "#1c6dd0" : listButtonStyle.border,
                background: active ? "#eff6ff" : listButtonStyle.background,
                boxShadow: active ? "0 0 0 3px rgba(28, 109, 208, 0.12)" : "none",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start" }}>
                <div>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "#5f6f82", letterSpacing: "0.04em" }}>{project.projectId}</p>
                  <h3 style={{ margin: "6px 0 0", fontSize: "1rem", lineHeight: 1.3 }}>
                    {project.propertyName || project.titleSubject || "案件名未設定"}
                  </h3>
                </div>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    borderRadius: "999px",
                    padding: "4px 10px",
                    background: active ? "#1c6dd0" : "#edf2f7",
                    color: active ? "#ffffff" : "#445160",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  {project.approvalStatus}
                </span>
              </div>
              <p style={{ margin: "10px 0 0", color: "#334155", lineHeight: 1.5 }}>
                {project.propertyAddress || "住所未設定"}
              </p>
              <p style={{ margin: "10px 0 0", color: "#5f6f82", fontSize: "0.9rem" }}>
                工事期間: {formatDateRange(project.workDateStart, project.workDateEnd)}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
