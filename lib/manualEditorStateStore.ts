import { get, put } from "@vercel/blob";
import { prisma } from "./prisma";

type StoredStateRow = {
  id: string;
  payload: string;
  updated_at: string;
};

type StoredEnvelope<T> = {
  payload: T;
  updatedAt: string;
};

type ReadStoredStateResult<T> = {
  exists: boolean;
  payload: T | null;
  updatedAt: string | null;
};

type WriteStoredStateResult<T> =
  | { ok: true; updatedAt: string }
  | { ok: false; reason: "conflict"; payload: T; updatedAt: string | null };

const MANUAL_EDITOR_BLOB_PREFIX = "manual-editor-state";
let ensureSharedStateTablePromise: Promise<void> | null = null;

function hasBlobStorage(): boolean {
  return typeof process.env.BLOB_READ_WRITE_TOKEN === "string"
    && process.env.BLOB_READ_WRITE_TOKEN.trim().length > 0;
}

function getBlobPathname(id: string): string {
  return `${MANUAL_EDITOR_BLOB_PREFIX}/${id}.json`;
}

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

async function ensureSharedStateTable(): Promise<void> {
  if (!ensureSharedStateTablePromise) {
    ensureSharedStateTablePromise = prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS manual_editor_states (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `).then(() => undefined).catch((error) => {
      ensureSharedStateTablePromise = null;
      throw error;
    });
  }
  await ensureSharedStateTablePromise;
}

async function readStoredStateFromBlob<T>(id: string, validate: (value: unknown) => value is T): Promise<ReadStoredStateResult<T>> {
  const result = await get(getBlobPathname(id), {
    access: "private",
  });

  if (!result || result.statusCode !== 200 || !result.stream) {
    return { exists: false, payload: null, updatedAt: null };
  }

  const raw = await new Response(result.stream).text();
  const parsed = JSON.parse(raw) as Partial<StoredEnvelope<unknown>> | null;
  const updatedAt = normalizeTimestamp(parsed?.updatedAt);

  if (!parsed || !validate(parsed.payload)) {
    throw new Error("invalid_stored_payload");
  }

  return {
    exists: true,
    payload: parsed.payload,
    updatedAt,
  };
}

async function writeStoredStateToBlob<T>(
  id: string,
  payload: T,
  baseUpdatedAt: string | null,
  validate: (value: unknown) => value is T,
): Promise<WriteStoredStateResult<T>> {
  const existing = await readStoredStateFromBlob(id, validate);
  if (existing.exists && existing.updatedAt !== baseUpdatedAt) {
    return {
      ok: false,
      reason: "conflict",
      payload: existing.payload as T,
      updatedAt: existing.updatedAt,
    };
  }

  const updatedAt = new Date().toISOString();
  await put(
    getBlobPathname(id),
    JSON.stringify({ payload, updatedAt }),
    {
      access: "private",
      allowOverwrite: true,
      contentType: "application/json; charset=utf-8",
    },
  );

  return {
    ok: true,
    updatedAt,
  };
}

async function readStoredStateFromPrisma<T>(id: string, validate: (value: unknown) => value is T): Promise<ReadStoredStateResult<T>> {
  await ensureSharedStateTable();
  const rows = await prisma.$queryRawUnsafe<StoredStateRow[]>(
    "SELECT id, payload, updated_at FROM manual_editor_states WHERE id = ? LIMIT 1",
    id,
  );
  const row = rows[0];
  if (!row) {
    return { exists: false, payload: null, updatedAt: null };
  }

  const parsed = JSON.parse(row.payload);
  if (!validate(parsed)) {
    throw new Error("invalid_stored_payload");
  }

  return {
    exists: true,
    payload: parsed,
    updatedAt: normalizeTimestamp(row.updated_at),
  };
}

async function writeStoredStateToPrisma<T>(
  id: string,
  payload: T,
  baseUpdatedAt: string | null,
  validate: (value: unknown) => value is T,
): Promise<WriteStoredStateResult<T>> {
  await ensureSharedStateTable();
  const existing = await readStoredStateFromPrisma(id, validate);
  if (existing.exists && existing.updatedAt !== baseUpdatedAt) {
    return {
      ok: false,
      reason: "conflict",
      payload: existing.payload as T,
      updatedAt: existing.updatedAt,
    };
  }

  await prisma.$executeRawUnsafe(
    `
    INSERT INTO manual_editor_states (id, payload, created_at, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      payload = excluded.payload,
      updated_at = CURRENT_TIMESTAMP
    `,
    id,
    JSON.stringify(payload),
  );

  const updated = await readStoredStateFromPrisma(id, validate);
  return {
    ok: true,
    updatedAt: updated.updatedAt ?? new Date().toISOString(),
  };
}

export async function readManualEditorState<T>(
  id: string,
  validate: (value: unknown) => value is T,
): Promise<ReadStoredStateResult<T>> {
  if (hasBlobStorage()) {
    return readStoredStateFromBlob(id, validate);
  }
  return readStoredStateFromPrisma(id, validate);
}

export async function writeManualEditorState<T>(
  id: string,
  payload: T,
  baseUpdatedAt: string | null,
  validate: (value: unknown) => value is T,
): Promise<WriteStoredStateResult<T>> {
  if (hasBlobStorage()) {
    return writeStoredStateToBlob(id, payload, baseUpdatedAt, validate);
  }
  return writeStoredStateToPrisma(id, payload, baseUpdatedAt, validate);
}
