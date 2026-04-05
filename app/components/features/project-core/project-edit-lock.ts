"use client";

import { pushSharedStorageSnapshot } from "../../sharedStorage";

export type ProjectEditLock = {
  projectId: string;
  userId: string;
  userName: string;
  sessionId: string;
  acquiredAt: string;
  updatedAt: string;
  expiresAt: string;
};

export type ProjectEditLockOwner = {
  userId: string;
  userName: string;
  sessionId: string;
};

export type ProjectEditLockSyncResult = {
  status: "idle" | "owned" | "locked_by_other";
  lock: ProjectEditLock | null;
};

type SharedStatePullResponse = {
  ok?: unknown;
  exists?: unknown;
  payload?: unknown;
};

const PROJECT_EDIT_LOCK_PREFIX = "sekou-project-edit-lock-v1:";
const PROJECT_EDIT_SESSION_STORAGE_KEY = "sekou-project-edit-session-v1";
const PROJECT_EDIT_LOCK_TTL_MS = 2 * 60 * 1000;
export const PROJECT_EDIT_LOCK_HEARTBEAT_MS = 30 * 1000;

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getNowIso(): string {
  return new Date().toISOString();
}

function getExpiryIso(): string {
  return new Date(Date.now() + PROJECT_EDIT_LOCK_TTL_MS).toISOString();
}

function normalizeProjectEditLock(value: unknown): ProjectEditLock | null {
  if (!isRecord(value)) {
    return null;
  }

  const projectId = typeof value.projectId === "string" ? value.projectId.trim() : "";
  const userId = typeof value.userId === "string" ? value.userId.trim() : "";
  const userName = typeof value.userName === "string" ? value.userName.trim() : "";
  const sessionId = typeof value.sessionId === "string" ? value.sessionId.trim() : "";
  const acquiredAt = typeof value.acquiredAt === "string" ? value.acquiredAt : "";
  const updatedAt = typeof value.updatedAt === "string" ? value.updatedAt : "";
  const expiresAt = typeof value.expiresAt === "string" ? value.expiresAt : "";

  if (!projectId || !userId || !userName || !sessionId || !expiresAt) {
    return null;
  }

  return {
    projectId,
    userId,
    userName,
    sessionId,
    acquiredAt: acquiredAt || updatedAt || getNowIso(),
    updatedAt: updatedAt || acquiredAt || getNowIso(),
    expiresAt,
  };
}

function isSharedStatePayload(value: unknown): value is { items: Record<string, string> } {
  if (!isRecord(value) || !isRecord(value.items)) {
    return false;
  }
  return Object.entries(value.items).every(([key, itemValue]) => typeof key === "string" && typeof itemValue === "string");
}

export function getProjectEditLockKey(projectId: string): string {
  return `${PROJECT_EDIT_LOCK_PREFIX}${projectId}`;
}

export function getProjectEditLockOwner(user: { id: string; name: string }): ProjectEditLockOwner {
  let sessionId = "";
  try {
    sessionId = window.sessionStorage.getItem(PROJECT_EDIT_SESSION_STORAGE_KEY) ?? "";
    if (!sessionId) {
      sessionId = uid("project_edit_session");
      window.sessionStorage.setItem(PROJECT_EDIT_SESSION_STORAGE_KEY, sessionId);
    }
  } catch {
    sessionId = uid("project_edit_session");
  }

  return {
    userId: user.id,
    userName: user.name || "不明",
    sessionId,
  };
}

export function isProjectEditLockActive(lock: ProjectEditLock | null): boolean {
  if (!lock) {
    return false;
  }
  const expiresAtMs = Date.parse(lock.expiresAt);
  return Number.isFinite(expiresAtMs) && expiresAtMs > Date.now();
}

export function isProjectEditLockOwner(lock: ProjectEditLock | null, owner: ProjectEditLockOwner | null): boolean {
  if (!lock || !owner) {
    return false;
  }
  return lock.userId === owner.userId && lock.sessionId === owner.sessionId;
}

