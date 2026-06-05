import { prisma } from "./prisma";
import {
  APPROVAL_NOTE_TEMPLATE_STORAGE_KEY,
  MAX_AUDIT_LOGS,
  MAX_REVISIONS,
  CSV_INTERNAL_ROW_ID_KEY,
  CSV_PROJECT_FIELD_ALIASES,
  DETAIL_PHOTO_TEMPLATE_STORAGE_KEY,
  LAYOUT_TEMPLATE_STORAGE_KEY,
  NOTICE_TEMPLATE_STORAGE_KEY,
  PARTY_COMPANY_TEMPLATE_STORAGE_KEY,
  PARTY_TEMPLATE_STORAGE_KEY,
  REVISION_STORAGE_KEY,
  SCHEDULE_PROCEDURE_TEMPLATE_STORAGE_KEY,
  SCHEDULE_TEMPLATE_STORAGE_KEY,
  AUDIT_STORAGE_KEY,
} from "../app/components/planner/constants";
import type {
  AuditLog,
  CsvRecord,
  PartyCompanyTemplatePreset,
  ProjectRevision,
  RelatedPartyKey,
  ScheduleProcedureTemplate,
  ScheduleRow,
  SimpleTemplate,
} from "../app/components/planner/types";
import { parseStorageJson, stringifyForStorage } from "../app/components/planner/utils/storage";

export type ManualEditorWorkspacePayload = {
  version: 1;
  projectIndex: string[];
  projectDataById: Record<string, string>;
  csvEditorRaw: string;
  savedAt: string;
};

export type ManualEditorConfigPayload = {
  version: 1;
  items: Record<string, string>;
  savedAt: string;
};

type ReadStoredStateResult<T> = {
  exists: boolean;
  payload: T | null;
  updatedAt: string | null;
};

type WriteStoredStateResult<T> =
  | { ok: true; updatedAt: string }
  | { ok: false; reason: "conflict"; payload: T; updatedAt: string | null };

type WorkspaceProjectRow = {
  project_id: string;
  sort_order: number;
  raw_json: string;
};

type WorkspaceCsvHeaderRow = {
  collection_id: string;
  headers_json: string;
  csv_raw: string;
  updated_at: string;
};

type WorkspaceCsvRow = {
  row_id: string;
  row_order: number;
  raw_json: string;
};

type AuditLogRow = {
  log_id: string;
  project_id: string;
  user_id: string;
  user_name: string;
  action: string;
  detail: string;
  at: string;
  raw_json: string;
};

type RevisionRow = {
  revision_id: string;
  project_id: string;
  user_id: string;
  user_name: string;
  label: string;
  at: string;
  raw_json: string;
};

type ConfigDocumentRow = {
  storage_key: string;
  raw_value: string;
};

type TemplateItemRow = {
  storage_key: string;
  item_id: string;
  item_name: string;
  item_scope: string;
  item_category: string;
  item_order: number;
  raw_json: string;
};

export type ManualEditorProjectItemPayload = {
  projectId: string;
  sortOrder: number;
  rawProject: string;
};

export type ManualEditorTemplateItemPayload = {
  storageKey: string;
  itemId: string;
  itemName: string;
  itemScope: string;
  itemCategory: string;
  itemOrder: number;
  rawJson: string;
};

type ProjectItemReadResult = {
  exists: boolean;
  payload: ManualEditorProjectItemPayload | null;
  updatedAt: string | null;
};

type TemplateItemReadResult = {
  exists: boolean;
  payload: ManualEditorTemplateItemPayload | null;
  updatedAt: string | null;
};

export type ManualEditorCsvHeaderPayload = {
  headers: string[];
};

export type ManualEditorCsvRowPayload = {
  rowId: string;
  rowOrder: number;
  rawJson: string;
};

type CsvHeaderReadResult = {
  exists: boolean;
  payload: ManualEditorCsvHeaderPayload | null;
  updatedAt: string | null;
};

type CsvRowReadResult = {
  exists: boolean;
  payload: ManualEditorCsvRowPayload | null;
  updatedAt: string | null;
};

type ItemWriteResult<T> =
  | { ok: true; updatedAt: string; payload: T; resolvedConflict: boolean }
  | { ok: false; reason: "conflict"; payload: T; updatedAt: string | null };

const WORKSPACE_COLLECTION_ID = "manual_editor_workspace_v2";
const CONFIG_COLLECTION_ID = "manual_editor_config_v2";
const WORKSPACE_CSV_HEADERS_KEY = "workspace_csv_headers";
const KNOWN_TEMPLATE_STORAGE_KEYS = new Set<string>([
  NOTICE_TEMPLATE_STORAGE_KEY,
  APPROVAL_NOTE_TEMPLATE_STORAGE_KEY,
  SCHEDULE_TEMPLATE_STORAGE_KEY,
  SCHEDULE_PROCEDURE_TEMPLATE_STORAGE_KEY,
  DETAIL_PHOTO_TEMPLATE_STORAGE_KEY,
  PARTY_TEMPLATE_STORAGE_KEY,
  PARTY_COMPANY_TEMPLATE_STORAGE_KEY,
  LAYOUT_TEMPLATE_STORAGE_KEY,
]);
const PARTY_KEYS: RelatedPartyKey[] = ["owner", "utility", "contractor", "management", "residents"];

let ensureStructuredTablesPromise: Promise<void> | null = null;

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function sanitizeUniqueStringArray(value: unknown): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  sanitizeStringArray(value).forEach((item) => {
    const text = item.trim();
    if (!text || seen.has(text)) {
      return;
    }
    seen.add(text);
    normalized.push(text);
  });
  return normalized;
}

function sanitizeCsvRecord(value: unknown): CsvRecord | null {
  if (!isRecord(value)) {
    return null;
  }
  const record: CsvRecord = {};
  Object.entries(value).forEach(([key, rawValue]) => {
    if (typeof key !== "string" || !key) {
      return;
    }
    record[key] = typeof rawValue === "string" ? rawValue : String(rawValue ?? "");
  });
  return record;
}

function sanitizeCsvRows(value: unknown): CsvRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((row) => sanitizeCsvRecord(row))
    .filter((row): row is CsvRecord => row !== null);
}

function parseCsvEditorRaw(raw: string): { headers: string[]; rows: CsvRecord[] } {
  const parsed = parseStorageJson<{ headers?: unknown; rows?: unknown }>(raw);
  return {
    headers: sanitizeStringArray(parsed?.headers),
    rows: sanitizeCsvRows(parsed?.rows),
  };
}

