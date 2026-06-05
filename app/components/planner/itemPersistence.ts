"use client";

import {
  APPROVAL_NOTE_TEMPLATE_STORAGE_KEY,
  CSV_INTERNAL_ROW_ID_KEY,
  DETAIL_PHOTO_TEMPLATE_STORAGE_KEY,
  LAYOUT_TEMPLATE_STORAGE_KEY,
  NOTICE_TEMPLATE_STORAGE_KEY,
  PARTY_COMPANY_TEMPLATE_STORAGE_KEY,
  PARTY_TEMPLATE_STORAGE_KEY,
  SCHEDULE_PROCEDURE_TEMPLATE_STORAGE_KEY,
  SCHEDULE_TEMPLATE_STORAGE_KEY,
} from "./constants";
import type {
  AuditLog,
  CsvRecord,
  PartyCompanyTemplatePreset,
  ProjectRevision,
  RelatedPartyKey,
  ScheduleProcedureTemplate,
  SimpleTemplate,
} from "./types";
import { parseStorageJson } from "./utils/storage";

export type ProjectItemSyncEntry = {
  projectId: string;
  sortOrder: number;
  rawProject: string;
};

export type TemplateItemSyncEntry = {
  storageKey: string;
  itemId: string;
  itemName: string;
  itemScope: string;
  itemCategory: string;
  itemOrder: number;
  rawJson: string;
};

export type CsvHeaderSyncEntry = {
  headers: string[];
};

export type CsvRowSyncEntry = {
  rowId: string;
  rowOrder: number;
  rawJson: string;
};

type ProjectItemResponse = {
  ok?: unknown;
  payload?: unknown;
  updatedAt?: unknown;
  resolvedConflict?: unknown;
  error?: unknown;
};

type TemplateItemResponse = ProjectItemResponse;
type CsvHeaderResponse = ProjectItemResponse;
type CsvRowResponse = ProjectItemResponse;
type AppendResponse = {
  ok?: unknown;
  updatedAt?: unknown;
  error?: unknown;
};

const TEMPLATE_STORAGE_KEYS = [
  NOTICE_TEMPLATE_STORAGE_KEY,
  APPROVAL_NOTE_TEMPLATE_STORAGE_KEY,
  SCHEDULE_TEMPLATE_STORAGE_KEY,
  SCHEDULE_PROCEDURE_TEMPLATE_STORAGE_KEY,
  DETAIL_PHOTO_TEMPLATE_STORAGE_KEY,
  PARTY_TEMPLATE_STORAGE_KEY,
  PARTY_COMPANY_TEMPLATE_STORAGE_KEY,
  LAYOUT_TEMPLATE_STORAGE_KEY,
] as const;
const PARTY_KEYS: RelatedPartyKey[] = ["owner", "utility", "contractor", "management", "residents"];

function encodePathPart(value: string): string {
  return encodeURIComponent(value);
}

