"use client";

import {
  MIN_BLOCK_MINUTES,
  PROJECT_DATA_STORAGE_PREFIX,
  PROJECT_INDEX_STORAGE_KEY,
  STORAGE_KEY,
} from "../../planner/constants";
import type { PdfTemplateId, Project, ScheduleRow, WorkCode } from "../../planner/types";
import {
  DAY_TOTAL_MINUTES,
  diffDays,
  fromTimelineOffset,
  normalizeDate,
  normalizeTime,
  toBoolean,
  toTimelineOffset,
} from "../../planner/utils/dateTime";
import { parseStorageJson, stringifyForStorage } from "../../planner/utils/storage";
import { normalizePdfTemplateId, normalizeProject, type ProjectNormalizationInput } from "./project-normalize";

const VALID_WORK_CODES: WorkCode[] = [
  "KOUATSU_CABLE",
  "UGS",
  "PAS",
  "GROUND_A",
  "GROUND_B",
  "GROUND_C",
];

const VALID_APPROVAL_STATUSES: Project["approvalStatus"][] = ["draft", "submitted", "approved", "rejected"];

export type PlannerWorkspaceProject = {
  projectId: string;
  propertyName: string;
  propertyAddress: string;
  titleSubject: string;
  coverRecipientSuffix: string;
  workDateStart: string;
  workDateEnd: string;
  outageDateStart: string;
  outageDateEnd: string;
  outageTimeStart: string;
  outageTimeEnd: string;
  outageEnabled: boolean;
  approvalStatus: Project["approvalStatus"];
  pdfTemplateId: PdfTemplateId;
  pdfExportCount: number;
  selectedWorkCodes: WorkCode[];
  noteSpecial: string;
};

export type PlannerWorkspaceProjectRecord = {
  project: PlannerWorkspaceProject;
  rawProject: Record<string, unknown>;
};

export type EditableProjectTextField =
  | "propertyName"
  | "propertyAddress"
  | "titleSubject"
  | "coverRecipientSuffix"
  | "noteSpecial";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function cloneForStorage<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
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

function normalizeWorkCodes(value: unknown): WorkCode[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const codes = value.filter(
    (item): item is WorkCode => typeof item === "string" && VALID_WORK_CODES.includes(item as WorkCode),
  );
  return VALID_WORK_CODES.filter((code) => codes.includes(code));
}

function normalizeApprovalStatus(value: unknown): Project["approvalStatus"] {
  return typeof value === "string" && VALID_APPROVAL_STATUSES.includes(value as Project["approvalStatus"])
    ? (value as Project["approvalStatus"])
    : "draft";
}

function normalizeScheduleRows(value: unknown, fallbackDate: string): ScheduleRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((row, index) => {
      if (!isRecord(row)) {
        return null;
      }

      const startDate = normalizeDate(toText(row.startDate)) || fallbackDate;
      const endDate = normalizeDate(toText(row.endDate)) || startDate;

      return {
        id: toText(row.id) || `row-${index + 1}`,
        label: toText(row.label),
        startDate,
        start: normalizeTime(toText(row.start), "09:00"),
        endDate,
        end: normalizeTime(toText(row.end), "17:00"),
        outage: toBoolean(String(row.outage ?? "")),
        text: toText(row.text),
        note: toText(row.note),
      };
    })
    .filter((row): row is ScheduleRow => row !== null);
}

function toWorkspaceProject(project: Project): PlannerWorkspaceProject {
  return {
    projectId: project.projectId,
    propertyName: project.propertyName,
    propertyAddress: project.propertyAddress,
    titleSubject: project.titleSubject,
    coverRecipientSuffix: project.coverRecipientSuffix,
    workDateStart: project.workDateStart,
    workDateEnd: project.workDateEnd,
    outageDateStart: project.outageDateStart,
    outageDateEnd: project.outageDateEnd,
    outageTimeStart: project.outageTimeStart,
    outageTimeEnd: project.outageTimeEnd,
    outageEnabled: project.outageEnabled,
    approvalStatus: normalizeApprovalStatus(project.approvalStatus),
    pdfTemplateId: normalizePdfTemplateId(project.pdfTemplateId),
    pdfExportCount: Number.isFinite(project.pdfExportCount) ? Number(project.pdfExportCount) : 0,
    selectedWorkCodes: VALID_WORK_CODES.filter((code) => project.selectedWorkCodes.includes(code)),
    noteSpecial: project.noteSpecial,
  };
}

