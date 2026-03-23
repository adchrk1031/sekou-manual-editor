import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { EMPTY_SUMMARY, LOG_FILE, RUNS_DIR, STORAGE_ROOT, DEFAULT_SETTINGS } from "@/constants/defaults";
import { AuditLog, RunData } from "@/types/domain";

const RUN_META_FILE = "run.json";
const ACTIVE_RUN_FILE = "active-run.json";

function storagePath(...parts: string[]): string {
  return path.join(process.cwd(), STORAGE_ROOT, ...parts);
}

async function ensureStorageDirs(): Promise<void> {
  await fs.mkdir(storagePath(), { recursive: true });
  await fs.mkdir(storagePath(RUNS_DIR), { recursive: true });
}

export function createId(prefix: string): string {
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  return `${prefix}_${id}`;
}

export async function initRun(userId: string): Promise<RunData> {
  await ensureStorageDirs();
  const runId = createId("run");
  const now = new Date().toISOString();
  const run: RunData = {
    runId,
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
    excelFile: null,
    mapping: null,
    settings: { ...DEFAULT_SETTINGS },
    ledgerRows: [],
    photos: [],
    photoPairs: [],
    photoResults: [],
    processRecords: [],
    summary: { ...EMPTY_SUMMARY }
  };

  await saveRun(run);
  await setActiveRunId(runId);
  return run;
}

export async function runDir(runId: string): Promise<string> {
  await ensureStorageDirs();
  const target = storagePath(RUNS_DIR, runId);
  await fs.mkdir(target, { recursive: true });
  return target;
}

export async function saveRun(run: RunData): Promise<void> {
  run.updatedAt = new Date().toISOString();
  const dir = await runDir(run.runId);
  await fs.writeFile(path.join(dir, RUN_META_FILE), JSON.stringify(run, null, 2), "utf-8");
}

export async function getRun(runId: string): Promise<RunData | null> {
  try {
    const file = await fs.readFile(storagePath(RUNS_DIR, runId, RUN_META_FILE), "utf-8");
    const parsed = JSON.parse(file) as Partial<RunData>;
    const normalized: RunData = {
      runId: parsed.runId ?? runId,
      createdAt: parsed.createdAt ?? new Date().toISOString(),
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
      createdBy: parsed.createdBy ?? "unknown-user",
      excelFile: parsed.excelFile ?? null,
      mapping: parsed.mapping ?? null,
      settings: parsed.settings ?? { ...DEFAULT_SETTINGS },
      ledgerRows: parsed.ledgerRows ?? [],
      photos: parsed.photos ?? [],
      photoPairs: parsed.photoPairs ?? [],
      photoResults: parsed.photoResults ?? [],
      processRecords: parsed.processRecords ?? [],
      summary: parsed.summary ?? { ...EMPTY_SUMMARY }
    };
    return normalized;
  } catch {
    return null;
  }
}

export async function getActiveRunId(): Promise<string | null> {
  try {
    const raw = await fs.readFile(storagePath(ACTIVE_RUN_FILE), "utf-8");
    const json = JSON.parse(raw) as { runId?: string };
    return json.runId ?? null;
  } catch {
    return null;
  }
}

export async function getOrCreateActiveRun(userId: string): Promise<RunData> {
  const activeId = await getActiveRunId();
  if (activeId) {
    const run = await getRun(activeId);
    if (run) {
      return run;
    }
  }
  return initRun(userId);
}

export async function setActiveRunId(runId: string): Promise<void> {
  await ensureStorageDirs();
  await fs.writeFile(storagePath(ACTIVE_RUN_FILE), JSON.stringify({ runId }, null, 2), "utf-8");
}

export async function appendAuditLog(log: AuditLog): Promise<void> {
  await ensureStorageDirs();
  const line = `${JSON.stringify(log)}\n`;
  await fs.appendFile(storagePath(LOG_FILE), line, "utf-8");
}

export async function readAuditLogs(limit = 200): Promise<AuditLog[]> {
  try {
    const raw = await fs.readFile(storagePath(LOG_FILE), "utf-8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as AuditLog)
      .slice(-limit)
      .reverse();
  } catch {
    return [];
  }
}

export async function saveBinaryFile(destPath: string, data: Buffer): Promise<void> {
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  await fs.writeFile(destPath, data);
}

export function hashBuffer(data: Buffer): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

export function absoluteStoragePath(...parts: string[]): string {
  return storagePath(...parts);
}