function parseTemplateItems(storageKey: string, rawValue: string): TemplateItemSyncEntry[] {
  if (storageKey === PARTY_COMPANY_TEMPLATE_STORAGE_KEY) {
    const parsed = parseStorageJson<Partial<Record<RelatedPartyKey, PartyCompanyTemplatePreset[]>>>(rawValue);
    if (!parsed || typeof parsed !== "object") {
      return [];
    }
    const items: TemplateItemSyncEntry[] = [];
    PARTY_KEYS.forEach((scope) => {
      const entries = Array.isArray(parsed[scope]) ? parsed[scope] : [];
      entries.forEach((item, index) => {
        if (!item || typeof item.id !== "string" || typeof item.label !== "string") {
          return;
        }
        items.push({
          storageKey,
          itemId: item.id,
          itemName: item.label,
          itemScope: scope,
          itemCategory: typeof item.title === "string" ? item.title : "",
          itemOrder: index,
          rawJson: JSON.stringify(item),
        });
      });
    });
    return items;
  }

  if (storageKey === SCHEDULE_PROCEDURE_TEMPLATE_STORAGE_KEY) {
    const parsed = parseStorageJson<ScheduleProcedureTemplate[]>(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item, index) => {
        if (!item || typeof item.id !== "string" || typeof item.name !== "string") {
          return null;
        }
        return {
          storageKey,
          itemId: item.id,
          itemName: item.name,
          itemScope: "",
          itemCategory: "scheduleProcedure",
          itemOrder: index,
          rawJson: JSON.stringify(item),
        } satisfies TemplateItemSyncEntry;
      })
      .filter((item): item is TemplateItemSyncEntry => item !== null);
  }

  const parsed = parseStorageJson<Array<SimpleTemplate<unknown>>>(rawValue);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed
    .map((item, index) => {
      if (!item || typeof item.id !== "string" || typeof item.name !== "string") {
        return null;
      }
      return {
        storageKey,
        itemId: item.id,
        itemName: item.name,
        itemScope: "",
        itemCategory:
          storageKey === NOTICE_TEMPLATE_STORAGE_KEY ? "notice"
            : storageKey === APPROVAL_NOTE_TEMPLATE_STORAGE_KEY ? "approvalNote"
              : storageKey === SCHEDULE_TEMPLATE_STORAGE_KEY ? "schedule"
                : storageKey === DETAIL_PHOTO_TEMPLATE_STORAGE_KEY ? "detailPhotos"
                  : storageKey === PARTY_TEMPLATE_STORAGE_KEY ? "relatedParties"
                    : storageKey === LAYOUT_TEMPLATE_STORAGE_KEY ? "layout"
                      : "",
        itemOrder: index,
        rawJson: JSON.stringify(item),
      } satisfies TemplateItemSyncEntry;
    })
    .filter((item): item is TemplateItemSyncEntry => item !== null);
}

export function buildTemplateItemSyncEntriesFromLocalStorage(): TemplateItemSyncEntry[] {
  if (typeof window === "undefined") {
    return [];
  }
  return TEMPLATE_STORAGE_KEYS.flatMap((storageKey) => {
    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue) {
      return [];
    }
    return parseTemplateItems(storageKey, rawValue);
  });
}

export function buildProjectItemSyncEntries(
  projectIds: string[],
  projectDataById: Record<string, string>,
): ProjectItemSyncEntry[] {
  return projectIds.flatMap((projectId, index) => {
    const rawProject = projectDataById[projectId];
    if (typeof rawProject !== "string") {
      return [];
    }
    return [{
      projectId,
      sortOrder: index,
      rawProject,
    }];
  });
}

export function buildCsvRowSyncEntries(csvDraftRows: CsvRecord[]): CsvRowSyncEntry[] {
  return csvDraftRows.map((row, index) => ({
    rowId: String(row[CSV_INTERNAL_ROW_ID_KEY] ?? "").trim() || `row_${index + 1}`,
    rowOrder: index,
    rawJson: JSON.stringify(row),
  }));
}

export function buildCsvHeaderSyncEntry(headers: string[]): CsvHeaderSyncEntry {
  return { headers: [...headers] };
}

export async function saveProjectItem(
  entry: ProjectItemSyncEntry,
  baseUpdatedAt: string | null,
): Promise<{
  ok: boolean;
  updatedAt: string | null;
  resolvedConflict: boolean;
  payload: ProjectItemSyncEntry | null;
  error?: string;
}> {
  try {
    const response = await fetch(`/api/manual-editor/projects/${encodePathPart(entry.projectId)}`, {
      method: "PUT",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payload: {
          sortOrder: entry.sortOrder,
          rawProject: entry.rawProject,
        },
        baseUpdatedAt,
      }),
    });
    const body = (await response.json().catch(() => null)) as ProjectItemResponse | null;
    return {
      ok: response.ok,
      updatedAt: typeof body?.updatedAt === "string" ? body.updatedAt : null,
      resolvedConflict: Boolean(body?.resolvedConflict),
      payload: body?.payload && typeof body.payload === "object"
        ? (body.payload as ProjectItemSyncEntry)
        : null,
      error: typeof body?.error === "string" ? body.error : undefined,
    };
  } catch {
    return { ok: false, updatedAt: null, resolvedConflict: false, payload: null, error: "network_error" };
  }
}

