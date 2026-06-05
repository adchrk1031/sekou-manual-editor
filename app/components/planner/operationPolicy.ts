export const OPERATION_LIMITS = {
  recommendedApprovedUsers: 30,
  recommendedProjects: 80,
  recommendedCsvRows: 1500,
  recommendedScheduleRowsPerProject: 12,
  localStorageWarnBytes: 3_500_000,
  localStorageCriticalBytes: 4_500_000,
} as const;

export const PDF_LAYOUT_LIMITS = {
  overviewScheduleRowsFirstPage: 6,
  overviewScheduleRowsContinuationPage: 14,
  detailRowsPerPage: 6,
} as const;

export type StatusTone = "ok" | "warn" | "info";

export function formatByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 KB";
  }
  if (bytes >= 1_000_000) {
    return `${(bytes / 1_000_000).toFixed(1)} MB`;
  }
  if (bytes >= 1_000) {
    return `${Math.round(bytes / 100) / 10} KB`;
  }
  return `${bytes} B`;
}

export function getUsageTone(current: number, warnThreshold: number, criticalThreshold?: number): StatusTone {
  if (typeof criticalThreshold === "number" && current >= criticalThreshold) {
    return "warn";
  }
  if (current >= warnThreshold) {
    return "info";
  }
  return "ok";
}

export function chunkItems<T>(items: T[], size: number): T[][] {
  if (size <= 0) {
    return [items];
  }
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks.length ? chunks : [[]];
}