function mergeProjectIntoRawProject(rawProject: Record<string, unknown>, project: Project): Record<string, unknown> {
  const clonedProject = cloneForStorage(project);
  return {
    ...rawProject,
    ...clonedProject,
    workDateMain: clonedProject.workDateStart,
    flags: buildWorkCodeFlags(clonedProject.selectedWorkCodes),
    selectedWorkCodes: [...clonedProject.selectedWorkCodes],
  } as Record<string, unknown>;
}

function toProjectRecord(value: unknown, index: number): PlannerWorkspaceProjectRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const rawProject = { ...value };
  const normalizedProject = normalizeProject(rawProject as ProjectNormalizationInput);
  const fallbackProjectId = toText(value.projectId) || `TEMP-${String(index + 1).padStart(3, "0")}`;

  return {
    project: {
      ...toWorkspaceProject(normalizedProject),
      projectId: normalizedProject.projectId || fallbackProjectId,
    },
    rawProject,
  };
}

export function materializeProjectRecord(record: PlannerWorkspaceProjectRecord): Project {
  return normalizeProject(record.rawProject as ProjectNormalizationInput);
}

export function replaceProjectRecord(
  record: PlannerWorkspaceProjectRecord,
  project: Project,
): PlannerWorkspaceProjectRecord {
  const normalizedProject = normalizeProject(project as ProjectNormalizationInput);
  return {
    project: toWorkspaceProject(normalizedProject),
    rawProject: mergeProjectIntoRawProject(record.rawProject, normalizedProject),
  };
}

function loadIndexedProjectRecords(): PlannerWorkspaceProjectRecord[] {
  const ids = parseStorageJson<string[]>(window.localStorage.getItem(PROJECT_INDEX_STORAGE_KEY));
  if (!Array.isArray(ids) || ids.length === 0) {
    return [];
  }

  return ids
    .map((id, index) => {
      const rawProject = window.localStorage.getItem(`${PROJECT_DATA_STORAGE_PREFIX}${id}`);
      if (!rawProject) {
        return null;
      }
      const parsed = parseStorageJson<unknown>(rawProject);
      return toProjectRecord(parsed, index);
    })
    .filter((record): record is PlannerWorkspaceProjectRecord => record !== null);
}

export function loadProjectRecordsFromStorage(): PlannerWorkspaceProjectRecord[] {
  const indexedRecords = loadIndexedProjectRecords();
  if (indexedRecords.length > 0) {
    return indexedRecords;
  }

  const parsed = parseStorageJson<unknown>(window.localStorage.getItem(STORAGE_KEY));
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((item, index) => toProjectRecord(item, index))
    .filter((record): record is PlannerWorkspaceProjectRecord => record !== null);
}

function syncProjectWorkRange(project: PlannerWorkspaceProject, scheduleRows: ScheduleRow[]): PlannerWorkspaceProject {
  const dates = [
    project.workDateStart,
    project.workDateEnd,
    project.outageDateStart,
    project.outageDateEnd,
    ...scheduleRows.flatMap((row) => [row.startDate, row.endDate]),
  ].filter(Boolean);

  const sortedDates = [...dates].sort();
  const minDate = sortedDates[0] || project.workDateStart;
  const maxDate = sortedDates[sortedDates.length - 1] || project.workDateEnd || minDate;

  return {
    ...project,
    workDateStart: minDate,
    workDateEnd: maxDate < minDate ? minDate : maxDate,
  };
}

