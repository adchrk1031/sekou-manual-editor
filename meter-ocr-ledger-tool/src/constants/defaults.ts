import { AppSettings, RunSummary } from "@/types/domain";

export const DEFAULT_SETTINGS: AppSettings = {
  ocrConfidenceThreshold: 0.82,
  maxDeltaThreshold: 1500,
  dryRun: true,
  productionWriteEnabled: false
};

export const EMPTY_SUMMARY: RunSummary = {
  total: 0,
  okAuto: 0,
  needReview: 0,
  ng: 0,
  error: 0
};

export const STORAGE_ROOT = "storage";
export const RUNS_DIR = "runs";
export const LOG_FILE = "audit-log.jsonl";

export const STATUS_LABEL: Record<string, string> = {
  OK_AUTO: "自動反映候補",
  NEED_REVIEW: "要確認",
  NG: "不一致",
  ERROR: "エラー"
};
