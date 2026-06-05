"use client";

import {
  CSV_EDITOR_STORAGE_KEY,
  PROJECT_DATA_STORAGE_PREFIX,
  PROJECT_INDEX_STORAGE_KEY,
  STORAGE_KEY,
} from "./constants";
import { removeSharedStorageItem, writeSharedStorageItem } from "../sharedStorage";

export type ManualEditorWorkspacePayload = {
  version: 1;
  projectIndex: string[];
  projectDataById: Record<string, string>;
  csvEditorRaw: string;
  savedAt: string;
};

type WorkspaceSnapshotResponse = {
  ok?: unknown;
  exists?: unknown;
  payload?: unknown;
  updatedAt?: unknown;
  error?: unknown;
};

const WORKSPACE_API_PATH = "/api/manual-editor/workspace";

function isWorkspacePayload(value: unknown): value is ManualEditorWorkspacePayload {
  if (!value || typeof value !== "object") {
    return false;
  }
  const payload = value as Partial<ManualEditorWorkspacePayload>;
  return payload.version === 1
    && Array.isArray(payload.projectIndex)
    && payload.projectIndex.every((id) => typeof id === "string")
    && Boolean(payload.projectDataById)
    && typeof payload.projectDataById === "object"
    && !Array.isArray(payload.projectDataById)
    && Object.values(payload.projectDataById).every((raw) => typeof raw === "string")
    && typeof payload.csvEditorRaw === "string"
    && typeof payload.savedAt === "string";
}

export function hasLocalWorkspaceData(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return Boolean(
    window.localStorage.getItem(PROJECT_INDEX_STORAGE_KEY)
    || window.localStorage.getItem(STORAGE_KEY)
    || window.localStorage.getItem(CSV_EDITOR_STORAGE_KEY),
  );
}

export function buildWorkspacePersistencePayload(
  projectIndex: string[],
  projectDataById: Record<string, string>,
  csvEditorRaw: string,
): ManualEditorWorkspacePayload {
  return {
    version: 1,
    projectIndex: [...projectIndex],
    projectDataById: { ...projectDataById },
    csvEditorRaw,
    savedAt: new Date().toISOString(),
  };
}

export function applyWorkspaceSnapshotToLocalStorage(payload: ManualEditorWorkspacePayload): void {
  if (typeof window === "undefined") {
    return;
  }
  const existingKeys = Object.keys(window.localStorage).filter((key) => key.startsWith(PROJECT_DATA_STORAGE_PREFIX));
  const nextKeySet = new Set(payload.projectIndex.map((id) => `${PROJECT_DATA_STORAGE_PREFIX}${id}`));
  existingKeys.forEach((key) => {
    if (!nextKeySet.has(key)) {
      removeSharedStorageItem(key);
    }
  });
  payload.projectIndex.forEach((projectId) => {
    const serialized = payload.projectDataById[projectId];
    if (typeof serialized === "string") {
      writeSharedStorageItem(`${PROJECT_DATA_STORAGE_PREFIX}${projectId}`, serialized);
    }
  });
  writeSharedStorageItem(PROJECT_INDEX_STORAGE_KEY, JSON.stringify(payload.projectIndex));
  removeSharedStorageItem(STORAGE_KEY);
  if (payload.csvEditorRaw) {
    writeSharedStorageItem(CSV_EDITOR_STORAGE_KEY, payload.csvEditorRaw);
  } else {
    removeSharedStorageItem(CSV_EDITOR_STORAGE_KEY);
  }
}

export async function fetchWorkspaceSnapshot(): Promise<{
  ok: boolean;
  exists: boolean;
  payload: ManualEditorWorkspacePayload | null;
  updatedAt: string | null;
  error?: string;
}> {
  try {
    const response = await fetch(WORKSPACE_API_PATH, {
      credentials: "same-origin",
      cache: "no-store",
    });
    const body = (await response.json().catch(() => null)) as WorkspaceSnapshotResponse | null;
    return {
      ok: response.ok,
      exists: Boolean(body?.exists),
      payload: isWorkspacePayload(body?.payload) ? body?.payload : null,
      updatedAt: typeof body?.updatedAt === "string" ? body.updatedAt : null,
      error: typeof body?.error === "string" ? body.error : undefined,
    };
  } catch {
    return {
      ok: false,
      exists: false,
      payload: null,
      updatedAt: null,
      error: "network_error",
    };
  }
}

export async function saveWorkspaceSnapshot(
  payload: ManualEditorWorkspacePayload,
  baseUpdatedAt: string | null,
  options?: { keepalive?: boolean },
): Promise<{
  ok: boolean;
  updatedAt: string | null;
  error?: string;
}> {
  try {
    const response = await fetch(WORKSPACE_API_PATH, {
      method: "PUT",
      credentials: "same-origin",
      cache: "no-store",
      keepalive: options?.keepalive,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payload,
        baseUpdatedAt,
      }),
    });
    const body = (await response.json().catch(() => null)) as WorkspaceSnapshotResponse | null;
    return {
      ok: response.ok,
      updatedAt: typeof body?.updatedAt === "string" ? body.updatedAt : null,
      error: typeof body?.error === "string" ? body.error : undefined,
    };
  } catch {
    return {
      ok: false,
      updatedAt: null,
      error: "network_error",
    };
  }
}
