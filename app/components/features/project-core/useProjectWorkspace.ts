"use client";

import { useEffect, useMemo, useState } from "react";
import { STORAGE_KEY } from "../../planner/constants";
import type { PdfTemplateId, Project, WorkCode } from "../../planner/types";
import { parseStorageJson } from "../../planner/utils/storage";
import { normalizeDate, normalizeTime } from "../../planner/utils/dateTime";
import { SHARED_STORAGE_UPDATED_EVENT, pullSharedStorageSnapshot } from "../../sharedStorage";

const VALID_WORK_CODES: WorkCode[] = [
  "KOUATSU_CABLE",
  "UGS",
  "PAS",
  "GROUND_A",
  "GROUND_B",
  "GROUND_C",
];

const VALID_PDF_TEMPLATE_IDS: PdfTemplateId[] = ["standard", "kansai", "night"];
const VALID_APPROVAL_STATUSES: Project["approvalStatus"][] = ["draft", "submitted", "approved", "rejected"];

export type PlannerWorkspaceProject = {
  projectId: string;
  propertyName: string;
  propertyAddress: string;
  titleSubject: string;
  workDateStart: string;
  workDateEnd: string;
  outageDateStart: string;
  outageDateEnd: string;
  outageTimeStart: string;
  outageTimeEnd: string;
  approvalStatus: Project["approvalStatus"];
  pdfTemplateId: PdfTemplateId;
  pdfExportCount: number;
  selectedWorkCodes: WorkCode[];
  noteSpecial: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeWorkCodes(value: unknown): WorkCode[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is WorkCode => typeof item === "string" && VALID_WORK_CODES.includes(item as WorkCode));
}

function normalizePdfTemplateId(value: unknown): PdfTemplateId {
  return typeof value === "string" && VALID_PDF_TEMPLATE_IDS.includes(value as PdfTemplateId)
    ? (value as PdfTemplateId)
    : "standard";
}

function normalizeApprovalStatus(value: unknown): Project["approvalStatus"] {
  return typeof value === "string" && VALID_APPROVAL_STATUSES.includes(value as Project["approvalStatus"])
    ? (value as Project["approvalStatus"])
    : "draft";
}

function toProjectPreview(value: unknown, index: number): PlannerWorkspaceProject | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    projectId: toText(value.projectId) || `TEMP-${String(index + 1).padStart(3, "0")}`,
    propertyName: toText(value.propertyName),
    propertyAddress: toText(value.propertyAddress),
    titleSubject: toText(value.titleSubject),
    workDateStart: normalizeDate(toText(value.workDateStart)),
    workDateEnd: normalizeDate(toText(value.workDateEnd)),
    outageDateStart: normalizeDate(toText(value.outageDateStart)),
    outageDateEnd: normalizeDate(toText(value.outageDateEnd)),
    outageTimeStart: normalizeTime(toText(value.outageTimeStart), ""),
    outageTimeEnd: normalizeTime(toText(value.outageTimeEnd), ""),
    approvalStatus: normalizeApprovalStatus(value.approvalStatus),
    pdfTemplateId: normalizePdfTemplateId(value.pdfTemplateId),
    pdfExportCount: Number.isFinite(value.pdfExportCount) ? Number(value.pdfExportCount) : 0,
    selectedWorkCodes: normalizeWorkCodes(value.selectedWorkCodes),
    noteSpecial: toText(value.noteSpecial),
  };
}

function loadProjectsFromStorage(): PlannerWorkspaceProject[] {
  const parsed = parseStorageJson<unknown>(window.localStorage.getItem(STORAGE_KEY));
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed
    .map((item, index) => toProjectPreview(item, index))
    .filter((item): item is PlannerWorkspaceProject => item !== null);
}

export function useProjectWorkspace() {
  const [projects, setProjects] = useState<PlannerWorkspaceProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [loading, setLoading] = useState(true);
  const [sharedReady, setSharedReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let disposed = false;

    const reload = async (): Promise<void> => {
      setLoading(true);
      const synced = await pullSharedStorageSnapshot();
      if (disposed) {
        return;
      }
      setSharedReady(synced);
      try {
        const nextProjects = loadProjectsFromStorage();
        setProjects(nextProjects);
        setSelectedProjectId((current) => {
          if (current && nextProjects.some((project) => project.projectId === current)) {
            return current;
          }
          return nextProjects[0]?.projectId ?? "";
        });
        setError("");
      } catch {
        setError("案件データの読み込みに失敗しました。既存保存形式との互換を確認してください。");
      } finally {
        setLoading(false);
      }
    };

    void reload();

    const onStorage = (event: StorageEvent): void => {
      if (event.key && event.key !== STORAGE_KEY) {
        return;
      }
      void reload();
    };

    const onSharedUpdated = (): void => {
      void reload();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(SHARED_STORAGE_UPDATED_EVENT, onSharedUpdated as EventListener);

    return () => {
      disposed = true;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(SHARED_STORAGE_UPDATED_EVENT, onSharedUpdated as EventListener);
    };
  }, []);

  const selectedProject = useMemo(
    () => projects.find((project) => project.projectId === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  return {
    projects,
    selectedProject,
    selectedProjectId,
    setSelectedProjectId,
    loading,
    sharedReady,
    error,
  };
}
