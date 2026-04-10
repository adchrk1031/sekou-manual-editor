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

type SharedStatePushResponse = {
  ok?: unknown;
  payload?: unknown;
  updatedAt?: unknown;
};

type SharedStatePushOptions = {
  keepalive?: boolean;
  timeoutMs?: number;
  force?: boolean;
};

const SHARED_STATE_API_PATH = "/api/manual-editor/state";
const SHARED_FETCH_TIMEOUT_MS = 5000;
export const SHARED_STORAGE_UPDATED_EVENT = "sekou:shared-storage-updated";
export const SHARED_STORAGE_RESYNC_INTERVAL_MS = 30 * 1000;
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

const EMPTY_SHARED_STATE_PAYLOAD: SharedStatePayload = { items: {} };

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
let lastKnownSharedSnapshot: SharedStatePayload = EMPTY_SHARED_STATE_PAYLOAD;
let pushLoopPromise: Promise<boolean> | null = null;
let pullLoopPromise: Promise<boolean> | null = null;
let pushRequested = false;

function normalizeSharedStatePayload(payload: SharedStatePayload): SharedStatePayload {
  const items = payload.items || {};
  const normalizedEntries = Object.entries(items)
    .filter(([key, value]) => isSharedStorageKey(key) && typeof value === "string")
    .sort(([left], [right]) => left.localeCompare(right));
  return {
    items: Object.fromEntries(normalizedEntries),
  };
}

function cloneSharedStatePayload(payload: SharedStatePayload): SharedStatePayload {
  return {
    items: { ...payload.items },
  };
}

function getSharedStateSignature(payload: SharedStatePayload): string {
  return JSON.stringify(normalizeSharedStatePayload(payload));
}

function getEmptySharedStatePayload(): SharedStatePayload {
  return { items: {} };
}

function mergeSharedStateSnapshots(
  baseSnapshot: SharedStatePayload,
  remoteSnapshot: SharedStatePayload,
  localSnapshot: SharedStatePayload,
): SharedStatePayload {
  const baseItems = baseSnapshot.items || {};
  const remoteItems = remoteSnapshot.items || {};
  const localItems = localSnapshot.items || {};
  const mergedItems: Record<string, string> = {};
  const allKeys = new Set([
    ...Object.keys(baseItems),
    ...Object.keys(remoteItems),
    ...Object.keys(localItems),
  ]);

  allKeys.forEach((key) => {
    if (!isSharedStorageKey(key)) {
      return;
    }
    const baseHas = Object.prototype.hasOwnProperty.call(baseItems, key);
    const remoteHas = Object.prototype.hasOwnProperty.call(remoteItems, key);
    const localHas = Object.prototype.hasOwnProperty.call(localItems, key);
    const baseValue = baseHas ? baseItems[key] : undefined;
    const remoteValue = remoteHas ? remoteItems[key] : undefined;
    const localValue = localHas ? localItems[key] : undefined;

    const localChanged = localHas !== baseHas || localValue !== baseValue;
    const remoteChanged = remoteHas !== baseHas || remoteValue !== baseValue;

    if (localChanged) {
      if (localHas) {
        mergedItems[key] = localValue as string;
        return;
      }
      if (!remoteChanged) {
        return;
      }
      if (remoteHas) {
        mergedItems[key] = remoteValue as string;
      }
      return;
    }

    if (remoteChanged) {
      if (remoteHas) {
        mergedItems[key] = remoteValue as string;
      }
      return;
    }

    if (localHas) {
      mergedItems[key] = localValue as string;
    }
  });

  return normalizeSharedStatePayload({ items: mergedItems });
}

async function requestSharedStatePush(
  payload: SharedStatePayload,
  baseUpdatedAt: string | null,
  options?: SharedStatePushOptions,
): Promise<{ ok: true; updatedAt?: string } | { ok: false; status?: number; payload?: SharedStatePayload; updatedAt?: string }> {
  if (typeof window === "undefined") {
    return { ok: false };
  }
  const shouldKeepalive = Boolean(options?.keepalive);
  const timeoutMs = options?.timeoutMs ?? SHARED_FETCH_TIMEOUT_MS;
  const controller = shouldKeepalive ? null : new AbortController();
  const timer = shouldKeepalive
    ? null
    : window.setTimeout(() => {
        controller?.abort();
      }, timeoutMs);
  try {
    const response = await fetch(SHARED_STATE_API_PATH, {
      method: "PUT",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      signal: controller?.signal,
      keepalive: shouldKeepalive,
      body: JSON.stringify({
        payload,
        baseUpdatedAt,
      }),
    });
    const body = (await response.json().catch(() => null)) as SharedStatePushResponse | null;
    if (response.ok) {
      return {
        ok: true,
        updatedAt: typeof body?.updatedAt === "string" ? body.updatedAt : undefined,
      };
    }
    return {
      ok: false,
      status: response.status,
      payload: isSharedStatePayload(body?.payload) ? normalizeSharedStatePayload(body.payload) : undefined,
      updatedAt: typeof body?.updatedAt === "string" ? body.updatedAt : undefined,
    };
  } catch {
    return { ok: false };
  } finally {
    if (timer !== null) {
      window.clearTimeout(timer);
    }
  }
}

