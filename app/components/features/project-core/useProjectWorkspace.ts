"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSessionUser, type AuthUser } from "../../auth";
import { PROJECT_SAVE_DEBOUNCE_MS } from "../../planner/constants";
import {
  pullSharedStorageSnapshot,
  pushSharedStorageSnapshot,
  SHARED_STORAGE_RESYNC_INTERVAL_MS,
  SHARED_STORAGE_UPDATED_EVENT,
} from "../../sharedStorage";
import {
  formatProjectEditLockNotice,
  getProjectEditLockOwner,
  getProjectEditLockKey,
  PROJECT_EDIT_LOCK_HEARTBEAT_MS,
  releaseProjectEditLock,
  syncProjectEditLock,
  type ProjectEditLock,
  type ProjectEditLockSyncResult,
} from "./project-edit-lock";
import {
  materializeProjectRecord,
  loadProjectRecordsFromStorage,
  persistProjectRecordsToStorage,
  replaceProjectRecord,
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
import {
  applyProjectSnapshot,
  createProjectRevision,
  loadRevisionsFromStorage,
  persistRevisionsToStorage,
  prependProjectRevision,
} from "../revisions/revision-utils";

type SaveState = "idle" | "saving" | "saved" | "error";
type RevisionNotice = { type: "ok" | "error"; text: string } | null;

export function useProjectWorkspace() {
  const [records, setRecords] = useState<PlannerWorkspaceProjectRecord[]>([]);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [projectEditLock, setProjectEditLock] = useState<ProjectEditLock | null>(null);
  const [projectEditLockStatus, setProjectEditLockStatus] = useState<ProjectEditLockSyncResult["status"]>("idle");
  const [revisions, setRevisions] = useState<ReturnType<typeof loadRevisionsFromStorage>>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedRevisionId, setSelectedRevisionId] = useState("");
  const [loading, setLoading] = useState(true);
  const [sharedReady, setSharedReady] = useState(false);
  const [error, setError] = useState("");
  const [revisionNotice, setRevisionNotice] = useState<RevisionNotice>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState("");
  const saveTimerRef = useRef<number | null>(null);
  const dirtyRef = useRef(false);

  const reload = async (preserveSelection: boolean): Promise<void> => {
    setLoading(true);
    const synced = await pullSharedStorageSnapshot();
    setSharedReady(synced);
    setCurrentUser(getSessionUser());

    if (dirtyRef.current) {
      setLoading(false);
      return;
    }

    try {
      const nextRecords = loadProjectRecordsFromStorage();
      const nextRevisions = loadRevisionsFromStorage();
      setRecords(nextRecords);
      setRevisions(nextRevisions);
      setSelectedProjectId((current) => {
        if (preserveSelection && current && nextRecords.some((record) => record.project.projectId === current)) {
          return current;
        }
        return nextRecords[0]?.project.projectId ?? "";
      });
      setError("");
      setRevisionNotice(null);
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

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible" || dirtyRef.current) {
        return;
      }
      void reload(true);
    }, SHARED_STORAGE_RESYNC_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const projects = useMemo(() => records.map((record) => record.project), [records]);
  const canEdit = currentUser?.role === "system_admin" || currentUser?.role === "admin" || currentUser?.role === "editor";
  const projectEditOwner = useMemo(
    () => (currentUser ? getProjectEditLockOwner(currentUser) : null),
    [currentUser],
  );
  const selectedRecord = useMemo(
    () => records.find((record) => record.project.projectId === selectedProjectId) ?? null,
    [records, selectedProjectId],
  );
  const selectedProject = selectedRecord?.project ?? null;
  const selectedProjectFull = useMemo(
    () => (selectedRecord ? materializeProjectRecord(selectedRecord) : null),
    [selectedRecord],
  );
  const projectRevisions = useMemo(
    () => revisions.filter((revision) => revision.projectId === selectedProjectId),
    [revisions, selectedProjectId],
  );
  const selectedRevision = useMemo(
    () => projectRevisions.find((revision) => revision.id === selectedRevisionId) ?? null,
    [projectRevisions, selectedRevisionId],
  );
  const projectEditLockMessage = useMemo(
    () => formatProjectEditLockNotice(projectEditLock, currentUser?.id),
    [currentUser?.id, projectEditLock],
  );
  const canEditSelectedProject = canEdit && projectEditLockStatus !== "locked_by_other";

  useEffect(() => {
    if (!projectRevisions.length) {
      setSelectedRevisionId("");
      return;
    }
    if (!selectedRevisionId || !projectRevisions.some((revision) => revision.id === selectedRevisionId)) {
      setSelectedRevisionId(projectRevisions[0].id);
    }
  }, [projectRevisions, selectedRevisionId]);

  useEffect(() => {
    let cancelled = false;

    const applyLockResult = (result: ProjectEditLockSyncResult): void => {
      if (cancelled) {
        return;
      }
      setProjectEditLock(result.lock);
      setProjectEditLockStatus(result.status);
    };

    if (!selectedProjectId || !currentUser) {
      applyLockResult({ status: "idle", lock: null });
      return () => {
        cancelled = true;
      };
    }

    const refreshLock = async (acquire: boolean): Promise<void> => {
      const result = await syncProjectEditLock(selectedProjectId, projectEditOwner, { acquire });
      applyLockResult(result);
    };

    void refreshLock(canEdit);

    const heartbeat = window.setInterval(() => {
      void refreshLock(canEdit);
    }, PROJECT_EDIT_LOCK_HEARTBEAT_MS);

    const onStorage = (event: StorageEvent): void => {
      if (event.key && event.key !== getProjectEditLockKey(selectedProjectId)) {
        return;
      }
      void refreshLock(false);
    };

    window.addEventListener("storage", onStorage);

    return () => {
      cancelled = true;
      window.clearInterval(heartbeat);
      window.removeEventListener("storage", onStorage);
      if (canEdit) {
        void releaseProjectEditLock(selectedProjectId, projectEditOwner);
      }
    };
  }, [canEdit, currentUser, projectEditOwner, selectedProjectId]);

  const updateSelectedRecord = (updater: (record: PlannerWorkspaceProjectRecord) => PlannerWorkspaceProjectRecord): void => {
    if (!selectedProjectId || !canEdit) {
      return;
    }
    if (!canEditSelectedProject) {
      setError(projectEditLockMessage || "この案件は現在ほかのユーザーが編集中です。");
      setSaveState("error");
      return;
    }
    setRecords((prev) => prev.map((record) => (
      record.project.projectId === selectedProjectId ? updater(record) : record
    )));
    dirtyRef.current = true;
    setSaveState("saving");
    setError("");
  };

  const persistRevisionList = (nextRevisions: ReturnType<typeof loadRevisionsFromStorage>): boolean => {
    const saved = persistRevisionsToStorage(nextRevisions);
    if (!saved) {
      setRevisionNotice({ type: "error", text: "履歴の保存に失敗しました。ブラウザの保存容量を確認してください。" });
      return false;
    }
    setRevisions(nextRevisions);
    void pushSharedStorageSnapshot().then((ok) => {
      if (ok) {
        setSharedReady(true);
      }
    });
    return true;
  };

  useEffect(() => {
    if (!dirtyRef.current) {
      return;
    }

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      void (async () => {
        if (selectedProjectId && projectEditOwner && canEdit) {
          const lockResult = await syncProjectEditLock(selectedProjectId, projectEditOwner, { acquire: true });
          setProjectEditLock(lockResult.lock);
          setProjectEditLockStatus(lockResult.status);
          if (lockResult.status !== "owned") {
            setSaveState("error");
            setError(formatProjectEditLockNotice(lockResult.lock, currentUser?.id) || "この案件は現在ほかのユーザーが編集中です。");
            dirtyRef.current = false;
            return;
          }
        }

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
      })();
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

  const saveManualRevision = (): void => {
    if (!selectedProjectFull || !currentUser || !canEditSelectedProject) {
      return;
    }
    const revision = createProjectRevision(
      selectedProjectFull,
      currentUser,
      `手動履歴保存 ${new Date().toLocaleString("ja-JP")}`,
    );
    const nextRevisions = prependProjectRevision(revisions, revision);
    if (!persistRevisionList(nextRevisions)) {
      return;
    }
    setSelectedRevisionId(revision.id);
    setRevisionNotice({ type: "ok", text: "現在内容を履歴保存しました。" });
  };

  const restoreSelectedRevision = (): void => {
    if (!selectedRecord || !selectedProjectFull || !selectedRevision || !currentUser || !canEditSelectedProject) {
      return;
    }

    const backupRevision = createProjectRevision(
      selectedProjectFull,
      currentUser,
      `復元前履歴保存 ${new Date().toLocaleString("ja-JP")}`,
    );
    const restoredProject = applyProjectSnapshot(selectedProjectFull, selectedRevision.snapshot);

    updateSelectedRecord(() => replaceProjectRecord(selectedRecord, restoredProject));
    const nextRevisions = prependProjectRevision(revisions, backupRevision);
    const revisionSaved = persistRevisionList(nextRevisions);
    setSelectedRevisionId(selectedRevision.id);
    if (revisionSaved) {
      setRevisionNotice({ type: "ok", text: `履歴「${selectedRevision.label}」を復元しました。` });
    }
  };

  return {
    currentUser,
    canEdit,
    canEditSelectedProject,
    projects,
    selectedProject,
    selectedProjectId,
    selectedProjectFull,
    setSelectedProjectId,
    projectRevisions,
    selectedRevision,
    selectedRevisionId,
    setSelectedRevisionId,
    loading,
    sharedReady,
    error,
    projectEditLockMessage,
    projectEditLockStatus,
    revisionNotice,
    saveState,
    lastSavedAt,
    saveManualRevision,
    restoreSelectedRevision,
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
    currentUser: AuthUser | null;
    canEdit: boolean;
    canEditSelectedProject: boolean;
    projects: PlannerWorkspaceProject[];
    selectedProject: PlannerWorkspaceProject | null;
    selectedProjectFull: ReturnType<typeof materializeProjectRecord> | null;
    selectedProjectId: string;
    setSelectedProjectId: (projectId: string) => void;
    projectRevisions: ReturnType<typeof loadRevisionsFromStorage>;
    selectedRevision: ReturnType<typeof loadRevisionsFromStorage>[number] | null;
    selectedRevisionId: string;
    setSelectedRevisionId: (revisionId: string) => void;
    loading: boolean;
    sharedReady: boolean;
    error: string;
    projectEditLockMessage: string;
    projectEditLockStatus: ProjectEditLockSyncResult["status"];
    revisionNotice: RevisionNotice;
    saveState: SaveState;
    lastSavedAt: string;
    saveManualRevision: () => void;
    restoreSelectedRevision: () => void;
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