function getRecordField(record: CsvRecord, aliases: readonly string[]): string {
  for (const alias of aliases) {
    const value = record[alias];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function extractProjectMetadata(rawProject: string): {
  propertyName: string;
  propertyAddress: string;
  titleSubject: string;
  workDateStart: string;
  workDateEnd: string;
  approvalStatus: string;
} {
  const parsed = parseStorageJson<Record<string, unknown>>(rawProject);
  if (!parsed || typeof parsed !== "object") {
    return {
      propertyName: "",
      propertyAddress: "",
      titleSubject: "",
      workDateStart: "",
      workDateEnd: "",
      approvalStatus: "draft",
    };
  }

  return {
    propertyName: toText(parsed.propertyName),
    propertyAddress: toText(parsed.propertyAddress),
    titleSubject: toText(parsed.titleSubject),
    workDateStart: toText(parsed.workDateStart || parsed.workDateMain),
    workDateEnd: toText(parsed.workDateEnd),
    approvalStatus: toText(parsed.approvalStatus) || "draft",
  };
}

function extractCsvRowMetadata(record: CsvRecord): {
  projectId: string;
  propertyName: string;
  exportedFlag: number;
} {
  const projectId = getRecordField(record, CSV_PROJECT_FIELD_ALIASES.projectId);
  const propertyName = getRecordField(record, CSV_PROJECT_FIELD_ALIASES.propertyName);
  const exportCount = Number(getRecordField(record, CSV_PROJECT_FIELD_ALIASES.pdfExportCount));
  const exportedAt = getRecordField(record, CSV_PROJECT_FIELD_ALIASES.pdfLastExportedAt);
  return {
    projectId,
    propertyName,
    exportedFlag: Number.isFinite(exportCount) && exportCount > 0 || Boolean(exportedAt) ? 1 : 0,
  };
}

function parseJsonArray<T>(raw: string): T[] {
  const parsed = parseStorageJson<unknown>(raw);
  return Array.isArray(parsed) ? (parsed as T[]) : [];
}

function serializeJsonArray<T>(items: T[]): string {
  return stringifyForStorage(items);
}

function parseJsonValue(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

function deepMergeJson(base: unknown, incoming: unknown): unknown {
  if (Array.isArray(base) && Array.isArray(incoming)) {
    return incoming;
  }
  if (isRecord(base) && isRecord(incoming)) {
    const merged: Record<string, unknown> = { ...base };
    Object.entries(incoming).forEach(([key, value]) => {
      if (!(key in merged)) {
        merged[key] = value;
        return;
      }
      merged[key] = deepMergeJson(merged[key], value);
    });
    return merged;
  }
  return incoming;
}

function mergeRawJson(baseRaw: string, incomingRaw: string): string {
  const merged = deepMergeJson(parseJsonValue(baseRaw), parseJsonValue(incomingRaw));
  return JSON.stringify(merged);
}

function isScheduleRowLike(value: unknown): value is ScheduleRow {
  return isRecord(value) && typeof value.id === "string" && value.id.trim().length > 0;
}

function mergeScheduleRows(base: unknown, incoming: unknown, deletedIds: readonly string[] = []): ScheduleRow[] {
  const baseRows = Array.isArray(base) ? base.filter((row): row is ScheduleRow => isScheduleRowLike(row)) : [];
  const incomingRows = Array.isArray(incoming) ? incoming.filter((row): row is ScheduleRow => isScheduleRowLike(row)) : [];
  const deleted = new Set(deletedIds.map((id) => id.trim()).filter(Boolean));
  const baseById = new Map(baseRows.map((row) => [row.id, row]));
  const merged: ScheduleRow[] = [];
  const seen = new Set<string>();

  incomingRows.forEach((row) => {
    if (deleted.has(row.id)) {
      return;
    }
    const previous = baseById.get(row.id);
    merged.push(previous ? { ...previous, ...row } : row);
    seen.add(row.id);
  });

  baseRows.forEach((row) => {
    if (seen.has(row.id) || deleted.has(row.id)) {
      return;
    }
    merged.push(row);
  });

  return merged;
}

function mergeRelatedPartyValue(baseParty: unknown, incomingParty: unknown): unknown {
  if (!isRecord(baseParty) || !isRecord(incomingParty)) {
    return incomingParty !== undefined ? incomingParty : baseParty;
  }
  const merged: Record<string, unknown> = { ...baseParty };
  Object.entries(incomingParty).forEach(([field, incomingValue]) => {
    const baseValue = baseParty[field];
    if (typeof incomingValue === "string" && incomingValue.trim() === "" && typeof baseValue === "string" && baseValue.trim() !== "") {
      return;
    }
    merged[field] = incomingValue;
  });
  return merged;
}

function mergeRelatedParties(base: unknown, incoming: unknown): Record<string, unknown> {
  const baseRecord = isRecord(base) ? base : {};
  const incomingRecord = isRecord(incoming) ? incoming : {};
  const keys = new Set([...Object.keys(baseRecord), ...Object.keys(incomingRecord)]);
  const merged: Record<string, unknown> = {};
  keys.forEach((key) => {
    const baseParty = baseRecord[key];
    const incomingParty = incomingRecord[key];
    merged[key] = mergeRelatedPartyValue(baseParty, incomingParty);
  });
  return merged;
}

function mergeProjectJson(baseRaw: string, incomingRaw: string): string {
  const baseValue = parseJsonValue(baseRaw);
  const incomingValue = parseJsonValue(incomingRaw);
  const merged = deepMergeJson(baseValue, incomingValue);
  if (!isRecord(merged) || !isRecord(baseValue) || !isRecord(incomingValue)) {
    return JSON.stringify(merged);
  }

  const deletedScheduleRowIds = Array.from(new Set([
    ...sanitizeUniqueStringArray(baseValue.deletedScheduleRowIds),
    ...sanitizeUniqueStringArray(incomingValue.deletedScheduleRowIds),
  ]));
  if ("scheduleRows" in baseValue || "scheduleRows" in incomingValue) {
    merged.scheduleRows = mergeScheduleRows(baseValue.scheduleRows, incomingValue.scheduleRows, deletedScheduleRowIds);
    merged.deletedScheduleRowIds = deletedScheduleRowIds;
  }
  if ("relatedParties" in baseValue || "relatedParties" in incomingValue) {
    merged.relatedParties = mergeRelatedParties(baseValue.relatedParties, incomingValue.relatedParties);
  }

  return JSON.stringify(merged);
}

function mergeTemplateItemJson(category: string, baseRaw: string, incomingRaw: string): string {
  const baseValue = parseJsonValue(baseRaw);
  const incomingValue = parseJsonValue(incomingRaw);
  const merged = deepMergeJson(baseValue, incomingValue);
  if (!isRecord(merged) || !isRecord(baseValue) || !isRecord(incomingValue)) {
    return JSON.stringify(merged);
  }

  if (category === "schedule" && ("payload" in baseValue || "payload" in incomingValue)) {
    merged.payload = mergeScheduleRows(baseValue.payload, incomingValue.payload);
  }
  if (category === "relatedParties" && ("payload" in baseValue || "payload" in incomingValue)) {
    merged.payload = mergeRelatedParties(baseValue.payload, incomingValue.payload);
  }

  return JSON.stringify(merged);
}

function sanitizeAuditLog(value: unknown): AuditLog | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = toText(value.id).trim();
  const at = toText(value.at).trim();
  const userId = toText(value.userId).trim();
  const userName = toText(value.userName).trim();
  const action = toText(value.action).trim();
  if (!id || !at || !userId || !userName || !action) {
    return null;
  }
  return {
    id,
    projectId: toText(value.projectId).trim(),
    at,
    userId,
    userName,
    action,
    detail: toText(value.detail),
  };
}

function sanitizeRevision(value: unknown): ProjectRevision | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = toText(value.id).trim();
  const projectId = toText(value.projectId).trim();
  const at = toText(value.at).trim();
  const userId = toText(value.userId).trim();
  const userName = toText(value.userName).trim();
  const label = toText(value.label).trim();
  if (!id || !projectId || !at || !userId || !userName || !label || !isRecord(value.snapshot)) {
    return null;
  }
  return value as ProjectRevision;
}

function parseTemplateItems(storageKey: string, rawValue: string): TemplateItemRow[] {
  if (storageKey === PARTY_COMPANY_TEMPLATE_STORAGE_KEY) {
    const parsed = parseStorageJson<Partial<Record<RelatedPartyKey, PartyCompanyTemplatePreset[]>>>(rawValue);
    if (!parsed || typeof parsed !== "object") {
      return [];
    }
    const rows: TemplateItemRow[] = [];
    PARTY_KEYS.forEach((scope) => {
      const presets = Array.isArray(parsed[scope]) ? parsed[scope] : [];
      presets.forEach((preset, index) => {
        if (!preset || typeof preset.id !== "string" || typeof preset.label !== "string") {
          return;
        }
        rows.push({
          storage_key: storageKey,
          item_id: preset.id,
          item_name: preset.label,
          item_scope: scope,
          item_category: typeof preset.title === "string" ? preset.title : "",
          item_order: index,
          raw_json: JSON.stringify(preset),
        });
      });
    });
    return rows;
  }

  if (storageKey === SCHEDULE_PROCEDURE_TEMPLATE_STORAGE_KEY) {
    const templates = parseJsonArray<ScheduleProcedureTemplate>(rawValue);
    return templates
      .map((template, index) => {
        if (!template || typeof template.id !== "string" || typeof template.name !== "string") {
          return null;
        }
        return {
          storage_key: storageKey,
          item_id: template.id,
          item_name: template.name,
          item_scope: "",
          item_category: "scheduleProcedure",
          item_order: index,
          raw_json: JSON.stringify(template),
        } satisfies TemplateItemRow;
      })
      .filter((row): row is TemplateItemRow => row !== null);
  }

  const genericTemplates = parseJsonArray<SimpleTemplate<unknown>>(rawValue);
  return genericTemplates
    .map((template, index) => {
      if (!template || typeof template.id !== "string" || typeof template.name !== "string") {
        return null;
      }
      return {
        storage_key: storageKey,
        item_id: template.id,
        item_name: template.name,
        item_scope: "",
        item_category:
          storageKey === NOTICE_TEMPLATE_STORAGE_KEY ? "notice"
            : storageKey === APPROVAL_NOTE_TEMPLATE_STORAGE_KEY ? "approvalNote"
              : storageKey === SCHEDULE_TEMPLATE_STORAGE_KEY ? "schedule"
                : storageKey === DETAIL_PHOTO_TEMPLATE_STORAGE_KEY ? "detailPhotos"
                  : storageKey === PARTY_TEMPLATE_STORAGE_KEY ? "relatedParties"
                    : storageKey === LAYOUT_TEMPLATE_STORAGE_KEY ? "layout"
                      : "",
        item_order: index,
        raw_json: JSON.stringify(template),
      } satisfies TemplateItemRow;
    })
    .filter((row): row is TemplateItemRow => row !== null);
}

function rebuildTemplateRawValue(storageKey: string, rows: TemplateItemRow[]): string {
  if (!rows.length) {
    return stringifyForStorage([]);
  }

  if (storageKey === PARTY_COMPANY_TEMPLATE_STORAGE_KEY) {
    const payload: Record<RelatedPartyKey, PartyCompanyTemplatePreset[]> = {
      owner: [],
      utility: [],
      contractor: [],
      management: [],
      residents: [],
    };
    rows
      .sort((left, right) => left.item_order - right.item_order)
      .forEach((row) => {
        const scope = PARTY_KEYS.includes(row.item_scope as RelatedPartyKey)
          ? row.item_scope as RelatedPartyKey
          : null;
        if (!scope) {
          return;
        }
        try {
          const parsed = JSON.parse(row.raw_json) as PartyCompanyTemplatePreset;
          payload[scope].push(parsed);
        } catch {
          // ignore broken rows when rebuilding
        }
      });
    return stringifyForStorage(payload);
  }

  if (storageKey === SCHEDULE_PROCEDURE_TEMPLATE_STORAGE_KEY) {
    const payload = rows
      .sort((left, right) => left.item_order - right.item_order)
      .map((row) => {
        try {
          return JSON.parse(row.raw_json) as ScheduleProcedureTemplate;
        } catch {
          return null;
        }
      })
      .filter((item): item is ScheduleProcedureTemplate => item !== null);
    return stringifyForStorage(payload);
  }

  const payload = rows
    .sort((left, right) => left.item_order - right.item_order)
    .map((row) => {
      try {
        return JSON.parse(row.raw_json) as SimpleTemplate<unknown>;
      } catch {
        return null;
      }
    })
    .filter((item): item is SimpleTemplate<unknown> => item !== null);
  return stringifyForStorage(payload);
}

async function rebuildAndPersistTemplateDocument(
  tx: Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">,
  storageKey: string,
  updatedAt: string,
): Promise<void> {
  const rows = await tx.$queryRawUnsafe<TemplateItemRow[]>(
    `
    SELECT storage_key, item_id, item_name, item_scope, item_category, item_order, raw_json
    FROM manual_editor_template_items
    WHERE storage_key = ?
    ORDER BY item_order ASC
    `,
    storageKey,
  );
  await tx.$executeRawUnsafe(
    "DELETE FROM manual_editor_config_documents WHERE storage_key = ?",
    storageKey,
  );
  await tx.$executeRawUnsafe(
    `
    INSERT INTO manual_editor_config_documents (storage_key, raw_value, updated_at)
    VALUES (?, ?, ?)
    `,
    storageKey,
    rebuildTemplateRawValue(storageKey, rows),
    updatedAt,
  );
}

async function rebuildWorkspaceCsvDocument(
  tx: Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">,
  updatedAt: string,
): Promise<void> {
  const headerRows = await tx.$queryRawUnsafe<WorkspaceCsvHeaderRow[]>(
    "SELECT collection_id, headers_json, csv_raw, updated_at FROM manual_editor_workspace_csv_headers WHERE collection_id = ? LIMIT 1",
    WORKSPACE_CSV_HEADERS_KEY,
  );
  const csvRows = await tx.$queryRawUnsafe<WorkspaceCsvRow[]>(
    "SELECT row_id, row_order, raw_json FROM manual_editor_workspace_csv_rows ORDER BY row_order ASC",
  );
  const headers = sanitizeStringArray(parseStorageJson<unknown>(headerRows[0]?.headers_json ?? "[]"));
  const rows = csvRows
    .map((row) => {
      try {
        return JSON.parse(row.raw_json) as unknown;
      } catch {
        return null;
      }
    })
    .filter((row): row is unknown => row !== null)
    .map((row) => sanitizeCsvRecord(row))
    .filter((row): row is CsvRecord => row !== null);
  await tx.$executeRawUnsafe(
    "DELETE FROM manual_editor_workspace_csv_headers WHERE collection_id = ?",
    WORKSPACE_CSV_HEADERS_KEY,
  );
  await tx.$executeRawUnsafe(
    `
    INSERT INTO manual_editor_workspace_csv_headers (collection_id, headers_json, csv_raw, updated_at)
    VALUES (?, ?, ?, ?)
    `,
    WORKSPACE_CSV_HEADERS_KEY,
    JSON.stringify(headers),
    stringifyForStorage({ headers, rows }),
    updatedAt,
  );
}

async function ensureStructuredTables(): Promise<void> {
  if (!ensureStructuredTablesPromise) {
    ensureStructuredTablesPromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS manual_editor_collection_meta (
          collection_id TEXT PRIMARY KEY,
          updated_at TEXT NOT NULL
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS manual_editor_workspace_projects (
          project_id TEXT PRIMARY KEY,
          sort_order INTEGER NOT NULL,
          property_name TEXT NOT NULL DEFAULT '',
          property_address TEXT NOT NULL DEFAULT '',
          title_subject TEXT NOT NULL DEFAULT '',
          work_date_start TEXT NOT NULL DEFAULT '',
          work_date_end TEXT NOT NULL DEFAULT '',
          approval_status TEXT NOT NULL DEFAULT 'draft',
          raw_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_manual_editor_workspace_projects_sort_order
        ON manual_editor_workspace_projects(sort_order)
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS manual_editor_workspace_csv_headers (
          collection_id TEXT PRIMARY KEY,
          headers_json TEXT NOT NULL,
          csv_raw TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS manual_editor_workspace_csv_rows (
          row_id TEXT PRIMARY KEY,
          row_order INTEGER NOT NULL,
          project_id TEXT NOT NULL DEFAULT '',
          property_name TEXT NOT NULL DEFAULT '',
          exported_flag INTEGER NOT NULL DEFAULT 0,
          raw_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_manual_editor_workspace_csv_rows_order
        ON manual_editor_workspace_csv_rows(row_order)
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS manual_editor_audit_logs (
          log_id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL DEFAULT '',
          user_id TEXT NOT NULL DEFAULT '',
          user_name TEXT NOT NULL DEFAULT '',
          action TEXT NOT NULL DEFAULT '',
          detail TEXT NOT NULL DEFAULT '',
          at TEXT NOT NULL,
          raw_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_manual_editor_audit_logs_at
        ON manual_editor_audit_logs(at DESC)
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS manual_editor_revisions (
          revision_id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL DEFAULT '',
          user_id TEXT NOT NULL DEFAULT '',
          user_name TEXT NOT NULL DEFAULT '',
          label TEXT NOT NULL DEFAULT '',
          at TEXT NOT NULL,
          raw_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_manual_editor_revisions_at
        ON manual_editor_revisions(at DESC)
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS manual_editor_config_documents (
          storage_key TEXT PRIMARY KEY,
          raw_value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS manual_editor_template_items (
          storage_key TEXT NOT NULL,
          item_id TEXT NOT NULL,
          item_name TEXT NOT NULL,
          item_scope TEXT NOT NULL DEFAULT '',
          item_category TEXT NOT NULL DEFAULT '',
          item_order INTEGER NOT NULL DEFAULT 0,
          raw_json TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (storage_key, item_id)
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_manual_editor_template_items_storage_order
        ON manual_editor_template_items(storage_key, item_order)
      `);
    })().catch((error) => {
      ensureStructuredTablesPromise = null;
      throw error;
    });
  }

  await ensureStructuredTablesPromise;
}

async function readCollectionUpdatedAt(collectionId: string): Promise<string | null> {
  const rows = await prisma.$queryRawUnsafe<Array<{ updated_at: string }>>(
    "SELECT updated_at FROM manual_editor_collection_meta WHERE collection_id = ? LIMIT 1",
    collectionId,
  );
  return normalizeTimestamp(rows[0]?.updated_at);
}

export function isWorkspacePayload(value: unknown): value is ManualEditorWorkspacePayload {
  if (!value || typeof value !== "object") {
    return false;
  }
  const payload = value as Partial<ManualEditorWorkspacePayload>;
  return payload.version === 1
    && Array.isArray(payload.projectIndex)
    && payload.projectIndex.every((projectId) => typeof projectId === "string")
    && Boolean(payload.projectDataById)
    && typeof payload.projectDataById === "object"
    && !Array.isArray(payload.projectDataById)
    && Object.values(payload.projectDataById).every((rawProject) => typeof rawProject === "string")
    && typeof payload.csvEditorRaw === "string"
    && typeof payload.savedAt === "string";
}

export function isConfigPayload(value: unknown): value is ManualEditorConfigPayload {
  if (!value || typeof value !== "object") {
    return false;
  }
  const payload = value as Partial<ManualEditorConfigPayload>;
  return payload.version === 1
    && Boolean(payload.items)
    && typeof payload.items === "object"
    && !Array.isArray(payload.items)
    && Object.values(payload.items).every((rawValue) => typeof rawValue === "string")
    && typeof payload.savedAt === "string";
}

export async function readStructuredWorkspaceState(): Promise<ReadStoredStateResult<ManualEditorWorkspacePayload>> {
  await ensureStructuredTables();
  const updatedAt = await readCollectionUpdatedAt(WORKSPACE_COLLECTION_ID);
  const projects = await prisma.$queryRawUnsafe<WorkspaceProjectRow[]>(
    "SELECT project_id, sort_order, raw_json FROM manual_editor_workspace_projects ORDER BY sort_order ASC",
  );
  const csvHeaderRows = await prisma.$queryRawUnsafe<WorkspaceCsvHeaderRow[]>(
    "SELECT collection_id, headers_json, csv_raw, updated_at FROM manual_editor_workspace_csv_headers WHERE collection_id = ? LIMIT 1",
    WORKSPACE_CSV_HEADERS_KEY,
  );
  const csvRows = await prisma.$queryRawUnsafe<WorkspaceCsvRow[]>(
    "SELECT row_id, row_order, raw_json FROM manual_editor_workspace_csv_rows ORDER BY row_order ASC",
  );

  const headerRow = csvHeaderRows[0];
  const exists = Boolean(updatedAt || projects.length || headerRow || csvRows.length);
  if (!exists) {
    return { exists: false, payload: null, updatedAt: null };
  }

  const projectIndex = projects.map((row) => row.project_id);
  const projectDataById = Object.fromEntries(
    projects.map((row) => [row.project_id, row.raw_json]),
  );
  const csvEditorRaw = headerRow?.csv_raw
    ? headerRow.csv_raw
    : stringifyForStorage({
      headers: sanitizeStringArray(parseStorageJson<unknown>(headerRow?.headers_json ?? "[]")),
      rows: csvRows
        .map((row) => {
          try {
            return JSON.parse(row.raw_json) as unknown;
          } catch {
            return null;
          }
        })
        .filter((row): row is unknown => row !== null)
        .map((row) => sanitizeCsvRecord(row))
        .filter((row): row is CsvRecord => row !== null),
    });

  return {
    exists: true,
    payload: {
      version: 1,
      projectIndex,
      projectDataById,
      csvEditorRaw,
      savedAt: updatedAt ?? new Date().toISOString(),
    },
    updatedAt,
  };
}

export async function readStructuredProjectItem(projectId: string): Promise<ProjectItemReadResult> {
  await ensureStructuredTables();
  const rows = await prisma.$queryRawUnsafe<Array<WorkspaceProjectRow & { updated_at: string }>>(
    `
    SELECT project_id, sort_order, raw_json, updated_at
    FROM manual_editor_workspace_projects
    WHERE project_id = ?
    LIMIT 1
    `,
    projectId,
  );
  const row = rows[0];
  if (!row) {
    return { exists: false, payload: null, updatedAt: null };
  }
  return {
    exists: true,
    payload: {
      projectId: row.project_id,
      sortOrder: row.sort_order,
      rawProject: row.raw_json,
    },
    updatedAt: normalizeTimestamp(row.updated_at),
  };
}

export async function readStructuredCsvHeaders(): Promise<CsvHeaderReadResult> {
  await ensureStructuredTables();
  const rows = await prisma.$queryRawUnsafe<WorkspaceCsvHeaderRow[]>(
    "SELECT collection_id, headers_json, csv_raw, updated_at FROM manual_editor_workspace_csv_headers WHERE collection_id = ? LIMIT 1",
    WORKSPACE_CSV_HEADERS_KEY,
  );
  const row = rows[0];
  if (!row) {
    return { exists: false, payload: null, updatedAt: null };
  }
  return {
    exists: true,
    payload: {
      headers: sanitizeStringArray(parseStorageJson<unknown>(row.headers_json)),
    },
    updatedAt: normalizeTimestamp(row.updated_at),
  };
}

export async function writeStructuredCsvHeaders(
  payload: ManualEditorCsvHeaderPayload,
  baseUpdatedAt: string | null,
): Promise<ItemWriteResult<ManualEditorCsvHeaderPayload>> {
  await ensureStructuredTables();
  const existing = await readStructuredCsvHeaders();
  const now = new Date().toISOString();
  const resolvedConflict = existing.exists && existing.updatedAt !== baseUpdatedAt;
  const headers = resolvedConflict
    ? [...new Set([...(existing.payload?.headers ?? []), ...payload.headers])]
    : payload.headers;

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      "DELETE FROM manual_editor_workspace_csv_headers WHERE collection_id = ?",
      WORKSPACE_CSV_HEADERS_KEY,
    );
    await tx.$executeRawUnsafe(
      `
      INSERT INTO manual_editor_workspace_csv_headers (collection_id, headers_json, csv_raw, updated_at)
      VALUES (?, ?, ?, ?)
      `,
      WORKSPACE_CSV_HEADERS_KEY,
      JSON.stringify(headers),
      stringifyForStorage({ headers, rows: [] }),
      now,
    );
    await rebuildWorkspaceCsvDocument(tx, now);
    await tx.$executeRawUnsafe(
      `
      INSERT INTO manual_editor_collection_meta (collection_id, updated_at)
      VALUES (?, ?)
      ON CONFLICT(collection_id) DO UPDATE SET updated_at = excluded.updated_at
      `,
      WORKSPACE_COLLECTION_ID,
      now,
    );
  });

  return {
    ok: true,
    updatedAt: now,
    resolvedConflict,
    payload: { headers },
  };
}

export async function readStructuredCsvRow(rowId: string): Promise<CsvRowReadResult> {
  await ensureStructuredTables();
  const rows = await prisma.$queryRawUnsafe<Array<WorkspaceCsvRow & { updated_at: string }>>(
    `
    SELECT row_id, row_order, raw_json, updated_at
    FROM manual_editor_workspace_csv_rows
    WHERE row_id = ?
    LIMIT 1
    `,
    rowId,
  );
  const row = rows[0];
  if (!row) {
    return { exists: false, payload: null, updatedAt: null };
  }
  return {
    exists: true,
    payload: {
      rowId: row.row_id,
      rowOrder: row.row_order,
      rawJson: row.raw_json,
    },
    updatedAt: normalizeTimestamp(row.updated_at),
  };
}

export async function writeStructuredCsvRow(
  payload: ManualEditorCsvRowPayload,
  baseUpdatedAt: string | null,
): Promise<ItemWriteResult<ManualEditorCsvRowPayload>> {
  await ensureStructuredTables();
  const existing = await readStructuredCsvRow(payload.rowId);
  const now = new Date().toISOString();
  let rawJson = payload.rawJson;
  let resolvedConflict = false;

  if (existing.exists && existing.updatedAt !== baseUpdatedAt) {
    rawJson = mergeRawJson(existing.payload?.rawJson ?? "{}", payload.rawJson);
    resolvedConflict = true;
  }

  let record = sanitizeCsvRecord(parseJsonValue(rawJson));
  if (!record) {
    record = {};
  }
  const meta = extractCsvRowMetadata(record);

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `
      INSERT INTO manual_editor_workspace_csv_rows (
        row_id, row_order, project_id, property_name, exported_flag, raw_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(row_id) DO UPDATE SET
        row_order = excluded.row_order,
        project_id = excluded.project_id,
        property_name = excluded.property_name,
        exported_flag = excluded.exported_flag,
        raw_json = excluded.raw_json,
        updated_at = excluded.updated_at
      `,
      payload.rowId,
      payload.rowOrder,
      meta.projectId,
      meta.propertyName,
      meta.exportedFlag,
      JSON.stringify(record),
      now,
    );
    await rebuildWorkspaceCsvDocument(tx, now);
    await tx.$executeRawUnsafe(
      `
      INSERT INTO manual_editor_collection_meta (collection_id, updated_at)
      VALUES (?, ?)
      ON CONFLICT(collection_id) DO UPDATE SET updated_at = excluded.updated_at
      `,
      WORKSPACE_COLLECTION_ID,
      now,
    );
  });

  return {
    ok: true,
    updatedAt: now,
    resolvedConflict,
    payload: {
      rowId: payload.rowId,
      rowOrder: payload.rowOrder,
      rawJson: JSON.stringify(record),
    },
  };
}

export async function deleteStructuredCsvRow(
  rowId: string,
  _baseUpdatedAt: string | null,
): Promise<{ ok: true; updatedAt: string; resolvedConflict: boolean }> {
  await ensureStructuredTables();
  const now = new Date().toISOString();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      "DELETE FROM manual_editor_workspace_csv_rows WHERE row_id = ?",
      rowId,
    );
    await rebuildWorkspaceCsvDocument(tx, now);
    await tx.$executeRawUnsafe(
      `
      INSERT INTO manual_editor_collection_meta (collection_id, updated_at)
      VALUES (?, ?)
      ON CONFLICT(collection_id) DO UPDATE SET updated_at = excluded.updated_at
      `,
      WORKSPACE_COLLECTION_ID,
      now,
    );
  });
  return { ok: true, updatedAt: now, resolvedConflict: false };
}

export async function writeStructuredProjectItem(
  payload: ManualEditorProjectItemPayload,
  baseUpdatedAt: string | null,
): Promise<ItemWriteResult<ManualEditorProjectItemPayload>> {
  await ensureStructuredTables();
  const existing = await readStructuredProjectItem(payload.projectId);
  const now = new Date().toISOString();
  let rawProject = payload.rawProject;
  let resolvedConflict = false;

  if (existing.exists && existing.updatedAt !== baseUpdatedAt) {
    rawProject = mergeProjectJson(existing.payload?.rawProject ?? "{}", payload.rawProject);
    resolvedConflict = true;
  }

  const meta = extractProjectMetadata(rawProject);
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `
      INSERT INTO manual_editor_workspace_projects (
        project_id, sort_order, property_name, property_address, title_subject,
        work_date_start, work_date_end, approval_status, raw_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET
        sort_order = excluded.sort_order,
        property_name = excluded.property_name,
        property_address = excluded.property_address,
        title_subject = excluded.title_subject,
        work_date_start = excluded.work_date_start,
        work_date_end = excluded.work_date_end,
        approval_status = excluded.approval_status,
        raw_json = excluded.raw_json,
        updated_at = excluded.updated_at
      `,
      payload.projectId,
      payload.sortOrder,
      meta.propertyName,
      meta.propertyAddress,
      meta.titleSubject,
      meta.workDateStart,
      meta.workDateEnd,
      meta.approvalStatus,
      rawProject,
      now,
    );
    await tx.$executeRawUnsafe(
      `
      INSERT INTO manual_editor_collection_meta (collection_id, updated_at)
      VALUES (?, ?)
      ON CONFLICT(collection_id) DO UPDATE SET updated_at = excluded.updated_at
      `,
      WORKSPACE_COLLECTION_ID,
      now,
    );
  });

  return {
    ok: true,
    updatedAt: now,
    resolvedConflict,
    payload: {
      projectId: payload.projectId,
      sortOrder: payload.sortOrder,
      rawProject,
    },
  };
}

export async function deleteStructuredProjectItem(
  projectId: string,
  _baseUpdatedAt: string | null,
): Promise<{ ok: true; updatedAt: string; resolvedConflict: boolean }> {
  await ensureStructuredTables();
  const now = new Date().toISOString();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      "DELETE FROM manual_editor_workspace_projects WHERE project_id = ?",
      projectId,
    );
    await tx.$executeRawUnsafe(
      `
      INSERT INTO manual_editor_collection_meta (collection_id, updated_at)
      VALUES (?, ?)
      ON CONFLICT(collection_id) DO UPDATE SET updated_at = excluded.updated_at
      `,
      WORKSPACE_COLLECTION_ID,
      now,
    );
  });
  return { ok: true, updatedAt: now, resolvedConflict: false };
}

export async function writeStructuredWorkspaceState(
  payload: ManualEditorWorkspacePayload,
  baseUpdatedAt: string | null,
): Promise<WriteStoredStateResult<ManualEditorWorkspacePayload>> {
  await ensureStructuredTables();
  const existing = await readStructuredWorkspaceState();
  if (existing.exists && existing.updatedAt !== baseUpdatedAt) {
    return {
      ok: false,
      reason: "conflict",
      payload: existing.payload as ManualEditorWorkspacePayload,
      updatedAt: existing.updatedAt,
    };
  }

  const now = new Date().toISOString();
  const csvParsed = parseCsvEditorRaw(payload.csvEditorRaw);

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("DELETE FROM manual_editor_workspace_projects");
    for (const [index, projectId] of payload.projectIndex.entries()) {
      const rawProject = payload.projectDataById[projectId];
      if (typeof rawProject !== "string") {
        continue;
      }
      const meta = extractProjectMetadata(rawProject);
      await tx.$executeRawUnsafe(
        `
        INSERT INTO manual_editor_workspace_projects (
          project_id, sort_order, property_name, property_address, title_subject,
          work_date_start, work_date_end, approval_status, raw_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        projectId,
        index,
        meta.propertyName,
        meta.propertyAddress,
        meta.titleSubject,
        meta.workDateStart,
        meta.workDateEnd,
        meta.approvalStatus,
        rawProject,
        now,
      );
    }

    await tx.$executeRawUnsafe("DELETE FROM manual_editor_workspace_csv_headers WHERE collection_id = ?", WORKSPACE_CSV_HEADERS_KEY);
    await tx.$executeRawUnsafe(
      `
      INSERT INTO manual_editor_workspace_csv_headers (collection_id, headers_json, csv_raw, updated_at)
      VALUES (?, ?, ?, ?)
      `,
      WORKSPACE_CSV_HEADERS_KEY,
      JSON.stringify(csvParsed.headers),
      payload.csvEditorRaw,
      now,
    );

    await tx.$executeRawUnsafe("DELETE FROM manual_editor_workspace_csv_rows");
    for (const [index, row] of csvParsed.rows.entries()) {
      const meta = extractCsvRowMetadata(row);
      const rowId = typeof row[CSV_INTERNAL_ROW_ID_KEY] === "string" && row[CSV_INTERNAL_ROW_ID_KEY].trim()
        ? row[CSV_INTERNAL_ROW_ID_KEY].trim()
        : `row_${index + 1}`;
      await tx.$executeRawUnsafe(
        `
        INSERT INTO manual_editor_workspace_csv_rows (
          row_id, row_order, project_id, property_name, exported_flag, raw_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        rowId,
        index,
        meta.projectId,
        meta.propertyName,
        meta.exportedFlag,
        JSON.stringify(row),
        now,
      );
    }

    await tx.$executeRawUnsafe(
      `
      INSERT INTO manual_editor_collection_meta (collection_id, updated_at)
      VALUES (?, ?)
      ON CONFLICT(collection_id) DO UPDATE SET updated_at = excluded.updated_at
      `,
      WORKSPACE_COLLECTION_ID,
      now,
    );
  });

  return {
    ok: true,
    updatedAt: now,
  };
}

export async function readStructuredConfigState(): Promise<ReadStoredStateResult<ManualEditorConfigPayload>> {
  await ensureStructuredTables();
  const updatedAt = await readCollectionUpdatedAt(CONFIG_COLLECTION_ID);
  const documents = await prisma.$queryRawUnsafe<ConfigDocumentRow[]>(
    "SELECT storage_key, raw_value FROM manual_editor_config_documents",
  );
  const templateRows = await prisma.$queryRawUnsafe<TemplateItemRow[]>(
    `
    SELECT storage_key, item_id, item_name, item_scope, item_category, item_order, raw_json
    FROM manual_editor_template_items
    ORDER BY storage_key ASC, item_order ASC
    `,
  );
  const auditRows = await prisma.$queryRawUnsafe<AuditLogRow[]>(
    `
    SELECT log_id, project_id, user_id, user_name, action, detail, at, raw_json
    FROM manual_editor_audit_logs
    ORDER BY at DESC
    LIMIT ?
    `,
    MAX_AUDIT_LOGS,
  );
  const revisionRows = await prisma.$queryRawUnsafe<RevisionRow[]>(
    `
    SELECT revision_id, project_id, user_id, user_name, label, at, raw_json
    FROM manual_editor_revisions
    ORDER BY at DESC
    LIMIT ?
    `,
    MAX_REVISIONS,
  );

  const items: Record<string, string> = {};
  documents.forEach((row) => {
    items[row.storage_key] = row.raw_value;
  });

  if (templateRows.length) {
    const rowsByKey = new Map<string, TemplateItemRow[]>();
    templateRows.forEach((row) => {
      const list = rowsByKey.get(row.storage_key) ?? [];
      list.push(row);
      rowsByKey.set(row.storage_key, list);
    });
    rowsByKey.forEach((rows, storageKey) => {
      items[storageKey] = rebuildTemplateRawValue(storageKey, rows);
    });
  }

  if (auditRows.length) {
    items[AUDIT_STORAGE_KEY] = serializeJsonArray(
      auditRows
        .map((row) => sanitizeAuditLog(parseJsonValue(row.raw_json)))
        .filter((row): row is AuditLog => row !== null),
    );
  }
  if (revisionRows.length) {
    items[REVISION_STORAGE_KEY] = serializeJsonArray(
      revisionRows
        .map((row) => sanitizeRevision(parseJsonValue(row.raw_json)))
        .filter((row): row is ProjectRevision => row !== null),
    );
  }

  const exists = Boolean(updatedAt || Object.keys(items).length);
  if (!exists) {
    return { exists: false, payload: null, updatedAt: null };
  }

  if (!items[AUDIT_STORAGE_KEY]) {
    items[AUDIT_STORAGE_KEY] = stringifyForStorage([]);
  }
  if (!items[REVISION_STORAGE_KEY]) {
    items[REVISION_STORAGE_KEY] = stringifyForStorage([]);
  }

  return {
    exists: true,
    payload: {
      version: 1,
      items,
      savedAt: updatedAt ?? new Date().toISOString(),
    },
    updatedAt,
  };
}

export async function readStructuredTemplateItem(
  storageKey: string,
  itemId: string,
): Promise<TemplateItemReadResult> {
  await ensureStructuredTables();
  const rows = await prisma.$queryRawUnsafe<Array<TemplateItemRow & { updated_at: string }>>(
    `
    SELECT storage_key, item_id, item_name, item_scope, item_category, item_order, raw_json, updated_at
    FROM manual_editor_template_items
    WHERE storage_key = ? AND item_id = ?
    LIMIT 1
    `,
    storageKey,
    itemId,
  );
  const row = rows[0];
  if (!row) {
    return { exists: false, payload: null, updatedAt: null };
  }
  return {
    exists: true,
    payload: {
      storageKey: row.storage_key,
      itemId: row.item_id,
      itemName: row.item_name,
      itemScope: row.item_scope,
      itemCategory: row.item_category,
      itemOrder: row.item_order,
      rawJson: row.raw_json,
    },
    updatedAt: normalizeTimestamp(row.updated_at),
  };
}

export async function writeStructuredTemplateItem(
  payload: ManualEditorTemplateItemPayload,
  baseUpdatedAt: string | null,
): Promise<ItemWriteResult<ManualEditorTemplateItemPayload>> {
  await ensureStructuredTables();
  const existing = await readStructuredTemplateItem(payload.storageKey, payload.itemId);
  const now = new Date().toISOString();
  let rawJson = payload.rawJson;
  let resolvedConflict = false;

  if (existing.exists && existing.updatedAt !== baseUpdatedAt) {
    rawJson = mergeTemplateItemJson(payload.itemCategory, existing.payload?.rawJson ?? "{}", payload.rawJson);
    resolvedConflict = true;
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `
      INSERT INTO manual_editor_template_items (
        storage_key, item_id, item_name, item_scope, item_category, item_order, raw_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(storage_key, item_id) DO UPDATE SET
        item_name = excluded.item_name,
        item_scope = excluded.item_scope,
        item_category = excluded.item_category,
        item_order = excluded.item_order,
        raw_json = excluded.raw_json,
        updated_at = excluded.updated_at
      `,
      payload.storageKey,
      payload.itemId,
      payload.itemName,
      payload.itemScope,
      payload.itemCategory,
      payload.itemOrder,
      rawJson,
      now,
    );
    await rebuildAndPersistTemplateDocument(tx, payload.storageKey, now);
    await tx.$executeRawUnsafe(
      `
      INSERT INTO manual_editor_collection_meta (collection_id, updated_at)
      VALUES (?, ?)
      ON CONFLICT(collection_id) DO UPDATE SET updated_at = excluded.updated_at
      `,
      CONFIG_COLLECTION_ID,
      now,
    );
  });

  return {
    ok: true,
    updatedAt: now,
    resolvedConflict,
    payload: {
      ...payload,
      rawJson,
    },
  };
}

export async function deleteStructuredTemplateItem(
  storageKey: string,
  itemId: string,
  _baseUpdatedAt: string | null,
): Promise<{ ok: true; updatedAt: string; resolvedConflict: boolean }> {
  await ensureStructuredTables();
  const now = new Date().toISOString();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      "DELETE FROM manual_editor_template_items WHERE storage_key = ? AND item_id = ?",
      storageKey,
      itemId,
    );
    await rebuildAndPersistTemplateDocument(tx, storageKey, now);
    await tx.$executeRawUnsafe(
      `
      INSERT INTO manual_editor_collection_meta (collection_id, updated_at)
      VALUES (?, ?)
      ON CONFLICT(collection_id) DO UPDATE SET updated_at = excluded.updated_at
      `,
      CONFIG_COLLECTION_ID,
      now,
    );
  });
  return { ok: true, updatedAt: now, resolvedConflict: false };
}

export async function appendStructuredAuditLog(rawJson: string): Promise<{ ok: true; updatedAt: string }> {
  await ensureStructuredTables();
  const log = sanitizeAuditLog(parseJsonValue(rawJson));
  if (!log) {
    throw new Error("invalid_audit_log");
  }
  const now = new Date().toISOString();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `
      INSERT INTO manual_editor_audit_logs (
        log_id, project_id, user_id, user_name, action, detail, at, raw_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(log_id) DO UPDATE SET
        project_id = excluded.project_id,
        user_id = excluded.user_id,
        user_name = excluded.user_name,
        action = excluded.action,
        detail = excluded.detail,
        at = excluded.at,
        raw_json = excluded.raw_json,
        updated_at = excluded.updated_at
      `,
      log.id,
      log.projectId,
      log.userId,
      log.userName,
      log.action,
      log.detail,
      log.at,
      JSON.stringify(log),
      now,
    );
    await tx.$executeRawUnsafe(
      `
      DELETE FROM manual_editor_audit_logs
      WHERE log_id NOT IN (
        SELECT log_id FROM manual_editor_audit_logs
        ORDER BY at DESC
        LIMIT ?
      )
      `,
      MAX_AUDIT_LOGS,
    );
    await tx.$executeRawUnsafe(
      `
      INSERT INTO manual_editor_collection_meta (collection_id, updated_at)
      VALUES (?, ?)
      ON CONFLICT(collection_id) DO UPDATE SET updated_at = excluded.updated_at
      `,
      CONFIG_COLLECTION_ID,
      now,
    );
  });
  return { ok: true, updatedAt: now };
}

export async function appendStructuredRevision(rawJson: string): Promise<{ ok: true; updatedAt: string }> {
  await ensureStructuredTables();
  const revision = sanitizeRevision(parseJsonValue(rawJson));
  if (!revision) {
    throw new Error("invalid_revision");
  }
  const now = new Date().toISOString();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `
      INSERT INTO manual_editor_revisions (
        revision_id, project_id, user_id, user_name, label, at, raw_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(revision_id) DO UPDATE SET
        project_id = excluded.project_id,
        user_id = excluded.user_id,
        user_name = excluded.user_name,
        label = excluded.label,
        at = excluded.at,
        raw_json = excluded.raw_json,
        updated_at = excluded.updated_at
      `,
      revision.id,
      revision.projectId,
      revision.userId,
      revision.userName,
      revision.label,
      revision.at,
      JSON.stringify(revision),
      now,
    );
    await tx.$executeRawUnsafe(
      `
      DELETE FROM manual_editor_revisions
      WHERE revision_id NOT IN (
        SELECT revision_id FROM manual_editor_revisions
        ORDER BY at DESC
        LIMIT ?
      )
      `,
      MAX_REVISIONS,
    );
    await tx.$executeRawUnsafe(
      `
      INSERT INTO manual_editor_collection_meta (collection_id, updated_at)
      VALUES (?, ?)
      ON CONFLICT(collection_id) DO UPDATE SET updated_at = excluded.updated_at
      `,
      CONFIG_COLLECTION_ID,
      now,
    );
  });
  return { ok: true, updatedAt: now };
}

export async function writeStructuredConfigState(
  payload: ManualEditorConfigPayload,
  baseUpdatedAt: string | null,
): Promise<WriteStoredStateResult<ManualEditorConfigPayload>> {
  await ensureStructuredTables();
  const existing = await readStructuredConfigState();
  if (existing.exists && existing.updatedAt !== baseUpdatedAt) {
    return {
      ok: false,
      reason: "conflict",
      payload: existing.payload as ManualEditorConfigPayload,
      updatedAt: existing.updatedAt,
    };
  }

  const now = new Date().toISOString();
  const entries = Object.entries(payload.items);

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("DELETE FROM manual_editor_config_documents");
    await tx.$executeRawUnsafe("DELETE FROM manual_editor_audit_logs");
    await tx.$executeRawUnsafe("DELETE FROM manual_editor_revisions");
    for (const [storageKey, rawValue] of entries) {
      await tx.$executeRawUnsafe(
        `
        INSERT INTO manual_editor_config_documents (storage_key, raw_value, updated_at)
        VALUES (?, ?, ?)
        `,
        storageKey,
        rawValue,
        now,
      );
    }

    await tx.$executeRawUnsafe("DELETE FROM manual_editor_template_items");
    for (const [storageKey, rawValue] of entries) {
      if (storageKey === AUDIT_STORAGE_KEY) {
        const logs = parseJsonArray<unknown>(rawValue)
          .map((item) => sanitizeAuditLog(item))
          .filter((item): item is AuditLog => item !== null)
          .slice(0, MAX_AUDIT_LOGS);
        for (const log of logs) {
          await tx.$executeRawUnsafe(
            `
            INSERT INTO manual_editor_audit_logs (
              log_id, project_id, user_id, user_name, action, detail, at, raw_json, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            log.id,
            log.projectId,
            log.userId,
            log.userName,
            log.action,
            log.detail,
            log.at,
            JSON.stringify(log),
            now,
          );
        }
        continue;
      }
      if (storageKey === REVISION_STORAGE_KEY) {
        const revisions = parseJsonArray<unknown>(rawValue)
          .map((item) => sanitizeRevision(item))
          .filter((item): item is ProjectRevision => item !== null)
          .slice(0, MAX_REVISIONS);
        for (const revision of revisions) {
          await tx.$executeRawUnsafe(
            `
            INSERT INTO manual_editor_revisions (
              revision_id, project_id, user_id, user_name, label, at, raw_json, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
            revision.id,
            revision.projectId,
            revision.userId,
            revision.userName,
            revision.label,
            revision.at,
            JSON.stringify(revision),
            now,
          );
        }
        continue;
      }
      if (!KNOWN_TEMPLATE_STORAGE_KEYS.has(storageKey)) {
        continue;
      }
      const templateRows = parseTemplateItems(storageKey, rawValue);
      for (const row of templateRows) {
        await tx.$executeRawUnsafe(
          `
          INSERT INTO manual_editor_template_items (
            storage_key, item_id, item_name, item_scope, item_category, item_order, raw_json, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
          row.storage_key,
          row.item_id,
          row.item_name,
          row.item_scope,
          row.item_category,
          row.item_order,
          row.raw_json,
          now,
        );
      }
    }

    await tx.$executeRawUnsafe(
      `
      INSERT INTO manual_editor_collection_meta (collection_id, updated_at)
      VALUES (?, ?)
      ON CONFLICT(collection_id) DO UPDATE SET updated_at = excluded.updated_at
      `,
      CONFIG_COLLECTION_ID,
      now,
    );
  });

  return {
    ok: true,
    updatedAt: now,
  };
}
