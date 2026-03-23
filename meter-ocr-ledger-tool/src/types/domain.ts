export type ProcessStatus = "OK_AUTO" | "NEED_REVIEW" | "NG" | "ERROR";

export type PhotoType = "REMOVAL" | "INSTALL" | "UNKNOWN";
export type PairStatus = "READY" | "MISSING" | "DUPLICATE";

export interface AppSettings {
  ocrConfidenceThreshold: number;
  maxDeltaThreshold: number;
  dryRun: boolean;
  productionWriteEnabled: boolean;
}

export interface ExcelMappingConfig {
  sheetName: string;
  headerRow: number;
  roomColumn: string;
  previousReadingColumn?: string;
  plannedInstallMeterNoColumn?: string;
  removalReadingOutputColumn: string;
  installMeterNoOutputColumn: string;
  installReadingOutputColumn: string;
}

export interface LedgerRow {
  rowIndex: number;
  roomRaw: string;
  roomNormalized: string;
  previousReading: number | null;
  plannedInstallMeterNo: string | null;
  currentRemovalReading: number | null;
  currentInstallMeterNo: string | null;
  currentInstallReading: number | null;
}

export interface StoredFile {
  fileId: string;
  fileName: string;
  filePath: string;
  sha256: string;
  uploadedAt: string;
}

export interface PhotoRecord extends StoredFile {
  roomNormalized: string | null;
  roomCandidates: string[];
  roomParseConfidence: number;
  photoType: PhotoType;
  parseReason?: string;
}

export interface RoomPhotoPair {
  roomNormalized: string;
  removalPhotoIds: string[];
  installPhotoIds: string[];
  selectedRemovalPhotoId: string | null;
  selectedInstallPhotoId: string | null;
  status: PairStatus;
  reasons: string[];
  updatedAt: string;
  updatedBy?: string;
}

export interface OCRCandidate {
  value: string;
  normalized: string;
  confidence: number;
}

export interface OcrExtract {
  engine: "google-vision" | "local-tesseract";
  fullText: string;
  roomNo?: string | null;
  roomConfidence?: number;
  roomCandidates?: OCRCandidate[];
  meterNo: string | null;
  meterNoConfidence: number;
  meterCandidates: OCRCandidate[];
  reading: number | null;
  readingRaw: string | null;
  readingConfidence: number;
  readingCandidates: OCRCandidate[];
  error?: string;
}

export interface PhotoProcessingResult {
  photoId: string;
  roomNormalized: string | null;
  photoType: PhotoType;
  ocr: OcrExtract;
}

export interface RoomUpdateCandidate {
  removalReading: number | null;
  installMeterNo: string | null;
  installReading: number | null;
}

export interface ProcessRecord {
  recordId: string;
  runId: string;
  roomNormalized: string | null;
  ledgerRowIndex: number | null;
  removalPhotoId: string | null;
  installPhotoId: string | null;
  photoIds: string[];
  candidate: RoomUpdateCandidate;
  status: ProcessStatus;
  reasons: string[];
  confidence: {
    removalReading: number;
    installMeterNo: number;
    installReading: number;
  };
  checks: {
    roomDetected: boolean;
    roomExistsInLedger: boolean;
    removalReadingValid: boolean;
    installMeterNoValid: boolean;
    installReadingValid: boolean;
    deltaValid: boolean;
    confidenceValid: boolean;
  };
  approvedForOutput: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
  manualOverride?: Partial<RoomUpdateCandidate>;
}

export interface RunSummary {
  total: number;
  okAuto: number;
  needReview: number;
  ng: number;
  error: number;
}

export interface RunData {
  runId: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  excelFile: StoredFile | null;
  mapping: ExcelMappingConfig | null;
  settings: AppSettings;
  ledgerRows: LedgerRow[];
  photos: PhotoRecord[];
  photoPairs: RoomPhotoPair[];
  photoResults: PhotoProcessingResult[];
  processRecords: ProcessRecord[];
  summary: RunSummary;
}

export interface AuditLog {
  logId: string;
  runId: string;
  recordId?: string;
  userId: string;
  action:
    | "RUN_INIT"
    | "UPLOAD_EXCEL"
    | "UPLOAD_PHOTOS"
    | "PAIR_RESOLVE"
    | "RUN_EXECUTE"
    | "RUN_SCAN_PHOTOS"
    | "REVIEW_UPDATE"
    | "EXPORT_CSV"
    | "EXPORT_GOOGLE_SHEETS"
    | "EXPORT_EXCEL"
    | "SETTINGS_UPDATE"
    | "SYSTEM_ERROR";
  payload: unknown;
  createdAt: string;
}

export interface GoogleSheetExportPayload {
  spreadsheetId: string;
  sheetName: string;
  roomColumn: string;
  removalReadingColumn: string;
  installMeterNoColumn: string;
  installReadingColumn: string;
}
