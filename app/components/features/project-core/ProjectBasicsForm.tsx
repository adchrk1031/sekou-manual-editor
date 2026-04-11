"use client";

import type { CSSProperties, ReactNode } from "react";
import { APPROVAL_STATUS_LABELS, PDF_TEMPLATE_PRESETS, WORK_MASTER } from "../../planner/constants";
import type { PlannerWorkspaceProject } from "./project-storage";

function FieldShell({
  label,
  children,
  span = 1,
}: {
  label: string;
  children: ReactNode;
  span?: 1 | 2;
}) {
  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        gridColumn: span === 2 ? "1 / -1" : undefined,
        minWidth: 0,
        width: "100%",
      }}
    >
      <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#4b5563", lineHeight: 1.45, overflowWrap: "anywhere" }}>{label}</span>
      {children}
    </label>
  );
}

function controlStyle(multiline = false): CSSProperties {
  return {
    width: "100%",
    minWidth: 0,
    maxWidth: "100%",
    borderRadius: "12px",
    border: "1px solid #d7dee6",
    background: "#ffffff",
    padding: multiline ? "12px 14px" : "10px 12px",
    font: "inherit",
    color: "#0f172a",
    lineHeight: 1.5,
    minHeight: multiline ? "112px" : undefined,
    resize: multiline ? "vertical" : undefined,
  };
}