function fitRowIntoRange(row: ScheduleRow, rangeStart: string, rangeEnd: string): ScheduleRow {
  const dayCount = Math.max(1, diffDays(rangeStart, rangeEnd) + 1);
  const span = dayCount * DAY_TOTAL_MINUTES;
  const startRaw = toTimelineOffset(row.startDate, row.start, rangeStart);
  const endRaw = toTimelineOffset(row.endDate, row.end, rangeStart);
  const duration = clamp(endRaw - startRaw, MIN_BLOCK_MINUTES, span);
  const nextStart = clamp(startRaw, 0, Math.max(0, span - duration));
  const nextEnd = nextStart + duration;
  const startPoint = fromTimelineOffset(nextStart, rangeStart);
  const endPoint = fromTimelineOffset(nextEnd, rangeStart);

  return {
    ...row,
    startDate: startPoint.date,
    start: startPoint.time,
    endDate: endPoint.date,
    end: endPoint.time,
  };
}

function fitOutageIntoRange(
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string,
  rangeStart: string,
  rangeEnd: string,
): { startDate: string; startTime: string; endDate: string; endTime: string } {
  const dayCount = Math.max(1, diffDays(rangeStart, rangeEnd) + 1);
  const span = dayCount * DAY_TOTAL_MINUTES;
  const safeStartTime = normalizeTime(startTime, "09:00");
  const safeEndTime = normalizeTime(endTime, "17:00");
  const startRaw = toTimelineOffset(startDate, safeStartTime, rangeStart);
  const endRaw = toTimelineOffset(endDate, safeEndTime, rangeStart);
  const duration = clamp(endRaw - startRaw, MIN_BLOCK_MINUTES, span);
  const nextStart = clamp(startRaw, 0, Math.max(0, span - duration));
  const nextEnd = nextStart + duration;
  const startPoint = fromTimelineOffset(nextStart, rangeStart);
  const endPoint = fromTimelineOffset(nextEnd, rangeStart);

  return {
    startDate: startPoint.date,
    startTime: startPoint.time,
    endDate: endPoint.date,
    endTime: endPoint.time,
  };
}

function writeScheduleRows(rawProject: Record<string, unknown>, scheduleRows: ScheduleRow[]): Record<string, unknown> {
  return {
    ...rawProject,
    scheduleRows: scheduleRows.map((row) => ({
      id: row.id,
      label: row.label,
      startDate: row.startDate,
      start: row.start,
      endDate: row.endDate,
      end: row.end,
      outage: row.outage,
      text: row.text,
      note: row.note,
    })),
  };
}

function writeProjectPreview(
  rawProject: Record<string, unknown>,
  project: PlannerWorkspaceProject,
  scheduleRows: ScheduleRow[],
): PlannerWorkspaceProjectRecord {
  const nextFlags = isRecord(rawProject.flags) ? { ...rawProject.flags } : {};
  VALID_WORK_CODES.forEach((code) => {
    nextFlags[code] = project.selectedWorkCodes.includes(code);
  });

  const nextRaw = writeScheduleRows(
    {
      ...rawProject,
      projectId: project.projectId,
      propertyName: project.propertyName,
      propertyAddress: project.propertyAddress,
      titleSubject: project.titleSubject,
      coverRecipientSuffix: project.coverRecipientSuffix,
      workDateStart: project.workDateStart,
      workDateMain: project.workDateStart,
      workDateEnd: project.workDateEnd,
      outageDateStart: project.outageDateStart,
      outageDateEnd: project.outageDateEnd,
      outageTimeStart: project.outageTimeStart,
      outageTimeEnd: project.outageTimeEnd,
      outageEnabled: project.outageEnabled,
      approvalStatus: project.approvalStatus,
      pdfTemplateId: project.pdfTemplateId,
      pdfExportCount: project.pdfExportCount,
      selectedWorkCodes: [...project.selectedWorkCodes],
      noteSpecial: project.noteSpecial,
      flags: nextFlags,
    },
    scheduleRows,
  );

  return {
    project,
    rawProject: nextRaw,
  };
}

function getScheduleRows(record: PlannerWorkspaceProjectRecord): ScheduleRow[] {
  return normalizeScheduleRows(record.rawProject.scheduleRows, record.project.workDateStart);
}

