"use client";

import type { AuthUser } from "../../auth";
import { MAX_REVISIONS, REVISION_STORAGE_KEY } from "../../planner/constants";
import type { Project, ProjectRevision, ProjectSnapshot, WorkCode } from "../../planner/types";
import { parseStorageJson, stringifyForStorage } from "../../planner/utils/storage";
import { writeSharedStorageItem } from "../../sharedStorage";
import { normalizeProject, type ProjectNormalizationInput } from "../project-core/project-normalize";

const VALID_WORK_CODES: WorkCode[] = [
  "KOUATSU_CABLE",
  "UGS",
  "PAS",
  "GROUND_A",
  "GROUND_B",
  "GROUND_C",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clonePlain<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

function buildWorkCodeFlags(selectedWorkCodes: WorkCode[]): Record<WorkCode, boolean> {
  return {
    KOUATSU_CABLE: selectedWorkCodes.includes("KOUATSU_CABLE"),
    UGS: selectedWorkCodes.includes("UGS"),
    PAS: selectedWorkCodes.includes("PAS"),
    GROUND_A: selectedWorkCodes.includes("GROUND_A"),
    GROUND_B: selectedWorkCodes.includes("GROUND_B"),
    GROUND_C: selectedWorkCodes.includes("GROUND_C"),
  };
}

export function buildProjectSnapshot(project: Project): ProjectSnapshot {
  return clonePlain({
    projectPresetId: project.projectPresetId,
    propertyName: project.propertyName,
    propertyAddress: project.propertyAddress,
    titleSubject: project.titleSubject,
    workDateStart: project.workDateStart,
    workDateEnd: project.workDateEnd,
    outageDateStart: project.outageDateStart,
    outageDateEnd: project.outageDateEnd,
    outageTimeStart: project.outageTimeStart,
    outageTimeEnd: project.outageTimeEnd,
    outageEnabled: project.outageEnabled,
    selectedWorkCodes: [...project.selectedWorkCodes],
    noteSpecial: project.noteSpecial,
    noteApprovalExtra: project.noteApprovalExtra,
    approvalRequestItems: project.approvalRequestItems,
    coverRecipientSuffix: project.coverRecipientSuffix,
    pdfTemplateId: project.pdfTemplateId,
    pdfCompanyName: project.pdfCompanyName,
    pdfTeam: project.pdfTeam,
    pdfContactPerson: project.pdfContactPerson,
    pdfAddress: project.pdfAddress,
    pdfEmail: project.pdfEmail,
    pdfTel: project.pdfTel,
    pdfFax: project.pdfFax,
    pdfExportCount: project.pdfExportCount,
    pdfLastExportedAt: project.pdfLastExportedAt,
    noticeTemplateId: project.noticeTemplateId,
    noticePropertyName: project.noticePropertyName,
    noticeRecipientName: project.noticeRecipientName,
    noticeSenderCompany: project.noticeSenderCompany,
    noticeHeadline: project.noticeHeadline,
    noticeIntroText: project.noticeIntroText,
    noticeMainWorkDate: project.noticeMainWorkDate,
    noticeOutageDate: project.noticeOutageDate,
    noticeOutageTimeStart: project.noticeOutageTimeStart,
    noticeOutageTimeEnd: project.noticeOutageTimeEnd,
    noticeUnitInspectionEnabled: project.noticeUnitInspectionEnabled,
    noticeScheduleRows: project.noticeScheduleRows,
    noticePrivateAreaText: project.noticePrivateAreaText,
    noticeCommonAreaText: project.noticeCommonAreaText,
    noticeCompensationText: project.noticeCompensationText,
    noticeContactCompany: project.noticeContactCompany,
    noticeContactDepartment: project.noticeContactDepartment,
    noticeContactAddress: project.noticeContactAddress,
    noticeContactTel: project.noticeContactTel,
    noticeContactHours: project.noticeContactHours,
    noticeAdviceItems: project.noticeAdviceItems,
    layoutAnnotations: project.layoutAnnotations,
    layoutAnnotationsV2: project.layoutAnnotationsV2,
    scheduleRows: project.scheduleRows,
    deletedScheduleRowIds: project.deletedScheduleRowIds,
    relatedParties: project.relatedParties,
  } satisfies ProjectSnapshot);
}

export function applyProjectSnapshot(project: Project, snapshot: ProjectSnapshot): Project {
  return normalizeProject({
    ...project,
    ...clonePlain(snapshot),
    flags: buildWorkCodeFlags(VALID_WORK_CODES.filter((code) => snapshot.selectedWorkCodes.includes(code))),
    selectedWorkCodes: VALID_WORK_CODES.filter((code) => snapshot.selectedWorkCodes.includes(code)),
  } satisfies ProjectNormalizationInput);
}

function normalizeProjectSnapshot(value: unknown): ProjectSnapshot {
  const normalizedProject = normalizeProject(value as ProjectNormalizationInput);
  return buildProjectSnapshot(normalizedProject);
}

function normalizeRevision(value: unknown, index: number): ProjectRevision | null {
  if (!isRecord(value) || !isRecord(value.snapshot)) {
    return null;
  }

  const atValue = typeof value.at === "string" && value.at.trim() ? value.at : new Date().toISOString();
  return {
    id: typeof value.id === "string" && value.id.trim() ? value.id : uid(`rev_${index + 1}`),
    projectId: typeof value.projectId === "string" ? value.projectId : "",
    at: atValue,
    userId: typeof value.userId === "string" ? value.userId : "unknown",
    userName: typeof value.userName === "string" && value.userName.trim() ? value.userName : "不明",
    label: typeof value.label === "string" && value.label.trim() ? value.label : "履歴保存",
    snapshot: normalizeProjectSnapshot(value.snapshot),
  };
}

export function loadRevisionsFromStorage(): ProjectRevision[] {
  const parsed = parseStorageJson<unknown>(window.localStorage.getItem(REVISION_STORAGE_KEY));
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed
    .map((item, index) => normalizeRevision(item, index))
    .filter((revision): revision is ProjectRevision => revision !== null)
    .slice(0, MAX_REVISIONS);
}

export function persistRevisionsToStorage(revisions: ProjectRevision[]): boolean {
  try {
    writeSharedStorageItem(
      REVISION_STORAGE_KEY,
      stringifyForStorage(revisions.slice(0, MAX_REVISIONS)),
    );
    return true;
  } catch {
    return false;
  }
}

export function createProjectRevision(
  project: Project,
  user: Pick<AuthUser, "id" | "name">,
  label: string,
): ProjectRevision {
  return {
    id: uid("rev"),
    projectId: project.projectId,
    at: new Date().toISOString(),
    userId: user.id,
    userName: user.name,
    label,
    snapshot: buildProjectSnapshot(project),
  };
}

export function prependProjectRevision(
  revisions: ProjectRevision[],
  revision: ProjectRevision,
): ProjectRevision[] {
  return [revision, ...revisions].slice(0, MAX_REVISIONS);
}
