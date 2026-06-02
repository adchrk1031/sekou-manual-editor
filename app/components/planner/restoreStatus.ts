"use client";

export type RestoreSource =
  | "browser_local"
  | "shared_sync"
  | "server_backup"
  | "json_import"
  | "empty";

export type RestoreStatus = {
  version: 1;
  recordedAt: string;
  workspaceSource: RestoreSource;
  configSource: RestoreSource;
  note: string;
  detail?: string;
};

const RESTORE_STATUS_STORAGE_KEY = "sekou-restore-status-v1";

function isRestoreSource(value: unknown): value is RestoreSource {
  return value === "browser_local"
    || value === "shared_sync"
    || value === "server_backup"
    || value === "json_import"
    || value === "empty";
}

function isRestoreStatus(value: unknown): value is RestoreStatus {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<RestoreStatus>;
  return candidate.version === 1
    && typeof candidate.recordedAt === "string"
    && isRestoreSource(candidate.workspaceSource)
    && isRestoreSource(candidate.configSource)
    && typeof candidate.note === "string"
    && (typeof candidate.detail === "undefined" || typeof candidate.detail === "string");
}

export function readRestoreStatus(): RestoreStatus | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(RESTORE_STATUS_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    return isRestoreStatus(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeRestoreStatus(status: RestoreStatus): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.setItem(RESTORE_STATUS_STORAGE_KEY, JSON.stringify(status));
  } catch {
    // Keep UI state in memory if sessionStorage is unavailable.
  }
}

export function formatRestoreSourceLabel(source: RestoreSource): string {
  if (source === "browser_local") {
    return "この端末保存";
  }
  if (source === "shared_sync") {
    return "共有同期";
  }
  if (source === "server_backup") {
    return "サーバーバックアップ";
  }
  if (source === "json_import") {
    return "JSONインポート";
  }
  return "未復元";
}

export function buildRestoreStatusValue(status: RestoreStatus): string {
  return `案件/CSV: ${formatRestoreSourceLabel(status.workspaceSource)} / 設定: ${formatRestoreSourceLabel(status.configSource)}`;
}