async function pushSharedStorageSnapshotOnce(options?: SharedStatePushOptions): Promise<boolean> {
  if (typeof window === "undefined") {
    return false;
  }

  const baseSnapshot = cloneSharedStatePayload(lastKnownSharedSnapshot);
  const localSnapshot = normalizeSharedStatePayload(collectSharedStorageSnapshot());

  if (!options?.force && getSharedStateSignature(baseSnapshot) === getSharedStateSignature(localSnapshot)) {
    return true;
  }

  const firstAttempt = await requestSharedStatePush(localSnapshot, lastPulledUpdatedAt, options);
  if (firstAttempt.ok) {
    if (firstAttempt.updatedAt) {
      lastPulledUpdatedAt = firstAttempt.updatedAt;
    }
    lastKnownSharedSnapshot = cloneSharedStatePayload(localSnapshot);
    return true;
  }

  if (firstAttempt.status !== 409 || !firstAttempt.payload) {
    return false;
  }

  const remoteSnapshot = firstAttempt.payload;
  if (firstAttempt.updatedAt) {
    lastPulledUpdatedAt = firstAttempt.updatedAt;
  }

  const latestLocalSnapshot = normalizeSharedStatePayload(collectSharedStorageSnapshot());
  const mergedSnapshot = mergeSharedStateSnapshots(baseSnapshot, remoteSnapshot, latestLocalSnapshot);
  const remoteSignature = getSharedStateSignature(remoteSnapshot);
  const mergedSignature = getSharedStateSignature(mergedSnapshot);

  const changedLocally = applySharedStorageSnapshot(mergedSnapshot);
  if (changedLocally) {
    dispatchSharedStorageUpdated(firstAttempt.updatedAt);
  }

  if (mergedSignature === remoteSignature) {
    lastKnownSharedSnapshot = cloneSharedStatePayload(remoteSnapshot);
    return true;
  }

  const retryAttempt = await requestSharedStatePush(mergedSnapshot, lastPulledUpdatedAt, options);
  if (retryAttempt.ok) {
    if (retryAttempt.updatedAt) {
      lastPulledUpdatedAt = retryAttempt.updatedAt;
    }
    lastKnownSharedSnapshot = cloneSharedStatePayload(mergedSnapshot);
    return true;
  }

  if (retryAttempt.status === 409 && retryAttempt.payload) {
    lastKnownSharedSnapshot = cloneSharedStatePayload(retryAttempt.payload);
    if (retryAttempt.updatedAt) {
      lastPulledUpdatedAt = retryAttempt.updatedAt;
    }
    pushRequested = true;
  }
  return false;
}

async function drainSharedStoragePushQueue(options?: SharedStatePushOptions): Promise<boolean> {
  let pushed = false;
  while (pushRequested) {
    pushRequested = false;
    const ok = await pushSharedStorageSnapshotOnce(options);
    pushed = ok || pushed;
  }
  return pushed;
}

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
  return normalizeSharedStatePayload({ items });
}

export function applySharedStorageSnapshot(payload: SharedStatePayload): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  let changed = false;
  const nextItems = normalizeSharedStatePayload(payload).items;
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

async function pullSharedStorageSnapshotOnce(): Promise<boolean> {
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
      lastKnownSharedSnapshot = getEmptySharedStatePayload();
      return true;
    }
    if (!isSharedStatePayload(body.payload)) {
      return false;
    }
    const updatedAt = typeof body.updatedAt === "string" ? body.updatedAt : undefined;
    const remoteSnapshot = normalizeSharedStatePayload(body.payload);
    const changed = applySharedStorageSnapshot(remoteSnapshot);
    if (updatedAt) {
      lastPulledUpdatedAt = updatedAt;
    }
    lastKnownSharedSnapshot = cloneSharedStatePayload(remoteSnapshot);
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

export async function pullSharedStorageSnapshot(): Promise<boolean> {
  if (typeof window === "undefined") {
    return false;
  }
  if (!pullLoopPromise) {
    pullLoopPromise = pullSharedStorageSnapshotOnce().finally(() => {
      pullLoopPromise = null;
    });
  }
  return pullLoopPromise;
}

export async function pushSharedStorageSnapshot(options?: SharedStatePushOptions): Promise<boolean> {
  if (typeof window === "undefined") {
    return false;
  }
  if (options?.keepalive || options?.force) {
    return pushSharedStorageSnapshotOnce(options);
  }
  pushRequested = true;
  if (!pushLoopPromise) {
    pushLoopPromise = drainSharedStoragePushQueue(options).finally(() => {
      pushLoopPromise = null;
    });
  }
  return pushLoopPromise;
}