export function readProjectEditLock(projectId: string): ProjectEditLock | null {
  if (typeof window === "undefined" || !projectId) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(getProjectEditLockKey(projectId));
    if (!raw) {
      return null;
    }
    return normalizeProjectEditLock(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeProjectEditLock(projectId: string, lock: ProjectEditLock | null): void {
  if (typeof window === "undefined" || !projectId) {
    return;
  }
  const key = getProjectEditLockKey(projectId);
  if (!lock) {
    window.localStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(lock));
}

function buildProjectEditLock(projectId: string, owner: ProjectEditLockOwner): ProjectEditLock {
  const nowIso = getNowIso();
  return {
    projectId,
    userId: owner.userId,
    userName: owner.userName,
    sessionId: owner.sessionId,
    acquiredAt: nowIso,
    updatedAt: nowIso,
    expiresAt: getExpiryIso(),
  };
}

async function fetchRemoteProjectEditLock(projectId: string): Promise<ProjectEditLock | null> {
  if (typeof window === "undefined" || !projectId) {
    return null;
  }

  try {
    const response = await fetch("/api/manual-editor/state", {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) {
      return readProjectEditLock(projectId);
    }
    const body = (await response.json()) as SharedStatePullResponse;
    if (body.ok !== true || body.exists === false || !isSharedStatePayload(body.payload)) {
      return null;
    }
    const rawLock = body.payload.items[getProjectEditLockKey(projectId)];
    if (!rawLock) {
      return null;
    }
    return normalizeProjectEditLock(JSON.parse(rawLock));
  } catch {
    return readProjectEditLock(projectId);
  }
}

export async function syncProjectEditLock(
  projectId: string,
  owner: ProjectEditLockOwner | null,
  options?: { acquire?: boolean },
): Promise<ProjectEditLockSyncResult> {
  if (!projectId || !owner) {
    return { status: "idle", lock: null };
  }

  const remoteLock = await fetchRemoteProjectEditLock(projectId);
  if (isProjectEditLockActive(remoteLock) && !isProjectEditLockOwner(remoteLock, owner)) {
    writeProjectEditLock(projectId, remoteLock);
    return {
      status: "locked_by_other",
      lock: remoteLock,
    };
  }

  if (!options?.acquire) {
    const localLock = readProjectEditLock(projectId);
    if (isProjectEditLockActive(localLock) && isProjectEditLockOwner(localLock, owner)) {
      return {
        status: "owned",
        lock: localLock,
      };
    }
    if (isProjectEditLockActive(remoteLock) && isProjectEditLockOwner(remoteLock, owner)) {
      writeProjectEditLock(projectId, remoteLock);
      return {
        status: "owned",
        lock: remoteLock,
      };
    }
    return { status: "idle", lock: null };
  }

  const nextLock = buildProjectEditLock(projectId, owner);
  writeProjectEditLock(projectId, nextLock);
  await pushSharedStorageSnapshot({ force: true });

  const confirmedLock = await fetchRemoteProjectEditLock(projectId);
  if (isProjectEditLockActive(confirmedLock) && isProjectEditLockOwner(confirmedLock, owner)) {
    writeProjectEditLock(projectId, confirmedLock);
    return {
      status: "owned",
      lock: confirmedLock,
    };
  }
  if (isProjectEditLockActive(confirmedLock)) {
    writeProjectEditLock(projectId, confirmedLock);
    return {
      status: "locked_by_other",
      lock: confirmedLock,
    };
  }

  return {
    status: "owned",
    lock: nextLock,
  };
}

export async function releaseProjectEditLock(
  projectId: string,
  owner: ProjectEditLockOwner | null,
): Promise<void> {
  if (!projectId || !owner) {
    return;
  }

  const currentLock = readProjectEditLock(projectId);
  if (!isProjectEditLockOwner(currentLock, owner)) {
    return;
  }

  writeProjectEditLock(projectId, null);
  await pushSharedStorageSnapshot({ keepalive: true, force: true, timeoutMs: 1500 });
}

export function formatProjectEditLockNotice(
  lock: ProjectEditLock | null,
  currentUserId?: string,
): string {
  if (!lock || !isProjectEditLockActive(lock)) {
    return "";
  }
  if (currentUserId && lock.userId === currentUserId) {
    return "この案件はこのアカウントの別タブ、または別ブラウザですでに編集中です。編集を続ける前に、他の画面を閉じるか保存状況を確認してください。";
  }
  return `${lock.userName} さんがこの案件を編集中です。共同閲覧はできますが、編集はロック解除まで読み取り専用になります。`;
}