export default function ProjectBasicsForm({
  project,
  canEdit,
  saveState,
  lastSavedAt,
  onTextChange,
  onPdfTemplateChange,
  onWorkDateStartChange,
  onWorkDateEndChange,
  onOutageDateStartChange,
  onOutageDateEndChange,
  onOutageTimeStartChange,
  onOutageTimeEndChange,
  onOutageEnabledChange,
  onToggleWorkCode,
}: {
  project: PlannerWorkspaceProject;
  canEdit: boolean;
  saveState: "idle" | "saving" | "saved" | "error";
  lastSavedAt: string;
  onTextChange: (
    field: "propertyName" | "propertyAddress" | "titleSubject" | "coverRecipientSuffix" | "noteSpecial",
    value: string,
  ) => void;
  onPdfTemplateChange: (value: string) => void;
  onWorkDateStartChange: (value: string) => void;
  onWorkDateEndChange: (value: string) => void;
  onOutageDateStartChange: (value: string) => void;
  onOutageDateEndChange: (value: string) => void;
  onOutageTimeStartChange: (value: string) => void;
  onOutageTimeEndChange: (value: string) => void;
  onOutageEnabledChange: (checked: boolean) => void;
  onToggleWorkCode: (workCode: PlannerWorkspaceProject["selectedWorkCodes"][number]) => void;
}) {
  const saveLabel = saveState === "saving"
    ? "保存中..."
    : saveState === "saved"
      ? `保存済み${lastSavedAt ? ` ${lastSavedAt}` : ""}`
      : saveState === "error"
        ? "保存エラー"
        : "未保存";

  return (
    <section
      style={{
        borderRadius: "18px",
        background: "#ffffff",
        border: "1px solid #d7dee6",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "18px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.1rem" }}>基本情報</h3>
          <p style={{ margin: "8px 0 0", color: "#5f6f82", lineHeight: 1.7 }}>
            まずは基本情報だけを新 UI から編集します。保存は既存 localStorage 契約へ書き戻します。
          </p>
          {!canEdit ? (
            <p style={{ margin: "8px 0 0", color: "#9a3412", lineHeight: 1.7 }}>
              このアカウントは閲覧専用のため、preview ワークスペースからは編集できません。
            </p>
          ) : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-end" }}>
          <span
            style={{
              borderRadius: "999px",
              background: saveState === "error" ? "#fee2e2" : "#e2e8f0",
              color: saveState === "error" ? "#991b1b" : "#1e293b",
              padding: "8px 12px",
              fontWeight: 700,
              fontSize: "0.82rem",
            }}
          >
            {saveLabel}
          </span>
          <span style={{ fontSize: "0.8rem", color: "#5f6f82" }}>
            承認状態: {APPROVAL_STATUS_LABELS[project.approvalStatus]}
          </span>
        </div>
      </div>

      <fieldset
        disabled={!canEdit}
        style={{
          border: 0,
          padding: 0,
          margin: 0,
          minWidth: 0,
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))", gap: "16px" }}>
        <FieldShell label="案件ID">
          <div style={{ ...controlStyle(), background: "#f8fafc" }}>{project.projectId}</div>
        </FieldShell>

        <FieldShell label="PDF テンプレート">
          <select
            value={project.pdfTemplateId}
            onChange={(event) => onPdfTemplateChange(event.target.value)}
            style={controlStyle()}
          >
            {PDF_TEMPLATE_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>{preset.label}</option>
            ))}
          </select>
        </FieldShell>

        <FieldShell label="物件名">
          <input
            type="text"
            value={project.propertyName}
            onChange={(event) => onTextChange("propertyName", event.target.value)}
            style={controlStyle()}
          />
        </FieldShell>

        <FieldShell label="件名">
          <input
            type="text"
            value={project.titleSubject}
            onChange={(event) => onTextChange("titleSubject", event.target.value)}
            style={controlStyle()}
          />
        </FieldShell>

        <FieldShell label="宛名末尾">
          <input
            type="text"
            value={project.coverRecipientSuffix}
            onChange={(event) => onTextChange("coverRecipientSuffix", event.target.value)}
            style={controlStyle()}
          />
        </FieldShell>

        <FieldShell label="停電を工程表に表示">
          <label
            style={{
              ...controlStyle(),
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <input
              type="checkbox"
              checked={project.outageEnabled}
              onChange={(event) => onOutageEnabledChange(event.target.checked)}
            />
            停電時間バーを表示する
          </label>
        </FieldShell>

        <FieldShell label="住所" span={2}>
          <input
            type="text"
            value={project.propertyAddress}
            onChange={(event) => onTextChange("propertyAddress", event.target.value)}
            style={controlStyle()}
          />
        </FieldShell>

        <FieldShell label="工事開始日">
          <input type="date" value={project.workDateStart} onChange={(event) => onWorkDateStartChange(event.target.value)} style={controlStyle()} />
        </FieldShell>

        <FieldShell label="工事終了日">
          <input type="date" value={project.workDateEnd} onChange={(event) => onWorkDateEndChange(event.target.value)} style={controlStyle()} />
        </FieldShell>

        <FieldShell label="停電開始日">
          <input type="date" value={project.outageDateStart} onChange={(event) => onOutageDateStartChange(event.target.value)} style={controlStyle()} />
        </FieldShell>

        <FieldShell label="停電終了日">
          <input type="date" value={project.outageDateEnd} onChange={(event) => onOutageDateEndChange(event.target.value)} style={controlStyle()} />
        </FieldShell>

        <FieldShell label="停電開始時間">
          <input type="time" value={project.outageTimeStart} onChange={(event) => onOutageTimeStartChange(event.target.value)} style={controlStyle()} />
        </FieldShell>

        <FieldShell label="停電終了時間">
          <input type="time" value={project.outageTimeEnd} onChange={(event) => onOutageTimeEndChange(event.target.value)} style={controlStyle()} />
        </FieldShell>

        <FieldShell label="工事項目" span={2}>
          <div
            style={{
              borderRadius: "12px",
              border: "1px solid #d7dee6",
              background: "#ffffff",
              padding: "12px",
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            {WORK_MASTER.map((work) => {
              const checked = project.selectedWorkCodes.includes(work.code);
              return (
                <label
                  key={work.code}
                  style={{
                    borderRadius: "999px",
                    border: `1px solid ${checked ? "#1d4ed8" : "#cbd5e1"}`,
                    background: checked ? "#dbeafe" : "#f8fafc",
                    color: checked ? "#1d4ed8" : "#334155",
                    padding: "8px 12px",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleWorkCode(work.code)}
                  />
                  {work.name}
                </label>
              );
            })}
          </div>
        </FieldShell>

        <FieldShell label="特記事項" span={2}>
          <textarea
            value={project.noteSpecial}
            onChange={(event) => onTextChange("noteSpecial", event.target.value)}
            style={controlStyle(true)}
          />
        </FieldShell>
        </div>
      </fieldset>
    </section>
  );
}
