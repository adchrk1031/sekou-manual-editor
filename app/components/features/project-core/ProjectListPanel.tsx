"use client";

import { useMemo, useState } from "react";
import { APPROVAL_STATUS_LABELS } from "../../planner/constants";
import { formatDateRange } from "../../planner/utils/dateTime";
import type { PlannerWorkspaceProject } from "./project-storage";

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
  const [searchText, setSearchText] = useState("");

  const filteredProjects = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) {
      return projects;
    }

    return projects.filter((project) => {
      const haystacks = [
        project.projectId,
        project.propertyName,
        project.titleSubject,
        project.propertyAddress,
      ];
      return haystacks.some((value) => value.toLowerCase().includes(keyword));
    });
  }, [projects, searchText]);

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
          {projects.length} 件の案件を読み込みました。ここでは基本情報だけを新 UI から安全に編集できます。
        </p>
      </div>

      <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#5f6f82" }}>案件ID・物件名で検索</span>
        <input
          type="search"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="案件ID・物件名・件名・住所で検索"
          style={{
            width: "100%",
            borderRadius: "12px",
            border: "1px solid #d7dee6",
            background: "#ffffff",
            padding: "10px 12px",
            font: "inherit",
            color: "#0f172a",
          }}
        />
      </label>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {filteredProjects.map((project) => {
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
                  {APPROVAL_STATUS_LABELS[project.approvalStatus]}
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
        {!filteredProjects.length ? (
          <div
            style={{
              borderRadius: "16px",
              border: "1px dashed #cbd5e1",
              background: "#ffffff",
              padding: "16px",
              color: "#5f6f82",
              lineHeight: 1.6,
            }}
          >
            該当する案件がありません。検索語を変えるか、空欄にして一覧全体を確認してください。
          </div>
        ) : null}
      </div>
    </section>
  );
}