export function updateProjectTextField(
  record: PlannerWorkspaceProjectRecord,
  field: EditableProjectTextField,
  value: string,
): PlannerWorkspaceProjectRecord {
  const scheduleRows = getScheduleRows(record);
  return writeProjectPreview(record.rawProject, { ...record.project, [field]: value }, scheduleRows);
}

export function updateProjectPdfTemplate(
  record: PlannerWorkspaceProjectRecord,
  value: string,
): PlannerWorkspaceProjectRecord {
  const scheduleRows = getScheduleRows(record);
  return writeProjectPreview(
    record.rawProject,
    {
      ...record.project,
      pdfTemplateId: normalizePdfTemplateId(value),
    },
    scheduleRows,
  );
}

export function updateProjectOutageEnabled(
  record: PlannerWorkspaceProjectRecord,
  checked: boolean,
): PlannerWorkspaceProjectRecord {
  const scheduleRows = getScheduleRows(record);
  return writeProjectPreview(
    record.rawProject,
    {
      ...record.project,
      outageEnabled: checked,
    },
    scheduleRows,
  );
}

export function toggleProjectWorkCode(
  record: PlannerWorkspaceProjectRecord,
  workCode: WorkCode,
): PlannerWorkspaceProjectRecord {
  const nextCodes = record.project.selectedWorkCodes.includes(workCode)
    ? record.project.selectedWorkCodes.filter((code) => code !== workCode)
    : [...record.project.selectedWorkCodes, workCode];

  const scheduleRows = getScheduleRows(record);
  return writeProjectPreview(
    record.rawProject,
    {
      ...record.project,
      selectedWorkCodes: VALID_WORK_CODES.filter((code) => nextCodes.includes(code)),
    },
    scheduleRows,
  );
}

export function updateProjectWorkDateStart(
  record: PlannerWorkspaceProjectRecord,
  value: string,
): PlannerWorkspaceProjectRecord {
  const normalized = normalizeDate(value);
  if (!normalized) {
    return record;
  }

  const current = record.project;
  const nextWorkDateEnd = current.workDateEnd && current.workDateEnd >= normalized ? current.workDateEnd : normalized;
  const scheduleRows = getScheduleRows(record).map((row) => fitRowIntoRange(row, normalized, nextWorkDateEnd));
  const outage = fitOutageIntoRange(
    current.outageDateStart || normalized,
    current.outageTimeStart || "09:00",
    current.outageDateEnd || current.outageDateStart || normalized,
    current.outageTimeEnd || "17:00",
    normalized,
    nextWorkDateEnd,
  );

  const nextProject = syncProjectWorkRange(
    {
      ...current,
      workDateStart: normalized,
      workDateEnd: nextWorkDateEnd,
      outageDateStart: outage.startDate,
      outageTimeStart: outage.startTime,
      outageDateEnd: outage.endDate,
      outageTimeEnd: outage.endTime,
    },
    scheduleRows,
  );

  return writeProjectPreview(record.rawProject, nextProject, scheduleRows);
}

export function updateProjectWorkDateEnd(
  record: PlannerWorkspaceProjectRecord,
  value: string,
): PlannerWorkspaceProjectRecord {
  const normalized = normalizeDate(value);
  if (!normalized) {
    return record;
  }

  const current = record.project;
  const nextWorkDateEnd = normalized < current.workDateStart ? current.workDateStart : normalized;
  const scheduleRows = getScheduleRows(record).map((row) => fitRowIntoRange(row, current.workDateStart, nextWorkDateEnd));
  const outage = fitOutageIntoRange(
    current.outageDateStart || current.workDateStart,
    current.outageTimeStart || "09:00",
    current.outageDateEnd || current.outageDateStart || nextWorkDateEnd,
    current.outageTimeEnd || "17:00",
    current.workDateStart,
    nextWorkDateEnd,
  );

  const nextProject = syncProjectWorkRange(
    {
      ...current,
      workDateEnd: nextWorkDateEnd,
      outageDateStart: outage.startDate,
      outageTimeStart: outage.startTime,
      outageDateEnd: outage.endDate,
      outageTimeEnd: outage.endTime,
    },
    scheduleRows,
  );

  return writeProjectPreview(record.rawProject, nextProject, scheduleRows);
}

