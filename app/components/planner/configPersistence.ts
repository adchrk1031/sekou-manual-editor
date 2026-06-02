"use client";

import {
  APPROVAL_NOTE_TEMPLATE_STORAGE_KEY,
  AUDIT_STORAGE_KEY,
  DETAIL_PHOTO_TEMPLATE_STORAGE_KEY,
  LAYOUT_TEMPLATE_STORAGE_KEY,
  NOTICE_TEMPLATE_STORAGE_KEY,
  PARTY_COMPANY_TEMPLATE_STORAGE_KEY,
  PARTY_TEMPLATE_STORAGE_KEY,
  REVISION_STORAGE_KEY,
  SCHEDULE_PROCEDURE_TEMPLATE_STORAGE_KEY,
  SCHEDULE_TEMPLATE_STORAGE_KEY,
} from "./constants";
import { removeSharedStorageItem, writeSharedStorageItem } from "../sharedStorage";

export type ManualEditorConfigPayload = {
  version: 1;
  items: Record<string, string>;
  savedAt: string;
};

type ConfigSnapshotResponse = {
  ok?: unknown;
  exists?: unknown;
  payload?: unknown;
  updatedAt?: unknown;
  error?: unknown;
};

const CONFIG_API_PATH = "/api/manual-editor/config";

export const CONFIG_PERSISTENCE_KEYS = [
  AUDIT_STORAGE_KEY,
  REVISION_STORAGE_KEY,
  NOTICE_TEMPLATE_STORAGE_KEY,
  APPROVAL_NOTE_TEMPLATE_STORAGE_KEY,
  SCHEDULE_TEMPLATE_STORAGE_KEY,
  SCHEDULE_PROCEDURE_TEMPLATE_STORAGE_KEY,
  DETAIL_PHOTO_TEMPLATE_STORAGE_KEY,
  PARTY_TEMPLATE_STORAGE_KEY,
  PARTY_COMPANY_TEMPLATE_STORAGE_KEY,
  LAYOUT_TEMPLATE_STORAGE_KEY,
] as const;

function isConfigPayload(value: unknown): value is ManualEditorConfigPayload {
  if (!value || typeof value !== "object") {
    return false;
  }
  const payload = value as Partial<ManualEditorConfigPayload>;
  return payload.version === 1
    && Boolean(payload.items)
    && typeof payload.items === "object"
    && !Array.isArray(payload.items)
    && Object.entries(payload.items).every(([key, rawValue]) => typeof key === "string" && typeof rawValue === "string")
    && typeof payload.savedAt === "string";
}

export function hasLocalConfigData(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return CONFIG_PERSISTENCE_KEYS.some((key) => typeof window.localStorage.getItem(key) === "string");
}

export function readLocalConfigSnapshotItems(): Record<string, string> {
  if (typeof window === "undefined") {
    return {};
  }
  const items: Record<string, string> = {};
  CONFIG_PERSISTENCE_KEYS.forEach((key) => {
    const rawValue = window.localStorage.getItem(key);
    if (typeof rawValue === "string") {
      items[key] = rawValue;
    }
  });
  return items;
}

export function getLocalConfigSnapshotSignature(): string {
  return JSON.stringify(readLocalConfigSnapshotItems());
}

export function buildConfigPersistencePayloadFromLocalStorage(): ManualEditorConfigPayload {
  return {
    version: 1,
    items: readLocalConfigSnapshotItems(),
    savedAt: new Date().toISOString(),
  };
}

export function applyConfigSnapshotToLocalStorage(payload: ManualEditorConfigPayload): void {
  if (typeof window === "undefined") {
    return;
  }
  const nextKeys = new Set(Object.keys(payload.items));
  CONFIG_PERSISTENCE_KEYS.forEach((key) => {
    const rawValue = payload.items[key];
    if (typeof rawValue === "string") {
      writeSharedStorageItem(key, rawValue);
      return;
    }
    if (!nextKeys.has(key)) {
      removeSharedStorageItem(key);
    }
  });
}

export async function fetchConfigSnapshot(): Promise<{
  ok: boolean;
  exists: boolean;
  payload: ManualEditorConfigPayload | null;
  updatedAt: string | null;
  error?: string;
}> {
  try {
    const response = await fetch(CONFIG_API_PATH, {
      credentials: "same-origin",
      cache: "no-store",
    });
    const body = (await response.json().catch(() => null)) as ConfigSnapshotResponse | null;
    return {
      ok: response.ok,
      exists: Boolean(body?.exists),
      payload: isConfigPayload(body?.payload) ? body.payload : null,
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

export async function saveConfigSnapshot(
  payload: ManualEditorConfigPayload,
  baseUpdatedAt: string | null,
  options?: { keepalive?: boolean },
): Promise<{
  ok: boolean;
  updatedAt: string | null;
  error?: string;
}> {
  try {
    const response = await fetch(CONFIG_API_PATH, {
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
    const body = (await response.json().catch(() => null)) as ConfigSnapshotResponse | null;
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