export async function deleteProjectItem(
  projectId: string,
  baseUpdatedAt: string | null,
): Promise<{
  ok: boolean;
  updatedAt: string | null;
  resolvedConflict: boolean;
  error?: string;
}> {
  try {
    const response = await fetch(`/api/manual-editor/projects/${encodePathPart(projectId)}`, {
      method: "DELETE",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ baseUpdatedAt }),
    });
    const body = (await response.json().catch(() => null)) as ProjectItemResponse | null;
    return {
      ok: response.ok,
      updatedAt: typeof body?.updatedAt === "string" ? body.updatedAt : null,
      resolvedConflict: Boolean(body?.resolvedConflict),
      error: typeof body?.error === "string" ? body.error : undefined,
    };
  } catch {
    return { ok: false, updatedAt: null, resolvedConflict: false, error: "network_error" };
  }
}

export async function saveTemplateItem(
  entry: TemplateItemSyncEntry,
  baseUpdatedAt: string | null,
): Promise<{
  ok: boolean;
  updatedAt: string | null;
  resolvedConflict: boolean;
  payload: TemplateItemSyncEntry | null;
  error?: string;
}> {
  try {
    const response = await fetch(
      `/api/manual-editor/template-items/${encodePathPart(entry.storageKey)}/${encodePathPart(entry.itemId)}`,
      {
        method: "PUT",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payload: {
            itemName: entry.itemName,
            itemScope: entry.itemScope,
            itemCategory: entry.itemCategory,
            itemOrder: entry.itemOrder,
            rawJson: entry.rawJson,
          },
          baseUpdatedAt,
        }),
      },
    );
    const body = (await response.json().catch(() => null)) as TemplateItemResponse | null;
    return {
      ok: response.ok,
      updatedAt: typeof body?.updatedAt === "string" ? body.updatedAt : null,
      resolvedConflict: Boolean(body?.resolvedConflict),
      payload: body?.payload && typeof body.payload === "object"
        ? (body.payload as TemplateItemSyncEntry)
        : null,
      error: typeof body?.error === "string" ? body.error : undefined,
    };
  } catch {
    return { ok: false, updatedAt: null, resolvedConflict: false, payload: null, error: "network_error" };
  }
}

export async function deleteTemplateItem(
  storageKey: string,
  itemId: string,
  baseUpdatedAt: string | null,
): Promise<{
  ok: boolean;
  updatedAt: string | null;
  resolvedConflict: boolean;
  error?: string;
}> {
  try {
    const response = await fetch(
      `/api/manual-editor/template-items/${encodePathPart(storageKey)}/${encodePathPart(itemId)}`,
      {
        method: "DELETE",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ baseUpdatedAt }),
      },
    );
    const body = (await response.json().catch(() => null)) as TemplateItemResponse | null;
    return {
      ok: response.ok,
      updatedAt: typeof body?.updatedAt === "string" ? body.updatedAt : null,
      resolvedConflict: Boolean(body?.resolvedConflict),
      error: typeof body?.error === "string" ? body.error : undefined,
    };
  } catch {
    return { ok: false, updatedAt: null, resolvedConflict: false, error: "network_error" };
  }
}