export function updateProjectOutageDateStart(
  record: PlannerWorkspaceProjectRecord,
  value: string,
): PlannerWorkspaceProjectRecord {
  const normalized = normalizeDate(value);
  if (!normalized) {
    return record;
  }

  const current = record.project;
  const nextOutageDateEnd = current.outageDateEnd && current.outageDateEnd >= normalized ? current.outageDateEnd : normalized;
  const scheduleRows = getScheduleRows(record);
  const nextProject = syncProjectWorkRange(
    {
      ...current,
      outageDateStart: normalized,
      outageDateEnd: nextOutageDateEnd,
    },
    scheduleRows,
  );

  return writeProjectPreview(record.rawProject, nextProject, scheduleRows);
}

export function updateProjectOutageDateEnd(
  record: PlannerWorkspaceProjectRecord,
  value: string,
): PlannerWorkspaceProjectRecord {
  const normalized = normalizeDate(value);
  if (!normalized) {
    return record;
  }

  const current = record.project;
  const nextOutageDateEnd = normalized < current.outageDateStart ? current.outageDateStart : normalized;
  const scheduleRows = getScheduleRows(record);
  const nextProject = syncProjectWorkRange(
    {
      ...current,
      outageDateEnd: nextOutageDateEnd,
    },
    scheduleRows,
  );

  return writeProjectPreview(record.rawProject, nextProject, scheduleRows);
}

export function updateProjectOutageTime(
  record: PlannerWorkspaceProjectRecord,
  field: "outageTimeStart" | "outageTimeEnd",
  value: string,
): PlannerWorkspaceProjectRecord {
  const current = record.project;
  const nextStartTime =
    field === "outageTimeStart"
      ? normalizeTime(value, current.outageTimeStart || "09:00")
      : normalizeTime(current.outageTimeStart, "09:00");
  const nextEndTime =
    field === "outageTimeEnd"
      ? normalizeTime(value, current.outageTimeEnd || "17:00")
      : normalizeTime(current.outageTimeEnd, "17:00");
  const fitted = fitOutageIntoRange(
    current.outageDateStart || current.workDateStart,
    nextStartTime,
    current.outageDateEnd || current.outageDateStart || current.workDateEnd,
    nextEndTime,
    current.workDateStart || current.outageDateStart,
    current.workDateEnd || current.outageDateEnd || current.outageDateStart,
  );
  const scheduleRows = getScheduleRows(record);
  return writeProjectPreview(
    record.rawProject,
    {
      ...current,
      outageDateStart: fitted.startDate,
      outageTimeStart: fitted.startTime,
      outageDateEnd: fitted.endDate,
      outageTimeEnd: fitted.endTime,
    },
    scheduleRows,
  );
}

export function persistProjectRecordsToStorage(records: PlannerWorkspaceProjectRecord[]): string | null {
  try {
    const nextIds = records.map((record) => record.project.projectId);
    const existingIds = parseStorageJson<string[]>(window.localStorage.getItem(PROJECT_INDEX_STORAGE_KEY)) ?? [];

    records.forEach((record) => {
      window.localStorage.setItem(
        `${PROJECT_DATA_STORAGE_PREFIX}${record.project.projectId}`,
        stringifyForStorage(record.rawProject),
      );
    });

    existingIds.forEach((projectId) => {
      if (!nextIds.includes(projectId)) {
        window.localStorage.removeItem(`${PROJECT_DATA_STORAGE_PREFIX}${projectId}`);
      }
    });

    window.localStorage.setItem(PROJECT_INDEX_STORAGE_KEY, JSON.stringify(nextIds));
    window.localStorage.removeItem(STORAGE_KEY);

    return new Date().toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return null;
  }
}
