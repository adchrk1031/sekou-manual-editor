"use client";

type SharedStatePayload = {
  items: Record<string, string>;
};

type SharedStatePullResponse = {
  ok?: unknown;
  exists?: unknown;
  payload?: unknown;
  updatedAt?: unknown;
};

const SHARED_STATE_API_PATH = "/api/manual-editor/state";
const SHARED_FETCH_TIMEOUT_MS = 5000;
export const SHARED_STORAGE_UPDATED_EVENT = "sekou:shared-storage-updated";
const SHARED_KEY_PREFIXES = [
  "sekou-project-data-v1:",
  "sekou-",
];
const SHARED_KEY_EXCLUDES = new Set([
  "sekou-tool-session-v1",
  "sekou-auth-login-guard-v1",
  "sekou-debug-outage-trace",
  "sekou-debug-legacy-date",
]);

function isSharedStorageKey(key: string): boolean {
  if (!key || SHARED_KEY_EXCLUDES.has(key)) {
    return false;
  }
  return SHARED_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function isSharedStatePayload(value: unknown): value is SharedStatePayload {
  if (!value || typeof value !== "object") {
    return false;
  }
  const items = (value as { items?: unknown }).items;
  if (!items || typeof items !== "object" || Array.isArray(items)) {
    return false;
  }
  return Object.entries(items).every(([key, itemValue]) => typeof key === "string" && typeof itemValue === "string");
}

let lastPulledUpdatedAt: string | null = null;

export function collectSharedStorageSnapshot(): SharedStatePayload {
  const items: Record<string, string> = {};
  if (typeof window === "undefined") {
    return { items };
  }
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key || !isSharedStorageKey(key)) {
      continue;
    }
    const value = window.localStorage.getItem(key);
    if (typeof value === "string") {
      items[key] = value;
    }
  }
  return { items };
}

export function applySharedStorageSnapshot(payload: SharedStatePayload): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  let changed = false;
  const nextItems = payload.items || {};
  const existingSharedKeys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (key && isSharedStorageKey(key)) {
      existingSharedKeys.push(key);
    }
  }

  existingSharedKeys.forEach((key) => {
    if (!(key in nextItems)) {
      window.localStorage.removeItem(key);
      changed = true;
    }
  });

  Object.entries(nextItems).forEach(([key, value]) => {
    if (isSharedStorageKey(key)) {
      const prev = window.localStorage.getItem(key);
      if (prev !== value) {
        window.localStorage.setItem(key, value);
        changed = true;
      }
    }
  });
  return changed;
}

function dispatchSharedStorageUpdated(updatedAt?: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent<{ updatedAt?: string }>(SHARED_STORAGE_UPDATED_EVENT, {
      detail: { updatedAt },
    }),
  );
}

export async function pullSharedStorageSnapshot(): Promise<boolean> {
  if (typeof window === "undefined") {
    return false;
  }
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), SHARED_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(SHARED_STATE_API_PATH, {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    });
    if (!response.ok) {
      return false;
    }
    const body = (await response.json()) as SharedStatePullResponse;
    if (body.ok !== true) {
      return false;
    }
    if (body.exists === false) {
      lastPulledUpdatedAt = null;
      return true;
    }
    if (!isSharedStatePayload(body.payload)) {
      return false;
    }
    const updatedAt = typeof body.updatedAt === "string" ? body.updatedAt : undefined;
    const changed = applySharedStorageSnapshot(body.payload);
    if (updatedAt) {
      lastPulledUpdatedAt = updatedAt;
    }
    if (changed) {
      dispatchSharedStorageUpdated(updatedAt);
    }
    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function pushSharedStorageSnapshot(): Promise<boolean> {
  if (typeof window === "undefined") {
    return false;
  }
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), SHARED_FETCH_TIMEOUT_MS);
  try {
    const payload = collectSharedStorageSnapshot();
    const response = await fetch(SHARED_STATE_API_PATH, {
      method: "PUT",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ payload }),
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}