export async function saveCsvHeaders(
  entry: CsvHeaderSyncEntry,
  baseUpdatedAt: string | null,
): Promise<{
  ok: boolean;
  updatedAt: string | null;
  resolvedConflict: boolean;
  payload: CsvHeaderSyncEntry | null;
  error?: string;
}> {
  try {
    const response = await fetch("/api/manual-editor/csv/headers", {
      method: "PUT",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payload: {
          headers: entry.headers,
        },
        baseUpdatedAt,
      }),
    });
    const body = (await response.json().catch(() => null)) as CsvHeaderResponse | null;
    return {
      ok: response.ok,
      updatedAt: typeof body?.updatedAt === "string" ? body.updatedAt : null,
      resolvedConflict: Boolean(body?.resolvedConflict),
      payload: body?.payload && typeof body.payload === "object"
        ? (body.payload as CsvHeaderSyncEntry)
        : null,
      error: typeof body?.error === "string" ? body.error : undefined,
    };
  } catch {
    return { ok: false, updatedAt: null, resolvedConflict: false, payload: null, error: "network_error" };
  }
}

export async function saveCsvRow(
  entry: CsvRowSyncEntry,
  baseUpdatedAt: string | null,
): Promise<{
  ok: boolean;
  updatedAt: string | null;
  resolvedConflict: boolean;
  payload: CsvRowSyncEntry | null;
  error?: string;
}> {
  try {
    const response = await fetch(`/api/manual-editor/csv/rows/${encodePathPart(entry.rowId)}`, {
      method: "PUT",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payload: {
          rowOrder: entry.rowOrder,
          rawJson: entry.rawJson,
        },
        baseUpdatedAt,
      }),
    });
    const body = (await response.json().catch(() => null)) as CsvRowResponse | null;
    return {
      ok: response.ok,
      updatedAt: typeof body?.updatedAt === "string" ? body.updatedAt : null,
      resolvedConflict: Boolean(body?.resolvedConflict),
      payload: body?.payload && typeof body.payload === "object"
        ? (body.payload as CsvRowSyncEntry)
        : null,
      error: typeof body?.error === "string" ? body.error : undefined,
    };
  } catch {
    return { ok: false, updatedAt: null, resolvedConflict: false, payload: null, error: "network_error" };
  }
}

export async function deleteCsvRow(
  rowId: string,
  baseUpdatedAt: string | null,
): Promise<{
  ok: boolean;
  updatedAt: string | null;
  resolvedConflict: boolean;
  error?: string;
}> {
  try {
    const response = await fetch(`/api/manual-editor/csv/rows/${encodePathPart(rowId)}`, {
      method: "DELETE",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ baseUpdatedAt }),
    });
    const body = (await response.json().catch(() => null)) as CsvRowResponse | null;
    return {
      ok: response.ok,
      updatedAt: typeof body?.updatedAt === "string" ? body.updatedAt : null,
      resolvedConflict: Boolean(body?.resolvedConflict),
      error: typeof body?.error === "string" ? body.error : undefined,
    };
  } catch {
    return { ok: false, updatedAt: null, resolvedConflict: false, error: "network_error" };
  }
}

export async function appendAuditLogEntry(log: AuditLog): Promise<{
  ok: boolean;
  updatedAt: string | null;
  error?: string;
}> {
  try {
    const response = await fetch("/api/manual-editor/audit-logs", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payload: {
          rawJson: JSON.stringify(log),
        },
      }),
    });
    const body = (await response.json().catch(() => null)) as AppendResponse | null;
    return {
      ok: response.ok,
      updatedAt: typeof body?.updatedAt === "string" ? body.updatedAt : null,
      error: typeof body?.error === "string" ? body.error : undefined,
    };
  } catch {
    return { ok: false, updatedAt: null, error: "network_error" };
  }
}

export async function appendRevisionEntry(revision: ProjectRevision): Promise<{
  ok: boolean;
  updatedAt: string | null;
  error?: string;
}> {
  try {
    const response = await fetch("/api/manual-editor/revisions", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payload: {
          rawJson: JSON.stringify(revision),
        },
      }),
    });
    const body = (await response.json().catch(() => null)) as AppendResponse | null;
    return {
      ok: response.ok,
      updatedAt: typeof body?.updatedAt === "string" ? body.updatedAt : null,
      error: typeof body?.error === "string" ? body.error : undefined,
    };
  } catch {
    return { ok: false, updatedAt: null, error: "network_error" };
  }
}
