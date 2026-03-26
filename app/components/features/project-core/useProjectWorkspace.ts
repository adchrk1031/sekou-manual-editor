"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PROJECT_SAVE_DEBOUNCE_MS } from "../../planner/constants";
import { pullSharedStorageSnapshot, pushSharedStorageSnapshot, SHARED_STORAGE_UPDATED_EVENT } from "../../sharedStorage";
import {
  loadProjectRecordsFromStorage,
  persistProjectRecordsToStorage,
  toggleProjectWorkCode,
  type EditableProjectTextField,
  type PlannerWorkspaceProject,
  type PlannerWorkspaceProjectRecord,
  updateProjectOutageDateEnd,
  updateProjectOutageDateStart,
  updateProjectOutageEnabled,
  updateProjectOutageTime,
  updateProjectPdfTemplate,
  updateProjectTextField,
  updateProjectWorkDateEnd,
  updateProjectWorkDateStart,
} from "./project-storage";

type SaveState = "idle" | "saving" | "saved" | "error";

export function useProjectWorkspace() {
  const [records, setRecords] = useState<PlannerWorkspaceProjectRecord[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [loading, setLoading] = useState(true);
  const [sharedReady, setSharedReady] = useState(false);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState("");
  const saveTimerRef = useRef<number | null>(null);
  const dirtyRef = useRef(false);

  const reload = async (preserveSelection: boolean): Promise<void> => {
    setLoading(true);
    const synced = await pullSharedStorageSnapshot();
    setSharedReady(synced);

    if (dirtyRef.current) {
      setLoading(false);
      return;
    }

    try {
      const nextRecords = loadProjectRecordsFromStorage();
      setRecords(nextRecords);
      setSelectedProjectId((current) => {
        if (preserveSelection && current && nextRecords.some((record) => record.project.projectId === current)) {
          return current;
        }
        return nextRecords[0]?.project.projectId ?? "";
      });
      setError("");
      setSaveState("idle");
    } catch {
      setError("案件データの読み込みに失敗しました。既存保存形式との互換を確認してください。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload(false);
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent): void => {
      if (dirtyRef.current) {
        return;
      }
      if (event.key && !event.key.startsWith("sekou-")) {
        return;
      }
      void reload(true);
    };

    const onSharedUpdated = (): void => {
      if (dirtyRef.current) {
        return;
      }
      void reload(true);
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(SHARED_STORAGE_UPDATED_EVENT, onSharedUpdated as EventListener);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(SHARED_STORAGE_UPDATED_EVENT, onSharedUpdated as EventListener);
    };
  }, []);

  const projects = useMemo(() => records.map((record) => record.project), [records]);
  const selectedRecord = useMemo(
    () => records.find((record) => record.project.projectId === selectedProjectId) ?? null,
    [records, selectedProjectId],
  );
  const selectedProject = selectedRecord?.project ?? null;

  const updateSelectedRecord = (updater: (record: PlannerWorkspaceProjectRecord) => PlannerWorkspaceProjectRecord): void => {
    if (!selectedProjectId) {
      return;
    }
    setRecords((prev) => prev.map((record) => (
      record.project.projectId === selectedProjectId ? updater(record) : record
    )));
    dirtyRef.current = true;
    setSaveState("saving");
    setError("");
  };

  useEffect(() => {
    if (!dirtyRef.current) {
      return;
    }

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      const savedAt = persistProjectRecordsToStorage(records);
      if (!savedAt) {
        setSaveState("error");
        setError("案件データの保存に失敗しました。ブラウザの容量と保存形式を確認してください。");
        return;
      }

      setLastSavedAt(savedAt);
      setSaveState("saved");
      dirtyRef.current = false;
      void pushSharedStorageSnapshot().then((ok) => {
        if (ok) {
          setSharedReady(true);
        }
      });
    }, PROJECT_SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [records]);

  const updateTextField = (field: EditableProjectTextField, value: string): void => {
    updateSelectedRecord((record) => updateProjectTextField(record, field, value));
  };

  return {
    projects,
    selectedProject,
    selectedProjectId,
    setSelectedProjectId,
    loading,
    sharedReady,
    error,
    saveState,
    lastSavedAt,
    updateTextField,
    updatePdfTemplate: (value: string) => updateSelectedRecord((record) => updateProjectPdfTemplate(record, value)),
    updateOutageEnabled: (checked: boolean) => updateSelectedRecord((record) => updateProjectOutageEnabled(record, checked)),
    toggleWorkCode: (workCode: Parameters<typeof toggleProjectWorkCode>[1]) =>
      updateSelectedRecord((record) => toggleProjectWorkCode(record, workCode)),
    updateWorkDateStart: (value: string) => updateSelectedRecord((record) => updateProjectWorkDateStart(record, value)),
    updateWorkDateEnd: (value: string) => updateSelectedRecord((record) => updateProjectWorkDateEnd(record, value)),
    updateOutageDateStart: (value: string) => updateSelectedRecord((record) => updateProjectOutageDateStart(record, value)),
    updateOutageDateEnd: (value: string) => updateSelectedRecord((record) => updateProjectOutageDateEnd(record, value)),
    updateOutageTimeStart: (value: string) => updateSelectedRecord((record) => updateProjectOutageTime(record, "outageTimeStart", value)),
    updateOutageTimeEnd: (value: string) => updateSelectedRecord((record) => updateProjectOutageTime(record, "outageTimeEnd", value)),
  } satisfies {
    projects: PlannerWorkspaceProject[];
    selectedProject: PlannerWorkspaceProject | null;
    selectedProjectId: string;
    setSelectedProjectId: (projectId: string) => void;
    loading: boolean;
    sharedReady: boolean;
    error: string;
    saveState: SaveState;
    lastSavedAt: string;
    updateTextField: (field: EditableProjectTextField, value: string) => void;
    updatePdfTemplate: (value: string) => void;
    updateOutageEnabled: (checked: boolean) => void;
    toggleWorkCode: (workCode: Parameters<typeof toggleProjectWorkCode>[1]) => void;
    updateWorkDateStart: (value: string) => void;
    updateWorkDateEnd: (value: string) => void;
    updateOutageDateStart: (value: string) => void;
    updateOutageDateEnd: (value: string) => void;
    updateOutageTimeStart: (value: string) => void;
    updateOutageTimeEnd: (value: string) => void;
  };
}
