"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CSSProperties, ChangeEvent, DragEvent as ReactDragEvent, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode, WheelEvent as ReactWheelEvent, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { compressToUTF16, decompressFromUTF16 } from "lz-string";
import { clearSession, ensureUsers, getLoginAttempts, getLoginFailureMessage, getSessionUser, loginWithCredentials, type LoginAttemptLog } from "./auth";
import { SHARED_STORAGE_UPDATED_EVENT, pullSharedStorageSnapshot, pushSharedStorageSnapshot } from "./sharedStorage";

type WorkCode = "KOUATSU_CABLE" | "UGS" | "PAS" | "GROUND_A" | "GROUND_B" | "GROUND_C";

type ScheduleRow = {
  id: string;
  label: string;
  startDate: string;
  start: string;
  endDate: string;
  end: string;
  outage: boolean;
  text: string;
  note: string;
};

type PhotoSlot = {
  id: string;
  label: string;
  dataUrl: string;
  layoutAnnotations: LayoutAnnotation[];
  layoutAnnotationsV2: LayoutAnnotationV2[];
};

type PhotoSlots = PhotoSlot[];
type LayoutTextAlign = "left" | "center" | "right";

type LayoutAnnotationType = "arrow" | "rect" | "polygon" | "text";

type LayoutAnnotationBase = {
  id: string;
  type: LayoutAnnotationType;
  color: string;
  groupId?: string;
  rotation?: number;
  fillColor?: string;
  fillOpacity?: number;
  name?: string;
  visible?: boolean;
  locked?: boolean;
};

type LayoutArrowAnnotation = LayoutAnnotationBase & {
  type: "arrow";
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  strokeWidth: number;
  arrowHead?: boolean;
};

type LayoutRectAnnotation = LayoutAnnotationBase & {
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  strokeWidth: number;
};

type LayoutPolygonAnnotation = LayoutAnnotationBase & {
  type: "polygon";
  x: number;
  y: number;
  width: number;
  height: number;
  sides: number;
  strokeWidth: number;
};

type LayoutTextAnnotation = LayoutAnnotationBase & {
  type: "text";
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fontWeight: number;
  fontFamily: string;
  textStrokeColor: string;
  textStrokeWidth: number;
  textAlign: LayoutTextAlign;
};

type LayoutAnnotation = LayoutArrowAnnotation | LayoutRectAnnotation | LayoutPolygonAnnotation | LayoutTextAnnotation;

type LayoutAnnotationV2Type = "arrow" | "rect" | "polygon" | "text";

type LayoutAnnotationV2Transform = {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
};

type LayoutAnnotationV2Style = {
  stroke: string;
  strokeWidth: number;
  fill: string;
  fillOpacity: number;
  textColor: string;
  fontSize: number;
  fontWeight: number;
  fontFamily: string;
  textStrokeColor: string;
  textStrokeWidth: number;
  textAlign: LayoutTextAlign;
};

type LayoutAnnotationV2Base = {
  id: string;
  type: LayoutAnnotationV2Type;
  groupId?: string;
  transform: LayoutAnnotationV2Transform;
  style: LayoutAnnotationV2Style;
  name?: string;
  visible?: boolean;
  locked?: boolean;
};

type LayoutArrowAnnotationV2 = LayoutAnnotationV2Base & {
  type: "arrow";
  points: [number, number, number, number];
  arrowHead?: boolean;
};

type LayoutRectAnnotationV2 = LayoutAnnotationV2Base & {
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
};

type LayoutPolygonAnnotationV2 = LayoutAnnotationV2Base & {
  type: "polygon";
  x: number;
  y: number;
  width: number;
  height: number;
  sides: number;
};

type LayoutTextAnnotationV2 = LayoutAnnotationV2Base & {
  type: "text";
  x: number;
  y: number;
  text: string;
};

type LayoutAnnotationV2 = LayoutArrowAnnotationV2 | LayoutRectAnnotationV2 | LayoutPolygonAnnotationV2 | LayoutTextAnnotationV2;

type LayoutAnnotationListEntry = {
  key: string;
  annotationIds: string[];
  primaryId: string;
  title: string;
  visible: boolean;
  locked: boolean;
  isGroup: boolean;
};

type RelatedParty = {
  enabled: boolean;
  title: string;
  company: string;
  person: string;
  office: string;
  tel: string;
};

type UserRole = "system_admin" | "admin" | "editor" | "viewer";
type UserApprovalStatus = "approved" | "pending" | "rejected";
type RelatedPartyKey = "owner" | "utility" | "contractor" | "management" | "residents";

type UserAccount = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  active: boolean;
  approvalStatus: UserApprovalStatus;
  approvedAt?: string;
  approvedById?: string;
  approvedByName?: string;
  createdAt?: string;
  createdById?: string;
  createdByName?: string;
  lastLoginAt?: string;
};

type AuditLog = {
  id: string;
  projectId: string;
  at: string;
  userId: string;
  userName: string;
  action: string;
  detail: string;
};

type PartyCompanyTemplatePreset = {
  id: string;
  label: string;
  title: string;
  company: string;
  person: string;
  office: string;
  tel: string;
};

type Project = {
  projectId: string;
  propertyName: string;
  propertyAddress: string;
  titleSubject: string;
  workDateStart: string;
  workDateEnd: string;
  outageDateStart: string;
  outageDateEnd: string;
  outageTimeStart: string;
  outageTimeEnd: string;
  outageEnabled: boolean;
  flags: Record<WorkCode, boolean>;
  selectedWorkCodes: WorkCode[];
  noteSpecial: string;
  noteApprovalExtra: string;
  coverRecipientSuffix: string;
  pdfTemplateId: PdfTemplateId;
  pdfCompanyName: string;
  pdfTeam: string;
  pdfContactPerson: string;
  pdfAddress: string;
  pdfEmail: string;
  pdfTel: string;
  pdfFax: string;
  layoutImageDataUrl: string;
  layoutAnnotations: LayoutAnnotation[];
  layoutAnnotationsV2: LayoutAnnotationV2[];
  scheduleRows: ScheduleRow[];
  detailPhotos: PhotoSlots;
  layoutPhotos: PhotoSlots;
  relatedParties: {
    owner: RelatedParty;
    utility: RelatedParty;
    contractor: RelatedParty;
    management: RelatedParty;
    residents: RelatedParty;
  };
  approvalStatus: "draft" | "submitted" | "approved" | "rejected";
  approvalComment: string;
  approvedBy: string;
  approvedAt: string;
};

type ProjectSnapshot = Pick<
  Project,
  | "propertyName"
  | "propertyAddress"
  | "titleSubject"
  | "workDateStart"
  | "workDateEnd"
  | "outageDateStart"
  | "outageDateEnd"
  | "outageTimeStart"
  | "outageTimeEnd"
  | "outageEnabled"
  | "selectedWorkCodes"
  | "noteSpecial"
  | "noteApprovalExtra"
  | "coverRecipientSuffix"
  | "pdfTemplateId"
  | "pdfCompanyName"
  | "pdfTeam"
  | "pdfContactPerson"
  | "pdfAddress"
  | "pdfEmail"
  | "pdfTel"
  | "pdfFax"
  | "layoutAnnotations"
  | "layoutAnnotationsV2"
  | "scheduleRows"
  | "relatedParties"
>;

type ProjectRevision = {
  id: string;
  projectId: string;
  at: string;
  userId: string;
  userName: string;
  label: string;
  snapshot: ProjectSnapshot;
};

type CsvRecord = Record<string, string>;

type WorkMaster = {
  code: WorkCode;
  name: string;
  detailText: string;
  defaultText: string;
};

type ScheduleProcedureTemplateStep = {
  id: string;
  label: string;
  durationMinutes: number;
  outage: boolean;
  note: string;
};

type ScheduleProcedureTemplate = {
  id: string;
  name: string;
  createdAt: string;
  workCodes: WorkCode[];
  steps: ScheduleProcedureTemplateStep[];
};

type TemplateScope = "schedule" | "detailPhotos" | "relatedParties" | "layout";
type PdfTemplateId = "standard" | "kansai" | "night";

type PdfTemplatePreset = {
  id: PdfTemplateId;
  label: string;
  description: string;
  coverKicker: string;
  coverTeamLabel: string;
  coverOfficeLabel: string;
  tocItems: [string, string, string, string, string];
  sectionOverview: string;
  sectionDetail: string;
  sectionApproval: string;
  sectionOrganization: string;
  sectionEmergency: string;
};

type LayoutTemplatePayload = {
  layoutImageDataUrl: string;
  layoutPhotos: PhotoSlots;
  layoutAnnotations: LayoutAnnotation[];
  layoutAnnotationsV2?: LayoutAnnotationV2[];
};

type DragInfo = {
  rowId: string;
  mode: "start" | "end" | "move";
  startX: number;
  trackWidth: number;
  viewSpan: number;
  fullSpan: number;
  baseDate: string;
  baseStart: number;
  baseEnd: number;
  currentStart: number;
  currentEnd: number;
};

type TimelineWindow = {
  id: string;
  viewStart: number;
  viewEnd: number;
  viewSpan: number;
  lineTicks: number[];
  labelTicks: number[];
  startDate: string;
  endDate: string;
};

type SimpleTemplate<T> = {
  id: string;
  name: string;
  createdAt: string;
  payload: T;
};

type LayoutEditorTool = "select" | "arrow" | "rect" | "chain" | "text";
type LayoutAdvancedTab = "transform" | "style" | "arrange";
type LayoutEditorTarget =
  | { kind: "layoutImage"; label: string }
  | { kind: "photo"; section: "detailPhotos" | "layoutPhotos"; photoId: string; label: string };

type LayoutDrawingDraft = {
  type: "arrow" | "rect";
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
  strokeWidth: number;
  fillColor: string;
  fillOpacity: number;
  arrowHead?: boolean;
};

type LayoutMoveState = {
  annotationIds: string[];
  startX: number;
  startY: number;
  snapshots: LayoutAnnotation[];
};

type LayoutResizeCorner = "nw" | "ne" | "sw" | "se";

type LayoutResizeState =
  | {
      mode: "box";
      annotationId: string;
      corner: LayoutResizeCorner;
      startX: number;
      startY: number;
      snapshot: LayoutRectAnnotation | LayoutPolygonAnnotation;
    }
  | {
      mode: "arrow";
      annotationId: string;
      endpoint: "from" | "to";
      startX: number;
      startY: number;
      snapshot: LayoutArrowAnnotation;
    }
  | {
      mode: "text";
      annotationId: string;
      startY: number;
      snapshot: LayoutTextAnnotation;
    }
  | {
      mode: "groupBox";
      annotationIds: string[];
      corner: LayoutResizeCorner;
      startX: number;
      startY: number;
      bounds: { x: number; y: number; width: number; height: number };
      snapshots: LayoutAnnotation[];
    };

type LayoutRotateState = {
  annotationIds: string[];
  centerX: number;
  centerY: number;
  startAngle: number;
  snapshots: LayoutAnnotation[];
};

type LayoutPanState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPanX: number;
  startPanY: number;
};

type LayoutMarqueeState = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  additive: boolean;
};

type LayoutGuideLine = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type UiIconName =
  | "upload"
  | "plus"
  | "menu"
  | "settings"
  | "cursor"
  | "shapeLine"
  | "shapeArrow"
  | "shapeRect"
  | "shapePolygon"
  | "shapeText"
  | "magnet"
  | "login"
  | "logout"
  | "userPlus"
  | "send"
  | "check"
  | "undo"
  | "save"
  | "history"
  | "apply"
  | "delete"
  | "copy"
  | "arrowLeft"
  | "arrowRight"
  | "pdf"
  | "refresh"
  | "addRow"
  | "up"
  | "down"
  | "photo"
  | "clear"
  | "lock"
  | "template";

type UserCreateNotice = {
  type: "ok" | "error";
  text: string;
};

type UiPreset = "standard" | "field" | "compact";

type LocalStorageExportItem = {
  key: string;
  value: string;
};

type LocalStorageExportPayload = {
  app: "sekou-manual-editor";
  exportedAt: string;
  items: LocalStorageExportItem[];
};

type OutageWindow = Pick<Project, "outageDateStart" | "outageTimeStart" | "outageDateEnd" | "outageTimeEnd">;

type OutageTraceEntry = {
  seq: number;
  at: string;
  source: string;
  changedFields: string[];
  before: OutageWindow;
  after: OutageWindow;
  rangeStart: string;
  rangeEnd: string;
  dateShifted: boolean;
};

type LegacyDateRiskEntry = {
  source: string;
  projectId: string;
  field: string;
  raw: string;
};

const STORAGE_KEY = "sekou-tool-projects-v5";
const PROJECT_INDEX_STORAGE_KEY = "sekou-project-index-v1";
const PROJECT_DATA_STORAGE_PREFIX = "sekou-project-data-v1:";
const CSV_EDITOR_STORAGE_KEY = "sekou-csv-editor-v1";
const USERS_STORAGE_KEY = "sekou-tool-users-v1";
const TEST_EDITOR_SEED_STORAGE_KEY = "sekou-tool-test-editors-seeded-v2";
const AUDIT_STORAGE_KEY = "sekou-tool-audit-v1";
const REVISION_STORAGE_KEY = "sekou-tool-revision-v1";
const SCHEDULE_TEMPLATE_STORAGE_KEY = "sekou-tool-template-schedule-v1";
const SCHEDULE_PROCEDURE_TEMPLATE_STORAGE_KEY = "sekou-tool-template-schedule-procedures-v1";
const DETAIL_PHOTO_TEMPLATE_STORAGE_KEY = "sekou-tool-template-detail-photos-v1";
const PARTY_TEMPLATE_STORAGE_KEY = "sekou-tool-template-parties-v1";
const PARTY_COMPANY_TEMPLATE_STORAGE_KEY = "sekou-tool-template-party-companies-v1";
const LAYOUT_TEMPLATE_STORAGE_KEY = "sekou-tool-template-layout-v1";
const UI_PRESET_STORAGE_KEY = "sekou-ui-preset-v1";
const OUTAGE_TRACE_DEBUG_KEY = "sekou-debug-outage-trace";
const LEGACY_DATE_TRACE_DEBUG_KEY = "sekou-debug-legacy-date";
const DAY_TOTAL_MINUTES = 24 * 60;
const MIN_BLOCK_MINUTES = 60;
const DRAG_SNAP_MINUTES = 5;
const HEADER_LOGO_SRC = "/header-logo.svg";
const PDF_LOGO_SRC = "/logo.png";
const PDF_LOGO_FALLBACK_SRC = "/rezil-fixed-logo.svg";
const MAX_AUDIT_LOGS = 500;
const MAX_REVISIONS = 200;
const CSV_PAGE_SIZE_OPTIONS = [20, 50, 100, 200, 300];
const PROJECT_SAVE_DEBOUNCE_MS = 350;
const CSV_SAVE_DEBOUNCE_MS = 700;
const DEFAULT_PHOTO_MAX_SIZE = 1280;
const DEFAULT_LAYOUT_MAX_SIZE = 1600;
const MAX_UPLOAD_FILE_BYTES = 10 * 1024 * 1024;
const TARGET_PHOTO_DATA_URL_BYTES = 850_000;
const TARGET_LAYOUT_DATA_URL_BYTES = 1_100_000;
const STORAGE_COMPRESSION_PREFIX = "lz:";
const STORAGE_COMPRESSION_THRESHOLD = 4 * 1024;
const LAYOUT_CANVAS_SIZE = 1000;
const MAX_ANNOTATION_HISTORY = 150;
const DEFAULT_ANNOTATION_COLOR = "#d92d20";
const DEFAULT_ANNOTATION_STROKE_WIDTH = 1;
const DEFAULT_ANNOTATION_FILL_COLOR = "#f59e0b";
const DEFAULT_ANNOTATION_FILL_OPACITY = 0.22;
const DEFAULT_TEXT_FONT_FAMILY = "\"Noto Sans JP\", \"Hiragino Kaku Gothic ProN\", \"Yu Gothic\", sans-serif";
const DEFAULT_TEXT_STROKE_COLOR = "#ffffff";
const DEFAULT_TEXT_STROKE_WIDTH = 3;
const LAYOUT_SNAP_THRESHOLD = 10;
const USER_LIST_VISIBLE_COUNT = 5;
const UI_PRESET_OPTIONS: Array<{ value: UiPreset; label: string }> = [
  { value: "standard", label: "標準" },
  { value: "field", label: "現場向け（大きめ）" },
  { value: "compact", label: "コンパクト" },
];
const LAYOUT_TEXT_FONT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: DEFAULT_TEXT_FONT_FAMILY, label: "ゴシック（標準）" },
  { value: "\"Yu Mincho\", \"Hiragino Mincho ProN\", serif", label: "明朝" },
  { value: "\"Meiryo\", \"Yu Gothic\", sans-serif", label: "メイリオ" },
  { value: "\"Arial\", sans-serif", label: "Arial" },
  { value: "\"Courier New\", monospace", label: "等幅（Monospace）" },
];

const TEST_EDITOR_USER_PRESETS: Array<{ id: string; name: string; email: string; password: string }> = [
  { id: "user_test_editor_01", name: "テスト編集者1", email: "test.editor01@example.com", password: "testpass01" },
  { id: "user_test_editor_02", name: "テスト編集者2", email: "test.editor02@example.com", password: "testpass02" },
  { id: "user_test_editor_03", name: "テスト編集者3", email: "test.editor03@example.com", password: "testpass03" },
  { id: "user_test_editor_04", name: "テスト編集者4", email: "test.editor04@example.com", password: "testpass04" },
  { id: "user_test_editor_05", name: "テスト編集者5", email: "test.editor05@example.com", password: "testpass05" },
  { id: "user_test_editor_06", name: "テスト編集者6", email: "test.editor06@example.com", password: "testpass06" },
];

const ROLE_LABELS: Record<UserRole, string> = {
  system_admin: "システム管理者",
  admin: "管理者",
  editor: "編集者",
  viewer: "閲覧者",
};

function isAdminLikeRole(role: UserRole): boolean {
  return role === "system_admin" || role === "admin";
}

const USER_APPROVAL_LABELS: Record<UserApprovalStatus, string> = {
  approved: "承認済み",
  pending: "承認待ち",
  rejected: "利用不可",
};

const APPROVAL_STATUS_LABELS: Record<Project["approvalStatus"], string> = {
  draft: "編集中",
  submitted: "確認依頼中",
  approved: "確定",
  rejected: "修正依頼",
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  login: "ログイン",
  logout: "ログアウト",
  user_create: "ユーザー作成",
  backup_save: "履歴保存",
  backup_restore: "履歴復元",
  approval_update: "状態更新",
  schedule_regenerate: "工程再生成",
  schedule_add_row: "工程行追加",
  schedule_remove_row: "工程行削除",
  schedule_reorder: "工程順序変更",
  timeline_drag: "工程バー調整",
  photo_add: "写真枠追加",
  photo_remove: "写真枠削除",
  layout_image_replace: "配置図アップロード",
  layout_annotation_save: "配置図注釈保存",
  pdf_export: "PDF出力",
  project_create: "案件作成",
  project_delete: "案件削除",
  copy_from_project: "他案件引用",
  template_apply: "テンプレート適用",
  csv_apply: "CSV反映",
  login_failed: "ログイン失敗",
  user_update_email: "管理者メール変更",
  user_approval_update: "利用承認更新",
  user_delete: "ユーザー削除",
};

const WORK_MASTER: WorkMaster[] = [
  { code: "KOUATSU_CABLE", name: "高圧ケーブル交換", detailText: "既設高圧ケーブル撤去、新規ケーブルへ切替を実施", defaultText: "高圧ケーブル切替" },
  { code: "UGS", name: "UGS交換", detailText: "UGS本体の更新・端末処理・絶縁確認を実施", defaultText: "UGS交換" },
  { code: "PAS", name: "PAS交換", detailText: "PAS撤去・新設・動作確認を実施", defaultText: "PAS交換" },
  { code: "GROUND_A", name: "A種接地是正", detailText: "A種接地抵抗値測定と是正工事を実施", defaultText: "A種接地是正" },
  { code: "GROUND_B", name: "B種接地是正", detailText: "B種接地抵抗値測定と是正工事を実施", defaultText: "B種接地是正" },
  { code: "GROUND_C", name: "C種接地是正", detailText: "C種接地抵抗値測定と是正工事を実施", defaultText: "C種接地是正" },
];

const DEFAULT_SCHEDULE_PROCEDURE_TEMPLATES: ScheduleProcedureTemplate[] = [
  {
    id: "proc_kouatsu_standard",
    name: "高圧ケーブル交換（標準段取り）",
    createdAt: "system",
    workCodes: ["KOUATSU_CABLE"],
    steps: [
      { id: "step_prepare", label: "事前準備", durationMinutes: 90, outage: false, note: "資材搬入・KY・停電前チェック" },
      { id: "step_shutdown", label: "停電切替", durationMinutes: 60, outage: true, note: "停電開始・安全確認" },
      { id: "step_replace", label: "高圧ケーブル交換", durationMinutes: 240, outage: true, note: "既設撤去・新設・端末処理" },
      { id: "step_test", label: "絶縁・耐圧試験", durationMinutes: 90, outage: true, note: "試験・記録採取" },
      { id: "step_recover", label: "復電・最終確認", durationMinutes: 60, outage: false, note: "復電・巡回確認・引継ぎ" },
    ],
  },
  {
    id: "proc_pas_ugs_standard",
    name: "PAS/UGS更新（標準段取り）",
    createdAt: "system",
    workCodes: ["PAS", "UGS"],
    steps: [
      { id: "step_prepare", label: "事前準備", durationMinutes: 60, outage: false, note: "作業動線確保・保安体制確認" },
      { id: "step_shutdown", label: "停電切替", durationMinutes: 45, outage: true, note: "停電開始・絶縁確認" },
      { id: "step_ugs", label: "UGS交換", durationMinutes: 120, outage: true, note: "UGS更新・端末処理" },
      { id: "step_pas", label: "PAS交換", durationMinutes: 120, outage: true, note: "PAS更新・動作確認" },
      { id: "step_recover", label: "復電・最終確認", durationMinutes: 45, outage: false, note: "復電・確認・報告" },
    ],
  },
  {
    id: "proc_ground_standard",
    name: "接地是正（標準段取り）",
    createdAt: "system",
    workCodes: ["GROUND_A", "GROUND_B", "GROUND_C"],
    steps: [
      { id: "step_prepare", label: "事前準備", durationMinutes: 60, outage: false, note: "測定計画・安全確認" },
      { id: "step_measure", label: "接地測定", durationMinutes: 90, outage: true, note: "接地抵抗測定" },
      { id: "step_improve", label: "是正作業", durationMinutes: 180, outage: true, note: "接地改修・再測定" },
      { id: "step_finalize", label: "復旧・報告", durationMinutes: 45, outage: false, note: "復旧・記録提出" },
    ],
  },
];

const CSV_WORK_COLUMN_ALIASES: Record<WorkCode, string[]> = {
  KOUATSU_CABLE: ["flag_kouatsu_cable", "高圧ケーブル交換", "高圧ケーブル切替", "高圧ケーブル", "kouatsu_cable"],
  UGS: ["flag_ugs", "UGS交換", "ugs"],
  PAS: ["flag_pas", "PAS交換", "pas"],
  GROUND_A: ["flag_ground_a", "A種接地是正", "ground_a", "a種接地是正"],
  GROUND_B: ["flag_ground_b", "B種接地是正", "ground_b", "b種接地是正"],
  GROUND_C: ["flag_ground_c", "C種接地是正", "ground_c", "c種接地是正"],
};

const CSV_PROJECT_FIELD_ALIASES = {
  projectId: ["project_id", "projectid", "案件ID", "案件id", "物件ID", "物件id", "pj_id"],
  propertyName: ["property_name", "propertyname", "物件名", "案件名", "建物名", "施設名"],
  propertyAddress: ["property_address", "propertyaddress", "住所", "所在地", "物件住所", "工事場所"],
  titleSubject: ["title_subject", "titlesubject", "件名", "工事件名", "工事名", "タイトル"],
  workDateStart: ["work_date_start", "workdatestart", "work_date_main", "工事開始日", "工事日開始", "工事日"],
  workDateEnd: ["work_date_end", "workdateend", "工事終了日", "工事日終了"],
  outageDateStart: ["outage_date_start", "outagedatestart", "outage_date", "停電開始日", "停電日", "停電日開始"],
  outageDateEnd: ["outage_date_end", "outagedateend", "停電終了日", "停電日終了"],
  outageTimeStart: ["outage_time_start", "outagetimestart", "work_time_start", "停電開始時間", "停電開始時刻"],
  outageTimeEnd: ["outage_time_end", "outagetimeend", "work_time_end", "停電終了時間", "停電終了時刻"],
  outageEnabled: ["outage_enabled", "停電あり", "停電有無", "停電有", "停電バー表示"],
  noteSpecial: ["note_special", "特記事項", "備考", "メモ"],
  noteApprovalExtra: ["note_approval_extra", "承認事項追記", "注意事項", "ご承認いただきたい事項追記"],
  coverRecipientSuffix: ["cover_recipient_suffix", "表紙宛名", "宛名", "宛先末尾"],
  pdfTemplateId: ["pdf_template_id", "pdf_template", "pdf_format", "PDFフォーマット", "様式テンプレート"],
  pdfCompanyName: ["pdf_company_name", "会社名", "発注者会社名"],
  pdfTeam: ["pdf_team", "技術チーム", "部署", "事業所"],
  pdfContactPerson: ["pdf_contact_person", "担当者", "担当者名"],
  pdfAddress: ["pdf_address", "連絡先住所", "住所連絡先", "会社住所"],
  pdfEmail: ["pdf_email", "連絡先メール", "email", "メール"],
  pdfTel: ["pdf_tel", "連絡先TEL", "tel", "電話番号"],
  pdfFax: ["pdf_fax", "連絡先FAX", "fax"],
  workList: ["工事項目", "作業項目", "selected_work_codes", "selected_works"],
  photoSlotALabel: ["photo_slot_a_label", "写真Aラベル"],
  photoSlotBLabel: ["photo_slot_b_label", "写真Bラベル"],
  photoSlotCLabel: ["photo_slot_c_label", "写真Cラベル"],
  photoSlotDLabel: ["photo_slot_d_label", "写真Dラベル"],
  layoutPhotoSlotALabel: ["layout_photo_slot_a_label", "配置図写真Aラベル"],
  layoutPhotoSlotBLabel: ["layout_photo_slot_b_label", "配置図写真Bラベル"],
  layoutPhotoSlotCLabel: ["layout_photo_slot_c_label", "配置図写真Cラベル"],
  layoutPhotoSlotDLabel: ["layout_photo_slot_d_label", "配置図写真Dラベル"],
} as const;

const CSV_HEADER_JA_LABELS: Record<string, string> = {
  project_id: "案件ID",
  property_name: "物件名",
  property_address: "住所",
  title_subject: "件名",
  work_date_start: "工事開始日",
  work_date_end: "工事終了日",
  outage_date_start: "停電開始日",
  outage_date_end: "停電終了日",
  outage_time_start: "停電開始時間",
  outage_time_end: "停電終了時間",
  outage_enabled: "停電あり",
  note_special: "特記事項",
  note_approval_extra: "承認事項追記",
  pdf_template_id: "PDFフォーマット",
  pdf_company_name: "会社名",
  pdf_team: "技術チーム",
  pdf_contact_person: "担当者",
  pdf_address: "連絡先住所",
  pdf_email: "連絡先メール",
  pdf_tel: "連絡先TEL",
  pdf_fax: "連絡先FAX",
  photo_slot_a_label: "写真Aラベル",
  photo_slot_b_label: "写真Bラベル",
  photo_slot_c_label: "写真Cラベル",
  photo_slot_d_label: "写真Dラベル",
  layout_photo_slot_a_label: "配置図写真Aラベル",
  layout_photo_slot_b_label: "配置図写真Bラベル",
  layout_photo_slot_c_label: "配置図写真Cラベル",
  layout_photo_slot_d_label: "配置図写真Dラベル",
};

function getCsvHeaderLabel(header: string): string {
  const key = sanitizeCsvHeader(header).toLowerCase();
  return CSV_HEADER_JA_LABELS[key] || sanitizeCsvHeader(header);
}

const TEMPLATE_SCOPE_META: Record<
  TemplateScope,
  { cardLabel: string; title: string; shortHelp: string; copyLabel: string }
> = {
  schedule: {
    cardLabel: "PDF3",
    title: "工事概要・工程表",
    shortHelp: "工程行の並び・時間帯をまとめて保存して再利用できます",
    copyLabel: "この案件へ引用",
  },
  detailPhotos: {
    cardLabel: "PDF4",
    title: "工事詳細説明（参考写真）",
    shortHelp: "写真ラベルと写真セットをテンプレートとして再利用できます",
    copyLabel: "この案件へ引用",
  },
  relatedParties: {
    cardLabel: "PDF6",
    title: "施工体制表・緊急連絡体制表",
    shortHelp: "関係各社の連絡先構成をテンプレートとして使い回せます",
    copyLabel: "この案件へ引用",
  },
  layout: {
    cardLabel: "PDF7",
    title: "配置図・写真",
    shortHelp: "配置図画像と写真セットをテンプレート化できます",
    copyLabel: "この案件へ引用",
  },
};

const PDF_TEMPLATE_PRESETS: PdfTemplatePreset[] = [
  {
    id: "standard",
    label: "標準（現行）",
    description: "現在の施工計画書フォーマットです。",
    coverKicker: "施工計画書自動発行ツール",
    coverTeamLabel: "技術チーム",
    coverOfficeLabel: "技術設計グループ",
    tocItems: ["工事概要", "工事詳細説明", "ご承認いただきたい事項", "施工体制表", "緊急連絡体制表"],
    sectionOverview: "工事概要",
    sectionDetail: "工事詳細説明",
    sectionApproval: "ご承認いただきたい事項",
    sectionOrganization: "施工体制表",
    sectionEmergency: "緊急連絡体制表",
  },
  {
    id: "kansai",
    label: "関西向け",
    description: "関西案件向けの表記に合わせたフォーマットです。",
    coverKicker: "施工計画書（関西向け）",
    coverTeamLabel: "部署・事業所",
    coverOfficeLabel: "部署・事業所",
    tocItems: ["工事概要", "工事詳細説明", "承認事項", "施工体制表", "緊急連絡体制"],
    sectionOverview: "工事概要",
    sectionDetail: "工事詳細説明",
    sectionApproval: "承認事項",
    sectionOrganization: "施工体制表",
    sectionEmergency: "緊急連絡体制",
  },
  {
    id: "night",
    label: "深夜停電向け",
    description: "深夜作業・停電帯を強調するフォーマットです。",
    coverKicker: "施工計画書（深夜停電対応）",
    coverTeamLabel: "技術チーム",
    coverOfficeLabel: "技術設計グループ",
    tocItems: ["工事概要（深夜作業）", "工事詳細説明", "承認事項", "施工体制表", "緊急連絡体制表"],
    sectionOverview: "工事概要（深夜作業）",
    sectionDetail: "工事詳細説明",
    sectionApproval: "承認事項",
    sectionOrganization: "施工体制表",
    sectionEmergency: "緊急連絡体制表",
  },
];

const PDF_TEMPLATE_PRESET_MAP: Record<PdfTemplateId, PdfTemplatePreset> = {
  standard: PDF_TEMPLATE_PRESETS[0],
  kansai: PDF_TEMPLATE_PRESETS[1],
  night: PDF_TEMPLATE_PRESETS[2],
};

const PARTY_COMPANY_TEMPLATE_PRESETS: Record<RelatedPartyKey, PartyCompanyTemplatePreset[]> = {
  owner: [
    { id: "owner_a_den", label: "A電（発注者）", title: "発注者", company: "A電", person: "設備管理担当", office: "設備管理部", tel: "03-1111-2222" },
    { id: "owner_rezil", label: "REZIL（発注者）", title: "発注者", company: "REZIL", person: "計画担当", office: "建物管理部", tel: "03-2222-3333" },
  ],
  utility: [
    { id: "utility_tepco", label: "東京電力PG", title: "電力会社", company: "東京電力パワーグリッド", person: "配電保安担当", office: "○○支社", tel: "0120-995-007" },
    { id: "utility_hepco", label: "北海道電力NW", title: "電力会社", company: "北海道電力ネットワーク", person: "配電担当", office: "○○営業所", tel: "0120-060-134" },
  ],
  contractor: [
    { id: "contractor_sanriku", label: "三陸組（施工者）", title: "施工者", company: "三陸組", person: "現場責任者", office: "工事部", tel: "090-1111-2222" },
    { id: "contractor_adenkoji", label: "A電工事（施工者）", title: "施工者", company: "A電工事", person: "工事担当", office: "施工管理課", tel: "090-3333-4444" },
  ],
  management: [
    { id: "management_union", label: "管理組合", title: "管理組合・管理会社", company: "管理組合", person: "理事長", office: "管理組合事務局", tel: "03-5555-6666" },
    { id: "management_company", label: "管理会社", title: "管理組合・管理会社", company: "管理会社", person: "管理担当", office: "フロント課", tel: "03-6666-7777" },
  ],
  residents: [
    { id: "residents_all", label: "居住者さま", title: "居住者", company: "居住者さま", person: "", office: "", tel: "" },
    { id: "residents_board", label: "理事会", title: "居住者", company: "理事会", person: "理事会担当", office: "", tel: "" },
  ],
};

const EMPTY_PARTY_TEMPLATE_SELECTIONS: Record<RelatedPartyKey, string> = {
  owner: "",
  utility: "",
  contractor: "",
  management: "",
  residents: "",
};

function createEmptyPartyCompanyTemplates(): Record<RelatedPartyKey, PartyCompanyTemplatePreset[]> {
  return {
    owner: [],
    utility: [],
    contractor: [],
    management: [],
    residents: [],
  };
}

function normalizePartyCompanyTemplate(value: unknown): PartyCompanyTemplatePreset | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const source = value as Partial<PartyCompanyTemplatePreset>;
  const id = typeof source.id === "string" ? source.id.trim() : "";
  const label = typeof source.label === "string" ? source.label.trim() : "";
  const title = typeof source.title === "string" ? source.title.trim() : "";
  const company = typeof source.company === "string" ? source.company.trim() : "";
  const person = typeof source.person === "string" ? source.person.trim() : "";
  const office = typeof source.office === "string" ? source.office.trim() : "";
  const tel = typeof source.tel === "string" ? source.tel.trim() : "";
  if (!id || !label) {
    return null;
  }
  return {
    id,
    label,
    title,
    company,
    person,
    office,
    tel,
  };
}

function normalizePartyCompanyTemplateMap(value: unknown): Record<RelatedPartyKey, PartyCompanyTemplatePreset[]> {
  const next = createEmptyPartyCompanyTemplates();
  if (!value || typeof value !== "object") {
    return next;
  }
  const source = value as Partial<Record<RelatedPartyKey, unknown>>;
  (Object.keys(next) as RelatedPartyKey[]).forEach((key) => {
    const list = Array.isArray(source[key]) ? source[key] : [];
    next[key] = list
      .map((item) => normalizePartyCompanyTemplate(item))
      .filter((item): item is PartyCompanyTemplatePreset => item !== null);
  });
  return next;
}

function UiIcon({ name }: { name: UiIconName }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "upload":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M10 13V4m0 0-3 3m3-3 3 3M4 14v2h12v-2" /></svg>;
    case "plus":
    case "addRow":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M10 4v12M4 10h12" /></svg>;
    case "menu":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M3 5h14M3 10h14M3 15h14" /></svg>;
    case "settings":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M10 3v2m0 10v2m7-7h-2M5 10H3m11.95-4.95-1.4 1.4M6.45 13.55l-1.4 1.4m0-9.9 1.4 1.4m8.1 8.1 1.4 1.4M13 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>;
    case "cursor":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M4 3v13l3-3 2 4 2-1-2-4h4z" /></svg>;
    case "shapeLine":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M4 14 16 6" /></svg>;
    case "shapeArrow":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="m4 14 9-9m0 0h-4m4 0v4" /></svg>;
    case "shapeRect":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><rect {...common} x="4" y="5" width="12" height="10" rx="2" ry="2" /></svg>;
    case "shapePolygon":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M10 3 16 8 13.5 16h-7L4 8z" /></svg>;
    case "shapeText":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M4 5h12M10 5v10m-3 0h6" /></svg>;
    case "magnet":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M6 4v6a4 4 0 1 0 8 0V4m-8 0h3m2 0h3" /></svg>;
    case "login":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M8 5H4v10h4m4-7 3 2-3 2m3-2H7" /></svg>;
    case "logout":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M12 5h4v10h-4m-4-7-3 2 3 2m-3-2h8" /></svg>;
    case "userPlus":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M13 16v-1a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v1m5-8a3 3 0 1 0 0-6 3 3 0 0 0 0 6m7 1v4m-2-2h4" /></svg>;
    case "send":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="m3 10 13-6-3 12-3-5-7-1Z" /></svg>;
    case "check":
    case "apply":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="m4 10 4 4 8-8" /></svg>;
    case "undo":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M7 7H3v4m0-4 3 3a6 6 0 1 0 1-5" /></svg>;
    case "save":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M4 4h10l2 2v10H4zM7 4v5h6V4M7 16v-4h6v4" /></svg>;
    case "history":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M3 10a7 7 0 1 0 2-5M3 5v4h4M10 7v4l3 2" /></svg>;
    case "delete":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M4 6h12M8 6V4h4v2m-6 0 1 10h6l1-10" /></svg>;
    case "copy":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M7 7h9v9H7zM4 13H3V4h9v1" /></svg>;
    case "arrowLeft":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M12 4 6 10l6 6M6 10h10" /></svg>;
    case "arrowRight":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="m8 4 6 6-6 6m6-6H4" /></svg>;
    case "pdf":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M5 3h7l3 3v11H5zM12 3v3h3M7 13h1.4a1.3 1.3 0 0 0 0-2.6H7V15m3-2h2.4m-2.4 2v-4.6h2.6M14 15v-4.6h2.4" /></svg>;
    case "refresh":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M16 10a6 6 0 1 1-1.5-4M16 4v4h-4" /></svg>;
    case "up":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="m5 12 5-5 5 5" /></svg>;
    case "down":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="m5 8 5 5 5-5" /></svg>;
    case "photo":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M3 5h4l1-2h4l1 2h4v11H3zM6 13l2-2 2 2 3-3 2 3" /></svg>;
    case "clear":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="m5 5 10 10M15 5 5 15" /></svg>;
    case "lock":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M5 9h10v8H5zM7 9V7a3 3 0 0 1 6 0v2" /></svg>;
    case "template":
      return <svg viewBox="0 0 20 20" aria-hidden="true"><path {...common} d="M4 4h12v12H4zM4 8h12M8 8v8" /></svg>;
    default:
      return <svg viewBox="0 0 20 20" aria-hidden="true"><circle {...common} cx="10" cy="10" r="6" /></svg>;
  }
}

function CardPreview({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="card-preview">
      <summary>
        <span className="card-preview-title">このカードの出力プレビュー</span>
        <span className="card-preview-hint">{title}</span>
      </summary>
      <div className="card-preview-canvas">{children}</div>
    </details>
  );
}

function LayoutAnnotatedImage({
  imageUrl,
  annotations,
  alt,
}: {
  imageUrl: string;
  annotations: LayoutAnnotation[];
  alt: string;
}) {
  if (!imageUrl) {
    return <span>画像を設定すると表示されます</span>;
  }
  return (
    <div className="annotated-layout">
      <img src={imageUrl} alt={alt} loading="lazy" decoding="async" />
      <svg
        className="annotated-layout-svg"
        viewBox={`0 0 ${LAYOUT_CANVAS_SIZE} ${LAYOUT_CANVAS_SIZE}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {annotations.map((annotation) => {
          if (annotation.visible === false) {
            return null;
          }
          const bounds = getAnnotationBounds(annotation);
          const rotation = annotation.rotation ?? 0;
          if (annotation.type === "arrow") {
            return (
              <g
                key={annotation.id}
                transform={rotation ? `rotate(${rotation} ${bounds.centerX} ${bounds.centerY})` : undefined}
              >
                <line
                  x1={annotation.fromX}
                  y1={annotation.fromY}
                  x2={annotation.toX}
                  y2={annotation.toY}
                  stroke={annotation.color}
                  strokeWidth={annotation.strokeWidth}
                  strokeLinecap="round"
                />
                {annotation.arrowHead !== false ? (
                  <polygon
                    points={buildArrowHeadPoints(annotation.fromX, annotation.fromY, annotation.toX, annotation.toY)}
                    fill={annotation.color}
                  />
                ) : null}
              </g>
            );
          }
          if (annotation.type === "rect") {
            return (
              <rect
                key={annotation.id}
                x={annotation.x}
                y={annotation.y}
                width={annotation.width}
                height={annotation.height}
                fill={annotation.fillColor || DEFAULT_ANNOTATION_FILL_COLOR}
                fillOpacity={normalizeFillOpacity(annotation.fillOpacity, 0)}
                stroke={annotation.color}
                strokeWidth={annotation.strokeWidth}
                rx={6}
                ry={6}
                transform={rotation ? `rotate(${rotation} ${bounds.centerX} ${bounds.centerY})` : undefined}
              />
            );
          }
          if (annotation.type === "polygon") {
            return (
              <polygon
                key={annotation.id}
                points={buildRegularPolygonPoints(annotation.x, annotation.y, annotation.width, annotation.height, annotation.sides)}
                fill={annotation.fillColor || DEFAULT_ANNOTATION_FILL_COLOR}
                fillOpacity={normalizeFillOpacity(annotation.fillOpacity, 0)}
                stroke={annotation.color}
                strokeWidth={annotation.strokeWidth}
                strokeLinejoin="round"
                transform={rotation ? `rotate(${rotation} ${bounds.centerX} ${bounds.centerY})` : undefined}
              />
            );
          }
          const textStrokeWidth = normalizeTextStrokeWidth(annotation.textStrokeWidth, DEFAULT_TEXT_STROKE_WIDTH);
          const textStrokeColor = textStrokeWidth > 0
            ? normalizeAnnotationColor(annotation.textStrokeColor || DEFAULT_TEXT_STROKE_COLOR)
            : "transparent";
          return (
            <text
              key={annotation.id}
              x={annotation.x}
              y={annotation.y}
              fill={annotation.color}
              fontSize={annotation.fontSize}
              fontWeight={annotation.fontWeight}
              fontFamily={annotation.fontFamily || DEFAULT_TEXT_FONT_FAMILY}
              textAnchor={annotation.textAlign === "center" ? "middle" : annotation.textAlign === "right" ? "end" : "start"}
              transform={rotation ? `rotate(${rotation} ${annotation.x} ${annotation.y})` : undefined}
              style={{ paintOrder: "stroke", stroke: textStrokeColor, strokeWidth: textStrokeWidth }}
            >
              {String(annotation.text || "注記").split("\n").map((line, index) => (
                <tspan key={`${annotation.id}_line_${index}`} x={annotation.x} dy={index === 0 ? 0 : annotation.fontSize * 1.25}>
                  {line || " "}
                </tspan>
              ))}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function UploadDropZone({
  imageUrl,
  annotations,
  alt,
  onFileSelect,
  onFileDrop,
  onDeleteImage,
}: {
  imageUrl: string;
  annotations: LayoutAnnotation[];
  alt: string;
  onFileSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onFileDrop: (file: File) => void;
  onDeleteImage?: () => void;
}) {
  const [dragActive, setDragActive] = useState(false);

  const handleDragOver = (event: ReactDragEvent<HTMLLabelElement | HTMLDivElement>) => {
    event.preventDefault();
    if (!dragActive) {
      setDragActive(true);
    }
  };

  const handleDragLeave = (event: ReactDragEvent<HTMLLabelElement | HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (event: ReactDragEvent<HTMLLabelElement | HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      onFileDrop(file);
    }
  };

  if (!imageUrl) {
    return (
      <label
        className={`photo-preview file-drop upload-dropzone ${dragActive ? "is-drag-active" : "is-empty"}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="upload-dropzone-empty">
          <span className="upload-dropzone-icon">
            <UiIcon name="upload" />
          </span>
          <p className="upload-dropzone-title">ここをクリックして画像をアップロード</p>
          <p className="upload-dropzone-meta">PNG/JPG・最大10MB</p>
        </div>
        {dragActive ? <p className="upload-dropzone-drag-hint">ここにドロップ</p> : null}
        <input type="file" accept="image/png,image/jpeg,image/jpg" onChange={onFileSelect} />
      </label>
    );
  }

  return (
    <div
      className={`photo-preview upload-dropzone ${dragActive ? "is-drag-active" : "is-filled"}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <LayoutAnnotatedImage imageUrl={imageUrl} annotations={annotations} alt={alt} />
      <div className="upload-dropzone-actions" onClick={(event) => event.stopPropagation()}>
        <label className="upload-mini-btn upload-mini-btn-subtle">
          画像を変更
          <input type="file" accept="image/png,image/jpeg,image/jpg" onChange={onFileSelect} />
        </label>
        {onDeleteImage ? (
          <button type="button" className="upload-mini-btn upload-mini-btn-danger" onClick={onDeleteImage}>
            削除
          </button>
        ) : null}
      </div>
      {dragActive ? <p className="upload-dropzone-drag-hint">ここにドロップ</p> : null}
    </div>
  );
}

const JP_WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function isPdfTemplateId(value: unknown): value is PdfTemplateId {
  return value === "standard" || value === "kansai" || value === "night";
}

function normalizePdfTemplateId(value: unknown): PdfTemplateId {
  if (typeof value !== "string") {
    return "standard";
  }
  const token = value.trim().toLowerCase();
  if (isPdfTemplateId(token)) {
    return token;
  }
  if (token.includes("kansai") || token.includes("関西")) {
    return "kansai";
  }
  if (token.includes("night") || token.includes("深夜")) {
    return "night";
  }
  return "standard";
}

function createPhotoSlots(labels?: string[]): PhotoSlots {
  const defaults = labels?.length
    ? labels
    : ["写真A（着工前）", "写真B（施工中）", "写真C（施工後）", "写真D（その他）"];
  return defaults.map((label, idx) => ({
    id: uid(`photo_${idx + 1}`),
    label,
    dataUrl: "",
    layoutAnnotations: [],
    layoutAnnotationsV2: [],
  }));
}

function cloneScheduleRows(rows: ScheduleRow[]): ScheduleRow[] {
  return rows.map((row) => ({ ...row, id: uid("row") }));
}

function cloneProcedureTemplateSteps(steps: ScheduleProcedureTemplateStep[]): ScheduleProcedureTemplateStep[] {
  return steps.map((step) => ({ ...step, id: uid("proc_step") }));
}

function cloneScheduleProcedureTemplates(templates: ScheduleProcedureTemplate[]): ScheduleProcedureTemplate[] {
  return templates.map((template) => ({
    ...template,
    workCodes: [...template.workCodes],
    steps: template.steps.map((step) => ({ ...step })),
  }));
}

function normalizeScheduleProcedureTemplates(value: unknown): ScheduleProcedureTemplate[] {
  if (!Array.isArray(value)) {
    return cloneScheduleProcedureTemplates(DEFAULT_SCHEDULE_PROCEDURE_TEMPLATES);
  }
  const normalized = value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const source = item as Partial<ScheduleProcedureTemplate>;
      const id = typeof source.id === "string" ? source.id.trim() : "";
      const name = typeof source.name === "string" ? source.name.trim() : "";
      const createdAt = typeof source.createdAt === "string" ? source.createdAt : new Date().toISOString();
      const workCodes = Array.isArray(source.workCodes)
        ? source.workCodes.filter((code): code is WorkCode => typeof code === "string" && WORK_MASTER.some((work) => work.code === code))
        : [];
      const steps = Array.isArray(source.steps)
        ? source.steps
          .map((step, index) => {
            if (!step || typeof step !== "object") {
              return null;
            }
            const stepSource = step as Partial<ScheduleProcedureTemplateStep>;
            const label = typeof stepSource.label === "string" ? stepSource.label.trim() : "";
            if (!label) {
              return null;
            }
            const durationRaw = Number(stepSource.durationMinutes);
            const durationMinutes = Number.isFinite(durationRaw)
              ? clamp(Math.round(durationRaw), 30, DAY_TOTAL_MINUTES * 30)
              : 60;
            return {
              id: typeof stepSource.id === "string" && stepSource.id.trim() ? stepSource.id.trim() : uid(`proc_step_${index + 1}`),
              label,
              durationMinutes,
              outage: Boolean(stepSource.outage),
              note: typeof stepSource.note === "string" ? stepSource.note.trim() : "",
            } as ScheduleProcedureTemplateStep;
          })
          .filter((step): step is ScheduleProcedureTemplateStep => step !== null)
        : [];
      if (!id || !name || !steps.length) {
        return null;
      }
      return {
        id,
        name,
        createdAt,
        workCodes,
        steps,
      } as ScheduleProcedureTemplate;
    })
    .filter((template): template is ScheduleProcedureTemplate => template !== null);
  if (!normalized.length) {
    return cloneScheduleProcedureTemplates(DEFAULT_SCHEDULE_PROCEDURE_TEMPLATES);
  }
  return normalized;
}

function clonePhotoSlots(slots: PhotoSlots): PhotoSlots {
  return slots.map((slot) => ({
    ...slot,
    id: uid("photo"),
    layoutAnnotations: cloneLayoutAnnotations(slot.layoutAnnotations || []),
    layoutAnnotationsV2: cloneLayoutAnnotationsV2(slot.layoutAnnotationsV2 || []),
  }));
}

function cloneLayoutAnnotations(annotations: LayoutAnnotation[]): LayoutAnnotation[] {
  return annotations.map((annotation) => ({ ...annotation }));
}

function cloneLayoutAnnotationsV2(annotations: LayoutAnnotationV2[]): LayoutAnnotationV2[] {
  return annotations.map((annotation) => ({
    ...annotation,
    transform: { ...annotation.transform },
    style: { ...annotation.style },
    ...(annotation.type === "arrow" ? { points: [...annotation.points] as [number, number, number, number] } : {}),
  }));
}

function cloneRelatedParties(parties: Project["relatedParties"]): Project["relatedParties"] {
  return {
    owner: { ...parties.owner },
    utility: { ...parties.utility },
    contractor: { ...parties.contractor },
    management: { ...parties.management },
    residents: { ...parties.residents },
  };
}

function createDefaultRelatedParties(
  seed?: { [K in keyof Project["relatedParties"]]?: Partial<RelatedParty> },
): Project["relatedParties"] {
  return {
    owner: {
      enabled: seed?.owner?.enabled ?? true,
      title: seed?.owner?.title ?? "発注者",
      company: seed?.owner?.company ?? "",
      person: seed?.owner?.person ?? "",
      office: seed?.owner?.office ?? "",
      tel: seed?.owner?.tel ?? "",
    },
    utility: {
      enabled: seed?.utility?.enabled ?? true,
      title: seed?.utility?.title ?? "電力会社",
      company: seed?.utility?.company ?? "",
      person: seed?.utility?.person ?? "",
      office: seed?.utility?.office ?? "",
      tel: seed?.utility?.tel ?? "",
    },
    contractor: {
      enabled: seed?.contractor?.enabled ?? true,
      title: seed?.contractor?.title ?? "施工者",
      company: seed?.contractor?.company ?? "",
      person: seed?.contractor?.person ?? "",
      office: seed?.contractor?.office ?? "",
      tel: seed?.contractor?.tel ?? "",
    },
    management: {
      enabled: seed?.management?.enabled ?? true,
      title: seed?.management?.title ?? "管理組合・管理会社",
      company: seed?.management?.company ?? "管理組合さま / 管理会社さま",
      person: seed?.management?.person ?? "",
      office: seed?.management?.office ?? "",
      tel: seed?.management?.tel ?? "",
    },
    residents: {
      enabled: seed?.residents?.enabled ?? true,
      title: seed?.residents?.title ?? "居住者",
      company: seed?.residents?.company ?? "居住者さま",
      person: seed?.residents?.person ?? "",
      office: seed?.residents?.office ?? "",
      tel: seed?.residents?.tel ?? "",
    },
  };
}

function seedTestEditorUsers(existingUsers: UserAccount[]): { nextUsers: UserAccount[]; addedCount: number } {
  if (!Array.isArray(existingUsers) || existingUsers.length === 0) {
    return { nextUsers: existingUsers, addedCount: 0 };
  }
  const existingEmails = new Set(existingUsers.map((user) => user.email.trim().toLowerCase()));
  const now = new Date().toISOString();
  const additions: UserAccount[] = [];

  TEST_EDITOR_USER_PRESETS.forEach((preset) => {
    if (existingEmails.has(preset.email.toLowerCase())) {
      return;
    }
    additions.push({
      id: preset.id,
      name: preset.name,
      email: preset.email,
      password: preset.password,
      role: "editor",
      active: true,
      approvalStatus: "approved",
      approvedAt: now,
      approvedById: "system",
      approvedByName: "システム",
      createdAt: now,
      createdById: "system",
      createdByName: "システム",
    });
  });

  if (!additions.length) {
    return { nextUsers: existingUsers, addedCount: 0 };
  }
  return { nextUsers: [...additions, ...existingUsers], addedCount: additions.length };
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampCanvasCoord(value: number): number {
  return clamp(value, 0, LAYOUT_CANVAS_SIZE);
}

function normalizeStrokeWidth(value: unknown, fallback = DEFAULT_ANNOTATION_STROKE_WIDTH): number {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return clamp(Math.round(num), 1, 16);
}

function normalizeTextStrokeWidth(value: unknown, fallback = DEFAULT_TEXT_STROKE_WIDTH): number {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return clamp(Math.round(num), 0, 12);
}

function normalizeFillOpacity(value: unknown, fallback = DEFAULT_ANNOTATION_FILL_OPACITY): number {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return clamp(num, 0, 1);
}

function normalizePolygonSides(value: unknown, fallback = 6): number {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return clamp(Math.round(num), 3, 12);
}

function normalizeFontSize(value: unknown, fallback = 24): number {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return clamp(Math.round(num), 10, 72);
}

function normalizeFontWeight(value: unknown, fallback = 700): number {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return clamp(Math.round(num), 300, 900);
}

function normalizeTextAlign(value: unknown): LayoutTextAlign {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "center" || raw === "right") {
    return raw;
  }
  return "left";
}

function normalizeFontFamily(value: unknown): string {
  const raw = String(value ?? "").trim();
  const matched = LAYOUT_TEXT_FONT_OPTIONS.find((option) => option.value === raw);
  return matched?.value || DEFAULT_TEXT_FONT_FAMILY;
}

function parseNumericInput(value: string, fallback: number): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeRotation(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return 0;
  }
  let normalized = num % 360;
  if (normalized > 180) {
    normalized -= 360;
  } else if (normalized < -180) {
    normalized += 360;
  }
  return normalized;
}

function normalizeAnnotationColor(value: unknown): string {
  const raw = String(value ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : DEFAULT_ANNOTATION_COLOR;
}

function normalizeAnnotationVisible(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  const raw = String(value ?? "").toLowerCase().trim();
  if (raw === "false" || raw === "0" || raw === "off") {
    return false;
  }
  return true;
}

function normalizeAnnotationLocked(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  const raw = String(value ?? "").toLowerCase().trim();
  return raw === "true" || raw === "1" || raw === "on" || raw === "locked";
}

function rotatePointAroundCenter(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = x - centerX;
  const dy = y - centerY;
  return {
    x: centerX + dx * cos - dy * sin,
    y: centerY + dx * sin + dy * cos,
  };
}

function getAnnotationBounds(annotation: LayoutAnnotation): { x: number; y: number; width: number; height: number; centerX: number; centerY: number } {
  if (annotation.type === "arrow") {
    const x = Math.min(annotation.fromX, annotation.toX);
    const y = Math.min(annotation.fromY, annotation.toY);
    const width = Math.max(10, Math.abs(annotation.toX - annotation.fromX));
    const height = Math.max(10, Math.abs(annotation.toY - annotation.fromY));
    return { x, y, width, height, centerX: x + width / 2, centerY: y + height / 2 };
  }
  if (annotation.type === "rect") {
    return {
      x: annotation.x,
      y: annotation.y,
      width: Math.max(8, annotation.width),
      height: Math.max(8, annotation.height),
      centerX: annotation.x + annotation.width / 2,
      centerY: annotation.y + annotation.height / 2,
    };
  }
  if (annotation.type === "polygon") {
    return {
      x: annotation.x,
      y: annotation.y,
      width: Math.max(8, annotation.width),
      height: Math.max(8, annotation.height),
      centerX: annotation.x + annotation.width / 2,
      centerY: annotation.y + annotation.height / 2,
    };
  }
  const lines = String(annotation.text || "注記").split("\n");
  const maxLineLength = lines.reduce((max, line) => Math.max(max, line.length), 1);
  const width = clamp(maxLineLength * annotation.fontSize * 0.62, 24, LAYOUT_CANVAS_SIZE);
  const height = clamp(lines.length * annotation.fontSize * 1.25, 14, 240);
  const x = annotation.textAlign === "center"
    ? annotation.x - width / 2
    : annotation.textAlign === "right"
      ? annotation.x - width
      : annotation.x;
  const y = annotation.y - height;
  return { x, y, width, height, centerX: x + width / 2, centerY: y + height / 2 };
}

function createDefaultLayoutAnnotationV2Transform(
  value?: Partial<LayoutAnnotationV2Transform> | null,
): LayoutAnnotationV2Transform {
  return {
    x: Number.isFinite(Number(value?.x)) ? Number(value?.x) : 0,
    y: Number.isFinite(Number(value?.y)) ? Number(value?.y) : 0,
    rotation: Number.isFinite(Number(value?.rotation)) ? Number(value?.rotation) : 0,
    scaleX: Number.isFinite(Number(value?.scaleX)) ? clamp(Number(value?.scaleX), 0.1, 10) : 1,
    scaleY: Number.isFinite(Number(value?.scaleY)) ? clamp(Number(value?.scaleY), 0.1, 10) : 1,
  };
}

function createDefaultLayoutAnnotationV2Style(
  value?: Partial<LayoutAnnotationV2Style> | null,
): LayoutAnnotationV2Style {
  return {
    stroke: normalizeAnnotationColor(value?.stroke),
    strokeWidth: normalizeStrokeWidth(value?.strokeWidth, DEFAULT_ANNOTATION_STROKE_WIDTH),
    fill: normalizeAnnotationColor(value?.fill || DEFAULT_ANNOTATION_FILL_COLOR),
    fillOpacity: normalizeFillOpacity(value?.fillOpacity, 0),
    textColor: normalizeAnnotationColor(value?.textColor),
    fontSize: normalizeFontSize(value?.fontSize, 26),
    fontWeight: normalizeFontWeight(value?.fontWeight, 700),
    fontFamily: normalizeFontFamily(value?.fontFamily),
    textStrokeColor: normalizeAnnotationColor(value?.textStrokeColor || DEFAULT_TEXT_STROKE_COLOR),
    textStrokeWidth: normalizeTextStrokeWidth(value?.textStrokeWidth, DEFAULT_TEXT_STROKE_WIDTH),
    textAlign: normalizeTextAlign(value?.textAlign),
  };
}

function applyV2TransformToPoint(
  x: number,
  y: number,
  transform: LayoutAnnotationV2Transform,
): { x: number; y: number } {
  const radians = (transform.rotation * Math.PI) / 180;
  const scaledX = x * transform.scaleX;
  const scaledY = y * transform.scaleY;
  const rotatedX = scaledX * Math.cos(radians) - scaledY * Math.sin(radians);
  const rotatedY = scaledX * Math.sin(radians) + scaledY * Math.cos(radians);
  return {
    x: clampCanvasCoord(rotatedX + transform.x),
    y: clampCanvasCoord(rotatedY + transform.y),
  };
}

function normalizeLayoutAnnotations(value: unknown): LayoutAnnotation[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const normalized: LayoutAnnotation[] = [];
  value.forEach((raw, index) => {
    if (!raw || typeof raw !== "object") {
      return;
    }
    const item = raw as Partial<LayoutAnnotation> & Record<string, unknown>;
    const id = item.id && String(item.id).trim() ? String(item.id) : uid(`anno_${index + 1}`);
    const color = normalizeAnnotationColor(item.color);
    const groupId = item.groupId && String(item.groupId).trim() ? String(item.groupId).trim() : undefined;
    const rotation = normalizeRotation(item.rotation);
    const name = item.name && String(item.name).trim() ? String(item.name).trim() : undefined;
    const visible = normalizeAnnotationVisible(item.visible);
    const locked = normalizeAnnotationLocked(item.locked);
    if (item.type === "arrow") {
      normalized.push({
        id,
        type: "arrow",
        color,
        groupId,
        rotation,
        name,
        visible,
        locked,
        fromX: clampCanvasCoord(Number(item.fromX ?? 0)),
        fromY: clampCanvasCoord(Number(item.fromY ?? 0)),
        toX: clampCanvasCoord(Number(item.toX ?? 0)),
        toY: clampCanvasCoord(Number(item.toY ?? 0)),
        strokeWidth: normalizeStrokeWidth(item.strokeWidth, DEFAULT_ANNOTATION_STROKE_WIDTH),
        arrowHead: item.arrowHead === undefined ? true : normalizeAnnotationVisible(item.arrowHead),
      });
      return;
    }
    if (item.type === "rect") {
      const x = clampCanvasCoord(Number(item.x ?? 0));
      const y = clampCanvasCoord(Number(item.y ?? 0));
      const width = clamp(Number(item.width ?? 0), 1, LAYOUT_CANVAS_SIZE);
      const height = clamp(Number(item.height ?? 0), 1, LAYOUT_CANVAS_SIZE);
      normalized.push({
        id,
        type: "rect",
        color,
        groupId,
        rotation,
        name,
        visible,
        locked,
        fillColor: normalizeAnnotationColor(item.fillColor || DEFAULT_ANNOTATION_FILL_COLOR),
        fillOpacity: normalizeFillOpacity(item.fillOpacity, 0),
        x,
        y,
        width,
        height,
        strokeWidth: normalizeStrokeWidth(item.strokeWidth, DEFAULT_ANNOTATION_STROKE_WIDTH),
      });
      return;
    }
    if (item.type === "polygon") {
      const x = clampCanvasCoord(Number(item.x ?? 0));
      const y = clampCanvasCoord(Number(item.y ?? 0));
      const width = clamp(Number(item.width ?? 0), 1, LAYOUT_CANVAS_SIZE);
      const height = clamp(Number(item.height ?? 0), 1, LAYOUT_CANVAS_SIZE);
      normalized.push({
        id,
        type: "polygon",
        color,
        groupId,
        rotation,
        name,
        visible,
        locked,
        fillColor: normalizeAnnotationColor(item.fillColor || DEFAULT_ANNOTATION_FILL_COLOR),
        fillOpacity: normalizeFillOpacity(item.fillOpacity, 0),
        x,
        y,
        width,
        height,
        sides: normalizePolygonSides(item.sides, 6),
        strokeWidth: normalizeStrokeWidth(item.strokeWidth, DEFAULT_ANNOTATION_STROKE_WIDTH),
      });
      return;
    }
    if (item.type === "text") {
      normalized.push({
        id,
        type: "text",
        color,
        groupId,
        rotation,
        name,
        visible,
        locked,
        x: clampCanvasCoord(Number(item.x ?? 0)),
        y: clampCanvasCoord(Number(item.y ?? 0)),
        text: String(item.text ?? "注記"),
        fontSize: normalizeFontSize(item.fontSize, 26),
        fontWeight: normalizeFontWeight(item.fontWeight, 700),
        fontFamily: normalizeFontFamily(item.fontFamily),
        textStrokeColor: normalizeAnnotationColor(item.textStrokeColor || DEFAULT_TEXT_STROKE_COLOR),
        textStrokeWidth: normalizeTextStrokeWidth(item.textStrokeWidth, DEFAULT_TEXT_STROKE_WIDTH),
        textAlign: normalizeTextAlign(item.textAlign),
      });
    }
  });
  return normalized;
}

function legacyLayoutAnnotationsToV2(annotations: LayoutAnnotation[]): LayoutAnnotationV2[] {
  return annotations.map((annotation) => {
    const rotation = normalizeRotation(annotation.rotation);
    if (annotation.type === "arrow") {
      return {
        id: annotation.id,
        type: "arrow",
        groupId: annotation.groupId,
        name: annotation.name,
        visible: normalizeAnnotationVisible(annotation.visible),
        locked: normalizeAnnotationLocked(annotation.locked),
        points: [annotation.fromX, annotation.fromY, annotation.toX, annotation.toY],
        arrowHead: annotation.arrowHead !== false,
        transform: createDefaultLayoutAnnotationV2Transform({ rotation }),
        style: createDefaultLayoutAnnotationV2Style({
          stroke: annotation.color,
          strokeWidth: annotation.strokeWidth,
          textColor: annotation.color,
        }),
      };
    }
    if (annotation.type === "rect") {
      return {
        id: annotation.id,
        type: "rect",
        groupId: annotation.groupId,
        name: annotation.name,
        visible: normalizeAnnotationVisible(annotation.visible),
        locked: normalizeAnnotationLocked(annotation.locked),
        x: annotation.x,
        y: annotation.y,
        width: annotation.width,
        height: annotation.height,
        transform: createDefaultLayoutAnnotationV2Transform({ rotation }),
        style: createDefaultLayoutAnnotationV2Style({
          stroke: annotation.color,
          strokeWidth: annotation.strokeWidth,
          fill: annotation.fillColor,
          fillOpacity: annotation.fillOpacity,
          textColor: annotation.color,
        }),
      };
    }
    if (annotation.type === "polygon") {
      return {
        id: annotation.id,
        type: "polygon",
        groupId: annotation.groupId,
        name: annotation.name,
        visible: normalizeAnnotationVisible(annotation.visible),
        locked: normalizeAnnotationLocked(annotation.locked),
        x: annotation.x,
        y: annotation.y,
        width: annotation.width,
        height: annotation.height,
        sides: normalizePolygonSides(annotation.sides, 6),
        transform: createDefaultLayoutAnnotationV2Transform({ rotation }),
        style: createDefaultLayoutAnnotationV2Style({
          stroke: annotation.color,
          strokeWidth: annotation.strokeWidth,
          fill: annotation.fillColor,
          fillOpacity: annotation.fillOpacity,
          textColor: annotation.color,
        }),
      };
    }
    return {
      id: annotation.id,
      type: "text",
      groupId: annotation.groupId,
      name: annotation.name,
      visible: normalizeAnnotationVisible(annotation.visible),
      locked: normalizeAnnotationLocked(annotation.locked),
      x: annotation.x,
      y: annotation.y,
      text: annotation.text,
      transform: createDefaultLayoutAnnotationV2Transform({ rotation }),
      style: createDefaultLayoutAnnotationV2Style({
        stroke: annotation.color,
        textColor: annotation.color,
        fontSize: annotation.fontSize,
        fontWeight: annotation.fontWeight,
        fontFamily: annotation.fontFamily,
        textStrokeColor: annotation.textStrokeColor,
        textStrokeWidth: annotation.textStrokeWidth,
        textAlign: annotation.textAlign,
      }),
    };
  });
}

function layoutAnnotationsV2ToLegacy(annotations: LayoutAnnotationV2[]): LayoutAnnotation[] {
  return annotations.map((annotation) => {
    if (annotation.type === "arrow") {
      const p1 = applyV2TransformToPoint(annotation.points[0], annotation.points[1], annotation.transform);
      const p2 = applyV2TransformToPoint(annotation.points[2], annotation.points[3], annotation.transform);
      return {
        id: annotation.id,
        type: "arrow",
        groupId: annotation.groupId,
        name: annotation.name,
        visible: normalizeAnnotationVisible(annotation.visible),
        locked: normalizeAnnotationLocked(annotation.locked),
        color: normalizeAnnotationColor(annotation.style.stroke),
        rotation: normalizeRotation(annotation.transform.rotation),
        fromX: p1.x,
        fromY: p1.y,
        toX: p2.x,
        toY: p2.y,
        strokeWidth: normalizeStrokeWidth(annotation.style.strokeWidth, DEFAULT_ANNOTATION_STROKE_WIDTH),
        arrowHead: annotation.arrowHead !== false,
      };
    }
    if (annotation.type === "rect") {
      const p1 = applyV2TransformToPoint(annotation.x, annotation.y, annotation.transform);
      const p2 = applyV2TransformToPoint(annotation.x + annotation.width, annotation.y, annotation.transform);
      const p3 = applyV2TransformToPoint(annotation.x, annotation.y + annotation.height, annotation.transform);
      const p4 = applyV2TransformToPoint(annotation.x + annotation.width, annotation.y + annotation.height, annotation.transform);
      const left = Math.min(p1.x, p2.x, p3.x, p4.x);
      const top = Math.min(p1.y, p2.y, p3.y, p4.y);
      const right = Math.max(p1.x, p2.x, p3.x, p4.x);
      const bottom = Math.max(p1.y, p2.y, p3.y, p4.y);
      return {
        id: annotation.id,
        type: "rect",
        groupId: annotation.groupId,
        name: annotation.name,
        visible: normalizeAnnotationVisible(annotation.visible),
        locked: normalizeAnnotationLocked(annotation.locked),
        color: normalizeAnnotationColor(annotation.style.stroke),
        rotation: normalizeRotation(annotation.transform.rotation),
        fillColor: normalizeAnnotationColor(annotation.style.fill || DEFAULT_ANNOTATION_FILL_COLOR),
        fillOpacity: normalizeFillOpacity(annotation.style.fillOpacity, 0),
        x: clampCanvasCoord(left),
        y: clampCanvasCoord(top),
        width: clamp(right - left, 1, LAYOUT_CANVAS_SIZE),
        height: clamp(bottom - top, 1, LAYOUT_CANVAS_SIZE),
        strokeWidth: normalizeStrokeWidth(annotation.style.strokeWidth, DEFAULT_ANNOTATION_STROKE_WIDTH),
      };
    }
    if (annotation.type === "polygon") {
      const p1 = applyV2TransformToPoint(annotation.x, annotation.y, annotation.transform);
      const p2 = applyV2TransformToPoint(annotation.x + annotation.width, annotation.y, annotation.transform);
      const p3 = applyV2TransformToPoint(annotation.x, annotation.y + annotation.height, annotation.transform);
      const p4 = applyV2TransformToPoint(annotation.x + annotation.width, annotation.y + annotation.height, annotation.transform);
      const left = Math.min(p1.x, p2.x, p3.x, p4.x);
      const top = Math.min(p1.y, p2.y, p3.y, p4.y);
      const right = Math.max(p1.x, p2.x, p3.x, p4.x);
      const bottom = Math.max(p1.y, p2.y, p3.y, p4.y);
      return {
        id: annotation.id,
        type: "polygon",
        groupId: annotation.groupId,
        name: annotation.name,
        visible: normalizeAnnotationVisible(annotation.visible),
        locked: normalizeAnnotationLocked(annotation.locked),
        color: normalizeAnnotationColor(annotation.style.stroke),
        rotation: normalizeRotation(annotation.transform.rotation),
        fillColor: normalizeAnnotationColor(annotation.style.fill || DEFAULT_ANNOTATION_FILL_COLOR),
        fillOpacity: normalizeFillOpacity(annotation.style.fillOpacity, 0),
        x: clampCanvasCoord(left),
        y: clampCanvasCoord(top),
        width: clamp(right - left, 1, LAYOUT_CANVAS_SIZE),
        height: clamp(bottom - top, 1, LAYOUT_CANVAS_SIZE),
        sides: normalizePolygonSides(annotation.sides, 6),
        strokeWidth: normalizeStrokeWidth(annotation.style.strokeWidth, DEFAULT_ANNOTATION_STROKE_WIDTH),
      };
    }
    const p = applyV2TransformToPoint(annotation.x, annotation.y, annotation.transform);
    return {
      id: annotation.id,
      type: "text",
      groupId: annotation.groupId,
      name: annotation.name,
      visible: normalizeAnnotationVisible(annotation.visible),
      locked: normalizeAnnotationLocked(annotation.locked),
      color: normalizeAnnotationColor(annotation.style.textColor || annotation.style.stroke),
      rotation: normalizeRotation(annotation.transform.rotation),
      x: p.x,
      y: p.y,
      text: annotation.text || "注記",
      fontSize: normalizeFontSize(annotation.style.fontSize, 26),
      fontWeight: normalizeFontWeight(annotation.style.fontWeight, 700),
      fontFamily: normalizeFontFamily(annotation.style.fontFamily),
      textStrokeColor: normalizeAnnotationColor(annotation.style.textStrokeColor || DEFAULT_TEXT_STROKE_COLOR),
      textStrokeWidth: normalizeTextStrokeWidth(annotation.style.textStrokeWidth, DEFAULT_TEXT_STROKE_WIDTH),
      textAlign: normalizeTextAlign(annotation.style.textAlign),
    };
  });
}

function normalizeLayoutAnnotationsV2(value: unknown): LayoutAnnotationV2[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const normalized: LayoutAnnotationV2[] = [];
  value.forEach((raw, index) => {
    if (!raw || typeof raw !== "object") {
      return;
    }
    const item = raw as Partial<LayoutAnnotationV2> & Record<string, unknown>;
    const id = item.id && String(item.id).trim() ? String(item.id) : uid(`anno_v2_${index + 1}`);
    const groupId = item.groupId && String(item.groupId).trim() ? String(item.groupId).trim() : undefined;
    const name = item.name && String(item.name).trim() ? String(item.name).trim() : undefined;
    const visible = normalizeAnnotationVisible(item.visible);
    const locked = normalizeAnnotationLocked(item.locked);
    const transform = createDefaultLayoutAnnotationV2Transform(
      item.transform && typeof item.transform === "object" ? (item.transform as Partial<LayoutAnnotationV2Transform>) : null,
    );
    const style = createDefaultLayoutAnnotationV2Style(
      item.style && typeof item.style === "object" ? (item.style as Partial<LayoutAnnotationV2Style>) : null,
    );
    if (item.type === "arrow") {
      const points = Array.isArray(item.points) ? item.points : [];
      const p0 = clampCanvasCoord(Number(points[0] ?? 0));
      const p1 = clampCanvasCoord(Number(points[1] ?? 0));
      const p2 = clampCanvasCoord(Number(points[2] ?? 0));
      const p3 = clampCanvasCoord(Number(points[3] ?? 0));
      normalized.push({
        id,
        type: "arrow",
        groupId,
        name,
        visible,
        locked,
        points: [p0, p1, p2, p3],
        arrowHead: item.arrowHead === undefined ? true : normalizeAnnotationVisible(item.arrowHead),
        transform,
        style,
      });
      return;
    }
    if (item.type === "rect") {
      normalized.push({
        id,
        type: "rect",
        groupId,
        name,
        visible,
        locked,
        x: clampCanvasCoord(Number(item.x ?? 0)),
        y: clampCanvasCoord(Number(item.y ?? 0)),
        width: clamp(Number(item.width ?? 0), 1, LAYOUT_CANVAS_SIZE),
        height: clamp(Number(item.height ?? 0), 1, LAYOUT_CANVAS_SIZE),
        transform,
        style,
      });
      return;
    }
    if (item.type === "polygon") {
      normalized.push({
        id,
        type: "polygon",
        groupId,
        name,
        visible,
        locked,
        x: clampCanvasCoord(Number(item.x ?? 0)),
        y: clampCanvasCoord(Number(item.y ?? 0)),
        width: clamp(Number(item.width ?? 0), 1, LAYOUT_CANVAS_SIZE),
        height: clamp(Number(item.height ?? 0), 1, LAYOUT_CANVAS_SIZE),
        sides: normalizePolygonSides(item.sides, 6),
        transform,
        style,
      });
      return;
    }
    if (item.type === "text") {
      normalized.push({
        id,
        type: "text",
        groupId,
        name,
        visible,
        locked,
        x: clampCanvasCoord(Number(item.x ?? 0)),
        y: clampCanvasCoord(Number(item.y ?? 0)),
        text: String(item.text ?? "注記"),
        transform,
        style,
      });
    }
  });
  return normalized;
}

function buildArrowHeadPoints(fromX: number, fromY: number, toX: number, toY: number): string {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / len;
  const uy = dy / len;
  const baseX = toX - ux * 22;
  const baseY = toY - uy * 22;
  const px = -uy;
  const py = ux;
  const leftX = baseX + px * 10;
  const leftY = baseY + py * 10;
  const rightX = baseX - px * 10;
  const rightY = baseY - py * 10;
  return `${toX},${toY} ${leftX},${leftY} ${rightX},${rightY}`;
}

function buildRegularPolygonPoints(
  x: number,
  y: number,
  width: number,
  height: number,
  sides: number,
): string {
  const safeSides = normalizePolygonSides(sides, 6);
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const radiusX = Math.max(1, width / 2);
  const radiusY = Math.max(1, height / 2);
  const startAngle = -Math.PI / 2;
  const points: string[] = [];
  for (let i = 0; i < safeSides; i += 1) {
    const angle = startAngle + (i * (Math.PI * 2)) / safeSides;
    const px = centerX + Math.cos(angle) * radiusX;
    const py = centerY + Math.sin(angle) * radiusY;
    points.push(`${px},${py}`);
  }
  return points.join(" ");
}

function findNearestSnapDelta(value: number, targets: number[], threshold = LAYOUT_SNAP_THRESHOLD): { delta: number; target: number } | null {
  let nearest: { delta: number; target: number } | null = null;
  targets.forEach((target) => {
    const delta = target - value;
    if (Math.abs(delta) > threshold) {
      return;
    }
    if (!nearest || Math.abs(delta) < Math.abs(nearest.delta)) {
      nearest = { delta, target };
    }
  });
  return nearest;
}

function getCombinedAnnotationBounds(
  annotations: LayoutAnnotation[],
): { x: number; y: number; width: number; height: number; centerX: number; centerY: number } | null {
  if (!annotations.length) {
    return null;
  }
  const first = getAnnotationBounds(annotations[0]);
  let left = first.x;
  let top = first.y;
  let right = first.x + first.width;
  let bottom = first.y + first.height;
  for (let i = 1; i < annotations.length; i += 1) {
    const bounds = getAnnotationBounds(annotations[i]);
    left = Math.min(left, bounds.x);
    top = Math.min(top, bounds.y);
    right = Math.max(right, bounds.x + bounds.width);
    bottom = Math.max(bottom, bounds.y + bounds.height);
  }
  return {
    x: left,
    y: top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
  };
}

function buildLayoutSnapTargets(
  annotations: LayoutAnnotation[],
  excludeIds?: string | string[] | Set<string>,
): { xTargets: number[]; yTargets: number[] } {
  const excludes =
    excludeIds instanceof Set
      ? excludeIds
      : new Set(Array.isArray(excludeIds) ? excludeIds : excludeIds ? [excludeIds] : []);
  const xTargets = new Set<number>([0, LAYOUT_CANVAS_SIZE / 2, LAYOUT_CANVAS_SIZE]);
  const yTargets = new Set<number>([0, LAYOUT_CANVAS_SIZE / 2, LAYOUT_CANVAS_SIZE]);
  annotations.forEach((annotation) => {
    if (excludes.has(annotation.id)) {
      return;
    }
    if (annotation.visible === false) {
      return;
    }
    const bounds = getAnnotationBounds(annotation);
    xTargets.add(bounds.x);
    xTargets.add(bounds.centerX);
    xTargets.add(bounds.x + bounds.width);
    yTargets.add(bounds.y);
    yTargets.add(bounds.centerY);
    yTargets.add(bounds.y + bounds.height);
  });
  return {
    xTargets: Array.from(xTargets),
    yTargets: Array.from(yTargets),
  };
}

function getLayoutAnnotationDefaultName(annotation: LayoutAnnotation): string {
  if (annotation.type === "arrow") {
    return annotation.arrowHead === false ? "線" : "矢印";
  }
  if (annotation.type === "rect") {
    return "四角形";
  }
  if (annotation.type === "polygon") {
    return "多角形";
  }
  return `テキスト: ${annotation.text}`;
}

function getLayoutAnnotationDisplayName(annotation: LayoutAnnotation): string {
  const name = annotation.name?.trim();
  if (name) {
    return name;
  }
  return getLayoutAnnotationDefaultName(annotation);
}

function toMinutes(value: string): number {
  const [h = "0", m = "0"] = value.split(":");
  return Number(h) * 60 + Number(m);
}

function toHHMM(minutes: number): string {
  const clamped = clamp(minutes, 0, DAY_TOTAL_MINUTES - 1);
  const h = String(Math.floor(clamped / 60)).padStart(2, "0");
  const m = String(clamped % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function tickLabel(minutes: number): string {
  if (minutes >= DAY_TOTAL_MINUTES) {
    return "24:00";
  }
  return toHHMM(minutes);
}

function startOfDay(date: string): Date {
  const normalized = normalizeDate(date);
  if (!normalized) {
    return new Date(Number.NaN);
  }
  const [year, month, day] = normalized.split("-").map((part) => Number(part));
  return new Date(Date.UTC(year, month - 1, day));
}

function diffDays(start: string, end: string): number {
  const s = startOfDay(start).getTime();
  const e = startOfDay(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) {
    return 0;
  }
  return Math.round((e - s) / (24 * 60 * 60 * 1000));
}

function addDays(date: string, days: number): string {
  const d = startOfDay(date);
  d.setUTCDate(d.getUTCDate() + days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toTimelineOffset(date: string, time: string, baseDate: string): number {
  const dayOffset = diffDays(baseDate, date) * DAY_TOTAL_MINUTES;
  return dayOffset + toMinutes(time);
}

function fromTimelineOffset(offset: number, baseDate: string): { date: string; time: string } {
  const safe = Math.max(0, offset);
  const day = Math.floor(safe / DAY_TOTAL_MINUTES);
  const minute = safe % DAY_TOTAL_MINUTES;
  return {
    date: addDays(baseDate, day),
    time: toHHMM(minute),
  };
}

function formatShortDate(value: string): string {
  const d = startOfDay(value);
  if (Number.isNaN(d.getTime())) {
    return value;
  }
  return `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}`;
}

function isLeapYear(year: number): boolean {
  return year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
}

function isValidDateParts(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  if (month < 1 || month > 12) {
    return false;
  }
  const daysByMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const maxDay = daysByMonth[month - 1];
  return day >= 1 && day <= maxDay;
}

function normalizeDate(value: string): string {
  if (!value) {
    return "";
  }
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split("-").map((part) => Number(part));
    return isValidDateParts(y, m, d) ? trimmed : "";
  }
  const replaced = trimmed.replace(/\//g, "-");
  const m = replaced.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) {
    return "";
  }
  const y = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!isValidDateParts(y, month, day)) {
    return "";
  }
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

function normalizeTime(value: string, fallback: string): string {
  if (!value) {
    return fallback;
  }
  const m = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) {
    return fallback;
  }
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isInteger(hh) || !Number.isInteger(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return fallback;
  }
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function toBoolean(value: string): boolean {
  const v = String(value ?? "").trim().toLowerCase();
  if (!v) {
    return false;
  }
  if (["1", "true", "yes", "y", "on", "t", "ok", "有", "あり", "はい", "○", "●", "済", "対象"].includes(v)) {
    return true;
  }
  if (["0", "false", "no", "n", "off", "f", "ng", "無", "なし", "いいえ", "×", "-", "未", "対象外"].includes(v)) {
    return false;
  }
  return false;
}

function sanitizeCsvHeader(header: string): string {
  return String(header ?? "").replace(/^\uFEFF/, "").trim();
}

function normalizeCsvLookupKey(value: string): string {
  return sanitizeCsvHeader(value)
    .toLowerCase()
    .replace(/[ \t　_\-\/]/g, "");
}

function createCsvValueGetter(record: CsvRecord): (...keys: string[]) => string {
  const raw = new Map<string, string>();
  Object.entries(record).forEach(([key, value]) => {
    raw.set(sanitizeCsvHeader(key), String(value ?? "").trim());
  });
  const normalized = new Map<string, string>();
  raw.forEach((value, key) => {
    const normalizedKey = normalizeCsvLookupKey(key);
    if (!normalized.has(normalizedKey)) {
      normalized.set(normalizedKey, value);
    }
  });
  return (...keys: string[]) => {
    for (const key of keys) {
      const direct = raw.get(sanitizeCsvHeader(key));
      if (direct !== undefined && direct !== "") {
        return direct;
      }
      const viaNormalized = normalized.get(normalizeCsvLookupKey(key));
      if (viaNormalized !== undefined && viaNormalized !== "") {
        return viaNormalized;
      }
    }
    return "";
  };
}

function formatDateWithWeekday(value: string): string {
  const normalized = normalizeDate(value);
  if (!normalized) {
    return "-";
  }
  const d = startOfDay(normalized);
  if (Number.isNaN(d.getTime())) {
    return normalized;
  }
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${mm}月${dd}日(${JP_WEEKDAYS[d.getUTCDay()]})`;
}

function formatDateRange(start: string, end: string): string {
  if (!start && !end) {
    return "-";
  }
  if (!end || start === end) {
    return formatDateWithWeekday(start || end);
  }
  return `${formatDateWithWeekday(start)}〜${formatDateWithWeekday(end)}`;
}

function formatDateTimeRange(startDate: string, startTime: string, endDate: string, endTime: string): string {
  const start = `${formatDateWithWeekday(startDate)} ${startTime}`;
  const end = `${formatDateWithWeekday(endDate)} ${endTime}`;
  if (startDate === endDate) {
    return `${formatDateWithWeekday(startDate)} ${startTime}〜${endTime}`;
  }
  return `${start}〜${end}`;
}

function getRowColorType(row: Pick<ScheduleRow, "id" | "label"> & { outage?: boolean }): "outage" | "main" | "additional" {
  if (row.id === "__outage_fixed__" || row.outage) {
    return "outage";
  }
  return row.label.includes("追加") ? "additional" : "main";
}

function parseCsv(text: string): CsvRecord[] {
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let inQuote = false;

  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    const n = text[i + 1];

    if (inQuote) {
      if (c === '"' && n === '"') {
        cell += '"';
        i += 1;
      } else if (c === '"') {
        inQuote = false;
      } else {
        cell += c;
      }
      continue;
    }

    if (c === '"') {
      inQuote = true;
      continue;
    }
    if (c === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    if (c === "\r") {
      continue;
    }
    cell += c;
  }

  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  if (!rows.length) {
    return [];
  }

  const headers = rows[0].map((h) => sanitizeCsvHeader(h));
  return rows
    .slice(1)
    .filter((r) => r.some((c) => c.trim().length > 0))
    .map((r) => {
      const record: CsvRecord = {};
      headers.forEach((h, idx) => {
        record[h] = (r[idx] ?? "").trim();
      });
      return record;
    });
}

function inferCsvHeaders(records: CsvRecord[]): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();
  records.forEach((record) => {
    Object.keys(record).forEach((key) => {
      const header = key.trim();
      if (!header || seen.has(header)) {
        return;
      }
      seen.add(header);
      ordered.push(header);
    });
  });
  return ordered;
}

function normalizeCsvRows(records: CsvRecord[], headers: string[]): CsvRecord[] {
  return records.map((record) => {
    const normalized: CsvRecord = {};
    headers.forEach((header) => {
      normalized[header] = String(record[header] ?? "");
    });
    return normalized;
  });
}

function collectLegacyDateRisks(source: string, raw: Partial<Project> & { workDateMain?: string }): LegacyDateRiskEntry[] {
  const risks: LegacyDateRiskEntry[] = [];
  const projectId = String(raw.projectId || "(unknown)");
  const projectDateFields: Array<keyof (Partial<Project> & { workDateMain?: string })> = [
    "workDateMain",
    "workDateStart",
    "workDateEnd",
    "outageDateStart",
    "outageDateEnd",
  ];

  projectDateFields.forEach((field) => {
    const value = raw[field];
    if (typeof value !== "string") {
      return;
    }
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
      risks.push({ source, projectId, field: String(field), raw: trimmed });
    }
  });

  if (Array.isArray(raw.scheduleRows)) {
    raw.scheduleRows.forEach((row, idx) => {
      const startDate = (row as Partial<ScheduleRow>).startDate;
      const endDate = (row as Partial<ScheduleRow>).endDate;
      if (typeof startDate === "string" && /^\d{4}-\d{2}-\d{2}T/.test(startDate.trim())) {
        risks.push({ source, projectId, field: `scheduleRows[${idx}].startDate`, raw: startDate.trim() });
      }
      if (typeof endDate === "string" && /^\d{4}-\d{2}-\d{2}T/.test(endDate.trim())) {
        risks.push({ source, projectId, field: `scheduleRows[${idx}].endDate`, raw: endDate.trim() });
      }
    });
  }

  return risks;
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

function recordsToCsv(headers: string[], rows: CsvRecord[]): string {
  if (!headers.length) {
    return "";
  }
  const lines = [headers.map((h) => escapeCsvCell(h)).join(",")];
  rows.forEach((row) => {
    lines.push(headers.map((header) => escapeCsvCell(String(row[header] ?? ""))).join(","));
  });
  return lines.join("\n");
}

function encodeStoragePayload(rawJson: string): string {
  if (rawJson.length < STORAGE_COMPRESSION_THRESHOLD) {
    return rawJson;
  }
  try {
    const compressed = compressToUTF16(rawJson);
    if (!compressed) {
      return rawJson;
    }
    const wrapped = `${STORAGE_COMPRESSION_PREFIX}${compressed}`;
    return wrapped.length < rawJson.length ? wrapped : rawJson;
  } catch {
    return rawJson;
  }
}

function decodeStoragePayload(raw: string | null): string | null {
  if (!raw) {
    return null;
  }
  if (!raw.startsWith(STORAGE_COMPRESSION_PREFIX)) {
    return raw;
  }
  const encoded = raw.slice(STORAGE_COMPRESSION_PREFIX.length);
  try {
    const decoded = decompressFromUTF16(encoded);
    return decoded ?? null;
  } catch {
    return null;
  }
}

function stringifyForStorage(value: unknown): string {
  return encodeStoragePayload(JSON.stringify(value));
}

function parseStorageJson<T>(raw: string | null): T | null {
  const payload = decodeStoragePayload(raw);
  if (!payload) {
    return null;
  }
  try {
    return JSON.parse(payload) as T;
  } catch {
    return null;
  }
}

function estimateDataUrlBytes(dataUrl: string): number {
  const idx = dataUrl.indexOf(",");
  if (idx < 0) {
    return dataUrl.length;
  }
  const base64 = dataUrl.slice(idx + 1);
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("file read failed"));
    reader.readAsDataURL(file);
  });
}

type ImageOptimizeOptions = {
  maxEdge: number;
  quality?: number;
  targetBytes?: number;
};

async function optimizeImageFile(
  file: File,
  { maxEdge, quality = 0.84, targetBytes = TARGET_PHOTO_DATA_URL_BYTES }: ImageOptimizeOptions,
): Promise<string> {
  const fallback = await readFileAsDataUrl(file);
  if (typeof window === "undefined" || !("createImageBitmap" in window)) {
    return fallback;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const base = Math.max(bitmap.width, bitmap.height) || 1;
    const initialScale = base > maxEdge ? maxEdge / base : 1;
    let width = Math.max(1, Math.round(bitmap.width * initialScale));
    let height = Math.max(1, Math.round(bitmap.height * initialScale));
    let best = fallback;
    let bestBytes = estimateDataUrlBytes(fallback);
    const qualityCandidates = [quality, Math.max(0.7, quality - 0.08), Math.max(0.58, quality - 0.18), 0.48];
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return fallback;
    }

    for (let attempt = 0; attempt < 4; attempt += 1) {
      canvas.width = width;
      canvas.height = height;
      ctx.clearRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bitmap, 0, 0, width, height);

      for (const q of qualityCandidates) {
        const optimized = canvas.toDataURL("image/webp", q);
        if (!optimized) {
          continue;
        }
        const bytes = estimateDataUrlBytes(optimized);
        if (bytes < bestBytes) {
          best = optimized;
          bestBytes = bytes;
        }
        if (bytes <= targetBytes) {
          bitmap.close();
          return optimized;
        }
      }

      if (Math.max(width, height) <= 720) {
        break;
      }
      width = Math.max(1, Math.round(width * 0.86));
      height = Math.max(1, Math.round(height * 0.86));
    }
    bitmap.close();
    return best;
  } catch {
    return fallback;
  }
}

function normalizeRowRange(start: number, end: number, span: number): { start: number; end: number } {
  const maxStart = Math.max(0, span - MIN_BLOCK_MINUTES);
  const safeStart = clamp(start, 0, maxStart);
  const safeEnd = clamp(end, safeStart + MIN_BLOCK_MINUTES, Math.max(MIN_BLOCK_MINUTES, span));
  return { start: safeStart, end: safeEnd };
}

function normalizeDateTimeValue(value: string, fallbackDate: string, fallbackTime: string): { date: string; time: string } {
  const [dateRaw, timeRaw] = value.split("T");
  const date = normalizeDate(dateRaw ?? "") || fallbackDate;
  const time = normalizeTime(timeRaw ?? "", fallbackTime);
  return { date, time };
}

function fitRowIntoRange(row: ScheduleRow, rangeStart: string, rangeEnd: string): ScheduleRow {
  const dayCount = Math.max(1, diffDays(rangeStart, rangeEnd) + 1);
  const span = dayCount * DAY_TOTAL_MINUTES;
  const startRaw = toTimelineOffset(row.startDate, row.start, rangeStart);
  const endRaw = toTimelineOffset(row.endDate, row.end, rangeStart);
  const duration = clamp(endRaw - startRaw, MIN_BLOCK_MINUTES, span);
  const nextStart = clamp(startRaw, 0, Math.max(0, span - duration));
  const nextEnd = nextStart + duration;
  const startPoint = fromTimelineOffset(nextStart, rangeStart);
  const endPoint = fromTimelineOffset(nextEnd, rangeStart);
  return {
    ...row,
    startDate: startPoint.date,
    start: startPoint.time,
    endDate: endPoint.date,
    end: endPoint.time,
  };
}

function fitOutageIntoRange(
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string,
  rangeStart: string,
  rangeEnd: string,
): { startDate: string; startTime: string; endDate: string; endTime: string } {
  const dayCount = Math.max(1, diffDays(rangeStart, rangeEnd) + 1);
  const span = dayCount * DAY_TOTAL_MINUTES;
  const startRaw = toTimelineOffset(startDate, startTime, rangeStart);
  const endRaw = toTimelineOffset(endDate, endTime, rangeStart);
  const duration = clamp(endRaw - startRaw, MIN_BLOCK_MINUTES, span);
  const nextStart = clamp(startRaw, 0, Math.max(0, span - duration));
  const nextEnd = nextStart + duration;
  const startPoint = fromTimelineOffset(nextStart, rangeStart);
  const endPoint = fromTimelineOffset(nextEnd, rangeStart);
  return {
    startDate: startPoint.date,
    startTime: startPoint.time,
    endDate: endPoint.date,
    endTime: endPoint.time,
  };
}

function syncProjectWorkRange(project: Project): Project {
  const dates = [
    project.workDateStart,
    project.workDateEnd,
    project.outageDateStart,
    project.outageDateEnd,
    ...project.scheduleRows.flatMap((row) => [row.startDate, row.endDate]),
  ].filter(Boolean);
  const minDate = [...dates].sort()[0] || project.workDateStart;
  const maxDate = [...dates].sort().slice(-1)[0] || project.workDateEnd;
  return {
    ...project,
    workDateStart: minDate,
    workDateEnd: maxDate < minDate ? minDate : maxDate,
  };
}

function floorToStep(value: number, step: number): number {
  return Math.floor(value / step) * step;
}

function ceilToStep(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

function chooseTimelineSteps(viewSpan: number): { lineStep: number; labelStep: number } {
  if (viewSpan <= 12 * 60) {
    return { lineStep: 30, labelStep: 60 };
  }
  if (viewSpan <= 36 * 60) {
    return { lineStep: 60, labelStep: 180 };
  }
  if (viewSpan <= 72 * 60) {
    return { lineStep: 120, labelStep: 360 };
  }
  if (viewSpan <= 7 * DAY_TOTAL_MINUTES) {
    return { lineStep: 360, labelStep: 720 };
  }
  if (viewSpan <= 14 * DAY_TOTAL_MINUTES) {
    return { lineStep: 720, labelStep: DAY_TOTAL_MINUTES };
  }
  return { lineStep: DAY_TOTAL_MINUTES, labelStep: DAY_TOTAL_MINUTES * 2 };
}

function buildTimelineTicks(viewStart: number, viewEnd: number): { lineTicks: number[]; labelTicks: number[] } {
  const viewSpan = Math.max(60, viewEnd - viewStart);
  const { lineStep, labelStep } = chooseTimelineSteps(viewSpan);

  const lineTicks: number[] = [];
  for (let tick = floorToStep(viewStart, lineStep); tick <= viewEnd; tick += lineStep) {
    if (tick >= viewStart && tick <= viewEnd) {
      lineTicks.push(tick);
    }
  }

  const labelTickSet = new Set<number>();
  for (let tick = floorToStep(viewStart, labelStep); tick <= viewEnd; tick += labelStep) {
    if (tick >= viewStart && tick <= viewEnd) {
      labelTickSet.add(tick);
    }
  }
  const firstDayBoundary = Math.ceil(viewStart / DAY_TOTAL_MINUTES) * DAY_TOTAL_MINUTES;
  for (let tick = firstDayBoundary; tick <= viewEnd; tick += DAY_TOTAL_MINUTES) {
    if (tick >= viewStart && tick <= viewEnd) {
      labelTickSet.add(tick);
    }
  }
  labelTickSet.add(viewStart);
  labelTickSet.add(viewEnd);
  const labelTicks = Array.from(labelTickSet).sort((a, b) => a - b);
  return { lineTicks, labelTicks };
}

function createScheduleFromWorks(project: Project): ScheduleRow[] {
  const selected = WORK_MASTER.filter((work) => project.selectedWorkCodes.includes(work.code));
  if (!selected.length) {
    return [];
  }

  const baseDate = project.outageDateStart || project.workDateStart || todayLocalISO();
  const startDate = project.outageDateStart || baseDate;
  const endDate = project.outageDateEnd || startDate;
  const startTime = project.outageTimeStart || "09:00";
  const endTime = project.outageTimeEnd || "17:00";
  const startMin = toTimelineOffset(startDate, startTime, baseDate);
  const rawEnd = toTimelineOffset(endDate, endTime, baseDate);
  const endMin = Math.max(startMin + 60, rawEnd);
  const total = Math.max(60, endMin - startMin);
  const block = Math.max(30, Math.floor(total / selected.length));

  return selected.map((work, index) => {
    const s = startMin + block * index;
    const e = index === selected.length - 1 ? endMin : Math.min(endMin, s + block);
    const startPoint = fromTimelineOffset(s, baseDate);
    const endPoint = fromTimelineOffset(e, baseDate);
    return {
      id: uid("row"),
      label: work.name,
      startDate: startPoint.date,
      start: startPoint.time,
      endDate: endPoint.date,
      end: endPoint.time,
      outage: index === 0,
      text: work.defaultText,
      note: "",
    };
  });
}

function mergeUniqueWorkCodes(baseCodes: WorkCode[], additionalCodes: WorkCode[]): WorkCode[] {
  const unique = new Set<WorkCode>([...baseCodes, ...additionalCodes]);
  return WORK_MASTER.map((work) => work.code).filter((code) => unique.has(code));
}

function resolveScheduleBuildRange(project: Project): {
  rangeStart: string;
  rangeEnd: string;
  baseDate: string;
  startOffset: number;
  endOffset: number;
  spanMinutes: number;
} {
  const rangeStart = normalizeDate(project.workDateStart) || normalizeDate(project.outageDateStart) || todayLocalISO();
  const rangeEndRaw = normalizeDate(project.workDateEnd) || normalizeDate(project.outageDateEnd) || rangeStart;
  const rangeEnd = rangeEndRaw < rangeStart ? rangeStart : rangeEndRaw;
  const startDate = normalizeDate(project.outageDateStart) || rangeStart;
  const startTime = normalizeTime(project.outageTimeStart, "09:00");
  const endDateRaw = normalizeDate(project.outageDateEnd) || rangeEnd;
  const endDate = endDateRaw < startDate ? startDate : endDateRaw;
  const endTime = normalizeTime(project.outageTimeEnd, "17:00");
  const baseDate = rangeStart;
  const startOffset = Math.max(0, toTimelineOffset(startDate, startTime, baseDate));
  const rawEndOffset = toTimelineOffset(endDate, endTime, baseDate);
  const endOffset = rawEndOffset > startOffset ? rawEndOffset : startOffset + MIN_BLOCK_MINUTES;
  return {
    rangeStart,
    rangeEnd,
    baseDate,
    startOffset,
    endOffset,
    spanMinutes: Math.max(MIN_BLOCK_MINUTES, endOffset - startOffset),
  };
}

function toScheduleTemplateStepDuration(row: ScheduleRow): number {
  const baseDate = normalizeDate(row.startDate) || todayLocalISO();
  const startOffset = toTimelineOffset(row.startDate, normalizeTime(row.start, "09:00"), baseDate);
  const endOffset = toTimelineOffset(row.endDate, normalizeTime(row.end, "17:00"), baseDate);
  return clamp(endOffset - startOffset, MIN_BLOCK_MINUTES, DAY_TOTAL_MINUTES * 30);
}

function rowToProcedureStep(row: ScheduleRow): ScheduleProcedureTemplateStep {
  const label = row.label.trim() || "工程";
  return {
    id: uid("proc_step"),
    label,
    durationMinutes: toScheduleTemplateStepDuration(row),
    outage: Boolean(row.outage),
    note: row.note.trim(),
  };
}

function stepSignature(step: Pick<ScheduleProcedureTemplateStep, "label" | "durationMinutes" | "outage" | "note">): string {
  return `${step.label.trim()}|${Math.round(step.durationMinutes)}|${step.outage ? "1" : "0"}|${step.note.trim()}`;
}

function buildRowsFromProcedureTemplate(project: Project, template: ScheduleProcedureTemplate): ScheduleRow[] {
  const steps = template.steps.filter((step) => step.label.trim());
  if (!steps.length) {
    return [];
  }
  const range = resolveScheduleBuildRange(project);
  const rawDurations = steps.map((step) => clamp(Math.round(step.durationMinutes || MIN_BLOCK_MINUTES), MIN_BLOCK_MINUTES, DAY_TOTAL_MINUTES * 30));
  const total = rawDurations.reduce((sum, value) => sum + value, 0) || rawDurations.length * MIN_BLOCK_MINUTES;
  let elapsed = 0;

  return steps.map((step, index) => {
    const startRatio = elapsed / total;
    elapsed += rawDurations[index];
    const endRatio = index === steps.length - 1 ? 1 : elapsed / total;
    const rawStart = range.startOffset + Math.round((range.spanMinutes * startRatio) / DRAG_SNAP_MINUTES) * DRAG_SNAP_MINUTES;
    const rawEnd = index === steps.length - 1
      ? range.endOffset
      : range.startOffset + Math.round((range.spanMinutes * endRatio) / DRAG_SNAP_MINUTES) * DRAG_SNAP_MINUTES;
    const normalized = normalizeRowRange(
      rawStart,
      rawEnd,
      Math.max((diffDays(range.rangeStart, range.rangeEnd) + 1) * DAY_TOTAL_MINUTES, range.endOffset + MIN_BLOCK_MINUTES),
    );
    const startPoint = fromTimelineOffset(normalized.start, range.baseDate);
    const endPoint = fromTimelineOffset(normalized.end, range.baseDate);
    return {
      id: uid("row"),
      label: step.label.trim(),
      startDate: startPoint.date,
      start: startPoint.time,
      endDate: endPoint.date,
      end: endPoint.time,
      outage: Boolean(step.outage),
      text: step.label.trim(),
      note: step.note.trim(),
    };
  });
}

function createBlankProject(seed?: Partial<Project>): Project {
  const flags: Record<WorkCode, boolean> = {
    KOUATSU_CABLE: false,
    UGS: false,
    PAS: false,
    GROUND_A: false,
    GROUND_B: false,
    GROUND_C: false,
  };

  const normalizedLegacySeed = normalizeLayoutAnnotations(seed?.layoutAnnotations ?? []);
  const seededV2 = seed?.layoutAnnotationsV2 ?? legacyLayoutAnnotationsToV2(normalizedLegacySeed);
  const layoutAnnotationsV2 = normalizeLayoutAnnotationsV2(seededV2);
  const legacyLayoutAnnotations = seed?.layoutAnnotationsV2 && !seed?.layoutAnnotations
    ? layoutAnnotationsV2ToLegacy(layoutAnnotationsV2)
    : normalizedLegacySeed;

  return {
    projectId: seed?.projectId ?? `PJ-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`,
    propertyName: seed?.propertyName ?? "",
    propertyAddress: seed?.propertyAddress ?? "",
    titleSubject: seed?.titleSubject ?? "",
    workDateStart: seed?.workDateStart ?? "",
    workDateEnd: seed?.workDateEnd ?? "",
    outageDateStart: seed?.outageDateStart ?? "",
    outageDateEnd: seed?.outageDateEnd ?? "",
    outageTimeStart: seed?.outageTimeStart ?? "",
    outageTimeEnd: seed?.outageTimeEnd ?? "",
    outageEnabled: seed?.outageEnabled ?? false,
    flags,
    selectedWorkCodes: seed?.selectedWorkCodes ?? [],
    noteSpecial: seed?.noteSpecial ?? "",
    noteApprovalExtra: seed?.noteApprovalExtra ?? "",
    coverRecipientSuffix: seed?.coverRecipientSuffix ?? "",
    pdfTemplateId: normalizePdfTemplateId(seed?.pdfTemplateId),
    pdfCompanyName: seed?.pdfCompanyName ?? "",
    pdfTeam: seed?.pdfTeam ?? "",
    pdfContactPerson: seed?.pdfContactPerson ?? "",
    pdfAddress: seed?.pdfAddress ?? "",
    pdfEmail: seed?.pdfEmail ?? "",
    pdfTel: seed?.pdfTel ?? "",
    pdfFax: seed?.pdfFax ?? "",
    layoutImageDataUrl: seed?.layoutImageDataUrl ?? "",
    layoutAnnotations: legacyLayoutAnnotations,
    layoutAnnotationsV2,
    scheduleRows: seed?.scheduleRows ?? [],
    detailPhotos: seed?.detailPhotos ?? createPhotoSlots(),
    layoutPhotos: seed?.layoutPhotos ?? createPhotoSlots(["写真A（配置図）", "写真B（配置図）", "写真C（配置図）", "写真D（配置図）"]),
    relatedParties: seed?.relatedParties ?? createDefaultRelatedParties(),
    approvalStatus: seed?.approvalStatus ?? "draft",
    approvalComment: seed?.approvalComment ?? "",
    approvedBy: seed?.approvedBy ?? "",
    approvedAt: seed?.approvedAt ?? "",
  };
}

function normalizeProject(
  project: Partial<Project> & {
    workDateMain?: string;
    photos?: Record<string, Partial<PhotoSlot>>;
    relatedParties?: Partial<Project["relatedParties"]>;
  },
): Project {
  const start = normalizeDate(project.workDateStart ?? project.workDateMain ?? "");
  const end = normalizeDate(project.workDateEnd ?? "") || start;
  const normalizedRows = (project.scheduleRows ?? []).map((row) => {
    const rowStartDate = normalizeDate((row as Partial<Record<"startDate", string>>).startDate ?? project.outageDateStart ?? start) || start;
    const rowEndDate = normalizeDate((row as Partial<Record<"endDate", string>>).endDate ?? rowStartDate) || rowStartDate;
    return {
      ...row,
      startDate: rowStartDate,
      start: normalizeTime(row.start ?? "", ""),
      endDate: rowEndDate,
      end: normalizeTime(row.end ?? "", ""),
    };
  });

  const flags: Record<WorkCode, boolean> = {
    KOUATSU_CABLE: !!project.flags?.KOUATSU_CABLE,
    UGS: !!project.flags?.UGS,
    PAS: !!project.flags?.PAS,
    GROUND_A: !!project.flags?.GROUND_A,
    GROUND_B: !!project.flags?.GROUND_B,
    GROUND_C: !!project.flags?.GROUND_C,
  };

  const normalizePhotoArray = (value: unknown, fallbackLabels: string[]): PhotoSlots => {
    if (Array.isArray(value)) {
      const normalized = value
        .map((item, idx) => {
          if (!item || typeof item !== "object") {
            return null;
          }
          const raw = item as Partial<PhotoSlot>;
          const normalizedLegacy = normalizeLayoutAnnotations(raw.layoutAnnotations);
          const normalizedV2 = normalizeLayoutAnnotationsV2(raw.layoutAnnotationsV2);
          const layoutAnnotationsV2 = normalizedV2.length ? normalizedV2 : legacyLayoutAnnotationsToV2(normalizedLegacy);
          const layoutAnnotations = normalizedV2.length ? layoutAnnotationsV2ToLegacy(layoutAnnotationsV2) : normalizedLegacy;
          return {
            id: raw.id || uid(`photo_${idx + 1}`),
            label: raw.label || fallbackLabels[idx] || `写真${idx + 1}`,
            dataUrl: raw.dataUrl || "",
            layoutAnnotations,
            layoutAnnotationsV2,
          };
        })
        .filter((item): item is PhotoSlot => item !== null);
      return normalized.length ? normalized : createPhotoSlots(fallbackLabels);
    }
    if (value && typeof value === "object") {
      const entries = Object.entries(value as Record<string, Partial<PhotoSlot>>);
      const normalized = entries.map(([key, raw], idx) => ({
        ...(function build() {
          const normalizedLegacy = normalizeLayoutAnnotations(raw.layoutAnnotations);
          const normalizedV2 = normalizeLayoutAnnotationsV2(raw.layoutAnnotationsV2);
          const layoutAnnotationsV2 = normalizedV2.length ? normalizedV2 : legacyLayoutAnnotationsToV2(normalizedLegacy);
          const layoutAnnotations = normalizedV2.length ? layoutAnnotationsV2ToLegacy(layoutAnnotationsV2) : normalizedLegacy;
          return {
            id: raw.id || key || uid(`photo_${idx + 1}`),
            label: raw.label || fallbackLabels[idx] || `写真${idx + 1}`,
            dataUrl: raw.dataUrl || "",
            layoutAnnotations,
            layoutAnnotationsV2,
          };
        })(),
      }));
      return normalized.length ? normalized : createPhotoSlots(fallbackLabels);
    }
    return createPhotoSlots(fallbackLabels);
  };

  const detailPhotos = normalizePhotoArray(project.detailPhotos ?? project.photos, ["写真A（着工前）", "写真B（施工中）", "写真C（施工後）", "写真D（その他）"]);
  const layoutPhotos = normalizePhotoArray(project.layoutPhotos, ["写真A（配置図）", "写真B（配置図）", "写真C（配置図）", "写真D（配置図）"]);
  const normalizedLegacyAnnotations = normalizeLayoutAnnotations(project.layoutAnnotations);
  const normalizedV2Annotations = normalizeLayoutAnnotationsV2(project.layoutAnnotationsV2);
  const layoutAnnotationsV2 = normalizedV2Annotations.length
    ? normalizedV2Annotations
    : legacyLayoutAnnotationsToV2(normalizedLegacyAnnotations);
  const layoutAnnotations = normalizedV2Annotations.length
    ? layoutAnnotationsV2ToLegacy(layoutAnnotationsV2)
    : normalizedLegacyAnnotations;
  const pdfTemplateId = normalizePdfTemplateId(project.pdfTemplateId);
  const relatedParties = createDefaultRelatedParties(project.relatedParties);
  relatedParties.owner.company = project.pdfCompanyName || relatedParties.owner.company;
  relatedParties.owner.office = project.pdfTeam || relatedParties.owner.office;
  relatedParties.owner.person = project.pdfContactPerson || relatedParties.owner.person;
  relatedParties.owner.tel = project.pdfTel || relatedParties.owner.tel;

  return {
    ...createBlankProject({
      projectId: project.projectId,
      propertyName: project.propertyName,
      propertyAddress: project.propertyAddress,
      titleSubject: project.titleSubject,
      workDateStart: start,
      workDateEnd: end,
      outageDateStart: normalizeDate(project.outageDateStart ?? project.workDateStart ?? "") || start,
      outageDateEnd: normalizeDate(project.outageDateEnd ?? project.workDateStart ?? project.workDateEnd ?? "") || start,
      outageTimeStart: normalizeTime(project.outageTimeStart ?? (project as Partial<Record<"workTimeStart", string>>).workTimeStart ?? "", ""),
      outageTimeEnd: normalizeTime(project.outageTimeEnd ?? (project as Partial<Record<"workTimeEnd", string>>).workTimeEnd ?? "", ""),
      outageEnabled: typeof project.outageEnabled === "boolean" ? project.outageEnabled : false,
      selectedWorkCodes: project.selectedWorkCodes,
      noteSpecial: project.noteSpecial,
      noteApprovalExtra: project.noteApprovalExtra,
      coverRecipientSuffix: project.coverRecipientSuffix,
      pdfTemplateId,
      pdfCompanyName: project.pdfCompanyName,
      pdfTeam: project.pdfTeam,
      pdfContactPerson: project.pdfContactPerson,
      pdfAddress: project.pdfAddress,
      pdfEmail: project.pdfEmail,
      pdfTel: project.pdfTel,
      pdfFax: project.pdfFax,
      layoutImageDataUrl: project.layoutImageDataUrl,
      layoutAnnotations,
      layoutAnnotationsV2,
      scheduleRows: normalizedRows,
      detailPhotos,
      layoutPhotos,
      relatedParties,
      approvalStatus: project.approvalStatus,
      approvalComment: project.approvalComment,
      approvedBy: project.approvedBy,
      approvedAt: project.approvedAt,
    }),
    flags,
  };
}

function normalizeWorkToken(value: string): string {
  return String(value ?? "").trim().toLowerCase().replace(/[ \t　_\-\/]/g, "");
}

function parseSelectedWorkCodes(getField: (...keys: string[]) => string): WorkCode[] {
  const selected = new Set<WorkCode>();
  (Object.entries(CSV_WORK_COLUMN_ALIASES) as [WorkCode, string[]][]).forEach(([code, aliases]) => {
    if (toBoolean(getField(...aliases))) {
      selected.add(code);
    }
  });

  const rawList = getField(...CSV_PROJECT_FIELD_ALIASES.workList);
  if (rawList) {
    const tokens = rawList
      .split(/[,、\/|;:\n\r]+/)
      .map((token) => normalizeWorkToken(token))
      .filter(Boolean);
    tokens.forEach((token) => {
      (Object.entries(CSV_WORK_COLUMN_ALIASES) as [WorkCode, string[]][]).forEach(([code, aliases]) => {
        const matched = aliases.some((alias) => normalizeWorkToken(alias) === token);
        if (matched) {
          selected.add(code);
        }
      });
    });
  }
  return Array.from(selected);
}

function projectFromCsv(record: CsvRecord): Project | null {
  const getField = createCsvValueGetter(record);
  const projectId = getField(...CSV_PROJECT_FIELD_ALIASES.projectId).trim();
  if (!projectId) {
    return null;
  }

  const startDate = normalizeDate(getField(...CSV_PROJECT_FIELD_ALIASES.workDateStart));
  const endDate = normalizeDate(getField(...CSV_PROJECT_FIELD_ALIASES.workDateEnd)) || startDate;
  const outageDateStart = normalizeDate(getField(...CSV_PROJECT_FIELD_ALIASES.outageDateStart)) || startDate;
  const outageDateEnd = normalizeDate(getField(...CSV_PROJECT_FIELD_ALIASES.outageDateEnd)) || outageDateStart;
  const selectedWorkCodes = parseSelectedWorkCodes(getField);

  const flags: Record<WorkCode, boolean> = {
    KOUATSU_CABLE: selectedWorkCodes.includes("KOUATSU_CABLE"),
    UGS: selectedWorkCodes.includes("UGS"),
    PAS: selectedWorkCodes.includes("PAS"),
    GROUND_A: selectedWorkCodes.includes("GROUND_A"),
    GROUND_B: selectedWorkCodes.includes("GROUND_B"),
    GROUND_C: selectedWorkCodes.includes("GROUND_C"),
  };

  const normalizedPropertyName = getField(...CSV_PROJECT_FIELD_ALIASES.propertyName).trim();

  const project = createBlankProject({
    projectId,
    propertyName: normalizedPropertyName || "新規案件",
    propertyAddress: getField(...CSV_PROJECT_FIELD_ALIASES.propertyAddress),
    titleSubject: getField(...CSV_PROJECT_FIELD_ALIASES.titleSubject) || "電気設備更新工事",
    workDateStart: startDate || todayLocalISO(),
    workDateEnd: endDate || startDate || todayLocalISO(),
    outageDateStart: outageDateStart || startDate || todayLocalISO(),
    outageDateEnd: outageDateEnd || outageDateStart || startDate || todayLocalISO(),
    outageTimeStart: normalizeTime(getField(...CSV_PROJECT_FIELD_ALIASES.outageTimeStart), "09:00"),
    outageTimeEnd: normalizeTime(getField(...CSV_PROJECT_FIELD_ALIASES.outageTimeEnd), "17:00"),
    outageEnabled: (() => {
      const raw = getField(...CSV_PROJECT_FIELD_ALIASES.outageEnabled);
      return raw === "" ? true : toBoolean(raw);
    })(),
    selectedWorkCodes,
    noteSpecial: getField(...CSV_PROJECT_FIELD_ALIASES.noteSpecial),
    noteApprovalExtra: getField(...CSV_PROJECT_FIELD_ALIASES.noteApprovalExtra),
    coverRecipientSuffix: getField(...CSV_PROJECT_FIELD_ALIASES.coverRecipientSuffix) || "管理組合御中",
    pdfTemplateId: normalizePdfTemplateId(getField(...CSV_PROJECT_FIELD_ALIASES.pdfTemplateId)),
    pdfCompanyName: getField(...CSV_PROJECT_FIELD_ALIASES.pdfCompanyName) || "レジル株式会社",
    pdfTeam: getField(...CSV_PROJECT_FIELD_ALIASES.pdfTeam),
    pdfContactPerson: getField(...CSV_PROJECT_FIELD_ALIASES.pdfContactPerson),
    pdfAddress: getField(...CSV_PROJECT_FIELD_ALIASES.pdfAddress),
    pdfEmail: getField(...CSV_PROJECT_FIELD_ALIASES.pdfEmail),
    pdfTel: getField(...CSV_PROJECT_FIELD_ALIASES.pdfTel),
    pdfFax: getField(...CSV_PROJECT_FIELD_ALIASES.pdfFax),
    layoutImageDataUrl: "",
    detailPhotos: createPhotoSlots([
      getField(...CSV_PROJECT_FIELD_ALIASES.photoSlotALabel) || "写真A（着工前）",
      getField(...CSV_PROJECT_FIELD_ALIASES.photoSlotBLabel) || "写真B（施工中）",
      getField(...CSV_PROJECT_FIELD_ALIASES.photoSlotCLabel) || "写真C（施工後）",
      getField(...CSV_PROJECT_FIELD_ALIASES.photoSlotDLabel) || "写真D（その他）",
    ]),
    layoutPhotos: createPhotoSlots(
      [
        getField(...CSV_PROJECT_FIELD_ALIASES.layoutPhotoSlotALabel) || "写真A（配置図）",
        getField(...CSV_PROJECT_FIELD_ALIASES.layoutPhotoSlotBLabel) || "写真B（配置図）",
        getField(...CSV_PROJECT_FIELD_ALIASES.layoutPhotoSlotCLabel) || "写真C（配置図）",
        getField(...CSV_PROJECT_FIELD_ALIASES.layoutPhotoSlotDLabel) || "写真D（配置図）",
      ],
    ),
    relatedParties: createDefaultRelatedParties({
      owner: {
        company: getField(...CSV_PROJECT_FIELD_ALIASES.pdfCompanyName) || "レジル株式会社",
        office: getField(...CSV_PROJECT_FIELD_ALIASES.pdfTeam) || "東日本技術チーム",
        person: getField(...CSV_PROJECT_FIELD_ALIASES.pdfContactPerson) || "鳥山　伸介",
        tel: getField(...CSV_PROJECT_FIELD_ALIASES.pdfTel) || "03-6846-0903",
      },
    }),
  });

  project.flags = flags;
  project.scheduleRows = createScheduleFromWorks(project);
  return project;
}

function formatAuditAction(action: string): string {
  return AUDIT_ACTION_LABELS[action] || "その他操作";
}

function formatAuditScreen(action: string): string {
  if (action.startsWith("csv_")) {
    return "CSV編集スペース";
  }
  if (["login", "logout", "login_failed", "user_create", "user_update_email", "user_approval_update", "user_delete", "user_role_update"].includes(action)) {
    return "ログイン管理";
  }
  if (["backup_save", "backup_restore", "pdf_export", "approval_update", "schedule_regenerate", "schedule_add_row", "schedule_remove_row", "schedule_reorder", "timeline_drag", "photo_add", "photo_remove", "layout_image_replace", "layout_annotation_save", "project_create", "project_delete", "copy_from_project", "template_apply"].includes(action)) {
    return "施工計画書編集";
  }
  return "その他";
}

function formatAuditDetail(detail: string): string {
  return detail
    .replaceAll("draft", "編集中")
    .replaceAll("submitted", "確認依頼中")
    .replaceAll("approved", "確定")
    .replaceAll("rejected", "修正依頼");
}

function formatAuditDetailForNonAdmin(log: AuditLog): string {
  if (["user_create", "user_update_email", "login", "login_failed"].includes(log.action)) {
    return "管理者のみ表示";
  }
  return formatAuditDetail(log.detail || "-");
}

function formatUserCreatedByLabel(user: UserAccount): string {
  const label = (user.createdByName || "").trim();
  if (user.createdById === "self_signup" || label.includes("セルフ登録")) {
    return "本人申請（セルフ登録）";
  }
  if (user.createdById === "self" || label === "初期登録") {
    return "初期管理者登録";
  }
  if (!label || label === "システム") {
    return "システム登録";
  }
  return label;
}

function formatUserApprovedByLabel(user: UserAccount): string {
  const label = (user.approvedByName || "").trim();
  if (label) {
    return label;
  }
  if (user.approvalStatus === "pending") {
    return "承認待ち";
  }
  if (user.approvalStatus === "rejected") {
    return "未承認";
  }
  if (user.approvalStatus === "approved") {
    if (user.role === "system_admin") {
      return "システム管理者";
    }
    if (user.role === "admin") {
      return "管理者";
    }
    return formatUserCreatedByLabel(user);
  }
  return "-";
}

const seedProjects: Project[] = [
];

export default function PlannerApp({ mode = "editor" }: { mode?: "editor" | "csv" | "tracking" }) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>(seedProjects);
  const [selectedId, setSelectedId] = useState<string>("");
  const [projectSearchText, setProjectSearchText] = useState<string>("");
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [uiPreset, setUiPreset] = useState<UiPreset>("standard");
  const [hydrated, setHydrated] = useState(false);
  const [sharedStorageReady, setSharedStorageReady] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState("-");
  const [importStatus, setImportStatus] = useState("CSV未取込");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvDraftRows, setCsvDraftRows] = useState<CsvRecord[]>([]);
  const [csvSearch, setCsvSearch] = useState("");
  const [csvPage, setCsvPage] = useState(0);
  const [csvPageSize, setCsvPageSize] = useState<number>(50);
  const [newCsvColumn, setNewCsvColumn] = useState("");
  const [csvSelectedRows, setCsvSelectedRows] = useState<number[]>([]);
  const [csvBulkHeader, setCsvBulkHeader] = useState("");
  const [csvDeleteHeader, setCsvDeleteHeader] = useState("");
  const [csvBulkValue, setCsvBulkValue] = useState("");
  const [csvBulkNotice, setCsvBulkNotice] = useState<UserCreateNotice | null>(null);
  const deferredCsvSearch = useDeferredValue(csvSearch);
  const [dragInfo, setDragInfo] = useState<DragInfo | null>(null);
  const [partySlide, setPartySlide] = useState(0);
  const [detailPhotoSlide, setDetailPhotoSlide] = useState(0);
  const [layoutPhotoSlide, setLayoutPhotoSlide] = useState(0);
  const [printMode, setPrintMode] = useState(false);
  const [scheduleTemplates, setScheduleTemplates] = useState<Array<SimpleTemplate<ScheduleRow[]>>>([]);
  const [scheduleProcedureTemplates, setScheduleProcedureTemplates] = useState<ScheduleProcedureTemplate[]>(
    cloneScheduleProcedureTemplates(DEFAULT_SCHEDULE_PROCEDURE_TEMPLATES),
  );
  const [detailPhotoTemplates, setDetailPhotoTemplates] = useState<Array<SimpleTemplate<PhotoSlots>>>([]);
  const [partyTemplates, setPartyTemplates] = useState<Array<SimpleTemplate<Project["relatedParties"]>>>([]);
  const [partyCompanyTemplates, setPartyCompanyTemplates] = useState<Record<RelatedPartyKey, PartyCompanyTemplatePreset[]>>(
    createEmptyPartyCompanyTemplates(),
  );
  const [layoutTemplates, setLayoutTemplates] = useState<
    Array<SimpleTemplate<LayoutTemplatePayload>>
  >([]);
  const [selectedScheduleTemplateId, setSelectedScheduleTemplateId] = useState("");
  const [selectedScheduleProcedureTemplateId, setSelectedScheduleProcedureTemplateId] = useState("");
  const [selectedDetailPhotoTemplateId, setSelectedDetailPhotoTemplateId] = useState("");
  const [selectedPartyTemplateId, setSelectedPartyTemplateId] = useState("");
  const [selectedLayoutTemplateId, setSelectedLayoutTemplateId] = useState("");
  const [templateScope, setTemplateScope] = useState<TemplateScope>("schedule");
  const [copySourceProjectId, setCopySourceProjectId] = useState("");
  const [newScheduleProcedureTemplateName, setNewScheduleProcedureTemplateName] = useState("");
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("editor");
  const [userCreateNotice, setUserCreateNotice] = useState<UserCreateNotice | null>(null);
  const [userManageNotice, setUserManageNotice] = useState<UserCreateNotice | null>(null);
  const [requiredHint, setRequiredHint] = useState("");
  const [accessLogs, setAccessLogs] = useState<LoginAttemptLog[]>([]);
  const [userListExpanded, setUserListExpanded] = useState(false);
  const [accessLogExpanded, setAccessLogExpanded] = useState(false);
  const [operationLogExpanded, setOperationLogExpanded] = useState(false);
  const [operationLogUserFilter, setOperationLogUserFilter] = useState("all");
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [revisions, setRevisions] = useState<ProjectRevision[]>([]);
  const [selectedRevisionId, setSelectedRevisionId] = useState("");
  const [layoutEditorOpen, setLayoutEditorOpen] = useState(false);
  const [layoutEditorTarget, setLayoutEditorTarget] = useState<LayoutEditorTarget | null>(null);
  const [layoutEditorImageDataUrl, setLayoutEditorImageDataUrl] = useState("");
  const [layoutEditorTool, setLayoutEditorTool] = useState<LayoutEditorTool>("select");
  const [layoutEditorArrowHeadEnabled, setLayoutEditorArrowHeadEnabled] = useState(true);
  const [layoutEditorColor, setLayoutEditorColor] = useState(DEFAULT_ANNOTATION_COLOR);
  const [layoutEditorStrokeWidth, setLayoutEditorStrokeWidth] = useState(DEFAULT_ANNOTATION_STROKE_WIDTH);
  const [layoutEditorFillColor, setLayoutEditorFillColor] = useState(DEFAULT_ANNOTATION_FILL_COLOR);
  const [layoutEditorFillOpacity, setLayoutEditorFillOpacity] = useState(DEFAULT_ANNOTATION_FILL_OPACITY);
  const [layoutEditorPolygonSides, setLayoutEditorPolygonSides] = useState(6);
  const [layoutEditorText, setLayoutEditorText] = useState("注意");
  const [layoutEditorFontFamily, setLayoutEditorFontFamily] = useState(DEFAULT_TEXT_FONT_FAMILY);
  const [layoutEditorTextStrokeColor, setLayoutEditorTextStrokeColor] = useState(DEFAULT_TEXT_STROKE_COLOR);
  const [layoutEditorTextStrokeWidth, setLayoutEditorTextStrokeWidth] = useState(DEFAULT_TEXT_STROKE_WIDTH);
  const [layoutEditorAnnotations, setLayoutEditorAnnotations] = useState<LayoutAnnotation[]>([]);
  const [layoutEditorSelectedId, setLayoutEditorSelectedId] = useState("");
  const [layoutEditorSelectedIds, setLayoutEditorSelectedIds] = useState<string[]>([]);
  const [layoutEditorDrawing, setLayoutEditorDrawing] = useState<LayoutDrawingDraft | null>(null);
  const [layoutEditorChainStart, setLayoutEditorChainStart] = useState<{ x: number; y: number } | null>(null);
  const [layoutEditorChainHover, setLayoutEditorChainHover] = useState<{ x: number; y: number } | null>(null);
  const [layoutEditorChainGroupId, setLayoutEditorChainGroupId] = useState<string | null>(null);
  const [layoutEditorChainFirstPoint, setLayoutEditorChainFirstPoint] = useState<{ x: number; y: number } | null>(null);
  const [layoutEditorChainAnnotationIds, setLayoutEditorChainAnnotationIds] = useState<string[]>([]);
  const [layoutEditorMove, setLayoutEditorMove] = useState<LayoutMoveState | null>(null);
  const [layoutEditorResize, setLayoutEditorResize] = useState<LayoutResizeState | null>(null);
  const [layoutEditorRotate, setLayoutEditorRotate] = useState<LayoutRotateState | null>(null);
  const [layoutEditorMarquee, setLayoutEditorMarquee] = useState<LayoutMarqueeState | null>(null);
  const [layoutEditorZoom, setLayoutEditorZoom] = useState(1);
  const [layoutEditorPan, setLayoutEditorPan] = useState({ x: 0, y: 0 });
  const [layoutEditorPanState, setLayoutEditorPanState] = useState<LayoutPanState | null>(null);
  const [layoutEditorSpacePressed, setLayoutEditorSpacePressed] = useState(false);
  const [layoutEditorSnapEnabled, setLayoutEditorSnapEnabled] = useState(true);
  const [layoutEditorGuideLines, setLayoutEditorGuideLines] = useState<LayoutGuideLine[]>([]);
  const [layoutEditorHistory, setLayoutEditorHistory] = useState<LayoutAnnotation[][]>([]);
  const [layoutEditorHistoryIndex, setLayoutEditorHistoryIndex] = useState(-1);
  const [layoutEditorAdvancedOpen, setLayoutEditorAdvancedOpen] = useState(false);
  const [layoutEditorAdvancedTab, setLayoutEditorAdvancedTab] = useState<LayoutAdvancedTab>("transform");
  const [partyTemplateSelections, setPartyTemplateSelections] = useState<Record<RelatedPartyKey, string>>(
    EMPTY_PARTY_TEMPLATE_SELECTIONS,
  );
  const projectRefCacheRef = useRef<Record<string, Project>>({});
  const projectSerializedCacheRef = useRef<Record<string, string>>({});
  const saveTimerRef = useRef<number | null>(null);
  const csvSaveTimerRef = useRef<number | null>(null);
  const csvSerializedCacheRef = useRef("");
  const sharedSyncTimerRef = useRef<number | null>(null);
  const outageTraceSeqRef = useRef(0);
  const layoutEditorSvgRef = useRef<SVGSVGElement | null>(null);
  const layoutEditorStageRef = useRef<HTMLDivElement | null>(null);
  const layoutEditorHistorySerializedRef = useRef("");
  const layoutEditorHistorySuppressRef = useRef(false);
  const projectPickerRef = useRef<HTMLDivElement | null>(null);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const projectsRef = useRef<Project[]>(projects);
  const csvHeadersRef = useRef<string[]>(csvHeaders);
  const csvDraftRowsRef = useRef<CsvRecord[]>(csvDraftRows);

  const persistProjectsToStorage = useCallback((targetProjects: Project[]): void => {
    try {
      const nextRefCache: Record<string, Project> = {};
      const nextSerializedCache: Record<string, string> = {};
      const ids: string[] = [];

      targetProjects.forEach((project) => {
        ids.push(project.projectId);
        nextRefCache[project.projectId] = project;
        const hasChangedRef = projectRefCacheRef.current[project.projectId] !== project;
        if (hasChangedRef || !projectSerializedCacheRef.current[project.projectId]) {
          const serialized = stringifyForStorage(project);
          localStorage.setItem(`${PROJECT_DATA_STORAGE_PREFIX}${project.projectId}`, serialized);
          nextSerializedCache[project.projectId] = serialized;
        } else {
          nextSerializedCache[project.projectId] = projectSerializedCacheRef.current[project.projectId];
        }
      });

      Object.keys(projectRefCacheRef.current).forEach((oldId) => {
        if (!nextRefCache[oldId]) {
          localStorage.removeItem(`${PROJECT_DATA_STORAGE_PREFIX}${oldId}`);
        }
      });

      localStorage.setItem(PROJECT_INDEX_STORAGE_KEY, JSON.stringify(ids));
      localStorage.removeItem(STORAGE_KEY);
      projectRefCacheRef.current = nextRefCache;
      projectSerializedCacheRef.current = nextSerializedCache;
      setLastSavedAt(new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } catch {
      // ignore storage write errors
    }
  }, []);

  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  useEffect(() => {
    csvHeadersRef.current = csvHeaders;
    csvDraftRowsRef.current = csvDraftRows;
  }, [csvHeaders, csvDraftRows]);

  const loadWorkspaceStateFromStorage = useCallback((preserveSelection: boolean): void => {
    try {
      let loadedProjects: Project[] = [];
      const loadedSerialized: Record<string, string> = {};
      const legacyDateRisks: LegacyDateRiskEntry[] = [];

      const indexRaw = localStorage.getItem(PROJECT_INDEX_STORAGE_KEY);
      if (indexRaw) {
        const ids = JSON.parse(indexRaw) as string[];
        if (Array.isArray(ids) && ids.length > 0) {
          loadedProjects = ids
            .map((id) => {
              const rawProject = localStorage.getItem(`${PROJECT_DATA_STORAGE_PREFIX}${id}`);
              if (!rawProject) {
                return null;
              }
              loadedSerialized[id] = rawProject;
              const parsed = parseStorageJson<Partial<Project> & { workDateMain?: string }>(rawProject);
              if (!parsed) {
                return null;
              }
              legacyDateRisks.push(...collectLegacyDateRisks("project_index_storage", parsed));
              return normalizeProject(parsed);
            })
            .filter((project): project is Project => project !== null);
        }
      }

      if (!loadedProjects.length) {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = parseStorageJson<Array<Partial<Project> & { workDateMain?: string }>>(raw) ?? [];
          if (parsed.length) {
            parsed.forEach((item) => {
              legacyDateRisks.push(...collectLegacyDateRisks("legacy_storage_v5", item));
            });
            loadedProjects = parsed.map((item) => normalizeProject(item));
            loadedProjects.forEach((project) => {
              loadedSerialized[project.projectId] = stringifyForStorage(project);
            });
          }
        }
      }

      if (loadedProjects.length > 0) {
        setProjects(loadedProjects);
        setSelectedId((prev) => {
          if (!preserveSelection) {
            return "";
          }
          return loadedProjects.some((project) => project.projectId === prev) ? prev : "";
        });
        projectRefCacheRef.current = Object.fromEntries(loadedProjects.map((project) => [project.projectId, project]));
        projectSerializedCacheRef.current = loadedSerialized;
      } else if (!preserveSelection) {
        setProjects([]);
        setSelectedId("");
        projectRefCacheRef.current = {};
        projectSerializedCacheRef.current = {};
      }

      if (legacyDateRisks.length > 0 && localStorage.getItem(LEGACY_DATE_TRACE_DEBUG_KEY) === "1") {
        const w = window as Window & { __sekouLegacyDateRisk?: LegacyDateRiskEntry[] };
        w.__sekouLegacyDateRisk = legacyDateRisks;
        console.warn("[sekou][legacy-date-risk]", legacyDateRisks);
      }

      const csvEditorRaw = localStorage.getItem(CSV_EDITOR_STORAGE_KEY);
      if (csvEditorRaw) {
        const parsed = parseStorageJson<{ headers?: string[]; rows?: CsvRecord[] }>(csvEditorRaw);
        if (parsed && Array.isArray(parsed.headers) && Array.isArray(parsed.rows)) {
          const headers = parsed.headers.filter((header) => typeof header === "string" && header.trim().length > 0);
          const rows = normalizeCsvRows(parsed.rows, headers);
          setCsvHeaders(headers);
          setCsvDraftRows(rows);
          csvSerializedCacheRef.current = csvEditorRaw;
        } else {
          setCsvHeaders([]);
          setCsvDraftRows([]);
          csvSerializedCacheRef.current = "";
        }
      } else {
        setCsvHeaders([]);
        setCsvDraftRows([]);
        csvSerializedCacheRef.current = "";
      }

      const rawUiPreset = localStorage.getItem(UI_PRESET_STORAGE_KEY);
      if (rawUiPreset === "standard" || rawUiPreset === "field" || rawUiPreset === "compact") {
        setUiPreset(rawUiPreset);
      } else {
        setUiPreset("standard");
      }

      const loadedUsers = ensureUsers() as UserAccount[];
      if (Array.isArray(loadedUsers) && loadedUsers.length > 0) {
        let nextUsers = loadedUsers;
        const testSeeded = localStorage.getItem(TEST_EDITOR_SEED_STORAGE_KEY) === "1";
        if (!testSeeded) {
          const seeded = seedTestEditorUsers(loadedUsers);
          nextUsers = seeded.nextUsers;
          if (seeded.addedCount > 0) {
            localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(nextUsers));
          }
          localStorage.setItem(TEST_EDITOR_SEED_STORAGE_KEY, "1");
        }
        setUsers(nextUsers);
      } else {
        setUsers([]);
      }
      const sessionUser = getSessionUser();
      setCurrentUserId(sessionUser?.id ?? "");
      setAccessLogs(getLoginAttempts());

      const auditRaw = localStorage.getItem(AUDIT_STORAGE_KEY);
      if (auditRaw) {
        const parsed = parseStorageJson<AuditLog[]>(auditRaw);
        if (Array.isArray(parsed)) {
          setAuditLogs(parsed);
        }
      } else {
        setAuditLogs([]);
      }

      const revisionRaw = localStorage.getItem(REVISION_STORAGE_KEY);
      if (revisionRaw) {
        const parsed = parseStorageJson<ProjectRevision[]>(revisionRaw);
        if (Array.isArray(parsed)) {
          const migrated = parsed.map((revision) => {
            const legacy = normalizeLayoutAnnotations(revision.snapshot?.layoutAnnotations || []);
            const parsedV2 = normalizeLayoutAnnotationsV2(revision.snapshot?.layoutAnnotationsV2 || []);
            const layoutAnnotationsV2 = parsedV2.length ? parsedV2 : legacyLayoutAnnotationsToV2(legacy);
            const layoutAnnotations = parsedV2.length ? layoutAnnotationsV2ToLegacy(layoutAnnotationsV2) : legacy;
            return {
              ...revision,
              snapshot: {
                ...revision.snapshot,
                layoutAnnotations,
                layoutAnnotationsV2,
              },
            };
          });
          setRevisions(migrated);
        }
      } else {
        setRevisions([]);
      }
    } catch {
      // keep existing in-memory state when storage payload is broken
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const bootstrapSharedStorage = async () => {
      await pullSharedStorageSnapshot();
      if (!cancelled) {
        setSharedStorageReady(true);
      }
    };
    void bootstrapSharedStorage();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sharedStorageReady) {
      return;
    }
    loadWorkspaceStateFromStorage(false);
    setHydrated(true);
  }, [sharedStorageReady, loadWorkspaceStateFromStorage]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    const handleSharedStorageUpdated = () => {
      loadWorkspaceStateFromStorage(true);
    };
    window.addEventListener(SHARED_STORAGE_UPDATED_EVENT, handleSharedStorageUpdated);
    return () => {
      window.removeEventListener(SHARED_STORAGE_UPDATED_EVENT, handleSharedStorageUpdated);
    };
  }, [hydrated, loadWorkspaceStateFromStorage]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      persistProjectsToStorage(projects);
    }, PROJECT_SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [projects, hydrated, persistProjectsToStorage]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    if (sharedSyncTimerRef.current) {
      window.clearTimeout(sharedSyncTimerRef.current);
    }
    sharedSyncTimerRef.current = window.setTimeout(() => {
      void pushSharedStorageSnapshot();
    }, 900);
    return () => {
      if (sharedSyncTimerRef.current) {
        window.clearTimeout(sharedSyncTimerRef.current);
      }
    };
  }, [
    projects,
    users,
    auditLogs,
    revisions,
    csvHeaders,
    csvDraftRows,
    scheduleTemplates,
    detailPhotoTemplates,
    partyTemplates,
    partyCompanyTemplates,
    layoutTemplates,
    hydrated,
  ]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    const flushNow = () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
      persistProjectsToStorage(projectsRef.current);
      if (csvSaveTimerRef.current) {
        window.clearTimeout(csvSaveTimerRef.current);
      }
      const serialized = stringifyForStorage({ headers: csvHeadersRef.current, rows: csvDraftRowsRef.current });
      if (serialized !== csvSerializedCacheRef.current) {
        localStorage.setItem(CSV_EDITOR_STORAGE_KEY, serialized);
        csvSerializedCacheRef.current = serialized;
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushNow();
      }
    };

    window.addEventListener("pagehide", flushNow);
    window.addEventListener("beforeunload", flushNow);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", flushNow);
      window.removeEventListener("beforeunload", flushNow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [hydrated, persistProjectsToStorage]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  }, [users, hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    localStorage.setItem(AUDIT_STORAGE_KEY, stringifyForStorage(auditLogs));
  }, [auditLogs, hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    localStorage.setItem(REVISION_STORAGE_KEY, stringifyForStorage(revisions));
  }, [revisions, hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    if (csvSaveTimerRef.current) {
      window.clearTimeout(csvSaveTimerRef.current);
    }
    csvSaveTimerRef.current = window.setTimeout(() => {
      const serialized = stringifyForStorage({ headers: csvHeaders, rows: csvDraftRows });
      if (serialized !== csvSerializedCacheRef.current) {
        localStorage.setItem(CSV_EDITOR_STORAGE_KEY, serialized);
        csvSerializedCacheRef.current = serialized;
      }
    }, CSV_SAVE_DEBOUNCE_MS);
    return () => {
      if (csvSaveTimerRef.current) {
        window.clearTimeout(csvSaveTimerRef.current);
      }
    };
  }, [csvHeaders, csvDraftRows, hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    localStorage.setItem(UI_PRESET_STORAGE_KEY, uiPreset);
  }, [hydrated, uiPreset]);

  useEffect(() => {
    try {
      const scheduleRaw = localStorage.getItem(SCHEDULE_TEMPLATE_STORAGE_KEY);
      const scheduleProcedureRaw = localStorage.getItem(SCHEDULE_PROCEDURE_TEMPLATE_STORAGE_KEY);
      const detailRaw = localStorage.getItem(DETAIL_PHOTO_TEMPLATE_STORAGE_KEY);
      const partyRaw = localStorage.getItem(PARTY_TEMPLATE_STORAGE_KEY);
      const partyCompanyRaw = localStorage.getItem(PARTY_COMPANY_TEMPLATE_STORAGE_KEY);
      const layoutRaw = localStorage.getItem(LAYOUT_TEMPLATE_STORAGE_KEY);
      const scheduleParsed = parseStorageJson<Array<SimpleTemplate<ScheduleRow[]>>>(scheduleRaw) ?? [];
      const scheduleProcedureParsed = parseStorageJson<ScheduleProcedureTemplate[]>(scheduleProcedureRaw);
      const detailParsed = parseStorageJson<Array<SimpleTemplate<PhotoSlots>>>(detailRaw) ?? [];
      const partyParsed = parseStorageJson<Array<SimpleTemplate<Project["relatedParties"]>>>(partyRaw) ?? [];
      const partyCompanyParsedRaw = parseStorageJson<Record<RelatedPartyKey, PartyCompanyTemplatePreset[]>>(partyCompanyRaw);
      const partyCompanyParsed = partyCompanyParsedRaw
        ? normalizePartyCompanyTemplateMap(partyCompanyParsedRaw)
        : createEmptyPartyCompanyTemplates();
      const layoutParsed = parseStorageJson<Array<SimpleTemplate<LayoutTemplatePayload>>>(layoutRaw) ?? [];

      if (Array.isArray(scheduleParsed)) {
        setScheduleTemplates(scheduleParsed);
        if (scheduleParsed[0]) {
          setSelectedScheduleTemplateId(scheduleParsed[0].id);
        }
      }
      const normalizedProcedures = normalizeScheduleProcedureTemplates(scheduleProcedureParsed);
      setScheduleProcedureTemplates(normalizedProcedures);
      setSelectedScheduleProcedureTemplateId(normalizedProcedures[0]?.id ?? "");
      if (Array.isArray(detailParsed)) {
        setDetailPhotoTemplates(detailParsed);
        if (detailParsed[0]) {
          setSelectedDetailPhotoTemplateId(detailParsed[0].id);
        }
      }
      if (Array.isArray(partyParsed)) {
        setPartyTemplates(partyParsed);
        if (partyParsed[0]) {
          setSelectedPartyTemplateId(partyParsed[0].id);
        }
      }
      setPartyCompanyTemplates(partyCompanyParsed);
      if (Array.isArray(layoutParsed)) {
        const normalized = layoutParsed.map((template) => ({
          ...template,
          payload: (() => {
            const legacy = normalizeLayoutAnnotations(template.payload?.layoutAnnotations || []);
            const parsedV2 = normalizeLayoutAnnotationsV2(template.payload?.layoutAnnotationsV2 || []);
            const layoutAnnotationsV2 = parsedV2.length ? parsedV2 : legacyLayoutAnnotationsToV2(legacy);
            const layoutAnnotations = parsedV2.length ? layoutAnnotationsV2ToLegacy(layoutAnnotationsV2) : legacy;
            return {
              layoutImageDataUrl: template.payload?.layoutImageDataUrl || "",
              layoutPhotos: clonePhotoSlots(template.payload?.layoutPhotos || []),
              layoutAnnotationsV2,
              layoutAnnotations,
            };
          })(),
        }));
        setLayoutTemplates(normalized);
        if (layoutParsed[0]) {
          setSelectedLayoutTemplateId(layoutParsed[0].id);
        }
      }
    } catch {
      // ignore invalid template cache
    }
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    localStorage.setItem(SCHEDULE_TEMPLATE_STORAGE_KEY, stringifyForStorage(scheduleTemplates));
  }, [scheduleTemplates, hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    localStorage.setItem(SCHEDULE_PROCEDURE_TEMPLATE_STORAGE_KEY, stringifyForStorage(scheduleProcedureTemplates));
  }, [scheduleProcedureTemplates, hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    localStorage.setItem(DETAIL_PHOTO_TEMPLATE_STORAGE_KEY, stringifyForStorage(detailPhotoTemplates));
  }, [detailPhotoTemplates, hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    localStorage.setItem(PARTY_TEMPLATE_STORAGE_KEY, stringifyForStorage(partyTemplates));
  }, [partyTemplates, hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    localStorage.setItem(PARTY_COMPANY_TEMPLATE_STORAGE_KEY, stringifyForStorage(partyCompanyTemplates));
  }, [partyCompanyTemplates, hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    localStorage.setItem(LAYOUT_TEMPLATE_STORAGE_KEY, stringifyForStorage(layoutTemplates));
  }, [layoutTemplates, hydrated]);

  useEffect(() => {
    setPartyTemplateSelections(EMPTY_PARTY_TEMPLATE_SELECTIONS);
  }, [selectedId]);

  const selectedProject = useMemo(
    () =>
      projects.find((project) => project.projectId === selectedId)
      ?? createBlankProject({ projectId: "" }),
    [projects, selectedId],
  );
  const hasSelectedProject = useMemo(
    () => !!selectedId && projects.some((project) => project.projectId === selectedId),
    [projects, selectedId],
  );
  const filteredProjectOptions = useMemo(() => {
    const keyword = projectSearchText.trim().toLowerCase();
    if (!keyword) {
      return projects.slice(0, 100);
    }
    return projects
      .filter((project) => {
        const haystack = [
          project.projectId,
          project.propertyName,
        ].join(" ").toLowerCase();
        return haystack.includes(keyword);
      })
      .slice(0, 100);
  }, [projects, projectSearchText]);
  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId && user.active && user.approvalStatus === "approved") ?? null,
    [users, currentUserId],
  );
  const userScopedProjectAuditLogs = useMemo(() => {
    if (!currentUser) {
      return [] as AuditLog[];
    }
    return auditLogs
      .filter((log) => log.projectId === selectedProject.projectId && log.userId === currentUser.id)
      .slice(0, 30);
  }, [auditLogs, selectedProject.projectId, currentUser]);
  const userScopedGlobalAuditLogs = useMemo(() => {
    if (!currentUser) {
      return [] as AuditLog[];
    }
    return auditLogs.filter((log) => log.userId === currentUser.id).slice(0, 30);
  }, [auditLogs, currentUser]);
  const adminFilteredAuditLogs = useMemo(() => {
    if (!currentUser || !isAdminLikeRole(currentUser.role)) {
      return [] as AuditLog[];
    }
    if (operationLogUserFilter === "all") {
      return auditLogs;
    }
    return auditLogs.filter((log) => log.userId === operationLogUserFilter);
  }, [auditLogs, currentUser, operationLogUserFilter]);
  const adminVisibleAuditLogs = useMemo(
    () => (operationLogExpanded ? adminFilteredAuditLogs : adminFilteredAuditLogs.slice(0, 5)),
    [adminFilteredAuditLogs, operationLogExpanded],
  );
  const adminAuditUserOptions = useMemo(() => {
    if (!currentUser || !isAdminLikeRole(currentUser.role)) {
      return [] as Array<{ id: string; label: string }>;
    }
    const labels = new Map<string, string>();
    users.forEach((user) => {
      labels.set(user.id, `${user.name} / ${user.email}`);
    });
    auditLogs.forEach((log) => {
      if (!labels.has(log.userId)) {
        labels.set(log.userId, log.userName || "不明ユーザー");
      }
    });
    return Array.from(labels.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "ja-JP"));
  }, [auditLogs, currentUser, users]);
  const canEdit = !!currentUser && currentUser.role !== "viewer";
  const canAdmin = !!currentUser && isAdminLikeRole(currentUser.role);
  const canApprove = !!currentUser && (isAdminLikeRole(currentUser.role) || currentUser.role === "editor");
  const userStats = useMemo(() => {
    const total = users.length;
    const admins = users.filter((user) => isAdminLikeRole(user.role)).length;
    const activeAdmins = users.filter((user) => isAdminLikeRole(user.role) && user.active && user.approvalStatus === "approved").length;
    const activeUsers = users.filter((user) => user.active).length;
    const approvedUsers = users.filter((user) => user.active && user.approvalStatus === "approved").length;
    const pendingUsers = users.filter((user) => user.approvalStatus === "pending").length;
    return { total, admins, activeAdmins, activeUsers, approvedUsers, pendingUsers };
  }, [users]);
  const otherProjects = useMemo(
    () => projects.filter((project) => project.projectId !== selectedProject.projectId),
    [projects, selectedProject.projectId],
  );
  const hasOtherProjects = otherProjects.length > 0;
  const copySourceProject = useMemo(
    () => projects.find((project) => project.projectId === copySourceProjectId),
    [projects, copySourceProjectId],
  );
  const selectedScheduleTemplate = useMemo(
    () => scheduleTemplates.find((template) => template.id === selectedScheduleTemplateId),
    [scheduleTemplates, selectedScheduleTemplateId],
  );
  const selectedScheduleProcedureTemplate = useMemo(
    () => scheduleProcedureTemplates.find((template) => template.id === selectedScheduleProcedureTemplateId),
    [scheduleProcedureTemplates, selectedScheduleProcedureTemplateId],
  );
  const selectedDetailPhotoTemplate = useMemo(
    () => detailPhotoTemplates.find((template) => template.id === selectedDetailPhotoTemplateId),
    [detailPhotoTemplates, selectedDetailPhotoTemplateId],
  );
  const selectedPartyTemplate = useMemo(
    () => partyTemplates.find((template) => template.id === selectedPartyTemplateId),
    [partyTemplates, selectedPartyTemplateId],
  );
  const selectedLayoutTemplate = useMemo(
    () => layoutTemplates.find((template) => template.id === selectedLayoutTemplateId),
    [layoutTemplates, selectedLayoutTemplateId],
  );
  const activeTemplateMeta = TEMPLATE_SCOPE_META[templateScope];
  const activeTemplateList = useMemo(() => {
    if (templateScope === "schedule") {
      return scheduleTemplates;
    }
    if (templateScope === "detailPhotos") {
      return detailPhotoTemplates;
    }
    if (templateScope === "relatedParties") {
      return partyTemplates;
    }
    return layoutTemplates;
  }, [templateScope, scheduleTemplates, detailPhotoTemplates, partyTemplates, layoutTemplates]);
  const activeTemplateId =
    templateScope === "schedule"
      ? selectedScheduleTemplateId
      : templateScope === "detailPhotos"
        ? selectedDetailPhotoTemplateId
        : templateScope === "relatedParties"
          ? selectedPartyTemplateId
          : selectedLayoutTemplateId;
  const hasActiveTemplateSelection = activeTemplateList.some((template) => template.id === activeTemplateId);
  const csvFilteredRows = useMemo(() => {
    const keyword = deferredCsvSearch.trim().toLowerCase();
    const rows = csvDraftRows.map((row, index) => ({ row, index }));
    if (!keyword) {
      return rows;
    }
    return rows.filter(({ row }) =>
      csvHeaders.some((header) => String(row[header] ?? "").toLowerCase().includes(keyword)),
    );
  }, [csvDraftRows, csvHeaders, deferredCsvSearch]);
  const csvTotalPages = Math.max(1, Math.ceil(csvFilteredRows.length / csvPageSize));
  const csvVisibleRows = useMemo(() => {
    const start = csvPage * csvPageSize;
    return csvFilteredRows.slice(start, start + csvPageSize);
  }, [csvFilteredRows, csvPage, csvPageSize]);
  const csvSelectedSet = useMemo(() => new Set(csvSelectedRows), [csvSelectedRows]);
  const csvVisibleSelectedCount = useMemo(
    () => csvVisibleRows.filter(({ index }) => csvSelectedSet.has(index)).length,
    [csvVisibleRows, csvSelectedSet],
  );
  const csvAllVisibleSelected = csvVisibleRows.length > 0 && csvVisibleSelectedCount === csvVisibleRows.length;
  const csvColumnWidthMap = useMemo(() => {
    const map: Record<string, CSSProperties> = {};
    csvHeaders.forEach((header) => {
      const headerLen = getCsvHeaderLabel(header).length;
      const maxValueLen = csvDraftRows.reduce((max, row) => {
        const nextLen = String(row[header] ?? "").length;
        return Math.max(max, nextLen);
      }, 0);
      const charWidth = clamp(Math.max(headerLen, maxValueLen) + 2, 10, 36);
      map[header] = { minWidth: `${charWidth}ch` };
    });
    return map;
  }, [csvHeaders, csvDraftRows]);
  const projectRevisions = useMemo(
    () => revisions.filter((revision) => revision.projectId === selectedProject.projectId),
    [revisions, selectedProject.projectId],
  );
  const selectedRevision = useMemo(
    () => projectRevisions.find((revision) => revision.id === selectedRevisionId) ?? null,
    [projectRevisions, selectedRevisionId],
  );
  function appendAudit(action: string, detail: string, projectId = selectedProject.projectId): void {
    if (!currentUser) {
      return;
    }
    const log: AuditLog = {
      id: uid("audit"),
      projectId,
      at: new Date().toISOString(),
      userId: currentUser.id,
      userName: currentUser.name,
      action,
      detail,
    };
    setAuditLogs((prev) => [log, ...prev].slice(0, MAX_AUDIT_LOGS));
  }

  function buildSnapshot(project: Project): ProjectSnapshot {
    return {
      propertyName: project.propertyName,
      propertyAddress: project.propertyAddress,
      titleSubject: project.titleSubject,
      workDateStart: project.workDateStart,
      workDateEnd: project.workDateEnd,
      outageDateStart: project.outageDateStart,
      outageDateEnd: project.outageDateEnd,
      outageTimeStart: project.outageTimeStart,
      outageTimeEnd: project.outageTimeEnd,
      outageEnabled: project.outageEnabled,
      selectedWorkCodes: [...project.selectedWorkCodes],
      noteSpecial: project.noteSpecial,
      noteApprovalExtra: project.noteApprovalExtra,
      coverRecipientSuffix: project.coverRecipientSuffix,
      pdfTemplateId: project.pdfTemplateId,
      pdfCompanyName: project.pdfCompanyName,
      pdfTeam: project.pdfTeam,
      pdfContactPerson: project.pdfContactPerson,
      pdfAddress: project.pdfAddress,
      pdfEmail: project.pdfEmail,
      pdfTel: project.pdfTel,
      pdfFax: project.pdfFax,
      layoutAnnotations: cloneLayoutAnnotations(project.layoutAnnotations),
      layoutAnnotationsV2: cloneLayoutAnnotationsV2(project.layoutAnnotationsV2),
      scheduleRows: project.scheduleRows.map((row) => ({ ...row })),
      relatedParties: cloneRelatedParties(project.relatedParties),
    };
  }

  function createRevision(project: Project, label: string): void {
    if (!currentUser) {
      return;
    }
    const revision: ProjectRevision = {
      id: uid("rev"),
      projectId: project.projectId,
      at: new Date().toISOString(),
      userId: currentUser.id,
      userName: currentUser.name,
      label,
      snapshot: buildSnapshot(project),
    };
    setRevisions((prev) => [revision, ...prev].slice(0, MAX_REVISIONS));
    setSelectedRevisionId(revision.id);
  }

  const dateRangeLabel = useMemo(
    () => formatDateRange(selectedProject.workDateStart, selectedProject.workDateEnd),
    [selectedProject.workDateStart, selectedProject.workDateEnd],
  );
  const outageDateTimeLabel = useMemo(
    () =>
      formatDateTimeRange(
        selectedProject.outageDateStart,
        selectedProject.outageTimeStart,
        selectedProject.outageDateEnd,
        selectedProject.outageTimeEnd,
      ),
    [
      selectedProject.outageDateStart,
      selectedProject.outageDateEnd,
      selectedProject.outageTimeStart,
      selectedProject.outageTimeEnd,
    ],
  );
  const selectedWorks = useMemo(
    () => WORK_MASTER.filter((work) => selectedProject.selectedWorkCodes.includes(work.code)),
    [selectedProject.selectedWorkCodes],
  );
  const activeLogoSrc = PDF_LOGO_SRC;
  const activePdfTemplate = useMemo(
    () => PDF_TEMPLATE_PRESET_MAP[normalizePdfTemplateId(selectedProject.pdfTemplateId)],
    [selectedProject.pdfTemplateId],
  );
  const activeParties = selectedProject.relatedParties;
  const partyEntries = useMemo(
    () => (Object.keys(selectedProject.relatedParties) as Array<RelatedPartyKey>),
    [selectedProject.relatedParties],
  );
  const detailPhotos = selectedProject.detailPhotos;
  const layoutPhotos = selectedProject.layoutPhotos;
  const partySlideSize = 2;
  const totalPartySlides = Math.max(1, Math.ceil(partyEntries.length / partySlideSize));
  const detailPhotoSize = 2;
  const layoutPhotoSize = 2;
  const totalDetailPhotoSlides = Math.max(1, Math.ceil(detailPhotos.length / detailPhotoSize));
  const totalLayoutPhotoSlides = Math.max(1, Math.ceil(layoutPhotos.length / layoutPhotoSize));
  const currentDetailSlidePhotos = useMemo(() => {
    const start = detailPhotoSlide * detailPhotoSize;
    return detailPhotos.slice(start, start + detailPhotoSize);
  }, [detailPhotos, detailPhotoSlide]);
  const currentLayoutSlidePhotos = useMemo(() => {
    const start = layoutPhotoSlide * layoutPhotoSize;
    return layoutPhotos.slice(start, start + layoutPhotoSize);
  }, [layoutPhotos, layoutPhotoSlide]);
  const layoutEditorSelectedIdSet = useMemo(
    () => new Set(layoutEditorSelectedIds),
    [layoutEditorSelectedIds],
  );
  const selectedLayoutAnnotations = useMemo(
    () => layoutEditorAnnotations.filter((annotation) => layoutEditorSelectedIdSet.has(annotation.id)),
    [layoutEditorAnnotations, layoutEditorSelectedIdSet],
  );
  const selectedEditableLayoutAnnotations = useMemo(
    () => selectedLayoutAnnotations.filter((annotation) => annotation.visible !== false && !annotation.locked),
    [selectedLayoutAnnotations],
  );
  const selectedLayoutAnnotation = useMemo(
    () => (selectedLayoutAnnotations.length === 1 ? selectedLayoutAnnotations[0] : null),
    [selectedLayoutAnnotations],
  );
  const selectedLayoutAnnotationBounds = useMemo(
    () => (selectedLayoutAnnotation ? getAnnotationBounds(selectedLayoutAnnotation) : null),
    [selectedLayoutAnnotation],
  );
  const layoutEditorAnnotationListEntries = useMemo<LayoutAnnotationListEntry[]>(() => {
    const annotationMap = new Map(layoutEditorAnnotations.map((annotation) => [annotation.id, annotation] as const));
    const chainGroupEntries = new Map<string, LayoutAnnotationListEntry>();
    const entries: LayoutAnnotationListEntry[] = [];
    let chainGroupNumber = 1;
    layoutEditorAnnotations.forEach((annotation) => {
      const isChainSegment = annotation.type === "arrow" && annotation.arrowHead === false && Boolean(annotation.groupId);
      if (!isChainSegment || !annotation.groupId) {
        entries.push({
          key: `single_${annotation.id}`,
          annotationIds: [annotation.id],
          primaryId: annotation.id,
          title: getLayoutAnnotationDisplayName(annotation),
          visible: annotation.visible !== false,
          locked: annotation.locked === true,
          isGroup: false,
        });
        return;
      }
      const existingEntry = chainGroupEntries.get(annotation.groupId);
      if (!existingEntry) {
        const nextEntry: LayoutAnnotationListEntry = {
          key: `group_${annotation.groupId}`,
          annotationIds: [annotation.id],
          primaryId: annotation.id,
          title: `折れ線グループ ${chainGroupNumber}`,
          visible: annotation.visible !== false,
          locked: annotation.locked === true,
          isGroup: true,
        };
        chainGroupNumber += 1;
        chainGroupEntries.set(annotation.groupId, nextEntry);
        entries.push(nextEntry);
        return;
      }
      existingEntry.annotationIds.push(annotation.id);
    });
    return entries.map((entry) => {
      if (!entry.isGroup) {
        return entry;
      }
      const members = entry.annotationIds
        .map((id) => annotationMap.get(id))
        .filter((annotation): annotation is LayoutAnnotation => Boolean(annotation));
      if (!members.length) {
        return entry;
      }
      const visible = members.every((annotation) => annotation.visible !== false);
      const locked = members.every((annotation) => annotation.locked === true);
      return {
        ...entry,
        visible,
        locked,
        title: `${entry.title}（${members.length}本）`,
      };
    });
  }, [layoutEditorAnnotations]);
  const selectedLayoutGroupBounds = useMemo(
    () => (selectedLayoutAnnotations.length > 1 ? getCombinedAnnotationBounds(selectedLayoutAnnotations.filter((annotation) => annotation.visible !== false)) : null),
    [selectedLayoutAnnotations],
  );
  const selectedEditableLayoutGroupBounds = useMemo(
    () => (selectedEditableLayoutAnnotations.length ? getCombinedAnnotationBounds(selectedEditableLayoutAnnotations) : null),
    [selectedEditableLayoutAnnotations],
  );
  const canUndoLayoutEditor = layoutEditorHistoryIndex > 0;
  const canRedoLayoutEditor = layoutEditorHistoryIndex >= 0 && layoutEditorHistoryIndex < layoutEditorHistory.length - 1;
  const hasLayoutSelection = layoutEditorSelectedIds.length > 0;
  const layoutEditorZoomPercent = Math.round(layoutEditorZoom * 100);
  useEffect(() => {
    const existingIds = new Set(layoutEditorAnnotations.map((annotation) => annotation.id));
    setLayoutEditorSelectedIds((prev) => prev.filter((id) => existingIds.has(id)));
    setLayoutEditorSelectedId((prev) => (prev && existingIds.has(prev) ? prev : ""));
  }, [layoutEditorAnnotations]);
  useEffect(() => {
    if (!selectedLayoutAnnotation) {
      return;
    }
    setLayoutEditorColor(selectedLayoutAnnotation.color);
    if (selectedLayoutAnnotation.type === "text") {
      setLayoutEditorText(selectedLayoutAnnotation.text || "注記");
      setLayoutEditorFontFamily(normalizeFontFamily(selectedLayoutAnnotation.fontFamily));
      setLayoutEditorTextStrokeColor(
        normalizeAnnotationColor(selectedLayoutAnnotation.textStrokeColor || DEFAULT_TEXT_STROKE_COLOR),
      );
      setLayoutEditorTextStrokeWidth(
        normalizeTextStrokeWidth(selectedLayoutAnnotation.textStrokeWidth, DEFAULT_TEXT_STROKE_WIDTH),
      );
      return;
    }
    setLayoutEditorStrokeWidth(selectedLayoutAnnotation.strokeWidth);
    if (selectedLayoutAnnotation.type === "arrow") {
      setLayoutEditorArrowHeadEnabled(selectedLayoutAnnotation.arrowHead !== false);
      return;
    }
    if (selectedLayoutAnnotation.type === "rect" || selectedLayoutAnnotation.type === "polygon") {
      setLayoutEditorFillColor(selectedLayoutAnnotation.fillColor || DEFAULT_ANNOTATION_FILL_COLOR);
      setLayoutEditorFillOpacity(normalizeFillOpacity(selectedLayoutAnnotation.fillOpacity, DEFAULT_ANNOTATION_FILL_OPACITY));
      if (selectedLayoutAnnotation.type === "polygon") {
        setLayoutEditorPolygonSides(normalizePolygonSides(selectedLayoutAnnotation.sides, 6));
      }
    }
  }, [selectedLayoutAnnotation?.id]);
  useEffect(() => {
    if (!layoutEditorOpen) {
      return;
    }
    if (!layoutEditorSelectedIds.length) {
      setLayoutEditorAdvancedOpen(false);
      setLayoutEditorAdvancedTab("transform");
    }
  }, [layoutEditorOpen, layoutEditorSelectedIds]);
  useEffect(() => {
    if (!layoutEditorOpen) {
      return;
    }
    const serialized = JSON.stringify(layoutEditorAnnotations);
    if (serialized === layoutEditorHistorySerializedRef.current) {
      return;
    }
    if (layoutEditorHistorySuppressRef.current) {
      layoutEditorHistorySuppressRef.current = false;
      layoutEditorHistorySerializedRef.current = serialized;
      return;
    }
    setLayoutEditorHistory((prev) => {
      const branch = prev.slice(0, layoutEditorHistoryIndex + 1);
      const next = [...branch, cloneLayoutAnnotations(layoutEditorAnnotations)];
      if (next.length <= MAX_ANNOTATION_HISTORY) {
        return next;
      }
      return next.slice(next.length - MAX_ANNOTATION_HISTORY);
    });
    setLayoutEditorHistoryIndex((prev) => {
      const next = prev + 1;
      return next >= MAX_ANNOTATION_HISTORY ? MAX_ANNOTATION_HISTORY - 1 : next;
    });
    layoutEditorHistorySerializedRef.current = serialized;
  }, [layoutEditorAnnotations, layoutEditorHistoryIndex, layoutEditorOpen]);

  useEffect(() => {
    if (!layoutEditorOpen) {
      return;
    }
    function isEditableTarget(target: EventTarget | null): boolean {
      const element = target as HTMLElement | null;
      if (!element) {
        return false;
      }
      const tagName = element.tagName.toLowerCase();
      return tagName === "input" || tagName === "textarea" || element.isContentEditable;
    }
    function handleLayoutEditorHotkey(event: KeyboardEvent): void {
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && !event.altKey && key === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redoLayoutEditor();
        } else {
          undoLayoutEditor();
        }
        return;
      }
      if ((event.metaKey || event.ctrlKey) && !event.altKey && key === "y") {
        event.preventDefault();
        redoLayoutEditor();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && !event.altKey && key === "d") {
        if (isEditableTarget(event.target)) {
          return;
        }
        event.preventDefault();
        duplicateSelectedLayoutAnnotation();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && !event.altKey && key === "a") {
        if (isEditableTarget(event.target)) {
          return;
        }
        event.preventDefault();
        const visibleIds = layoutEditorAnnotations
          .filter((annotation) => annotation.visible !== false)
          .map((annotation) => annotation.id);
        setLayoutEditorSelectedIds(visibleIds);
        setLayoutEditorSelectedId(visibleIds[visibleIds.length - 1] ?? "");
        return;
      }
      if (key === "escape") {
        event.preventDefault();
        setLayoutEditorSelectedId("");
        setLayoutEditorSelectedIds([]);
        setLayoutEditorDrawing(null);
        setLayoutEditorMove(null);
        setLayoutEditorResize(null);
        setLayoutEditorRotate(null);
        setLayoutEditorMarquee(null);
        resetLayoutEditorChainSession();
        setLayoutEditorGuideLines([]);
        return;
      }
      if (key.startsWith("arrow") && layoutEditorSelectedIds.length) {
        if (isEditableTarget(event.target)) {
          return;
        }
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        if (key === "arrowleft") {
          nudgeSelectedLayoutAnnotations(-step, 0);
        } else if (key === "arrowright") {
          nudgeSelectedLayoutAnnotations(step, 0);
        } else if (key === "arrowup") {
          nudgeSelectedLayoutAnnotations(0, -step);
        } else if (key === "arrowdown") {
          nudgeSelectedLayoutAnnotations(0, step);
        }
        return;
      }
      if ((key === "delete" || key === "backspace") && layoutEditorSelectedIds.length) {
        if (isEditableTarget(event.target)) {
          return;
        }
        event.preventDefault();
        removeSelectedLayoutAnnotation();
      }
    }
    window.addEventListener("keydown", handleLayoutEditorHotkey);
    return () => window.removeEventListener("keydown", handleLayoutEditorHotkey);
  }, [
    layoutEditorOpen,
    canUndoLayoutEditor,
    canRedoLayoutEditor,
    layoutEditorSelectedIds,
    layoutEditorHistory,
    layoutEditorHistoryIndex,
    layoutEditorAnnotations,
  ]);

  useEffect(() => {
    if (!layoutEditorOpen) {
      return;
    }
    function isEditableTarget(target: EventTarget | null): boolean {
      const element = target as HTMLElement | null;
      if (!element) {
        return false;
      }
      const tagName = element.tagName.toLowerCase();
      return tagName === "input" || tagName === "textarea" || element.isContentEditable;
    }
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.code !== "Space" || isEditableTarget(event.target)) {
        return;
      }
      event.preventDefault();
      setLayoutEditorSpacePressed(true);
    }
    function handleKeyUp(event: KeyboardEvent): void {
      if (event.code !== "Space") {
        return;
      }
      setLayoutEditorSpacePressed(false);
    }
    function handleBlur(): void {
      setLayoutEditorSpacePressed(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [layoutEditorOpen]);

  useEffect(() => {
    if (!layoutEditorOpen) {
      return;
    }
    function handleResize(): void {
      setLayoutEditorPan((prev) => clampLayoutEditorPan(prev, layoutEditorZoom));
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [layoutEditorOpen, layoutEditorZoom]);

  const outageGraphRow: ScheduleRow = {
    id: "__outage_fixed__",
    label: "停電時間",
    startDate: selectedProject.outageDateStart,
    start: selectedProject.outageTimeStart,
    endDate: selectedProject.outageDateEnd,
    end: selectedProject.outageTimeEnd,
    outage: true,
    text: "停電時間",
    note: "全館停電",
  };
  const graphRows: ScheduleRow[] = selectedProject.outageEnabled
    ? [outageGraphRow, ...selectedProject.scheduleRows]
    : [...selectedProject.scheduleRows];

  const timeline = useMemo(() => {
    const baseDate = selectedProject.workDateStart || selectedProject.outageDateStart || todayLocalISO();
    const rangeStart = selectedProject.workDateStart || baseDate;
    const rangeEnd = selectedProject.workDateEnd || rangeStart;
    const dayCount = Math.max(1, diffDays(rangeStart, rangeEnd) + 1);
    const fullSpan = dayCount * DAY_TOTAL_MINUTES;

    const rawRanges = graphRows.map((row) =>
      normalizeRowRange(
        toTimelineOffset(row.startDate, row.start, baseDate),
        toTimelineOffset(row.endDate, row.end, baseDate),
        fullSpan,
      ),
    );
    const minOffset = rawRanges.length ? Math.min(...rawRanges.map((r) => r.start)) : 0;
    const maxOffset = rawRanges.length ? Math.max(...rawRanges.map((r) => r.end)) : fullSpan;
    const defaultViewStart = clamp(floorToStep(Math.max(0, minOffset - 60), 60), 0, Math.max(0, fullSpan - 60));
    const defaultViewEnd = clamp(ceilToStep(Math.min(fullSpan, maxOffset + 60), 60), defaultViewStart + 60, fullSpan);
    const defaultViewSpan = Math.max(60, defaultViewEnd - defaultViewStart);

    const defaultTicks = buildTimelineTicks(defaultViewStart, defaultViewEnd);
    const windows: TimelineWindow[] = [];
    if (defaultViewSpan > 72 * 60) {
      const midpoint = defaultViewStart + Math.floor(defaultViewSpan / 2);
      const splitAt = clamp(floorToStep(midpoint, 60), defaultViewStart + 60, defaultViewEnd - 60);
      const first = { viewStart: defaultViewStart, viewEnd: splitAt };
      const second = { viewStart: splitAt, viewEnd: defaultViewEnd };

      [first, second].forEach((windowRange, index) => {
        const ticks = buildTimelineTicks(windowRange.viewStart, windowRange.viewEnd);
        windows.push({
          id: `split_${index + 1}`,
          viewStart: windowRange.viewStart,
          viewEnd: windowRange.viewEnd,
          viewSpan: Math.max(60, windowRange.viewEnd - windowRange.viewStart),
          lineTicks: ticks.lineTicks,
          labelTicks: ticks.labelTicks,
          startDate: fromTimelineOffset(windowRange.viewStart, baseDate).date,
          endDate: fromTimelineOffset(Math.max(windowRange.viewStart, windowRange.viewEnd - 1), baseDate).date,
        });
      });
    } else {
      const ticks = buildTimelineTicks(defaultViewStart, defaultViewEnd);
      windows.push({
        id: "single",
        viewStart: defaultViewStart,
        viewEnd: defaultViewEnd,
        viewSpan: defaultViewSpan,
        lineTicks: ticks.lineTicks,
        labelTicks: ticks.labelTicks,
        startDate: fromTimelineOffset(defaultViewStart, baseDate).date,
        endDate: fromTimelineOffset(Math.max(defaultViewStart, defaultViewEnd - 1), baseDate).date,
      });
    }

    return {
      baseDate,
      dayCount,
      fullSpan,
      viewStart: defaultViewStart,
      viewEnd: defaultViewEnd,
      viewSpan: defaultViewSpan,
      lineTicks: defaultTicks.lineTicks,
      labelTicks: defaultTicks.labelTicks,
      windows,
    };
  }, [
    selectedProject.workDateStart,
    selectedProject.workDateEnd,
    selectedProject.outageDateStart,
    selectedProject.outageDateEnd,
    graphRows,
  ]);

  useEffect(() => {
    setPartySlide((prev) => clamp(prev, 0, totalPartySlides - 1));
  }, [totalPartySlides]);

  useEffect(() => {
    setDetailPhotoSlide((prev) => clamp(prev, 0, totalDetailPhotoSlides - 1));
  }, [totalDetailPhotoSlides]);

  useEffect(() => {
    setLayoutPhotoSlide((prev) => clamp(prev, 0, totalLayoutPhotoSlides - 1));
  }, [totalLayoutPhotoSlides]);

  useEffect(() => {
    if (!otherProjects.length) {
      setCopySourceProjectId("");
      return;
    }
    if (!copySourceProjectId || !otherProjects.some((project) => project.projectId === copySourceProjectId)) {
      setCopySourceProjectId(otherProjects[0].projectId);
    }
  }, [otherProjects, copySourceProjectId]);

  useEffect(() => {
    if (!projectRevisions.length) {
      setSelectedRevisionId("");
      return;
    }
    if (!selectedRevisionId || !projectRevisions.some((revision) => revision.id === selectedRevisionId)) {
      setSelectedRevisionId(projectRevisions[0].id);
    }
  }, [projectRevisions, selectedRevisionId]);

  useEffect(() => {
    setLayoutEditorOpen(false);
    setLayoutEditorDrawing(null);
    setLayoutEditorMove(null);
    setLayoutEditorResize(null);
    setLayoutEditorRotate(null);
    setLayoutEditorSelectedId("");
  }, [selectedProject.projectId]);

  useEffect(() => {
    setCsvPage((prev) => clamp(prev, 0, csvTotalPages - 1));
  }, [csvTotalPages]);

  useEffect(() => {
    if (!csvSelectedRows.length) {
      return;
    }
    setCsvSelectedRows((prev) => prev.filter((index) => index >= 0 && index < csvDraftRows.length));
  }, [csvDraftRows.length, csvSelectedRows.length]);

  useEffect(() => {
    if (!csvHeaders.length) {
      setCsvBulkHeader("");
      setCsvDeleteHeader("");
      setCsvBulkNotice(null);
      return;
    }
    if (!csvBulkHeader || !csvHeaders.includes(csvBulkHeader)) {
      setCsvBulkHeader(csvHeaders[0]);
    }
    if (!csvDeleteHeader || !csvHeaders.includes(csvDeleteHeader)) {
      setCsvDeleteHeader(csvHeaders[csvHeaders.length - 1]);
    }
  }, [csvHeaders, csvBulkHeader, csvDeleteHeader]);

  useEffect(() => {
    if (users.length <= USER_LIST_VISIBLE_COUNT && userListExpanded) {
      setUserListExpanded(false);
    }
  }, [users.length, userListExpanded]);

  useEffect(() => {
    if (!scheduleProcedureTemplates.length) {
      setSelectedScheduleProcedureTemplateId("");
      return;
    }
    if (!selectedScheduleProcedureTemplateId || !scheduleProcedureTemplates.some((template) => template.id === selectedScheduleProcedureTemplateId)) {
      setSelectedScheduleProcedureTemplateId(scheduleProcedureTemplates[0].id);
    }
  }, [scheduleProcedureTemplates, selectedScheduleProcedureTemplateId]);

  useEffect(() => {
    if (!hasSelectedProject || selectedScheduleProcedureTemplateId) {
      return;
    }
    const matched = scheduleProcedureTemplates.find((template) =>
      template.workCodes.some((code) => selectedProject.selectedWorkCodes.includes(code)),
    );
    if (matched) {
      setSelectedScheduleProcedureTemplateId(matched.id);
    }
  }, [hasSelectedProject, selectedProject.selectedWorkCodes, scheduleProcedureTemplates, selectedScheduleProcedureTemplateId]);

  function updateSelectedProject(
    updater: (project: Project) => Project,
    meta?: { action?: string; detail?: string; snapshotLabel?: string },
  ): void {
    if (!hasSelectedProject || !selectedId) {
      if (!canEdit) {
        return;
      }
      const seedProject = createBlankProject();
      const baseProject: Project = {
        ...seedProject,
        ...selectedProject,
        projectId: seedProject.projectId,
        scheduleRows: cloneScheduleRows(selectedProject.scheduleRows),
        detailPhotos: clonePhotoSlots(selectedProject.detailPhotos),
        layoutPhotos: clonePhotoSlots(selectedProject.layoutPhotos),
        relatedParties: cloneRelatedParties(selectedProject.relatedParties),
        layoutAnnotations: cloneLayoutAnnotations(selectedProject.layoutAnnotations),
        layoutAnnotationsV2: cloneLayoutAnnotationsV2(selectedProject.layoutAnnotationsV2),
      };
      const nextProject = syncProjectWorkRange(updater(baseProject));
      setProjects((prev) => [nextProject, ...prev]);
      setSelectedId(nextProject.projectId);
      setProjectSearchText("");
      setProjectPickerOpen(false);
      appendAudit("project_create", `新規案件を作成: ${nextProject.projectId}`, nextProject.projectId);
      createRevision(nextProject, "新規案件初期化");
      if (meta?.action) {
        appendAudit(meta.action, meta.detail ?? "", nextProject.projectId);
      }
      if (meta?.snapshotLabel) {
        createRevision(nextProject, meta.snapshotLabel);
      }
      return;
    }
    const nextProject = syncProjectWorkRange(updater(selectedProject));
    setProjects((prev) => prev.map((project) => (project.projectId === selectedId ? nextProject : project)));
    if (meta?.action) {
      appendAudit(meta.action, meta.detail ?? "", nextProject.projectId);
    }
    if (meta?.snapshotLabel) {
      createRevision(nextProject, meta.snapshotLabel);
    }
  }

  function handleProjectField<K extends keyof Project>(field: K, value: Project[K]): void {
    updateSelectedProject((project) => ({ ...project, [field]: value }));
  }

  function pickOutageWindow(project: Project): OutageWindow {
    return {
      outageDateStart: project.outageDateStart,
      outageTimeStart: project.outageTimeStart,
      outageDateEnd: project.outageDateEnd,
      outageTimeEnd: project.outageTimeEnd,
    };
  }

  function traceOutageAdjustment(
    source: string,
    change: Record<string, unknown>,
    before: OutageWindow,
    after: OutageWindow,
    rangeStart: string,
    rangeEnd: string,
  ): void {
    if (typeof window === "undefined") {
      return;
    }
    try {
      if (window.localStorage.getItem(OUTAGE_TRACE_DEBUG_KEY) !== "1") {
        return;
      }
    } catch {
      return;
    }

    const changedFields = Object.keys(change);
    const dateShifted = before.outageDateStart !== after.outageDateStart || before.outageDateEnd !== after.outageDateEnd;
    const entry: OutageTraceEntry = {
      seq: outageTraceSeqRef.current + 1,
      at: new Date().toISOString(),
      source,
      changedFields,
      before,
      after,
      rangeStart,
      rangeEnd,
      dateShifted,
    };
    outageTraceSeqRef.current = entry.seq;

    const w = window as Window & { __sekouOutageTrace?: OutageTraceEntry[] };
    const prev = Array.isArray(w.__sekouOutageTrace) ? w.__sekouOutageTrace : [];
    w.__sekouOutageTrace = [entry, ...prev].slice(0, 200);
    console.info("[sekou][outage-trace]", entry);
  }

  async function login(): Promise<void> {
    await pullSharedStorageSnapshot();
    setUsers(ensureUsers() as UserAccount[]);
    setAccessLogs(getLoginAttempts());
    const email = loginEmail.trim().toLowerCase();
    const result = loginWithCredentials(email, loginPassword, "tracking_page");
    if (!result.user) {
      setLoginError(getLoginFailureMessage(result.reason));
      appendAudit("login_failed", `ログイン失敗: ${email}`, selectedProject.projectId);
      setAccessLogs(getLoginAttempts());
      return;
    }
    const user = result.user;
    await pushSharedStorageSnapshot();
    setUsers(ensureUsers() as UserAccount[]);
    setAccessLogs(getLoginAttempts());
    setCurrentUserId(user.id);
    setLoginError("");
    setLoginPassword("");
    appendAudit("login", "ログインしました", selectedProject.projectId);
  }

  function logout(): void {
    if (currentUser) {
      appendAudit("logout", "ログアウトしました", selectedProject.projectId);
    }
    setCurrentUserId("");
    setLoginPassword("");
    clearSession();
    router.replace("/");
  }

  async function createUser(roleOverride?: UserRole): Promise<void> {
    if (!canAdmin) {
      return;
    }
    await pullSharedStorageSnapshot();
    const freshUsers = ensureUsers() as UserAccount[];
    setUsers(freshUsers);
    const name = newUserName.trim();
    const email = newUserEmail.trim().toLowerCase();
    const password = newUserPassword.trim();
    if (!name || !email || !password) {
      setUserCreateNotice({ type: "error", text: "名前・メール・パスワードを入力してください。" });
      return;
    }
    const mailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!mailPattern.test(email)) {
      setUserCreateNotice({ type: "error", text: "メール形式が正しくありません。Gmail登録も可能です。" });
      return;
    }
    if (freshUsers.some((user) => user.email.toLowerCase() === email)) {
      setUserCreateNotice({ type: "error", text: "このメールアドレスは既に登録済みです。" });
      return;
    }
    const roleToCreate = roleOverride ?? newUserRole;
    const account: UserAccount = {
      id: uid("user"),
      name,
      email,
      password,
      role: roleToCreate,
      active: true,
      approvalStatus: "approved",
      approvedAt: new Date().toISOString(),
      approvedById: currentUser?.id || "unknown",
      approvedByName: currentUser?.name || "不明",
      createdAt: new Date().toISOString(),
      createdById: currentUser?.id || "unknown",
      createdByName: currentUser?.name || "不明",
    };
    setUsers((prev) => [account, ...prev]);
    setNewUserName("");
    setNewUserEmail("");
    setNewUserPassword("");
    setNewUserRole("editor");
    setUserManageNotice(null);
    setUserCreateNotice({ type: "ok", text: `${ROLE_LABELS[roleToCreate]}「${name}」を追加しました。` });
    appendAudit("user_create", `ユーザー作成: ${name} (${ROLE_LABELS[roleToCreate]})`, selectedProject.projectId);
  }

  function updateUserRoleByAdmin(userId: string, nextRole: UserRole): void {
    if (!canAdmin) {
      return;
    }
    const target = users.find((user) => user.id === userId);
    if (!target || target.role === nextRole) {
      return;
    }
    if (target.role === "system_admin" && nextRole !== "system_admin") {
      setUserManageNotice({ type: "error", text: "システム管理者の権限は変更できません。" });
      return;
    }
    if (nextRole === "system_admin" && currentUser?.role !== "system_admin") {
      setUserManageNotice({ type: "error", text: "システム管理者のみ、システム管理者を指定できます。" });
      return;
    }
    if (isAdminLikeRole(target.role) && target.active && target.approvalStatus === "approved" && !isAdminLikeRole(nextRole)) {
      const activeAdmins = users.filter(
        (user) => user.active && user.approvalStatus === "approved" && isAdminLikeRole(user.role),
      ).length;
      if (activeAdmins <= 1) {
        setUserManageNotice({ type: "error", text: "有効な管理者/システム管理者を0名にはできません。先に別ユーザーを管理者にしてください。" });
        return;
      }
    }
    setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, role: nextRole } : user)));
    setUserManageNotice({ type: "ok", text: `${target.name} の権限を「${ROLE_LABELS[nextRole]}」に変更しました。` });
    appendAudit("user_role_update", `権限変更: ${target.name} -> ${ROLE_LABELS[nextRole]}`, selectedProject.projectId);
  }

  function updateUserApprovalStatusByAdmin(userId: string, nextStatus: UserApprovalStatus): void {
    if (!canAdmin) {
      return;
    }
    const target = users.find((user) => user.id === userId);
    if (!target || target.approvalStatus === nextStatus) {
      return;
    }
    if (target.role === "system_admin") {
      setUserManageNotice({ type: "error", text: "システム管理者の承認区分は変更できません。" });
      return;
    }
    if (target.id === currentUser?.id && nextStatus !== "approved") {
      setUserManageNotice({ type: "error", text: "ログイン中の自分自身は未承認/利用不可に変更できません。" });
      return;
    }
    if (isAdminLikeRole(target.role) && target.active && target.approvalStatus === "approved" && nextStatus !== "approved") {
      const activeAdmins = users.filter(
        (user) => user.active && user.approvalStatus === "approved" && isAdminLikeRole(user.role),
      ).length;
      if (activeAdmins <= 1) {
        setUserManageNotice({ type: "error", text: "有効かつ承認済みの管理者/システム管理者を0名にはできません。先に別ユーザーを管理者承認してください。" });
        return;
      }
    }
    setUsers((prev) =>
      prev.map((user) =>
        user.id === userId
          ? {
              ...user,
              approvalStatus: nextStatus,
              active: nextStatus === "approved",
              approvedAt: nextStatus === "approved" ? new Date().toISOString() : undefined,
              approvedById: nextStatus === "approved" ? currentUser?.id || "unknown" : undefined,
              approvedByName: nextStatus === "approved" ? currentUser?.name || "不明" : undefined,
            }
          : user,
      ),
    );
    setUserManageNotice({ type: "ok", text: `${target.name} の承認区分を「${USER_APPROVAL_LABELS[nextStatus]}」に変更しました。` });
    appendAudit("user_approval_update", `利用承認変更: ${target.name} -> ${USER_APPROVAL_LABELS[nextStatus]}`, selectedProject.projectId);
  }

  function toggleUserActiveByAdmin(userId: string): void {
    if (!canAdmin) {
      return;
    }
    const target = users.find((user) => user.id === userId);
    if (!target) {
      return;
    }
    if (target.role === "system_admin") {
      setUserManageNotice({ type: "error", text: "システム管理者は無効化できません。" });
      return;
    }
    if (target.id === currentUser?.id && target.active) {
      setUserManageNotice({ type: "error", text: "ログイン中の自分自身は無効化できません。" });
      return;
    }
    if (target.active && isAdminLikeRole(target.role) && target.approvalStatus === "approved") {
      const activeAdmins = users.filter(
        (user) => user.active && user.approvalStatus === "approved" && isAdminLikeRole(user.role),
      ).length;
      if (activeAdmins <= 1) {
        setUserManageNotice({ type: "error", text: "有効な管理者/システム管理者を0名にはできません。先に別ユーザーを管理者にしてください。" });
        return;
      }
    }
    const nextActive = !target.active;
    setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, active: nextActive } : user)));
    setUserManageNotice({ type: "ok", text: `${target.name} を${nextActive ? "有効化" : "無効化"}しました。` });
    appendAudit("user_active_update", `ユーザー${nextActive ? "有効化" : "無効化"}: ${target.name}`, selectedProject.projectId);
  }

  function deleteUserByAdmin(userId: string): void {
    if (!canAdmin) {
      return;
    }
    const target = users.find((user) => user.id === userId);
    if (!target) {
      return;
    }
    if (target.role === "system_admin") {
      setUserManageNotice({ type: "error", text: "システム管理者は削除できません。" });
      return;
    }
    if (target.id === currentUser?.id) {
      setUserManageNotice({ type: "error", text: "ログイン中の自分自身は削除できません。" });
      return;
    }
    if (isAdminLikeRole(target.role) && target.active && target.approvalStatus === "approved") {
      const activeAdmins = users.filter(
        (user) => user.active && user.approvalStatus === "approved" && isAdminLikeRole(user.role),
      ).length;
      if (activeAdmins <= 1) {
        setUserManageNotice({ type: "error", text: "有効かつ承認済みの管理者/システム管理者を0名にはできません。先に別ユーザーを管理者承認してください。" });
        return;
      }
    }
    const ok = window.confirm(`ユーザー「${target.name}（${target.email}）」を削除します。よろしいですか？`);
    if (!ok) {
      return;
    }
    setUsers((prev) => prev.filter((user) => user.id !== userId));
    setUserManageNotice({ type: "ok", text: `${target.name} を削除しました。` });
    appendAudit("user_delete", `ユーザー削除: ${target.name} (${target.email})`, selectedProject.projectId);
  }

  function saveManualRevision(): void {
    if (!canEdit) {
      return;
    }
    createRevision(selectedProject, `手動履歴保存 ${new Date().toLocaleString("ja-JP")}`);
    appendAudit("backup_save", "手動で履歴保存", selectedProject.projectId);
  }

  function exportLocalStorageData(): void {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const items: LocalStorageExportItem[] = [];
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i);
        if (!key) {
          continue;
        }
        items.push({
          key,
          value: window.localStorage.getItem(key) ?? "",
        });
      }
      items.sort((a, b) => a.key.localeCompare(b.key, "ja"));
      const payload: LocalStorageExportPayload = {
        app: "sekou-manual-editor",
        exportedAt: new Date().toISOString(),
        items,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const suffix = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
      anchor.href = url;
      anchor.download = `sekou-localstorage-export-${suffix}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
      setUserManageNotice({ type: "ok", text: `データをエクスポートしました（${items.length}件）。` });
    } catch {
      setUserManageNotice({ type: "error", text: "データのエクスポートに失敗しました。" });
    }
  }

  function isLocalStorageExportPayload(value: unknown): value is LocalStorageExportPayload {
    if (!value || typeof value !== "object") {
      return false;
    }
    const candidate = value as Partial<LocalStorageExportPayload> & { items?: unknown };
    if (candidate.app !== "sekou-manual-editor") {
      return false;
    }
    if (!Array.isArray(candidate.items)) {
      return false;
    }
    return candidate.items.every((item) => {
      if (!item || typeof item !== "object") {
        return false;
      }
      const record = item as Partial<LocalStorageExportItem>;
      return typeof record.key === "string" && typeof record.value === "string";
    });
  }

  function openImportFileDialog(): void {
    importFileInputRef.current?.click();
  }

  async function importLocalStorageData(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const raw = await file.text();
      const parsed: unknown = JSON.parse(raw);
      if (!isLocalStorageExportPayload(parsed)) {
        throw new Error("invalid-structure");
      }
      const ok = window.confirm("現在のデータを上書きしてインポートします。よろしいですか？");
      if (!ok) {
        return;
      }
      window.localStorage.clear();
      parsed.items.forEach((item) => {
        window.localStorage.setItem(item.key, item.value);
      });
      alert("データをインポートしました。画面を再読み込みします。");
      window.location.reload();
    } catch {
      alert("インポートに失敗しました。JSON形式とデータ構造を確認してください。");
    } finally {
      event.target.value = "";
    }
  }

  function restoreRevision(): void {
    if (!canEdit || !selectedRevision) {
      return;
    }
    updateSelectedProject(
      (project) => ({
        ...project,
        ...selectedRevision.snapshot,
        selectedWorkCodes: [...selectedRevision.snapshot.selectedWorkCodes],
        layoutAnnotations: cloneLayoutAnnotations(selectedRevision.snapshot.layoutAnnotations || []),
        layoutAnnotationsV2: cloneLayoutAnnotationsV2(
          selectedRevision.snapshot.layoutAnnotationsV2
            || legacyLayoutAnnotationsToV2(selectedRevision.snapshot.layoutAnnotations || []),
        ),
        scheduleRows: cloneScheduleRows(selectedRevision.snapshot.scheduleRows),
        relatedParties: cloneRelatedParties(selectedRevision.snapshot.relatedParties),
      }),
      {
        action: "backup_restore",
        detail: `履歴復元: ${selectedRevision.label}`,
        snapshotLabel: `復元前履歴保存 ${new Date().toLocaleString("ja-JP")}`,
      },
    );
  }

  function updateApprovalStatus(status: Project["approvalStatus"]): void {
    if (!canApprove) {
      return;
    }
    updateSelectedProject(
      (project) => ({
        ...project,
        approvalStatus: status,
        approvedBy: status === "approved" && currentUser ? currentUser.name : project.approvedBy,
        approvedAt: status === "approved" ? new Date().toISOString() : project.approvedAt,
      }),
      {
        action: "approval_update",
        detail: `状態を「${APPROVAL_STATUS_LABELS[status]}」に変更`,
        snapshotLabel: `状態変更前履歴保存 ${APPROVAL_STATUS_LABELS[status]}`,
      },
    );
  }

  function updateWorkDateStart(value: string): void {
    const normalized = normalizeDate(value);
    if (!normalized) {
      return;
    }
    updateSelectedProject((project) => {
      const beforeOutage = pickOutageWindow(project);
      const end = project.workDateEnd && project.workDateEnd >= normalized ? project.workDateEnd : normalized;
      const rows = project.scheduleRows.map((row) => fitRowIntoRange(row, normalized, end));
      const outage = fitOutageIntoRange(
        project.outageDateStart,
        project.outageTimeStart,
        project.outageDateEnd,
        project.outageTimeEnd,
        normalized,
        end,
      );
      const nextProject = {
        ...project,
        workDateStart: normalized,
        workDateEnd: end,
        outageDateStart: outage.startDate,
        outageTimeStart: outage.startTime,
        outageDateEnd: outage.endDate,
        outageTimeEnd: outage.endTime,
        scheduleRows: rows,
      };
      traceOutageAdjustment(
        "work_date_start_change",
        { workDateStart: normalized },
        beforeOutage,
        pickOutageWindow(nextProject),
        normalized,
        end,
      );
      return nextProject;
    });
  }

  function updateWorkDateEnd(value: string): void {
    const normalized = normalizeDate(value);
    if (!normalized) {
      return;
    }
    updateSelectedProject((project) => {
      const beforeOutage = pickOutageWindow(project);
      const end = normalized < project.workDateStart ? project.workDateStart : normalized;
      const rows = project.scheduleRows.map((row) => fitRowIntoRange(row, project.workDateStart, end));
      const outage = fitOutageIntoRange(
        project.outageDateStart,
        project.outageTimeStart,
        project.outageDateEnd,
        project.outageTimeEnd,
        project.workDateStart,
        end,
      );
      const nextProject = {
        ...project,
        workDateEnd: end,
        outageDateStart: outage.startDate,
        outageTimeStart: outage.startTime,
        outageDateEnd: outage.endDate,
        outageTimeEnd: outage.endTime,
        scheduleRows: rows,
      };
      traceOutageAdjustment(
        "work_date_end_change",
        { workDateEnd: end },
        beforeOutage,
        pickOutageWindow(nextProject),
        project.workDateStart,
        end,
      );
      return nextProject;
    });
  }

  function updateOutageDateStart(value: string): void {
    const normalized = normalizeDate(value);
    if (!normalized) {
      return;
    }
    updateSelectedProject((project) => {
      const beforeOutage = pickOutageWindow(project);
      const end = project.outageDateEnd && project.outageDateEnd >= normalized ? project.outageDateEnd : normalized;
      const nextProject = { ...project, outageDateStart: normalized, outageDateEnd: end };
      traceOutageAdjustment(
        "field_outage_date_start_direct",
        { outageDateStart: normalized },
        beforeOutage,
        pickOutageWindow(nextProject),
        project.workDateStart,
        project.workDateEnd,
      );
      return nextProject;
    });
  }

  function updateOutageDateEnd(value: string): void {
    const normalized = normalizeDate(value);
    if (!normalized) {
      return;
    }
    updateSelectedProject((project) => {
      const beforeOutage = pickOutageWindow(project);
      const end = normalized < project.outageDateStart ? project.outageDateStart : normalized;
      const nextProject = { ...project, outageDateEnd: end };
      traceOutageAdjustment(
        "field_outage_date_end_direct",
        { outageDateEnd: end },
        beforeOutage,
        pickOutageWindow(nextProject),
        project.workDateStart,
        project.workDateEnd,
      );
      return nextProject;
    });
  }

  function updateOutageRange(
    patch: Partial<OutageWindow>,
    source = "unknown",
  ): void {
    updateSelectedProject((project) => {
      const beforeOutage = pickOutageWindow(project);
      const draft = { ...project, ...patch };
      const fitted = fitOutageIntoRange(
        draft.outageDateStart,
        draft.outageTimeStart,
        draft.outageDateEnd,
        draft.outageTimeEnd,
        project.workDateStart,
        project.workDateEnd,
      );
      const nextProject = {
        ...draft,
        outageDateStart: fitted.startDate,
        outageTimeStart: fitted.startTime,
        outageDateEnd: fitted.endDate,
        outageTimeEnd: fitted.endTime,
      };
      traceOutageAdjustment(
        source,
        patch,
        beforeOutage,
        pickOutageWindow(nextProject),
        project.workDateStart,
        project.workDateEnd,
      );
      return nextProject;
    });
  }

  function createProject(): void {
    if (!canEdit) {
      return;
    }
    const created = createBlankProject();
    setProjects((prev) => [created, ...prev]);
    setSelectedId(created.projectId);
    appendAudit("project_create", `新規案件を作成: ${created.projectId}`, created.projectId);
    createRevision(created, "新規案件初期化");
  }

  function deleteSelectedProject(): void {
    if (!canEdit) {
      return;
    }
    if (!hasSelectedProject) {
      window.alert("削除する案件を先に選択してください。");
      return;
    }
    if (projects.length <= 1) {
      window.alert("削除できません。最低1件の案件が必要です。");
      return;
    }
    const targetProject = selectedProject;
    if (!window.confirm(`案件「${targetProject.projectId} | ${targetProject.propertyName}」を削除します。よろしいですか？`)) {
      return;
    }

    appendAudit("project_delete", `案件削除: ${targetProject.projectId} | ${targetProject.propertyName}`, targetProject.projectId);

    setProjects((prev) => {
      const targetIndex = prev.findIndex((project) => project.projectId === targetProject.projectId);
      const nextProjects = prev.filter((project) => project.projectId !== targetProject.projectId);
      const fallbackIndex = targetIndex > 0 ? targetIndex - 1 : 0;
      const nextSelected = nextProjects[Math.min(fallbackIndex, nextProjects.length - 1)];
      if (nextSelected) {
        setSelectedId(nextSelected.projectId);
      }
      return nextProjects;
    });
    setImportStatus(`削除しました: ${targetProject.projectId}`);
  }

  function setCsvEditorData(records: CsvRecord[]): void {
    const headers = inferCsvHeaders(records);
    setCsvHeaders(headers);
    setCsvDraftRows(normalizeCsvRows(records, headers));
    setCsvPage(0);
    setCsvSelectedRows([]);
  }

  function applyCsvRowsToProjects(rows: CsvRecord[], sourceLabel: "import" | "editor" = "editor"): void {
    if (!canEdit) {
      return;
    }
    const imported = rows
      .map((record) => projectFromCsv(record))
      .filter((item): item is Project => item !== null);

    if (!imported.length) {
      setImportStatus("反映失敗: project_id列がある行を入力してください");
      return;
    }

    setProjects((prev) => {
      const map = new Map<string, Project>();
      prev.forEach((project) => map.set(project.projectId, project));
      imported.forEach((project) => map.set(project.projectId, project));
      return Array.from(map.values());
    });
    setSelectedId(imported[0].projectId);
    setImportStatus(`${imported.length}件を${sourceLabel === "import" ? "CSV取込" : "編集データ反映"}しました`);
    setCsvSelectedRows([]);
    appendAudit("csv_apply", `${imported.length}件を${sourceLabel === "import" ? "CSV取込" : "CSV編集から反映"}`, imported[0].projectId);
  }

  function updateCsvCell(rowIndex: number, header: string, value: string): void {
    if (!canEdit) {
      return;
    }
    setCsvDraftRows((prev) => prev.map((row, idx) => (idx === rowIndex ? { ...row, [header]: value } : row)));
  }

  function addCsvRow(): void {
    if (!canEdit || !csvHeaders.length) {
      return;
    }
    const next: CsvRecord = {};
    csvHeaders.forEach((header) => {
      next[header] = "";
    });
    setCsvDraftRows((prev) => {
      const appended = [...prev, next];
      setCsvPage(Math.max(0, Math.ceil(appended.length / csvPageSize) - 1));
      return appended;
    });
  }

  function deleteCsvRow(rowIndex: number): void {
    if (!canEdit) {
      return;
    }
    setCsvDraftRows((prev) => prev.filter((_, idx) => idx !== rowIndex));
    setCsvSelectedRows((prev) => prev.filter((idx) => idx !== rowIndex).map((idx) => (idx > rowIndex ? idx - 1 : idx)));
  }

  function toggleCsvRowSelection(rowIndex: number): void {
    if (!canEdit) {
      return;
    }
    setCsvSelectedRows((prev) => (prev.includes(rowIndex) ? prev.filter((idx) => idx !== rowIndex) : [...prev, rowIndex]));
  }

  function toggleCsvVisibleSelection(checked: boolean): void {
    if (!canEdit || !csvVisibleRows.length) {
      return;
    }
    const indices = csvVisibleRows.map(({ index }) => index);
    setCsvSelectedRows((prev) => {
      const set = new Set(prev);
      indices.forEach((idx) => {
        if (checked) {
          set.add(idx);
        } else {
          set.delete(idx);
        }
      });
      return Array.from(set).sort((a, b) => a - b);
    });
  }

  function applyBulkCsvEdit(): void {
    if (!canEdit) {
      return;
    }
    if (!csvBulkHeader || !csvHeaders.includes(csvBulkHeader)) {
      setCsvBulkNotice({ type: "error", text: "編集対象の列を選択してください。" });
      return;
    }
    if (!csvSelectedRows.length) {
      setCsvBulkNotice({ type: "error", text: "先に編集したい行をチェックしてください。" });
      return;
    }
    const selected = new Set(csvSelectedRows);
    setCsvDraftRows((prev) =>
      prev.map((row, index) =>
        selected.has(index)
          ? { ...row, [csvBulkHeader]: csvBulkValue }
          : row,
      ),
    );
    setCsvBulkNotice({ type: "ok", text: `選択した${csvSelectedRows.length}行を更新しました。` });
  }

  function deleteSelectedCsvRows(): void {
    if (!canEdit || !csvSelectedRows.length) {
      return;
    }
    if (!window.confirm(`選択した${csvSelectedRows.length}件を削除します。よろしいですか？`)) {
      return;
    }
    const selected = new Set(csvSelectedRows);
    setCsvDraftRows((prev) => prev.filter((_, index) => !selected.has(index)));
    setCsvSelectedRows([]);
  }

  function deleteAllCsvRows(): void {
    if (!canEdit || !csvDraftRows.length) {
      return;
    }
    if (!window.confirm(`CSVの全${csvDraftRows.length}件を削除します。よろしいですか？`)) {
      return;
    }
    setCsvDraftRows([]);
    setCsvSelectedRows([]);
    setCsvPage(0);
  }

  function addCsvColumn(): void {
    if (!canEdit) {
      return;
    }
    const header = newCsvColumn.trim();
    if (!header || csvHeaders.includes(header)) {
      return;
    }
    setCsvHeaders((prev) => [...prev, header]);
    setCsvDraftRows((prev) => prev.map((row) => ({ ...row, [header]: "" })));
    setNewCsvColumn("");
  }

  function deleteCsvColumn(): void {
    if (!canEdit) {
      return;
    }
    if (!csvDeleteHeader || !csvHeaders.includes(csvDeleteHeader)) {
      setCsvBulkNotice({ type: "error", text: "削除する列を選択してください。" });
      return;
    }
    const confirmed = window.confirm(`列「${getCsvHeaderLabel(csvDeleteHeader)}」を削除します。よろしいですか？`);
    if (!confirmed) {
      return;
    }
    setCsvHeaders((prev) => prev.filter((header) => header !== csvDeleteHeader));
    setCsvDraftRows((prev) =>
      prev.map((row) => {
        const { [csvDeleteHeader]: _removed, ...rest } = row;
        return rest;
      }),
    );
    setCsvBulkNotice({ type: "ok", text: `列「${getCsvHeaderLabel(csvDeleteHeader)}」を削除しました。` });
  }

  function exportCsvEditor(): void {
    if (!csvHeaders.length || !csvDraftRows.length) {
      return;
    }
    const csvText = recordsToCsv(csvHeaders, csvDraftRows);
    const utf8Bom = "\uFEFF";
    const blob = new Blob([utf8Bom, csvText], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sekou_csv_editor_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleCsvImport(event: ChangeEvent<HTMLInputElement>): void {
    if (!canEdit) {
      event.target.value = "";
      return;
    }
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const records = parseCsv(String(reader.result ?? ""));
        if (!records.length) {
          setImportStatus("取込失敗: project_id列があるCSVを選択してください");
          return;
        }
        setCsvEditorData(records);
        applyCsvRowsToProjects(records, "import");
      } catch {
        setImportStatus("取込失敗: CSV形式を確認してください");
      }
    };
    reader.readAsText(file, "utf-8");
    event.target.value = "";
  }

  function toggleWork(code: WorkCode): void {
    updateSelectedProject((project) => {
      const exists = project.selectedWorkCodes.includes(code);
      const selectedWorkCodes = exists
        ? project.selectedWorkCodes.filter((item) => item !== code)
        : [...project.selectedWorkCodes, code];
      if (exists) {
        return { ...project, selectedWorkCodes };
      }

      const work = WORK_MASTER.find((item) => item.code === code);
      if (!work) {
        return { ...project, selectedWorkCodes };
      }
      const hasWorkRow = project.scheduleRows.some(
        (row) => row.label === work.name || row.text === work.defaultText,
      );
      if (hasWorkRow) {
        return { ...project, selectedWorkCodes };
      }

      const row = fitRowIntoRange(
        {
          id: uid("row"),
          label: work.name,
          startDate: project.outageDateStart || project.workDateStart,
          start: project.outageTimeStart || "09:00",
          endDate: project.outageDateEnd || project.workDateEnd || project.workDateStart,
          end: project.outageTimeEnd || "17:00",
          outage: false,
          text: work.defaultText,
          note: "",
        },
        project.workDateStart,
        project.workDateEnd,
      );

      return {
        ...project,
        selectedWorkCodes,
        scheduleRows: [...project.scheduleRows, row],
      };
    });
  }

  function regenerateSchedule(): void {
    updateSelectedProject(
      (project) => ({ ...project, scheduleRows: createScheduleFromWorks(project) }),
      { action: "schedule_regenerate", detail: "工事項目から工程表を再生成", snapshotLabel: "工程表再生成" },
    );
  }

  function regenerateScheduleFromProcedureTemplate(): void {
    if (!selectedScheduleProcedureTemplate) {
      alert("段取りテンプレートを選択してください。");
      return;
    }
    updateSelectedProject(
      (project) => {
        const nextRows = buildRowsFromProcedureTemplate(project, selectedScheduleProcedureTemplate);
        return {
          ...project,
          selectedWorkCodes: mergeUniqueWorkCodes(project.selectedWorkCodes, selectedScheduleProcedureTemplate.workCodes),
          scheduleRows: nextRows,
        };
      },
      {
        action: "schedule_regenerate",
        detail: `段取りテンプレートで再生成: ${selectedScheduleProcedureTemplate.name}`,
        snapshotLabel: "段取りテンプレート再生成",
      },
    );
  }

  function appendProcedureTemplateRows(): void {
    if (!selectedScheduleProcedureTemplate) {
      alert("段取りテンプレートを選択してください。");
      return;
    }
    updateSelectedProject(
      (project) => {
        const nextRows = buildRowsFromProcedureTemplate(project, selectedScheduleProcedureTemplate);
        return {
          ...project,
          selectedWorkCodes: mergeUniqueWorkCodes(project.selectedWorkCodes, selectedScheduleProcedureTemplate.workCodes),
          scheduleRows: [...project.scheduleRows, ...nextRows],
        };
      },
      {
        action: "schedule_add_row",
        detail: `段取りテンプレートで工程を追加: ${selectedScheduleProcedureTemplate.name}`,
        snapshotLabel: "段取りテンプレート追加",
      },
    );
  }

  function saveCurrentScheduleAsProcedureTemplate(): void {
    if (!canEdit) {
      return;
    }
    const steps = selectedProject.scheduleRows
      .filter((row) => row.label.trim())
      .map((row) => rowToProcedureStep(row));
    if (!steps.length) {
      alert("工程表に1行以上入力してからテンプレート登録してください。");
      return;
    }
    const normalizedName = newScheduleProcedureTemplateName.trim();
    const fallbackHead = selectedProject.propertyName.trim() || selectedProject.titleSubject.trim() || "工程";
    const item: ScheduleProcedureTemplate = {
      id: uid("proc_tpl"),
      name: normalizedName || `${fallbackHead}_段取り_${autoTemplateName("tpl")}`,
      createdAt: new Date().toISOString(),
      workCodes: [...selectedProject.selectedWorkCodes],
      steps,
    };
    setScheduleProcedureTemplates((prev) => [item, ...prev]);
    setSelectedScheduleProcedureTemplateId(item.id);
    setNewScheduleProcedureTemplateName("");
    appendAudit("template_apply", `段取りテンプレート登録: ${item.name}`);
  }

  function appendCurrentRowsToSelectedProcedureTemplate(): void {
    if (!canEdit) {
      return;
    }
    if (!selectedScheduleProcedureTemplate) {
      alert("追記先の段取りテンプレートを選択してください。");
      return;
    }
    const additionalSteps = selectedProject.scheduleRows
      .filter((row) => row.label.trim())
      .map((row) => rowToProcedureStep(row));
    if (!additionalSteps.length) {
      alert("追記できる工程行がありません。");
      return;
    }
    setScheduleProcedureTemplates((prev) => prev.map((template) => {
      if (template.id !== selectedScheduleProcedureTemplate.id) {
        return template;
      }
      const exists = new Set(template.steps.map((step) => stepSignature(step)));
      const mergedSteps = [...template.steps];
      additionalSteps.forEach((step) => {
        const signature = stepSignature(step);
        if (exists.has(signature)) {
          return;
        }
        mergedSteps.push(step);
        exists.add(signature);
      });
      return {
        ...template,
        workCodes: mergeUniqueWorkCodes(template.workCodes, selectedProject.selectedWorkCodes),
        steps: mergedSteps,
      };
    }));
    appendAudit("template_apply", `段取りテンプレート追記: ${selectedScheduleProcedureTemplate.name}`);
  }

  function deleteScheduleProcedureTemplate(): void {
    if (!canEdit || !selectedScheduleProcedureTemplateId) {
      return;
    }
    setScheduleProcedureTemplates((prev) => {
      const next = prev.filter((template) => template.id !== selectedScheduleProcedureTemplateId);
      setSelectedScheduleProcedureTemplateId(next[0]?.id ?? "");
      return next.length ? next : cloneScheduleProcedureTemplates(DEFAULT_SCHEDULE_PROCEDURE_TEMPLATES);
    });
  }

  function addScheduleRow(): void {
    updateSelectedProject(
      (project) => ({
        ...project,
        scheduleRows: [
          ...project.scheduleRows,
          {
            id: uid("row"),
            label: "追加作業",
            startDate: project.outageDateStart,
            start: project.outageTimeStart,
            endDate: project.outageDateEnd,
            end: project.outageTimeEnd,
            outage: false,
            text: "",
            note: "",
          },
        ],
      }),
      { action: "schedule_add_row", detail: "工程表の行を追加", snapshotLabel: "工程表行追加" },
    );
  }

  function updateScheduleRow(rowId: string, patch: Partial<ScheduleRow>): void {
    updateSelectedProject((project) => ({
      ...project,
      scheduleRows: project.scheduleRows.map((row) =>
        row.id === rowId
          ? fitRowIntoRange({ ...row, ...patch }, project.workDateStart, project.workDateEnd)
          : row,
      ),
    }));
  }

  function removeScheduleRow(rowId: string): void {
    updateSelectedProject(
      (project) => ({
        ...project,
        scheduleRows: project.scheduleRows.filter((row) => row.id !== rowId),
      }),
      { action: "schedule_remove_row", detail: "工程表の行を削除", snapshotLabel: "工程表行削除" },
    );
  }

  function moveScheduleRow(rowId: string, direction: -1 | 1): void {
    updateSelectedProject(
      (project) => {
        const idx = project.scheduleRows.findIndex((row) => row.id === rowId);
        if (idx < 0) {
          return project;
        }
        const nextIdx = idx + direction;
        if (nextIdx < 0 || nextIdx >= project.scheduleRows.length) {
          return project;
        }
        const rows = [...project.scheduleRows];
        const [picked] = rows.splice(idx, 1);
        rows.splice(nextIdx, 0, picked);
        return { ...project, scheduleRows: rows };
      },
      { action: "schedule_reorder", detail: "工程表の順序を変更" },
    );
  }

  function beginRowDrag(
    row: ScheduleRow,
    mode: DragInfo["mode"],
    event: ReactPointerEvent<HTMLElement>,
    viewSpan: number,
  ): void {
    event.preventDefault();
    event.stopPropagation();
    const track = (event.currentTarget.closest(".row-track") as HTMLElement) || (event.currentTarget as HTMLElement);
    const rect = track.getBoundingClientRect();
    const base = normalizeRowRange(
      toTimelineOffset(row.startDate, row.start, timeline.baseDate),
      toTimelineOffset(row.endDate, row.end, timeline.baseDate),
      timeline.fullSpan,
    );
    setDragInfo({
      rowId: row.id,
      mode,
      startX: event.clientX,
      trackWidth: Math.max(1, rect.width),
      viewSpan,
      fullSpan: timeline.fullSpan,
      baseDate: timeline.baseDate,
      baseStart: base.start,
      baseEnd: base.end,
      currentStart: base.start,
      currentEnd: base.end,
    });
  }

  useEffect(() => {
    if (!dragInfo) {
      return;
    }
    let rafId: number | null = null;
    let pending: { start: number; end: number } | null = null;

    const onPointerMove = (event: PointerEvent) => {
      const deltaPx = event.clientX - dragInfo.startX;
      const rawDeltaMin = (deltaPx / dragInfo.trackWidth) * dragInfo.viewSpan;
      const snappedDelta = Math.round(rawDeltaMin / DRAG_SNAP_MINUTES) * DRAG_SNAP_MINUTES;

      let nextStart = dragInfo.baseStart;
      let nextEnd = dragInfo.baseEnd;

      if (dragInfo.mode === "start") {
        nextStart = clamp(dragInfo.baseStart + snappedDelta, 0, dragInfo.baseEnd - MIN_BLOCK_MINUTES);
      } else if (dragInfo.mode === "end") {
        nextEnd = clamp(dragInfo.baseEnd + snappedDelta, dragInfo.baseStart + MIN_BLOCK_MINUTES, dragInfo.fullSpan);
      } else {
        const duration = dragInfo.baseEnd - dragInfo.baseStart;
        const shiftedStart = clamp(dragInfo.baseStart + snappedDelta, 0, Math.max(0, dragInfo.fullSpan - duration));
        nextStart = shiftedStart;
        nextEnd = shiftedStart + duration;
      }
      pending = { start: nextStart, end: nextEnd };
      if (rafId === null) {
        rafId = window.requestAnimationFrame(() => {
          const nextPending = pending;
          if (nextPending) {
            setDragInfo((prev) => (prev ? { ...prev, currentStart: nextPending.start, currentEnd: nextPending.end } : prev));
          }
          rafId = null;
        });
      }
    };

    const onPointerUp = () => {
      setDragInfo((prev) => {
        if (!prev) {
          return null;
        }
        const nextStartPoint = fromTimelineOffset(prev.currentStart, prev.baseDate);
        const nextEndPoint = fromTimelineOffset(prev.currentEnd, prev.baseDate);

        if (prev.rowId === "__outage_fixed__") {
          updateOutageRange({
            outageDateStart: nextStartPoint.date,
            outageTimeStart: nextStartPoint.time,
            outageDateEnd: nextEndPoint.date,
            outageTimeEnd: nextEndPoint.time,
          }, "timeline_drag_outage");
          appendAudit("timeline_drag", "停電バーをドラッグ調整");
        } else {
          updateSelectedProject((project) => ({
            ...project,
            scheduleRows: project.scheduleRows.map((row) =>
              row.id === prev.rowId
                ? {
                    ...row,
                    startDate: nextStartPoint.date,
                    start: nextStartPoint.time,
                    endDate: nextEndPoint.date,
                    end: nextEndPoint.time,
                  }
                : row,
            ),
          }), { action: "timeline_drag", detail: "工程バーをドラッグ調整" });
        }
        return null;
      });
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [dragInfo]);

  function updatePhotoItem(section: "detailPhotos" | "layoutPhotos", photoId: string, patch: Partial<PhotoSlot>): void {
    updateSelectedProject((project) => ({
      ...project,
      [section]: project[section].map((item) => (item.id === photoId ? { ...item, ...patch } : item)),
    }));
  }

  function addPhotoItem(section: "detailPhotos" | "layoutPhotos"): void {
    updateSelectedProject(
      (project) => {
        const list = project[section];
        const nextIndex = list.length + 1;
        const baseLabel = section === "detailPhotos" ? "写真" : "配置写真";
        const next: PhotoSlot = {
          id: uid("photo"),
          label: `${baseLabel}${nextIndex}`,
          dataUrl: "",
          layoutAnnotations: [],
          layoutAnnotationsV2: [],
        };
        return { ...project, [section]: [...list, next] };
      },
      { action: "photo_add", detail: `${section === "detailPhotos" ? "PDF4" : "PDF7"} 写真枠を追加` },
    );
  }

  function removePhotoItem(section: "detailPhotos" | "layoutPhotos", photoId: string): void {
    updateSelectedProject(
      (project) => {
        const next = project[section].filter((item) => item.id !== photoId);
        return { ...project, [section]: next };
      },
      { action: "photo_remove", detail: `${section === "detailPhotos" ? "PDF4" : "PDF7"} 写真枠を削除` },
    );
  }

  function applyPhotoFile(section: "detailPhotos" | "layoutPhotos", photoId: string, file: File): void {
    if (file.size > MAX_UPLOAD_FILE_BYTES) {
      alert("画像サイズが大きすぎます。10MB以下のPNG/JPGを選択してください。");
      return;
    }
    const maxSize = section === "layoutPhotos" ? DEFAULT_LAYOUT_MAX_SIZE : DEFAULT_PHOTO_MAX_SIZE;
    const quality = section === "layoutPhotos" ? 0.8 : 0.76;
    const targetBytes = section === "layoutPhotos" ? TARGET_LAYOUT_DATA_URL_BYTES : TARGET_PHOTO_DATA_URL_BYTES;
    optimizeImageFile(file, { maxEdge: maxSize, quality, targetBytes })
      .then((optimized) => {
        updatePhotoItem(section, photoId, { dataUrl: optimized, layoutAnnotations: [], layoutAnnotationsV2: [] });
      })
      .catch(() => {
        // noop
      });
  }

  function replacePhoto(section: "detailPhotos" | "layoutPhotos", photoId: string, event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    applyPhotoFile(section, photoId, file);
    event.target.value = "";
  }

  function exportPdf(): void {
    if (!canExportPdf) {
      setRequiredHint(`必須項目が未入力です（${totalMissingRequiredCount}件）。`);
      scrollToMissingField();
      return;
    }
    setRequiredHint("");
    appendAudit("pdf_export", "PDF出力を実行", selectedProject.projectId);
    const originalTitle = document.title;
    setPrintMode(true);
    document.title = "";
    const restore = () => {
      document.title = originalTitle;
      setPrintMode(false);
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.print();
      });
    });
    setTimeout(restore, 1500);
  }

  function updateRelatedParty(
    key: RelatedPartyKey,
    patch: Partial<RelatedParty>,
  ): void {
    updateSelectedProject((project) => ({
      ...project,
      relatedParties: {
        ...project.relatedParties,
        [key]: { ...project.relatedParties[key], ...patch },
      },
    }));
  }

  function applyRelatedPartyCompanyTemplate(
    key: RelatedPartyKey,
    templateId: string,
  ): void {
    setPartyTemplateSelections((prev) => ({ ...prev, [key]: templateId }));
    if (!templateId) {
      return;
    }
    const template = [...(partyCompanyTemplates[key] || []), ...PARTY_COMPANY_TEMPLATE_PRESETS[key]].find(
      (item) => item.id === templateId,
    );
    if (!template) {
      return;
    }
    updateRelatedParty(key, {
      title: template.title,
      company: template.company,
      person: template.person,
      office: template.office,
      tel: template.tel,
    });
  }

  function saveRelatedPartyCompanyTemplate(key: RelatedPartyKey): void {
    if (!canEdit) {
      return;
    }
    const party = selectedProject.relatedParties[key];
    const company = party.company.trim();
    if (!company) {
      alert("会社名 / 表示名を入力してからテンプレート登録してください。");
      return;
    }
    const item: PartyCompanyTemplatePreset = {
      id: uid(`tpl_party_company_${key}`),
      label: `${company}_${autoTemplateName("会社tpl")}`,
      title: party.title.trim() || party.title,
      company,
      person: party.person.trim(),
      office: party.office.trim(),
      tel: party.tel.trim(),
    };
    setPartyCompanyTemplates((prev) => {
      const next = {
        ...prev,
        [key]: [item, ...(prev[key] || [])],
      };
      // 登録直後の再ログインでも参照できるよう即時永続化
      if (hydrated) {
        localStorage.setItem(PARTY_COMPANY_TEMPLATE_STORAGE_KEY, stringifyForStorage(next));
      }
      return next;
    });
    setPartyTemplateSelections((prev) => ({ ...prev, [key]: item.id }));
    appendAudit("template_apply", `${party.title} の会社テンプレートを登録`);
  }

  function applyLayoutImageFile(file: File): void {
    if (file.size > MAX_UPLOAD_FILE_BYTES) {
      alert("画像サイズが大きすぎます。10MB以下のPNG/JPGを選択してください。");
      return;
    }
    optimizeImageFile(file, {
      maxEdge: DEFAULT_LAYOUT_MAX_SIZE,
      quality: 0.8,
      targetBytes: TARGET_LAYOUT_DATA_URL_BYTES,
    })
      .then((optimized) => {
        updateSelectedProject(
          (project) => ({
            ...project,
            layoutImageDataUrl: optimized,
            layoutAnnotations: [],
            layoutAnnotationsV2: [],
          }),
          { action: "layout_image_replace", detail: "配置図画像をアップロード（注釈を初期化）" },
        );
      })
      .catch(() => {
        // noop
      });
  }

  function replaceLayoutImage(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    applyLayoutImageFile(file);
    event.target.value = "";
  }

  function openAnnotationEditorSession(
    imageDataUrl: string,
    initial: LayoutAnnotation[],
    target: LayoutEditorTarget,
  ): void {
    if (!imageDataUrl) {
      return;
    }
    setLayoutEditorTarget(target);
    setLayoutEditorImageDataUrl(imageDataUrl);
    setLayoutEditorAnnotations(initial);
    setLayoutEditorSelectedId("");
    setLayoutEditorSelectedIds([]);
    setLayoutEditorDrawing(null);
    resetLayoutEditorChainSession();
    setLayoutEditorMove(null);
    setLayoutEditorResize(null);
    setLayoutEditorRotate(null);
    setLayoutEditorMarquee(null);
    setLayoutEditorTool("select");
    setLayoutEditorArrowHeadEnabled(true);
    setLayoutEditorColor(DEFAULT_ANNOTATION_COLOR);
    setLayoutEditorStrokeWidth(DEFAULT_ANNOTATION_STROKE_WIDTH);
    setLayoutEditorFillColor(DEFAULT_ANNOTATION_FILL_COLOR);
    setLayoutEditorFillOpacity(DEFAULT_ANNOTATION_FILL_OPACITY);
    setLayoutEditorPolygonSides(6);
    setLayoutEditorFontFamily(DEFAULT_TEXT_FONT_FAMILY);
    setLayoutEditorTextStrokeColor(DEFAULT_TEXT_STROKE_COLOR);
    setLayoutEditorTextStrokeWidth(DEFAULT_TEXT_STROKE_WIDTH);
    setLayoutEditorZoom(1);
    setLayoutEditorPan({ x: 0, y: 0 });
    setLayoutEditorPanState(null);
    setLayoutEditorSpacePressed(false);
    setLayoutEditorSnapEnabled(false);
    setLayoutEditorGuideLines([]);
    setLayoutEditorHistory([cloneLayoutAnnotations(initial)]);
    setLayoutEditorHistoryIndex(0);
    setLayoutEditorAdvancedOpen(false);
    setLayoutEditorAdvancedTab("transform");
    layoutEditorHistorySerializedRef.current = JSON.stringify(initial);
    layoutEditorHistorySuppressRef.current = false;
    setLayoutEditorOpen(true);
  }

  function openLayoutAnnotationEditor(): void {
    if (!selectedProject.layoutImageDataUrl) {
      return;
    }
    const initial = cloneLayoutAnnotations(selectedProject.layoutAnnotations);
    openAnnotationEditorSession(selectedProject.layoutImageDataUrl, initial, { kind: "layoutImage", label: "配置図画像" });
  }

  function openPhotoAnnotationEditor(section: "detailPhotos" | "layoutPhotos", photoId: string): void {
    const slot = selectedProject[section].find((item) => item.id === photoId);
    if (!slot?.dataUrl) {
      return;
    }
    const initial = cloneLayoutAnnotations(slot.layoutAnnotations || []);
    openAnnotationEditorSession(slot.dataUrl, initial, {
      kind: "photo",
      section,
      photoId,
      label: `${section === "detailPhotos" ? "参考写真" : "配置写真"}:${slot.label}`,
    });
  }

  function closeLayoutAnnotationEditor(): void {
    setLayoutEditorOpen(false);
    setLayoutEditorTarget(null);
    setLayoutEditorImageDataUrl("");
    setLayoutEditorDrawing(null);
    resetLayoutEditorChainSession();
    setLayoutEditorMove(null);
    setLayoutEditorResize(null);
    setLayoutEditorRotate(null);
    setLayoutEditorMarquee(null);
    setLayoutEditorZoom(1);
    setLayoutEditorPan({ x: 0, y: 0 });
    setLayoutEditorPanState(null);
    setLayoutEditorSpacePressed(false);
    setLayoutEditorGuideLines([]);
    setLayoutEditorHistory([]);
    setLayoutEditorHistoryIndex(-1);
    setLayoutEditorAdvancedOpen(false);
    setLayoutEditorAdvancedTab("transform");
    setLayoutEditorSelectedIds([]);
    setLayoutEditorSelectedId("");
    layoutEditorHistorySerializedRef.current = "";
    layoutEditorHistorySuppressRef.current = false;
  }

  function saveLayoutAnnotationEditor(): void {
    if (!layoutEditorTarget) {
      closeLayoutAnnotationEditor();
      return;
    }
    const nextLegacy = cloneLayoutAnnotations(layoutEditorAnnotations);
    const nextV2 = legacyLayoutAnnotationsToV2(nextLegacy);
    if (layoutEditorTarget.kind === "layoutImage") {
      updateSelectedProject(
        (project) => ({
          ...project,
          layoutAnnotations: nextLegacy,
          layoutAnnotationsV2: nextV2,
        }),
        { action: "layout_annotation_save", detail: `配置図注釈を保存（${layoutEditorAnnotations.length}件）` },
      );
    } else {
      const { section, photoId, label } = layoutEditorTarget;
      updateSelectedProject(
        (project) => ({
          ...project,
          [section]: project[section].map((slot) =>
            slot.id === photoId
              ? { ...slot, layoutAnnotations: nextLegacy, layoutAnnotationsV2: nextV2 }
              : slot,
          ),
        }),
        { action: "layout_annotation_save", detail: `${label} の画像注釈を保存（${layoutEditorAnnotations.length}件）` },
      );
    }
    closeLayoutAnnotationEditor();
  }

  function clearPhotoImage(section: "detailPhotos" | "layoutPhotos", photoId: string): void {
    updateSelectedProject((project) => ({
      ...project,
      [section]: project[section].map((item) =>
        item.id === photoId ? { ...item, dataUrl: "", layoutAnnotations: [], layoutAnnotationsV2: [] } : item,
      ),
    }));
  }

  function clearPhotoAnnotations(section: "detailPhotos" | "layoutPhotos", photoId: string): void {
    const slot = selectedProject[section].find((item) => item.id === photoId);
    if (!slot) {
      return;
    }
    updateSelectedProject(
      (project) => ({
        ...project,
        [section]: project[section].map((item) =>
          item.id === photoId ? { ...item, layoutAnnotations: [], layoutAnnotationsV2: [] } : item,
        ),
      }),
      { action: "layout_annotation_save", detail: `${slot.label} の画像注釈をクリア` },
    );
  }

  function clearLayoutAnnotationsInEditor(): void {
    setLayoutEditorAnnotations([]);
    setLayoutEditorSelectedId("");
    setLayoutEditorSelectedIds([]);
    setLayoutEditorDrawing(null);
    setLayoutEditorMove(null);
    setLayoutEditorResize(null);
    setLayoutEditorRotate(null);
    setLayoutEditorMarquee(null);
    setLayoutEditorGuideLines([]);
  }

  function removeSelectedLayoutAnnotation(): void {
    if (!layoutEditorSelectedIds.length) {
      return;
    }
    const removeSet = new Set(
      layoutEditorAnnotations
        .filter((annotation) => layoutEditorSelectedIdSet.has(annotation.id) && !annotation.locked)
        .map((annotation) => annotation.id),
    );
    if (!removeSet.size) {
      return;
    }
    setLayoutEditorAnnotations((prev) => prev.filter((item) => !removeSet.has(item.id)));
    setLayoutEditorSelectedId("");
    setLayoutEditorSelectedIds([]);
  }

  function duplicateSelectedLayoutAnnotation(): void {
    if (!layoutEditorSelectedIds.length) {
      return;
    }
    const targets = layoutEditorAnnotations.filter((item) => layoutEditorSelectedIdSet.has(item.id) && !item.locked);
    if (!targets.length) {
      return;
    }
    const dx = 18;
    const dy = 18;
    const duplicateGroupIdMap = new Map<string, string>();
    const duplicated = targets.map((target) => {
      let duplicatedGroupId: string | undefined;
      if (target.groupId) {
        duplicatedGroupId = duplicateGroupIdMap.get(target.groupId);
        if (!duplicatedGroupId) {
          duplicatedGroupId = uid("anno_group");
          duplicateGroupIdMap.set(target.groupId, duplicatedGroupId);
        }
      }
      if (target.type === "arrow") {
        return {
          ...target,
          id: uid("anno_arrow"),
          groupId: duplicatedGroupId,
          fromX: clampCanvasCoord(target.fromX + dx),
          fromY: clampCanvasCoord(target.fromY + dy),
          toX: clampCanvasCoord(target.toX + dx),
          toY: clampCanvasCoord(target.toY + dy),
        } as LayoutAnnotation;
      }
      if (target.type === "text") {
        return {
          ...target,
          id: uid("anno_txt"),
          groupId: duplicatedGroupId,
          x: clampCanvasCoord(target.x + dx),
          y: clampCanvasCoord(target.y + dy),
        } as LayoutAnnotation;
      }
      return {
        ...target,
        id: uid(target.type === "polygon" ? "anno_poly" : "anno_rect"),
        groupId: duplicatedGroupId,
        x: clampCanvasCoord(target.x + dx),
        y: clampCanvasCoord(target.y + dy),
      } as LayoutAnnotation;
    });
    setLayoutEditorAnnotations((prev) => [...prev, ...duplicated]);
    setLayoutEditorSelectedIds(duplicated.map((item) => item.id));
    setLayoutEditorSelectedId(duplicated[duplicated.length - 1]?.id ?? "");
  }

  function undoLayoutEditor(): void {
    if (!canUndoLayoutEditor) {
      return;
    }
    const nextIndex = layoutEditorHistoryIndex - 1;
    const snapshot = cloneLayoutAnnotations(layoutEditorHistory[nextIndex] || []);
    layoutEditorHistorySuppressRef.current = true;
    layoutEditorHistorySerializedRef.current = JSON.stringify(snapshot);
    setLayoutEditorHistoryIndex(nextIndex);
    setLayoutEditorAnnotations(snapshot);
    const snapshotIds = new Set(snapshot.map((annotation) => annotation.id));
    setLayoutEditorSelectedIds((prev) => prev.filter((id) => snapshotIds.has(id)));
    setLayoutEditorSelectedId((prev) => (prev && snapshotIds.has(prev) ? prev : ""));
  }

  function redoLayoutEditor(): void {
    if (!canRedoLayoutEditor) {
      return;
    }
    const nextIndex = layoutEditorHistoryIndex + 1;
    const snapshot = cloneLayoutAnnotations(layoutEditorHistory[nextIndex] || []);
    layoutEditorHistorySuppressRef.current = true;
    layoutEditorHistorySerializedRef.current = JSON.stringify(snapshot);
    setLayoutEditorHistoryIndex(nextIndex);
    setLayoutEditorAnnotations(snapshot);
    const snapshotIds = new Set(snapshot.map((annotation) => annotation.id));
    setLayoutEditorSelectedIds((prev) => prev.filter((id) => snapshotIds.has(id)));
    setLayoutEditorSelectedId((prev) => (prev && snapshotIds.has(prev) ? prev : ""));
  }

  function alignSelectedLayoutAnnotations(mode: "left" | "center" | "right" | "top" | "middle" | "bottom"): void {
    const editable = selectedLayoutAnnotations.filter((annotation) => !annotation.locked);
    if (editable.length < 2) {
      return;
    }
    const groupBounds = getCombinedAnnotationBounds(editable);
    if (!groupBounds) {
      return;
    }
    const selectedSet = new Set(editable.map((annotation) => annotation.id));
    setLayoutEditorAnnotations((prev) =>
      prev.map((annotation) => {
        if (!selectedSet.has(annotation.id)) {
          return annotation;
        }
        const bounds = getAnnotationBounds(annotation);
        let dx = 0;
        let dy = 0;
        if (mode === "left") {
          dx = groupBounds.x - bounds.x;
        } else if (mode === "center") {
          dx = groupBounds.centerX - bounds.centerX;
        } else if (mode === "right") {
          dx = groupBounds.x + groupBounds.width - (bounds.x + bounds.width);
        } else if (mode === "top") {
          dy = groupBounds.y - bounds.y;
        } else if (mode === "middle") {
          dy = groupBounds.centerY - bounds.centerY;
        } else if (mode === "bottom") {
          dy = groupBounds.y + groupBounds.height - (bounds.y + bounds.height);
        }
        return applyMoveToAnnotation(annotation, dx, dy);
      }),
    );
    setLayoutEditorGuideLines([]);
  }

  function distributeSelectedLayoutAnnotations(axis: "horizontal" | "vertical"): void {
    const editable = selectedLayoutAnnotations.filter((annotation) => annotation.visible !== false && !annotation.locked);
    if (editable.length < 3) {
      return;
    }
    const withBounds = editable.map((annotation) => ({ annotation, bounds: getAnnotationBounds(annotation) }));
    const sorted = [...withBounds].sort((a, b) =>
      axis === "horizontal" ? a.bounds.centerX - b.bounds.centerX : a.bounds.centerY - b.bounds.centerY,
    );
    const firstCenter = axis === "horizontal" ? sorted[0].bounds.centerX : sorted[0].bounds.centerY;
    const lastCenter = axis === "horizontal"
      ? sorted[sorted.length - 1].bounds.centerX
      : sorted[sorted.length - 1].bounds.centerY;
    const step = (lastCenter - firstCenter) / (sorted.length - 1);
    const deltaMap = new Map<string, { dx: number; dy: number }>();
    sorted.forEach((item, index) => {
      const expected = firstCenter + step * index;
      if (axis === "horizontal") {
        deltaMap.set(item.annotation.id, { dx: expected - item.bounds.centerX, dy: 0 });
      } else {
        deltaMap.set(item.annotation.id, { dx: 0, dy: expected - item.bounds.centerY });
      }
    });
    setLayoutEditorAnnotations((prev) =>
      prev.map((annotation) => {
        const delta = deltaMap.get(annotation.id);
        if (!delta) {
          return annotation;
        }
        return applyMoveToAnnotation(annotation, delta.dx, delta.dy);
      }),
    );
    setLayoutEditorGuideLines([]);
  }

  function nudgeSelectedLayoutAnnotations(dx: number, dy: number): void {
    if (!dx && !dy) {
      return;
    }
    const editable = selectedLayoutAnnotations.filter((annotation) => annotation.visible !== false && !annotation.locked);
    if (!editable.length) {
      return;
    }
    const selectedSet = new Set(editable.map((annotation) => annotation.id));
    setLayoutEditorAnnotations((prev) =>
      prev.map((annotation) => (selectedSet.has(annotation.id) ? applyMoveToAnnotation(annotation, dx, dy) : annotation)),
    );
    setLayoutEditorGuideLines([]);
  }

  function moveSelectedGroupTo(targetX: number, targetY: number): void {
    if (!selectedEditableLayoutGroupBounds || !selectedEditableLayoutAnnotations.length) {
      return;
    }
    const dx = targetX - selectedEditableLayoutGroupBounds.x;
    const dy = targetY - selectedEditableLayoutGroupBounds.y;
    const selectedSet = new Set(selectedEditableLayoutAnnotations.map((annotation) => annotation.id));
    setLayoutEditorAnnotations((prev) =>
      prev.map((annotation) => (selectedSet.has(annotation.id) ? applyMoveToAnnotation(annotation, dx, dy) : annotation)),
    );
    setLayoutEditorGuideLines([]);
  }

  function resizeSelectedGroupTo(targetWidth: number, targetHeight: number): void {
    if (!selectedEditableLayoutGroupBounds || !selectedEditableLayoutAnnotations.length) {
      return;
    }
    const clampedWidth = clamp(targetWidth, 8, LAYOUT_CANVAS_SIZE);
    const clampedHeight = clamp(targetHeight, 8, LAYOUT_CANVAS_SIZE);
    const nextBounds = {
      x: selectedEditableLayoutGroupBounds.x,
      y: selectedEditableLayoutGroupBounds.y,
      width: clampedWidth,
      height: clampedHeight,
    };
    const nextGroup = applyGroupResizeFromBounds(
      selectedEditableLayoutAnnotations.map((annotation) => ({ ...annotation })),
      {
        x: selectedEditableLayoutGroupBounds.x,
        y: selectedEditableLayoutGroupBounds.y,
        width: selectedEditableLayoutGroupBounds.width,
        height: selectedEditableLayoutGroupBounds.height,
      },
      nextBounds,
    );
    const map = new Map(nextGroup.map((annotation) => [annotation.id, annotation] as const));
    setLayoutEditorAnnotations((prev) =>
      prev.map((annotation) => (map.has(annotation.id) ? (map.get(annotation.id) as LayoutAnnotation) : annotation)),
    );
    setLayoutEditorGuideLines([]);
  }

  function rotateSelectedGroupBy(deltaAngle: number): void {
    if (!selectedEditableLayoutGroupBounds || !selectedEditableLayoutAnnotations.length) {
      return;
    }
    const nextGroup = selectedEditableLayoutAnnotations.map((annotation) =>
      applyRotateToAnnotationAroundCenter(
        annotation,
        selectedEditableLayoutGroupBounds.centerX,
        selectedEditableLayoutGroupBounds.centerY,
        deltaAngle,
      ),
    );
    const map = new Map(nextGroup.map((annotation) => [annotation.id, annotation] as const));
    setLayoutEditorAnnotations((prev) =>
      prev.map((annotation) => (map.has(annotation.id) ? (map.get(annotation.id) as LayoutAnnotation) : annotation)),
    );
    setLayoutEditorGuideLines([]);
  }

  function updateLayoutEditorAnnotation(annotationId: string, patch: Partial<LayoutAnnotation>): void {
    setLayoutEditorAnnotations((prev) =>
      prev.map((annotation) => {
        if (annotation.id !== annotationId) {
          return annotation;
        }
        if (annotation.locked && patch.locked === undefined && patch.visible === undefined && patch.name === undefined) {
          return annotation;
        }
        return { ...annotation, ...patch } as LayoutAnnotation;
      }),
    );
  }

  function setLayoutAnnotationVisibility(annotationId: string, visible: boolean): void {
    updateLayoutEditorAnnotation(annotationId, { visible });
  }

  function setLayoutAnnotationLocked(annotationId: string, locked: boolean): void {
    updateLayoutEditorAnnotation(annotationId, { locked });
  }

  function setLayoutAnnotationVisibilityBulk(annotationIds: string[], visible: boolean): void {
    if (!annotationIds.length) {
      return;
    }
    const idSet = new Set(annotationIds);
    setLayoutEditorAnnotations((prev) =>
      prev.map((annotation) => (idSet.has(annotation.id) ? ({ ...annotation, visible } as LayoutAnnotation) : annotation)),
    );
  }

  function setLayoutAnnotationLockedBulk(annotationIds: string[], locked: boolean): void {
    if (!annotationIds.length) {
      return;
    }
    const idSet = new Set(annotationIds);
    setLayoutEditorAnnotations((prev) =>
      prev.map((annotation) => (idSet.has(annotation.id) ? ({ ...annotation, locked } as LayoutAnnotation) : annotation)),
    );
  }

  function renameLayoutAnnotation(annotationId: string, name: string): void {
    updateLayoutEditorAnnotation(annotationId, { name: name.trim() || undefined });
  }

  function reorderSelectedLayers(mode: "front" | "back" | "forward" | "backward"): void {
    if (!layoutEditorSelectedIds.length) {
      return;
    }
    const selectedSet = new Set(layoutEditorSelectedIds);
    setLayoutEditorAnnotations((prev) => {
      const next = [...prev];
      if (mode === "front") {
        const selected = next.filter((item) => selectedSet.has(item.id));
        const unselected = next.filter((item) => !selectedSet.has(item.id));
        return [...unselected, ...selected];
      }
      if (mode === "back") {
        const selected = next.filter((item) => selectedSet.has(item.id));
        const unselected = next.filter((item) => !selectedSet.has(item.id));
        return [...selected, ...unselected];
      }
      if (mode === "forward") {
        for (let i = next.length - 2; i >= 0; i -= 1) {
          if (selectedSet.has(next[i].id) && !selectedSet.has(next[i + 1].id)) {
            const temp = next[i];
            next[i] = next[i + 1];
            next[i + 1] = temp;
          }
        }
        return next;
      }
      for (let i = 1; i < next.length; i += 1) {
        if (selectedSet.has(next[i].id) && !selectedSet.has(next[i - 1].id)) {
          const temp = next[i];
          next[i] = next[i - 1];
          next[i - 1] = temp;
        }
      }
      return next;
    });
  }

  function applyEditorStyleToSelectedAnnotation(): void {
    if (!layoutEditorSelectedIds.length) {
      return;
    }
    const selectedSet = new Set(layoutEditorSelectedIds);
    setLayoutEditorAnnotations((prev) =>
      prev.map((annotation) => {
        if (!selectedSet.has(annotation.id)) {
          return annotation;
        }
        if (annotation.locked) {
          return annotation;
        }
        if (annotation.type === "text") {
          return {
            ...annotation,
            color: layoutEditorColor,
            fontFamily: normalizeFontFamily(layoutEditorFontFamily),
            textStrokeColor: normalizeAnnotationColor(layoutEditorTextStrokeColor),
            textStrokeWidth: normalizeTextStrokeWidth(
              layoutEditorTextStrokeWidth,
              annotation.textStrokeWidth ?? DEFAULT_TEXT_STROKE_WIDTH,
            ),
          };
        }
        if (annotation.type === "polygon") {
          return {
            ...annotation,
            color: layoutEditorColor,
            strokeWidth: layoutEditorStrokeWidth,
            fillColor: layoutEditorFillColor,
            fillOpacity: normalizeFillOpacity(layoutEditorFillOpacity, annotation.fillOpacity ?? 0),
            sides: normalizePolygonSides(layoutEditorPolygonSides, annotation.sides),
          };
        }
        if (annotation.type === "rect") {
          return {
            ...annotation,
            color: layoutEditorColor,
            strokeWidth: layoutEditorStrokeWidth,
            fillColor: layoutEditorFillColor,
            fillOpacity: normalizeFillOpacity(layoutEditorFillOpacity, annotation.fillOpacity ?? 0),
          };
        }
        if (annotation.type === "arrow") {
          return {
            ...annotation,
            color: layoutEditorColor,
            strokeWidth: layoutEditorStrokeWidth,
            arrowHead: layoutEditorArrowHeadEnabled,
          };
        }
        return annotation;
      }),
    );
  }

  function setSelectedAnnotationRotation(nextRotation: number): void {
    if (!selectedLayoutAnnotation) {
      return;
    }
    updateLayoutEditorAnnotation(selectedLayoutAnnotation.id, { rotation: normalizeRotation(nextRotation) });
  }

  function clampLayoutEditorPan(nextPan: { x: number; y: number }, zoom = layoutEditorZoom): { x: number; y: number } {
    if (zoom <= 1) {
      return { x: 0, y: 0 };
    }
    const stageRect = layoutEditorStageRef.current?.getBoundingClientRect();
    if (!stageRect || !stageRect.width || !stageRect.height) {
      return nextPan;
    }
    const maxX = ((zoom - 1) * stageRect.width) / 2;
    const maxY = ((zoom - 1) * stageRect.height) / 2;
    return {
      x: clamp(nextPan.x, -maxX, maxX),
      y: clamp(nextPan.y, -maxY, maxY),
    };
  }

  function setLayoutEditorZoomLevel(nextZoom: number, options?: { resetPan?: boolean }): void {
    const clampedZoom = clamp(nextZoom, 0.25, 4);
    setLayoutEditorZoom(clampedZoom);
    if (options?.resetPan) {
      setLayoutEditorPan({ x: 0, y: 0 });
      return;
    }
    setLayoutEditorPan((prev) => clampLayoutEditorPan(prev, clampedZoom));
  }

  function zoomInLayoutEditor(): void {
    setLayoutEditorZoomLevel(Number((layoutEditorZoom + 0.1).toFixed(2)));
  }

  function zoomOutLayoutEditor(): void {
    setLayoutEditorZoomLevel(Number((layoutEditorZoom - 0.1).toFixed(2)));
  }

  function resetLayoutEditorFitView(): void {
    setLayoutEditorZoomLevel(1, { resetPan: true });
  }

  function setLayoutEditorActualSize(): void {
    setLayoutEditorZoomLevel(1, { resetPan: true });
  }

  function resetLayoutEditorChainSession(): void {
    setLayoutEditorChainStart(null);
    setLayoutEditorChainHover(null);
    setLayoutEditorChainGroupId(null);
    setLayoutEditorChainFirstPoint(null);
    setLayoutEditorChainAnnotationIds([]);
  }

  function activateLayoutTool(tool: LayoutEditorTool): void {
    setLayoutEditorTool(tool);
    resetLayoutEditorChainSession();
    setLayoutEditorGuideLines([]);
  }

  function activateLineTool(): void {
    setLayoutEditorTool("arrow");
    setLayoutEditorArrowHeadEnabled(false);
    resetLayoutEditorChainSession();
    setLayoutEditorGuideLines([]);
  }

  function activateChainTool(): void {
    setLayoutEditorTool("chain");
    resetLayoutEditorChainSession();
    setLayoutEditorGuideLines([]);
  }

  function getLayoutAnnotationSelectionIds(annotationId: string): string[] {
    const target = layoutEditorAnnotations.find((item) => item.id === annotationId);
    if (!target) {
      return [];
    }
    if (!target.groupId) {
      return [annotationId];
    }
    const grouped = layoutEditorAnnotations
      .filter((item) => item.groupId === target.groupId && item.visible !== false)
      .map((item) => item.id);
    return grouped.length ? grouped : [annotationId];
  }

  function handleLayoutEditorStageWheel(event: ReactWheelEvent<HTMLDivElement>): void {
    if (!layoutEditorOpen || (!event.ctrlKey && !event.metaKey)) {
      return;
    }
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.1 : -0.1;
    setLayoutEditorZoomLevel(Number((layoutEditorZoom + delta).toFixed(2)));
  }

  function applySnapToPoint(
    point: { x: number; y: number },
    targets: { xTargets: number[]; yTargets: number[] },
  ): { point: { x: number; y: number }; guides: LayoutGuideLine[] } {
    const xSnap = findNearestSnapDelta(point.x, targets.xTargets);
    const ySnap = findNearestSnapDelta(point.y, targets.yTargets);
    const xDelta = xSnap ? xSnap.delta : 0;
    const yDelta = ySnap ? ySnap.delta : 0;
    const snapped = {
      x: clampCanvasCoord(point.x + xDelta),
      y: clampCanvasCoord(point.y + yDelta),
    };
    const guides: LayoutGuideLine[] = [];
    if (xSnap) {
      guides.push({ id: "snap_x", x1: xSnap.target, y1: 0, x2: xSnap.target, y2: LAYOUT_CANVAS_SIZE });
    }
    if (ySnap) {
      guides.push({ id: "snap_y", x1: 0, y1: ySnap.target, x2: LAYOUT_CANVAS_SIZE, y2: ySnap.target });
    }
    return { point: snapped, guides };
  }

  function applySnapToMovedGroup(
    annotations: LayoutAnnotation[],
    excludeIds: string[],
  ): { dx: number; dy: number; guides: LayoutGuideLine[] } {
    const bounds = getCombinedAnnotationBounds(annotations);
    if (!bounds) {
      return { dx: 0, dy: 0, guides: [] };
    }
    const targets = buildLayoutSnapTargets(layoutEditorAnnotations, excludeIds);
    const xCandidates = [bounds.x, bounds.centerX, bounds.x + bounds.width];
    const yCandidates = [bounds.y, bounds.centerY, bounds.y + bounds.height];
    let xDelta: number | null = null;
    let yDelta: number | null = null;
    let xTarget: number | null = null;
    let yTarget: number | null = null;
    xCandidates.forEach((value) => {
      const hit = findNearestSnapDelta(value, targets.xTargets);
      if (hit && (xDelta === null || Math.abs(hit.delta) < Math.abs(xDelta))) {
        xDelta = hit.delta;
        xTarget = hit.target;
      }
    });
    yCandidates.forEach((value) => {
      const hit = findNearestSnapDelta(value, targets.yTargets);
      if (hit && (yDelta === null || Math.abs(hit.delta) < Math.abs(yDelta))) {
        yDelta = hit.delta;
        yTarget = hit.target;
      }
    });
    if (xDelta === null && yDelta === null) {
      return { dx: 0, dy: 0, guides: [] };
    }
    const guides: LayoutGuideLine[] = [];
    if (xTarget !== null) {
      guides.push({ id: "snap_x", x1: xTarget, y1: 0, x2: xTarget, y2: LAYOUT_CANVAS_SIZE });
    }
    if (yTarget !== null) {
      guides.push({ id: "snap_y", x1: 0, y1: yTarget, x2: LAYOUT_CANVAS_SIZE, y2: yTarget });
    }
    return { dx: xDelta ?? 0, dy: yDelta ?? 0, guides };
  }

  function applySnapToBoxResize(
    box: Pick<LayoutRectAnnotation, "x" | "y" | "width" | "height">,
    corner: LayoutResizeCorner,
    excludeIds: string | string[] | Set<string>,
  ): { box: Pick<LayoutRectAnnotation, "x" | "y" | "width" | "height">; guides: LayoutGuideLine[] } {
    const targets = buildLayoutSnapTargets(layoutEditorAnnotations, excludeIds);
    const left = box.x;
    const right = box.x + box.width;
    const top = box.y;
    const bottom = box.y + box.height;
    let next = { ...box };
    const guides: LayoutGuideLine[] = [];
    if (corner === "nw" || corner === "sw") {
      const snap = findNearestSnapDelta(left, targets.xTargets);
      if (snap) {
        next.x = clampCanvasCoord(left + snap.delta);
        next.width = clamp(right - next.x, 8, LAYOUT_CANVAS_SIZE);
        guides.push({ id: "snap_x", x1: snap.target, y1: 0, x2: snap.target, y2: LAYOUT_CANVAS_SIZE });
      }
    }
    if (corner === "ne" || corner === "se") {
      const snap = findNearestSnapDelta(right, targets.xTargets);
      if (snap) {
        const snappedRight = clampCanvasCoord(right + snap.delta);
        next.width = clamp(snappedRight - left, 8, LAYOUT_CANVAS_SIZE);
        guides.push({ id: "snap_x", x1: snap.target, y1: 0, x2: snap.target, y2: LAYOUT_CANVAS_SIZE });
      }
    }
    if (corner === "nw" || corner === "ne") {
      const snap = findNearestSnapDelta(top, targets.yTargets);
      if (snap) {
        next.y = clampCanvasCoord(top + snap.delta);
        next.height = clamp(bottom - next.y, 8, LAYOUT_CANVAS_SIZE);
        guides.push({ id: "snap_y", x1: 0, y1: snap.target, x2: LAYOUT_CANVAS_SIZE, y2: snap.target });
      }
    }
    if (corner === "sw" || corner === "se") {
      const snap = findNearestSnapDelta(bottom, targets.yTargets);
      if (snap) {
        const snappedBottom = clampCanvasCoord(bottom + snap.delta);
        next.height = clamp(snappedBottom - top, 8, LAYOUT_CANVAS_SIZE);
        guides.push({ id: "snap_y", x1: 0, y1: snap.target, x2: LAYOUT_CANVAS_SIZE, y2: snap.target });
      }
    }
    return { box: next, guides };
  }

  function getLayoutEditorPointFromClient(clientX: number, clientY: number): { x: number; y: number } | null {
    const svg = layoutEditorSvgRef.current;
    if (!svg) {
      return null;
    }
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return null;
    }
    const x = clampCanvasCoord(((clientX - rect.left) / rect.width) * LAYOUT_CANVAS_SIZE);
    const y = clampCanvasCoord(((clientY - rect.top) / rect.height) * LAYOUT_CANVAS_SIZE);
    return { x, y };
  }

  function getLayoutEditorPoint(event: ReactPointerEvent<SVGSVGElement>): { x: number; y: number } | null {
    return getLayoutEditorPointFromClient(event.clientX, event.clientY);
  }

  function applyMoveToAnnotation(snapshot: LayoutAnnotation, dx: number, dy: number): LayoutAnnotation {
    if (snapshot.type === "arrow") {
      return {
        ...snapshot,
        fromX: clampCanvasCoord(snapshot.fromX + dx),
        fromY: clampCanvasCoord(snapshot.fromY + dy),
        toX: clampCanvasCoord(snapshot.toX + dx),
        toY: clampCanvasCoord(snapshot.toY + dy),
      };
    }
    if (snapshot.type === "rect" || snapshot.type === "polygon") {
      return {
        ...snapshot,
        x: clampCanvasCoord(snapshot.x + dx),
        y: clampCanvasCoord(snapshot.y + dy),
      };
    }
    return {
      ...snapshot,
      x: clampCanvasCoord(snapshot.x + dx),
      y: clampCanvasCoord(snapshot.y + dy),
    };
  }

  function applyBoxResize(
    snapshot: Pick<LayoutRectAnnotation, "x" | "y" | "width" | "height">,
    corner: LayoutResizeCorner,
    dx: number,
    dy: number,
  ): Pick<LayoutRectAnnotation, "x" | "y" | "width" | "height"> {
    let left = snapshot.x;
    let top = snapshot.y;
    let right = snapshot.x + snapshot.width;
    let bottom = snapshot.y + snapshot.height;
    const minSize = 8;
    if (corner === "nw" || corner === "sw") {
      left = clamp(snapshot.x + dx, 0, right - minSize);
    }
    if (corner === "ne" || corner === "se") {
      right = clamp(snapshot.x + snapshot.width + dx, left + minSize, LAYOUT_CANVAS_SIZE);
    }
    if (corner === "nw" || corner === "ne") {
      top = clamp(snapshot.y + dy, 0, bottom - minSize);
    }
    if (corner === "sw" || corner === "se") {
      bottom = clamp(snapshot.y + snapshot.height + dy, top + minSize, LAYOUT_CANVAS_SIZE);
    }
    return {
      x: left,
      y: top,
      width: Math.max(minSize, right - left),
      height: Math.max(minSize, bottom - top),
    };
  }

  function resizeGroupBounds(
    bounds: { x: number; y: number; width: number; height: number },
    corner: LayoutResizeCorner,
    dx: number,
    dy: number,
  ): { x: number; y: number; width: number; height: number } {
    const minSize = 8;
    let left = bounds.x;
    let top = bounds.y;
    let right = bounds.x + bounds.width;
    let bottom = bounds.y + bounds.height;
    if (corner === "nw" || corner === "sw") {
      left = clamp(bounds.x + dx, 0, right - minSize);
    }
    if (corner === "ne" || corner === "se") {
      right = clamp(bounds.x + bounds.width + dx, left + minSize, LAYOUT_CANVAS_SIZE);
    }
    if (corner === "nw" || corner === "ne") {
      top = clamp(bounds.y + dy, 0, bottom - minSize);
    }
    if (corner === "sw" || corner === "se") {
      bottom = clamp(bounds.y + bounds.height + dy, top + minSize, LAYOUT_CANVAS_SIZE);
    }
    return {
      x: left,
      y: top,
      width: Math.max(minSize, right - left),
      height: Math.max(minSize, bottom - top),
    };
  }

  function applyGroupResizeFromBounds(
    snapshots: LayoutAnnotation[],
    fromBounds: { x: number; y: number; width: number; height: number },
    toBounds: { x: number; y: number; width: number; height: number },
  ): LayoutAnnotation[] {
    const sx = toBounds.width / Math.max(1, fromBounds.width);
    const sy = toBounds.height / Math.max(1, fromBounds.height);
    const tx = toBounds.x;
    const ty = toBounds.y;
    const ox = fromBounds.x;
    const oy = fromBounds.y;
    return snapshots.map((snapshot) => {
      if (snapshot.type === "arrow") {
        return {
          ...snapshot,
          fromX: clampCanvasCoord(tx + (snapshot.fromX - ox) * sx),
          fromY: clampCanvasCoord(ty + (snapshot.fromY - oy) * sy),
          toX: clampCanvasCoord(tx + (snapshot.toX - ox) * sx),
          toY: clampCanvasCoord(ty + (snapshot.toY - oy) * sy),
        };
      }
      if (snapshot.type === "rect" || snapshot.type === "polygon") {
        return {
          ...snapshot,
          x: clampCanvasCoord(tx + (snapshot.x - ox) * sx),
          y: clampCanvasCoord(ty + (snapshot.y - oy) * sy),
          width: clamp(snapshot.width * sx, 8, LAYOUT_CANVAS_SIZE),
          height: clamp(snapshot.height * sy, 8, LAYOUT_CANVAS_SIZE),
        };
      }
      const scale = Math.max(0.2, (Math.abs(sx) + Math.abs(sy)) / 2);
      return {
        ...snapshot,
        x: clampCanvasCoord(tx + (snapshot.x - ox) * sx),
        y: clampCanvasCoord(ty + (snapshot.y - oy) * sy),
        fontSize: normalizeFontSize(Math.round(snapshot.fontSize * scale), snapshot.fontSize),
      };
    });
  }

  function applyRotateToAnnotation(
    snapshot: LayoutAnnotation,
    centerX: number,
    centerY: number,
    deltaAngle: number,
  ): LayoutAnnotation {
    if (snapshot.type === "arrow") {
      const p1 = rotatePointAroundCenter(snapshot.fromX, snapshot.fromY, centerX, centerY, deltaAngle);
      const p2 = rotatePointAroundCenter(snapshot.toX, snapshot.toY, centerX, centerY, deltaAngle);
      return {
        ...snapshot,
        fromX: clampCanvasCoord(p1.x),
        fromY: clampCanvasCoord(p1.y),
        toX: clampCanvasCoord(p2.x),
        toY: clampCanvasCoord(p2.y),
      };
    }
    return {
      ...snapshot,
      rotation: normalizeRotation((snapshot.rotation ?? 0) + deltaAngle),
    };
  }

  function applyRotateToAnnotationAroundCenter(
    snapshot: LayoutAnnotation,
    centerX: number,
    centerY: number,
    deltaAngle: number,
  ): LayoutAnnotation {
    if (snapshot.type === "arrow") {
      const p1 = rotatePointAroundCenter(snapshot.fromX, snapshot.fromY, centerX, centerY, deltaAngle);
      const p2 = rotatePointAroundCenter(snapshot.toX, snapshot.toY, centerX, centerY, deltaAngle);
      return {
        ...snapshot,
        fromX: clampCanvasCoord(p1.x),
        fromY: clampCanvasCoord(p1.y),
        toX: clampCanvasCoord(p2.x),
        toY: clampCanvasCoord(p2.y),
      };
    }
    if (snapshot.type === "rect" || snapshot.type === "polygon") {
      const cx = snapshot.x + snapshot.width / 2;
      const cy = snapshot.y + snapshot.height / 2;
      const p = rotatePointAroundCenter(cx, cy, centerX, centerY, deltaAngle);
      return {
        ...snapshot,
        x: clampCanvasCoord(p.x - snapshot.width / 2),
        y: clampCanvasCoord(p.y - snapshot.height / 2),
        rotation: normalizeRotation((snapshot.rotation ?? 0) + deltaAngle),
      };
    }
    const p = rotatePointAroundCenter(snapshot.x, snapshot.y, centerX, centerY, deltaAngle);
    return {
      ...snapshot,
      x: clampCanvasCoord(p.x),
      y: clampCanvasCoord(p.y),
      rotation: normalizeRotation((snapshot.rotation ?? 0) + deltaAngle),
    };
  }

  function handleLayoutEditorCanvasPointerDown(event: ReactPointerEvent<SVGSVGElement>): void {
    if (!canEdit || !layoutEditorOpen) {
      return;
    }
    if (layoutEditorSpacePressed || event.button === 1) {
      event.preventDefault();
      setLayoutEditorDrawing(null);
      setLayoutEditorMove(null);
      setLayoutEditorResize(null);
      setLayoutEditorRotate(null);
      setLayoutEditorMarquee(null);
      setLayoutEditorGuideLines([]);
      setLayoutEditorPanState({
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startPanX: layoutEditorPan.x,
        startPanY: layoutEditorPan.y,
      });
      layoutEditorSvgRef.current?.setPointerCapture(event.pointerId);
      return;
    }
    const point = getLayoutEditorPoint(event);
    if (!point) {
      return;
    }
    layoutEditorSvgRef.current?.setPointerCapture(event.pointerId);
    if (layoutEditorTool === "chain") {
      setLayoutEditorMove(null);
      setLayoutEditorResize(null);
      setLayoutEditorRotate(null);
      setLayoutEditorMarquee(null);
      setLayoutEditorGuideLines([]);
      const nextPoint =
        layoutEditorSnapEnabled && !event.shiftKey
          ? applySnapToPoint(point, buildLayoutSnapTargets(layoutEditorAnnotations)).point
          : point;
      if (!layoutEditorChainStart) {
        setLayoutEditorChainGroupId(uid("anno_chain_group"));
        setLayoutEditorChainStart(nextPoint);
        setLayoutEditorChainFirstPoint(nextPoint);
        setLayoutEditorChainAnnotationIds([]);
        setLayoutEditorChainHover(nextPoint);
        setLayoutEditorSelectedId("");
        setLayoutEditorSelectedIds([]);
        return;
      }
      const activeChainGroupId = layoutEditorChainGroupId || uid("anno_chain_group");
      if (!layoutEditorChainGroupId) {
        setLayoutEditorChainGroupId(activeChainGroupId);
      }
      const canClose = layoutEditorChainFirstPoint && layoutEditorChainAnnotationIds.length >= 2;
      const shouldClose =
        canClose && Math.hypot(nextPoint.x - layoutEditorChainFirstPoint.x, nextPoint.y - layoutEditorChainFirstPoint.y) <= 14;
      const segmentEnd = shouldClose && layoutEditorChainFirstPoint ? layoutEditorChainFirstPoint : nextPoint;
      if (Math.hypot(segmentEnd.x - layoutEditorChainStart.x, segmentEnd.y - layoutEditorChainStart.y) < 3) {
        return;
      }
      const next: LayoutArrowAnnotation = {
        id: uid("anno_chain"),
        type: "arrow",
        name: `折れ線 ${layoutEditorAnnotations.length + 1}`,
        visible: true,
        locked: false,
        color: layoutEditorColor,
        groupId: activeChainGroupId,
        rotation: 0,
        fromX: layoutEditorChainStart.x,
        fromY: layoutEditorChainStart.y,
        toX: segmentEnd.x,
        toY: segmentEnd.y,
        strokeWidth: layoutEditorStrokeWidth,
        arrowHead: false,
      };
      setLayoutEditorAnnotations((prev) => [...prev, next]);
      const nextChainIds = [...layoutEditorChainAnnotationIds, next.id];
      if (shouldClose) {
        setLayoutEditorSelectedId(next.id);
        setLayoutEditorSelectedIds(nextChainIds);
        setLayoutEditorTool("select");
        resetLayoutEditorChainSession();
      } else {
        setLayoutEditorSelectedId(next.id);
        setLayoutEditorSelectedIds([next.id]);
        setLayoutEditorChainStart(segmentEnd);
        setLayoutEditorChainHover(segmentEnd);
        setLayoutEditorChainAnnotationIds(nextChainIds);
      }
      return;
    }
    if (layoutEditorTool === "arrow" || layoutEditorTool === "rect") {
      setLayoutEditorMove(null);
      setLayoutEditorResize(null);
      setLayoutEditorRotate(null);
      setLayoutEditorMarquee(null);
      resetLayoutEditorChainSession();
      setLayoutEditorGuideLines([]);
      setLayoutEditorDrawing({
        type: layoutEditorTool,
        startX: point.x,
        startY: point.y,
        endX: point.x,
        endY: point.y,
        color: layoutEditorColor,
        strokeWidth: layoutEditorStrokeWidth,
        fillColor: layoutEditorFillColor,
        fillOpacity: normalizeFillOpacity(layoutEditorFillOpacity),
        arrowHead: layoutEditorArrowHeadEnabled,
      });
      setLayoutEditorSelectedId("");
      setLayoutEditorSelectedIds([]);
      return;
    }
    if (layoutEditorTool === "text") {
      setLayoutEditorMove(null);
      setLayoutEditorResize(null);
      setLayoutEditorRotate(null);
      setLayoutEditorMarquee(null);
      resetLayoutEditorChainSession();
      setLayoutEditorGuideLines([]);
      const text = layoutEditorText.trim() || "注記";
      const next: LayoutTextAnnotation = {
        id: uid("anno_txt"),
        type: "text",
        name: `テキスト ${layoutEditorAnnotations.length + 1}`,
        visible: true,
        locked: false,
        color: layoutEditorColor,
        x: point.x,
        y: point.y,
        text,
        fontSize: 28,
        fontWeight: 700,
        fontFamily: normalizeFontFamily(layoutEditorFontFamily),
        textStrokeColor: normalizeAnnotationColor(layoutEditorTextStrokeColor),
        textStrokeWidth: normalizeTextStrokeWidth(layoutEditorTextStrokeWidth, DEFAULT_TEXT_STROKE_WIDTH),
        textAlign: "left",
        rotation: 0,
      };
      setLayoutEditorAnnotations((prev) => [...prev, next]);
      setLayoutEditorSelectedId(next.id);
      setLayoutEditorSelectedIds([next.id]);
      setLayoutEditorTool("select");
      return;
    }
    setLayoutEditorMove(null);
    setLayoutEditorResize(null);
    setLayoutEditorRotate(null);
    resetLayoutEditorChainSession();
    setLayoutEditorGuideLines([]);
    if (layoutEditorTool === "select") {
      if (!event.shiftKey) {
        setLayoutEditorSelectedId("");
        setLayoutEditorSelectedIds([]);
      }
      setLayoutEditorMarquee({
        startX: point.x,
        startY: point.y,
        endX: point.x,
        endY: point.y,
        additive: event.shiftKey,
      });
      return;
    }
    setLayoutEditorSelectedId("");
    setLayoutEditorSelectedIds([]);
  }

  function handleLayoutEditorCanvasPointerMove(event: ReactPointerEvent<SVGSVGElement>): void {
    if (!canEdit || !layoutEditorOpen) {
      return;
    }
    if (layoutEditorPanState) {
      const dx = event.clientX - layoutEditorPanState.startClientX;
      const dy = event.clientY - layoutEditorPanState.startClientY;
      const nextPan = {
        x: layoutEditorPanState.startPanX + dx,
        y: layoutEditorPanState.startPanY + dy,
      };
      setLayoutEditorPan(clampLayoutEditorPan(nextPan, layoutEditorZoom));
      setLayoutEditorGuideLines([]);
      return;
    }
    const point = getLayoutEditorPoint(event);
    if (!point) {
      return;
    }
    if (layoutEditorTool === "chain" && layoutEditorChainStart && !layoutEditorDrawing && !layoutEditorMove && !layoutEditorResize && !layoutEditorRotate && !layoutEditorMarquee) {
      if (layoutEditorSnapEnabled && !event.shiftKey) {
        const snapped = applySnapToPoint(point, buildLayoutSnapTargets(layoutEditorAnnotations));
        setLayoutEditorChainHover(snapped.point);
        setLayoutEditorGuideLines(snapped.guides);
      } else {
        setLayoutEditorChainHover(point);
        setLayoutEditorGuideLines([]);
      }
      return;
    }
    if (layoutEditorMarquee) {
      setLayoutEditorMarquee((prev) => (prev ? { ...prev, endX: point.x, endY: point.y } : prev));
      setLayoutEditorGuideLines([]);
      return;
    }
    if (layoutEditorDrawing) {
      if (layoutEditorSnapEnabled && !event.shiftKey) {
        const snapped = applySnapToPoint(point, buildLayoutSnapTargets(layoutEditorAnnotations));
        setLayoutEditorDrawing((prev) => (prev ? { ...prev, endX: snapped.point.x, endY: snapped.point.y } : prev));
        setLayoutEditorGuideLines(snapped.guides);
      } else {
        setLayoutEditorDrawing((prev) => (prev ? { ...prev, endX: point.x, endY: point.y } : prev));
        setLayoutEditorGuideLines([]);
      }
      return;
    }
    if (layoutEditorMove) {
      const dx = point.x - layoutEditorMove.startX;
      const dy = point.y - layoutEditorMove.startY;
      let snapDx = 0;
      let snapDy = 0;
      let guides: LayoutGuideLine[] = [];
      if (layoutEditorSnapEnabled && !event.shiftKey) {
        const movedGroup = layoutEditorMove.snapshots.map((snapshot) => applyMoveToAnnotation(snapshot, dx, dy));
        const snapped = applySnapToMovedGroup(movedGroup, layoutEditorMove.annotationIds);
        snapDx = snapped.dx;
        snapDy = snapped.dy;
        guides = snapped.guides;
      }
      const snapshotMap = new Map(layoutEditorMove.snapshots.map((snapshot) => [snapshot.id, snapshot] as const));
      setLayoutEditorAnnotations((prev) =>
        prev.map((annotation) =>
          layoutEditorMove.annotationIds.includes(annotation.id) && snapshotMap.has(annotation.id)
            ? applyMoveToAnnotation(snapshotMap.get(annotation.id) as LayoutAnnotation, dx + snapDx, dy + snapDy)
            : annotation,
        ),
      );
      setLayoutEditorGuideLines(guides);
      return;
    }
    if (layoutEditorResize) {
      if (layoutEditorResize.mode === "box") {
        const dx = point.x - layoutEditorResize.startX;
        const dy = point.y - layoutEditorResize.startY;
        let nextBox = applyBoxResize(layoutEditorResize.snapshot, layoutEditorResize.corner, dx, dy);
        let guides: LayoutGuideLine[] = [];
        if (layoutEditorSnapEnabled && !event.shiftKey) {
          const snapped = applySnapToBoxResize(nextBox, layoutEditorResize.corner, layoutEditorResize.annotationId);
          nextBox = snapped.box;
          guides = snapped.guides;
        }
        setLayoutEditorAnnotations((prev) =>
          prev.map((annotation) =>
            annotation.id === layoutEditorResize.annotationId && (annotation.type === "rect" || annotation.type === "polygon")
              ? { ...annotation, ...nextBox }
              : annotation,
          ),
        );
        setLayoutEditorGuideLines(guides);
        return;
      }
      if (layoutEditorResize.mode === "groupBox") {
        const dx = point.x - layoutEditorResize.startX;
        const dy = point.y - layoutEditorResize.startY;
        let resizedBounds = resizeGroupBounds(layoutEditorResize.bounds, layoutEditorResize.corner, dx, dy);
        let guides: LayoutGuideLine[] = [];
        if (layoutEditorSnapEnabled && !event.shiftKey) {
          const snapped = applySnapToBoxResize(resizedBounds, layoutEditorResize.corner, layoutEditorResize.annotationIds);
          resizedBounds = snapped.box;
          guides = snapped.guides;
        }
        const nextGroup = applyGroupResizeFromBounds(layoutEditorResize.snapshots, layoutEditorResize.bounds, resizedBounds);
        const map = new Map(nextGroup.map((item) => [item.id, item] as const));
        setLayoutEditorAnnotations((prev) =>
          prev.map((annotation) => (map.has(annotation.id) ? (map.get(annotation.id) as LayoutAnnotation) : annotation)),
        );
        setLayoutEditorGuideLines(guides);
        return;
      }
      if (layoutEditorResize.mode === "arrow") {
        const snappedPoint =
          layoutEditorSnapEnabled && !event.shiftKey
            ? applySnapToPoint(point, buildLayoutSnapTargets(layoutEditorAnnotations, layoutEditorResize.annotationId))
            : null;
        const nextPoint = snappedPoint?.point ?? point;
        setLayoutEditorAnnotations((prev) =>
          prev.map((annotation) => {
            if (annotation.id !== layoutEditorResize.annotationId || annotation.type !== "arrow") {
              return annotation;
            }
            if (layoutEditorResize.endpoint === "from") {
              return { ...layoutEditorResize.snapshot, fromX: nextPoint.x, fromY: nextPoint.y };
            }
            return { ...layoutEditorResize.snapshot, toX: nextPoint.x, toY: nextPoint.y };
          }),
        );
        setLayoutEditorGuideLines(snappedPoint?.guides ?? []);
        return;
      }
      const dy = point.y - layoutEditorResize.startY;
      const nextSize = clamp(Math.round(layoutEditorResize.snapshot.fontSize - dy * 0.35), 10, 96);
      setLayoutEditorAnnotations((prev) =>
        prev.map((annotation) =>
          annotation.id === layoutEditorResize.annotationId && annotation.type === "text"
            ? { ...layoutEditorResize.snapshot, fontSize: nextSize }
            : annotation,
        ),
      );
      setLayoutEditorGuideLines([]);
      return;
    }
    if (layoutEditorRotate) {
      const angle = Math.atan2(point.y - layoutEditorRotate.centerY, point.x - layoutEditorRotate.centerX) * (180 / Math.PI);
      const delta = angle - layoutEditorRotate.startAngle;
      const rotatedGroup = layoutEditorRotate.snapshots.map((snapshot) =>
        applyRotateToAnnotationAroundCenter(snapshot, layoutEditorRotate.centerX, layoutEditorRotate.centerY, delta),
      );
      const map = new Map(rotatedGroup.map((item) => [item.id, item] as const));
      setLayoutEditorAnnotations((prev) =>
        prev.map((annotation) =>
          map.has(annotation.id) ? (map.get(annotation.id) as LayoutAnnotation) : annotation,
        ),
      );
      setLayoutEditorGuideLines([]);
      return;
    }
    setLayoutEditorGuideLines([]);
  }

  function handleLayoutEditorCanvasPointerUp(event: ReactPointerEvent<SVGSVGElement>): void {
    if (!canEdit || !layoutEditorOpen) {
      return;
    }
    if (layoutEditorSvgRef.current?.hasPointerCapture(event.pointerId)) {
      layoutEditorSvgRef.current.releasePointerCapture(event.pointerId);
    }
    if (layoutEditorPanState) {
      setLayoutEditorPanState(null);
      setLayoutEditorGuideLines([]);
      return;
    }
    if (layoutEditorMarquee) {
      const marquee = layoutEditorMarquee;
      setLayoutEditorMarquee(null);
      const left = Math.min(marquee.startX, marquee.endX);
      const right = Math.max(marquee.startX, marquee.endX);
      const top = Math.min(marquee.startY, marquee.endY);
      const bottom = Math.max(marquee.startY, marquee.endY);
      if (Math.abs(right - left) < 4 && Math.abs(bottom - top) < 4) {
        if (!marquee.additive) {
          setLayoutEditorSelectedId("");
          setLayoutEditorSelectedIds([]);
        }
      } else {
        const hitIds = layoutEditorAnnotations
          .filter((annotation) => {
            if (annotation.visible === false) {
              return false;
            }
            const bounds = getAnnotationBounds(annotation);
            return !(bounds.x + bounds.width < left || bounds.x > right || bounds.y + bounds.height < top || bounds.y > bottom);
          })
          .map((annotation) => annotation.id);
        const expandedHitIds = Array.from(new Set(hitIds.flatMap((id) => getLayoutAnnotationSelectionIds(id))));
        if (marquee.additive) {
          setLayoutEditorSelectedIds((prev) => Array.from(new Set([...prev, ...expandedHitIds])));
          if (expandedHitIds.length) {
            setLayoutEditorSelectedId(expandedHitIds[expandedHitIds.length - 1]);
          }
        } else {
          setLayoutEditorSelectedIds(expandedHitIds);
          setLayoutEditorSelectedId(expandedHitIds[expandedHitIds.length - 1] ?? "");
        }
      }
      setLayoutEditorGuideLines([]);
      return;
    }
    if (layoutEditorDrawing) {
      const draft = layoutEditorDrawing;
      setLayoutEditorDrawing(null);
      const dx = draft.endX - draft.startX;
      const dy = draft.endY - draft.startY;
      if (Math.hypot(dx, dy) < 6) {
        setLayoutEditorGuideLines([]);
        return;
      }
      if (draft.type === "arrow") {
        const next: LayoutArrowAnnotation = {
          id: uid("anno_arrow"),
          type: "arrow",
          name: `${draft.arrowHead === false ? "線" : "矢印"} ${layoutEditorAnnotations.length + 1}`,
          visible: true,
          locked: false,
          color: draft.color,
          rotation: 0,
          fromX: draft.startX,
          fromY: draft.startY,
          toX: draft.endX,
          toY: draft.endY,
          strokeWidth: draft.strokeWidth,
          arrowHead: draft.arrowHead !== false,
        };
        setLayoutEditorAnnotations((prev) => [...prev, next]);
        setLayoutEditorSelectedId(next.id);
        setLayoutEditorSelectedIds([next.id]);
        setLayoutEditorTool("select");
        resetLayoutEditorChainSession();
        setLayoutEditorGuideLines([]);
        return;
      }
      const left = Math.min(draft.startX, draft.endX);
      const top = Math.min(draft.startY, draft.endY);
      const next: LayoutRectAnnotation = {
        id: uid("anno_rect"),
        type: "rect",
        name: `四角形 ${layoutEditorAnnotations.length + 1}`,
        visible: true,
        locked: false,
        color: draft.color,
        rotation: 0,
        fillColor: draft.fillColor,
        fillOpacity: normalizeFillOpacity(draft.fillOpacity),
        x: left,
        y: top,
        width: Math.max(8, Math.abs(dx)),
        height: Math.max(8, Math.abs(dy)),
        strokeWidth: draft.strokeWidth,
      };
      setLayoutEditorAnnotations((prev) => [...prev, next]);
      setLayoutEditorSelectedId(next.id);
      setLayoutEditorSelectedIds([next.id]);
      setLayoutEditorTool("select");
      resetLayoutEditorChainSession();
      setLayoutEditorGuideLines([]);
      return;
    }
    if (layoutEditorMove) {
      setLayoutEditorMove(null);
    }
    if (layoutEditorResize) {
      setLayoutEditorResize(null);
    }
    if (layoutEditorRotate) {
      setLayoutEditorRotate(null);
    }
    setLayoutEditorGuideLines([]);
  }

  function startLayoutAnnotationMove(annotationId: string, event: ReactPointerEvent<SVGElement>): void {
    if (!canEdit || layoutEditorTool !== "select" || layoutEditorSpacePressed) {
      return;
    }
    event.stopPropagation();
    const groupedSelectionIds = getLayoutAnnotationSelectionIds(annotationId);
    const targetSelectionIds = groupedSelectionIds.length ? groupedSelectionIds : [annotationId];
    if (event.shiftKey) {
      setLayoutEditorSelectedIds((prev) => {
        const nextSet = new Set(prev);
        const allSelected = targetSelectionIds.every((id) => nextSet.has(id));
        if (allSelected) {
          targetSelectionIds.forEach((id) => nextSet.delete(id));
          const next = Array.from(nextSet);
          if (!nextSet.has(layoutEditorSelectedId)) {
            setLayoutEditorSelectedId(next[next.length - 1] ?? "");
          }
          return next;
        }
        targetSelectionIds.forEach((id) => nextSet.add(id));
        setLayoutEditorSelectedId(annotationId);
        return Array.from(nextSet);
      });
      return;
    }
    const point = getLayoutEditorPointFromClient(event.clientX, event.clientY);
    const target = layoutEditorAnnotations.find((item) => item.id === annotationId);
    if (!point || !target) {
      return;
    }
    if (target.locked) {
      setLayoutEditorSelectedIds(targetSelectionIds);
      setLayoutEditorSelectedId(annotationId);
      return;
    }
    const selectedIdsRaw = layoutEditorSelectedIdSet.has(annotationId) && layoutEditorSelectedIds.length
      ? Array.from(new Set([...layoutEditorSelectedIds, ...targetSelectionIds]))
      : targetSelectionIds;
    const selectedIds = selectedIdsRaw.filter((id) => {
      const item = layoutEditorAnnotations.find((annotation) => annotation.id === id);
      return item && item.visible !== false && !item.locked;
    });
    if (!selectedIds.length) {
      setLayoutEditorSelectedIds([annotationId]);
      setLayoutEditorSelectedId(annotationId);
      return;
    }
    const selectedSet = new Set(selectedIds);
    const snapshots = layoutEditorAnnotations
      .filter((item) => selectedSet.has(item.id))
      .map((item) => ({ ...item }));
    setLayoutEditorSelectedIds(selectedIds);
    setLayoutEditorSelectedId(annotationId);
    setLayoutEditorResize(null);
    setLayoutEditorRotate(null);
    setLayoutEditorMarquee(null);
    setLayoutEditorGuideLines([]);
    setLayoutEditorMove({
      annotationIds: selectedIds,
      startX: point.x,
      startY: point.y,
      snapshots,
    });
    layoutEditorSvgRef.current?.setPointerCapture(event.pointerId);
  }

  function startLayoutAnnotationRotate(annotationId: string, event: ReactPointerEvent<SVGElement>): void {
    if (!canEdit || layoutEditorTool !== "select" || layoutEditorSpacePressed) {
      return;
    }
    event.stopPropagation();
    const point = getLayoutEditorPointFromClient(event.clientX, event.clientY);
    const target = layoutEditorAnnotations.find((item) => item.id === annotationId);
    if (!point || !target || target.locked) {
      return;
    }
    const bounds = getAnnotationBounds(target);
    const angle = Math.atan2(point.y - bounds.centerY, point.x - bounds.centerX) * (180 / Math.PI);
    setLayoutEditorSelectedId(annotationId);
    setLayoutEditorSelectedIds([annotationId]);
    setLayoutEditorMove(null);
    setLayoutEditorResize(null);
    setLayoutEditorMarquee(null);
    setLayoutEditorGuideLines([]);
    setLayoutEditorRotate({
      annotationIds: [annotationId],
      centerX: bounds.centerX,
      centerY: bounds.centerY,
      startAngle: angle,
      snapshots: [{ ...target }],
    });
    layoutEditorSvgRef.current?.setPointerCapture(event.pointerId);
  }

  function startLayoutGroupRotate(event: ReactPointerEvent<SVGElement>): void {
    if (!canEdit || layoutEditorTool !== "select" || layoutEditorSpacePressed) {
      return;
    }
    event.stopPropagation();
    const point = getLayoutEditorPointFromClient(event.clientX, event.clientY);
    if (!point || !selectedEditableLayoutGroupBounds || selectedEditableLayoutAnnotations.length < 2) {
      return;
    }
    const angle = Math.atan2(point.y - selectedEditableLayoutGroupBounds.centerY, point.x - selectedEditableLayoutGroupBounds.centerX) * (180 / Math.PI);
    const ids = selectedEditableLayoutAnnotations.map((item) => item.id);
    setLayoutEditorMove(null);
    setLayoutEditorResize(null);
    setLayoutEditorMarquee(null);
    setLayoutEditorGuideLines([]);
    setLayoutEditorRotate({
      annotationIds: ids,
      centerX: selectedEditableLayoutGroupBounds.centerX,
      centerY: selectedEditableLayoutGroupBounds.centerY,
      startAngle: angle,
      snapshots: selectedEditableLayoutAnnotations.map((item) => ({ ...item })),
    });
    layoutEditorSvgRef.current?.setPointerCapture(event.pointerId);
  }

  function startLayoutBoxResize(annotationId: string, corner: LayoutResizeCorner, event: ReactPointerEvent<SVGElement>): void {
    if (!canEdit || layoutEditorTool !== "select" || layoutEditorSpacePressed) {
      return;
    }
    event.stopPropagation();
    const point = getLayoutEditorPointFromClient(event.clientX, event.clientY);
    const target = layoutEditorAnnotations.find((item) => item.id === annotationId);
    if (!point || !target || target.locked || (target.type !== "rect" && target.type !== "polygon")) {
      return;
    }
    setLayoutEditorSelectedId(annotationId);
    setLayoutEditorSelectedIds([annotationId]);
    setLayoutEditorMove(null);
    setLayoutEditorRotate(null);
    setLayoutEditorMarquee(null);
    setLayoutEditorGuideLines([]);
    setLayoutEditorResize({
      mode: "box",
      annotationId,
      corner,
      startX: point.x,
      startY: point.y,
      snapshot: { ...target },
    });
    layoutEditorSvgRef.current?.setPointerCapture(event.pointerId);
  }

  function startLayoutGroupBoxResize(corner: LayoutResizeCorner, event: ReactPointerEvent<SVGElement>): void {
    if (!canEdit || layoutEditorTool !== "select" || layoutEditorSpacePressed) {
      return;
    }
    event.stopPropagation();
    const point = getLayoutEditorPointFromClient(event.clientX, event.clientY);
    if (!point || !selectedEditableLayoutGroupBounds || selectedEditableLayoutAnnotations.length < 2) {
      return;
    }
    const ids = selectedEditableLayoutAnnotations.map((item) => item.id);
    setLayoutEditorMove(null);
    setLayoutEditorRotate(null);
    setLayoutEditorMarquee(null);
    setLayoutEditorGuideLines([]);
    setLayoutEditorResize({
      mode: "groupBox",
      annotationIds: ids,
      corner,
      startX: point.x,
      startY: point.y,
      bounds: {
        x: selectedEditableLayoutGroupBounds.x,
        y: selectedEditableLayoutGroupBounds.y,
        width: selectedEditableLayoutGroupBounds.width,
        height: selectedEditableLayoutGroupBounds.height,
      },
      snapshots: selectedEditableLayoutAnnotations.map((item) => ({ ...item })),
    });
    layoutEditorSvgRef.current?.setPointerCapture(event.pointerId);
  }

  function startLayoutArrowEndpointResize(
    annotationId: string,
    endpoint: "from" | "to",
    event: ReactPointerEvent<SVGElement>,
  ): void {
    if (!canEdit || layoutEditorTool !== "select" || layoutEditorSpacePressed) {
      return;
    }
    event.stopPropagation();
    const point = getLayoutEditorPointFromClient(event.clientX, event.clientY);
    const target = layoutEditorAnnotations.find((item) => item.id === annotationId);
    if (!point || !target || target.locked || target.type !== "arrow") {
      return;
    }
    setLayoutEditorSelectedId(annotationId);
    setLayoutEditorSelectedIds([annotationId]);
    setLayoutEditorMove(null);
    setLayoutEditorRotate(null);
    setLayoutEditorMarquee(null);
    setLayoutEditorGuideLines([]);
    setLayoutEditorResize({
      mode: "arrow",
      annotationId,
      endpoint,
      startX: point.x,
      startY: point.y,
      snapshot: { ...target },
    });
    layoutEditorSvgRef.current?.setPointerCapture(event.pointerId);
  }

  function startLayoutTextResize(annotationId: string, event: ReactPointerEvent<SVGElement>): void {
    if (!canEdit || layoutEditorTool !== "select" || layoutEditorSpacePressed) {
      return;
    }
    event.stopPropagation();
    const point = getLayoutEditorPointFromClient(event.clientX, event.clientY);
    const target = layoutEditorAnnotations.find((item) => item.id === annotationId);
    if (!point || !target || target.locked || target.type !== "text") {
      return;
    }
    setLayoutEditorSelectedId(annotationId);
    setLayoutEditorSelectedIds([annotationId]);
    setLayoutEditorMove(null);
    setLayoutEditorRotate(null);
    setLayoutEditorMarquee(null);
    setLayoutEditorGuideLines([]);
    setLayoutEditorResize({
      mode: "text",
      annotationId,
      startY: point.y,
      snapshot: { ...target },
    });
    layoutEditorSvgRef.current?.setPointerCapture(event.pointerId);
  }

  function copyFromSource(section: "schedule" | "detailPhotos" | "relatedParties" | "layout"): void {
    if (!copySourceProject || !canEdit) {
      return;
    }
    updateSelectedProject((project) => {
      if (section === "schedule") {
        return { ...project, scheduleRows: cloneScheduleRows(copySourceProject.scheduleRows) };
      }
      if (section === "detailPhotos") {
        return { ...project, detailPhotos: clonePhotoSlots(copySourceProject.detailPhotos) };
      }
      if (section === "relatedParties") {
        return { ...project, relatedParties: cloneRelatedParties(copySourceProject.relatedParties) };
      }
      return {
        ...project,
        layoutImageDataUrl: copySourceProject.layoutImageDataUrl,
        layoutAnnotations: cloneLayoutAnnotations(copySourceProject.layoutAnnotations),
        layoutAnnotationsV2: cloneLayoutAnnotationsV2(copySourceProject.layoutAnnotationsV2),
        layoutPhotos: clonePhotoSlots(copySourceProject.layoutPhotos),
      };
    }, {
      action: "copy_from_project",
      detail: `${copySourceProject.projectId} から ${section} をコピー`,
      snapshotLabel: "案件コピー適用前バックアップ",
    });
  }

  function autoTemplateName(prefix: string): string {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mi = String(now.getMinutes()).padStart(2, "0");
    return `${prefix}_${mm}${dd}_${hh}${mi}`;
  }

  function autoScheduleTemplateName(): string {
    const workHead = selectedProject.titleSubject || "工事";
    const topRows = selectedProject.scheduleRows
      .map((row) => row.label.trim())
      .filter(Boolean)
      .slice(0, 2)
      .join("・");
    const body = topRows ? `${workHead}_${topRows}` : workHead;
    return `${body}_工程表_${autoTemplateName("tpl")}`;
  }

  function autoDetailPhotoTemplateName(): string {
    const workHead = selectedProject.titleSubject || "工事";
    return `${workHead}_参考写真_${autoTemplateName("tpl")}`;
  }

  function autoPartyTemplateName(): string {
    const contractor = selectedProject.relatedParties.contractor.company?.trim() || "未設定";
    return `施工会社:${contractor}_体制表_${autoTemplateName("tpl")}`;
  }

  function autoLayoutTemplateName(): string {
    const workHead = selectedProject.titleSubject || "工事";
    return `${workHead}_配置図写真_${autoTemplateName("tpl")}`;
  }

  function saveScheduleTemplate(): void {
    if (!canEdit) {
      return;
    }
    const item: SimpleTemplate<ScheduleRow[]> = {
      id: uid("tpl_schedule"),
      name: autoScheduleTemplateName(),
      createdAt: new Date().toISOString(),
      payload: cloneScheduleRows(selectedProject.scheduleRows),
    };
    setScheduleTemplates((prev) => [item, ...prev]);
    setSelectedScheduleTemplateId(item.id);
  }

  function applyScheduleTemplate(): void {
    if (!selectedScheduleTemplate) {
      return;
    }
    updateSelectedProject(
      (project) => ({ ...project, scheduleRows: cloneScheduleRows(selectedScheduleTemplate.payload) }),
      { action: "template_apply", detail: `工程表テンプレート適用: ${selectedScheduleTemplate.name}`, snapshotLabel: "テンプレート適用前バックアップ" },
    );
  }

  function deleteScheduleTemplate(): void {
    if (!canEdit) {
      return;
    }
    if (!selectedScheduleTemplateId) {
      return;
    }
    setScheduleTemplates((prev) => {
      const next = prev.filter((template) => template.id !== selectedScheduleTemplateId);
      setSelectedScheduleTemplateId(next[0]?.id ?? "");
      return next;
    });
  }

  function saveDetailPhotoTemplate(): void {
    if (!canEdit) {
      return;
    }
    const item: SimpleTemplate<PhotoSlots> = {
      id: uid("tpl_detail_photo"),
      name: autoDetailPhotoTemplateName(),
      createdAt: new Date().toISOString(),
      payload: clonePhotoSlots(selectedProject.detailPhotos),
    };
    setDetailPhotoTemplates((prev) => [item, ...prev]);
    setSelectedDetailPhotoTemplateId(item.id);
  }

  function applyDetailPhotoTemplate(): void {
    if (!selectedDetailPhotoTemplate) {
      return;
    }
    updateSelectedProject(
      (project) => ({ ...project, detailPhotos: clonePhotoSlots(selectedDetailPhotoTemplate.payload) }),
      { action: "template_apply", detail: `PDF4写真テンプレート適用: ${selectedDetailPhotoTemplate.name}`, snapshotLabel: "テンプレート適用前バックアップ" },
    );
  }

  function deleteDetailPhotoTemplate(): void {
    if (!canEdit) {
      return;
    }
    if (!selectedDetailPhotoTemplateId) {
      return;
    }
    setDetailPhotoTemplates((prev) => {
      const next = prev.filter((template) => template.id !== selectedDetailPhotoTemplateId);
      setSelectedDetailPhotoTemplateId(next[0]?.id ?? "");
      return next;
    });
  }

  function savePartyTemplate(): void {
    if (!canEdit) {
      return;
    }
    const item: SimpleTemplate<Project["relatedParties"]> = {
      id: uid("tpl_party"),
      name: autoPartyTemplateName(),
      createdAt: new Date().toISOString(),
      payload: cloneRelatedParties(selectedProject.relatedParties),
    };
    setPartyTemplates((prev) => [item, ...prev]);
    setSelectedPartyTemplateId(item.id);
  }

  function applyPartyTemplate(): void {
    if (!selectedPartyTemplate) {
      return;
    }
    updateSelectedProject(
      (project) => ({ ...project, relatedParties: cloneRelatedParties(selectedPartyTemplate.payload) }),
      { action: "template_apply", detail: `PDF6体制表テンプレート適用: ${selectedPartyTemplate.name}`, snapshotLabel: "テンプレート適用前バックアップ" },
    );
  }

  function deletePartyTemplate(): void {
    if (!canEdit) {
      return;
    }
    if (!selectedPartyTemplateId) {
      return;
    }
    setPartyTemplates((prev) => {
      const next = prev.filter((template) => template.id !== selectedPartyTemplateId);
      setSelectedPartyTemplateId(next[0]?.id ?? "");
      return next;
    });
  }

  function saveLayoutTemplate(): void {
    if (!canEdit) {
      return;
    }
    const item: SimpleTemplate<LayoutTemplatePayload> = {
      id: uid("tpl_layout"),
      name: autoLayoutTemplateName(),
      createdAt: new Date().toISOString(),
      payload: {
        layoutImageDataUrl: selectedProject.layoutImageDataUrl,
        layoutPhotos: clonePhotoSlots(selectedProject.layoutPhotos),
        layoutAnnotations: cloneLayoutAnnotations(selectedProject.layoutAnnotations),
        layoutAnnotationsV2: cloneLayoutAnnotationsV2(selectedProject.layoutAnnotationsV2),
      },
    };
    setLayoutTemplates((prev) => [item, ...prev]);
    setSelectedLayoutTemplateId(item.id);
  }

  function applyLayoutTemplate(): void {
    if (!selectedLayoutTemplate) {
      return;
    }
    const normalizedLegacy = normalizeLayoutAnnotations(selectedLayoutTemplate.payload.layoutAnnotations || []);
    const parsedV2 = normalizeLayoutAnnotationsV2(selectedLayoutTemplate.payload.layoutAnnotationsV2 || []);
    const nextV2 = parsedV2.length ? parsedV2 : legacyLayoutAnnotationsToV2(normalizedLegacy);
    const nextLegacy = parsedV2.length ? layoutAnnotationsV2ToLegacy(nextV2) : normalizedLegacy;
    updateSelectedProject((project) => ({
      ...project,
      layoutImageDataUrl: selectedLayoutTemplate.payload.layoutImageDataUrl,
      layoutPhotos: clonePhotoSlots(selectedLayoutTemplate.payload.layoutPhotos),
      layoutAnnotationsV2: nextV2,
      layoutAnnotations: nextLegacy,
    }), {
      action: "template_apply",
      detail: `PDF7配置図テンプレート適用: ${selectedLayoutTemplate.name}`,
      snapshotLabel: "テンプレート適用前バックアップ",
    });
  }

  function deleteLayoutTemplate(): void {
    if (!canEdit) {
      return;
    }
    if (!selectedLayoutTemplateId) {
      return;
    }
    setLayoutTemplates((prev) => {
      const next = prev.filter((template) => template.id !== selectedLayoutTemplateId);
      setSelectedLayoutTemplateId(next[0]?.id ?? "");
      return next;
    });
  }

  function setTemplateIdForScope(scope: TemplateScope, id: string): void {
    if (scope === "schedule") {
      setSelectedScheduleTemplateId(id);
      return;
    }
    if (scope === "detailPhotos") {
      setSelectedDetailPhotoTemplateId(id);
      return;
    }
    if (scope === "relatedParties") {
      setSelectedPartyTemplateId(id);
      return;
    }
    setSelectedLayoutTemplateId(id);
  }

  function applyActiveTemplate(): void {
    if (templateScope === "schedule") {
      applyScheduleTemplate();
      return;
    }
    if (templateScope === "detailPhotos") {
      applyDetailPhotoTemplate();
      return;
    }
    if (templateScope === "relatedParties") {
      applyPartyTemplate();
      return;
    }
    applyLayoutTemplate();
  }

  function saveActiveTemplate(): void {
    if (templateScope === "schedule") {
      saveScheduleTemplate();
      return;
    }
    if (templateScope === "detailPhotos") {
      saveDetailPhotoTemplate();
      return;
    }
    if (templateScope === "relatedParties") {
      savePartyTemplate();
      return;
    }
    saveLayoutTemplate();
  }

  function deleteActiveTemplate(): void {
    if (templateScope === "schedule") {
      deleteScheduleTemplate();
      return;
    }
    if (templateScope === "detailPhotos") {
      deleteDetailPhotoTemplate();
      return;
    }
    if (templateScope === "relatedParties") {
      deletePartyTemplate();
      return;
    }
    deleteLayoutTemplate();
  }

  const detailPhotosFilled = useMemo(() => detailPhotos.filter((photo) => !!photo.dataUrl), [detailPhotos]);
  const layoutPhotosFilled = useMemo(() => layoutPhotos.filter((photo) => !!photo.dataUrl), [layoutPhotos]);
  const detailPhotoChunks: PhotoSlot[][] = useMemo(
    () => Array.from({ length: Math.ceil(detailPhotosFilled.length / 4) }, (_, i) => detailPhotosFilled.slice(i * 4, i * 4 + 4)),
    [detailPhotosFilled],
  );
  const layoutPhotoChunks: PhotoSlot[][] = useMemo(
    () => Array.from({ length: Math.ceil(layoutPhotosFilled.length / 4) }, (_, i) => layoutPhotosFilled.slice(i * 4, i * 4 + 4)),
    [layoutPhotosFilled],
  );
  const cardStatus = useMemo(() => {
    const pdf1Missing: string[] = [];
    if (!selectedProject.propertyName.trim()) pdf1Missing.push("物件名");
    if (!selectedProject.titleSubject.trim()) pdf1Missing.push("件名");
    if (!selectedProject.coverRecipientSuffix.trim()) pdf1Missing.push("表紙宛名");

    const pdf3Missing: string[] = [];
    if (!selectedProject.propertyAddress.trim()) pdf3Missing.push("住所");
    if (!selectedProject.workDateStart) pdf3Missing.push("工事開始日");
    if (!selectedProject.workDateEnd) pdf3Missing.push("工事終了日");
    if (!selectedProject.outageDateStart) pdf3Missing.push("停電開始日");
    if (!selectedProject.outageDateEnd) pdf3Missing.push("停電終了日");
    if (!selectedProject.outageTimeStart) pdf3Missing.push("停電開始時間");
    if (!selectedProject.outageTimeEnd) pdf3Missing.push("停電終了時間");
    if (!selectedProject.scheduleRows.length) pdf3Missing.push("工程表行");

    const pdf4Missing: string[] = [];
    if (!detailPhotosFilled.length) pdf4Missing.push("参考写真（1枚以上）");

    const pdf6Missing: string[] = [];
    const enabledParties = Object.values(selectedProject.relatedParties).filter((party) => party.enabled);
    if (!enabledParties.length) {
      pdf6Missing.push("反映先会社");
    } else if (enabledParties.some((party) => !party.company.trim())) {
      pdf6Missing.push("会社名");
    }

    const pdf7Missing: string[] = [];
    if (!selectedProject.layoutImageDataUrl && !layoutPhotosFilled.length) {
      pdf7Missing.push("配置図または写真");
    }

    return {
      pdf1: { done: pdf1Missing.length === 0, missing: pdf1Missing },
      pdf2: { done: true, missing: [] as string[] },
      pdf3: { done: pdf3Missing.length === 0, missing: pdf3Missing },
      pdf4: { done: pdf4Missing.length === 0, missing: pdf4Missing },
      pdf5: { done: true, missing: [] as string[] },
      pdf6: { done: pdf6Missing.length === 0, missing: pdf6Missing },
      pdf7: { done: pdf7Missing.length === 0, missing: pdf7Missing },
    };
  }, [selectedProject, detailPhotosFilled.length, layoutPhotosFilled.length]);
  const cardOrder: Array<keyof typeof cardStatus> = ["pdf1", "pdf2", "pdf3", "pdf4", "pdf5", "pdf6", "pdf7"];
  const incompleteCards = cardOrder.filter((key) => !cardStatus[key].done);
  const completionRate = Math.round(((cardOrder.length - incompleteCards.length) / cardOrder.length) * 100);
  const enabledPartyKeys = useMemo(
    () => partyEntries.filter((key) => selectedProject.relatedParties[key].enabled),
    [partyEntries, selectedProject.relatedParties],
  );
  const missingEnabledPartyCompanyKeys = useMemo(
    () => enabledPartyKeys.filter((key) => !selectedProject.relatedParties[key].company.trim()),
    [enabledPartyKeys, selectedProject.relatedParties],
  );
  const requiredMissingMap = useMemo(
    () => ({
      propertyName: !selectedProject.propertyName.trim(),
      coverRecipientSuffix: !selectedProject.coverRecipientSuffix.trim(),
      titleSubject: !selectedProject.titleSubject.trim(),
      propertyAddress: !selectedProject.propertyAddress.trim(),
      workDateStart: !selectedProject.workDateStart,
      workDateEnd: !selectedProject.workDateEnd,
      outageDateStart: !selectedProject.outageDateStart,
      outageDateEnd: !selectedProject.outageDateEnd,
      outageTimeStart: !selectedProject.outageTimeStart,
      outageTimeEnd: !selectedProject.outageTimeEnd,
      scheduleRows: selectedProject.scheduleRows.length === 0,
      detailPhotos: detailPhotosFilled.length === 0,
      relatedPartiesEnabled: enabledPartyKeys.length === 0,
      relatedPartyCompany: missingEnabledPartyCompanyKeys.length > 0,
      layoutAssets: !selectedProject.layoutImageDataUrl && layoutPhotosFilled.length === 0,
    }),
    [
      selectedProject.propertyName,
      selectedProject.coverRecipientSuffix,
      selectedProject.titleSubject,
      selectedProject.propertyAddress,
      selectedProject.workDateStart,
      selectedProject.workDateEnd,
      selectedProject.outageDateStart,
      selectedProject.outageDateEnd,
      selectedProject.outageTimeStart,
      selectedProject.outageTimeEnd,
      selectedProject.scheduleRows.length,
      selectedProject.layoutImageDataUrl,
      detailPhotosFilled.length,
      layoutPhotosFilled.length,
      enabledPartyKeys.length,
      missingEnabledPartyCompanyKeys.length,
    ],
  );
  const requiredMissingKeys = useMemo(() => {
    const keys: string[] = [];
    if (requiredMissingMap.propertyName) keys.push("propertyName");
    if (requiredMissingMap.coverRecipientSuffix) keys.push("coverRecipientSuffix");
    if (requiredMissingMap.titleSubject) keys.push("titleSubject");
    if (requiredMissingMap.propertyAddress) keys.push("propertyAddress");
    if (requiredMissingMap.workDateStart) keys.push("workDateStart");
    if (requiredMissingMap.workDateEnd) keys.push("workDateEnd");
    if (requiredMissingMap.outageDateStart) keys.push("outageDateStart");
    if (requiredMissingMap.outageDateEnd) keys.push("outageDateEnd");
    if (requiredMissingMap.outageTimeStart) keys.push("outageTimeStart");
    if (requiredMissingMap.outageTimeEnd) keys.push("outageTimeEnd");
    if (requiredMissingMap.scheduleRows) keys.push("scheduleRows");
    if (requiredMissingMap.detailPhotos) keys.push("detailPhotos");
    if (requiredMissingMap.relatedPartiesEnabled) keys.push("relatedPartiesEnabled");
    missingEnabledPartyCompanyKeys.forEach((key) => keys.push(`relatedPartyCompany:${key}`));
    if (requiredMissingMap.layoutAssets) keys.push("layoutAssets");
    return keys;
  }, [requiredMissingMap, missingEnabledPartyCompanyKeys]);
  const totalMissingRequiredCount = requiredMissingKeys.length;
  const canExportPdf = totalMissingRequiredCount === 0;
  function scrollToMissingField(targetKey?: string): void {
    const key = targetKey || requiredMissingKeys[0];
    if (!key) {
      return;
    }
    const target = document.querySelector(`[data-required-key="${key}"]`) as HTMLElement | null;
    if (!target) {
      return;
    }
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.add("required-scroll-highlight");
    window.setTimeout(() => target.classList.remove("required-scroll-highlight"), 1200);
    const focusTarget = target.matches("input, select, textarea")
      ? target
      : (target.querySelector("input, select, textarea, button") as HTMLElement | null);
    focusTarget?.focus();
  }

  function selectProjectFromSearch(projectId: string): void {
    setSelectedId(projectId);
    setProjectSearchText("");
    setProjectPickerOpen(false);
  }

  function handleProjectSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Escape") {
      setProjectSearchText("");
      setProjectPickerOpen(false);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const first = filteredProjectOptions[0];
      if (first) {
        selectProjectFromSearch(first.projectId);
      }
    }
  }

  useEffect(() => {
    if (canExportPdf && requiredHint) {
      setRequiredHint("");
    }
  }, [canExportPdf, requiredHint]);
  const isEditorMode = mode === "editor";
  const isCsvMode = mode === "csv";
  const isTrackingMode = mode === "tracking";
  const showEditorAssist = false;

  useEffect(() => {
    if (!projectPickerOpen) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!projectPickerRef.current) {
        return;
      }
      if (!projectPickerRef.current.contains(event.target as Node)) {
        setProjectPickerOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [projectPickerOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }
    setProjectPickerOpen(false);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [mode, selectedId]);

  return (
    <>
      <main className={`planner-app ${isCsvMode ? "planner-app-csv" : ""} ui-preset-${uiPreset}`}>
        <header className={`top-bar ${isTrackingMode ? "top-bar-tracking" : "top-bar-work"} ${isCsvMode ? "top-bar-csv" : ""}`} aria-label="Top">
          <div className="top-logo-slot">
            <img
              className="top-brand-logo"
              src={HEADER_LOGO_SRC}
              alt="REZIL"
              onError={(event) => {
                event.currentTarget.src = PDF_LOGO_FALLBACK_SRC;
              }}
            />
          </div>
          <div className="top-heading-slot">
            <p className="top-kicker">現場・スマホで編集できる</p>
            <h1>施工計画書自動発行ツール</h1>
          </div>
          {!isTrackingMode && !isCsvMode ? (
            <div className="top-search-slot">
              <div className="project-picker" ref={projectPickerRef}>
                <input
                  className="control top-select top-select-search"
                  value={projectSearchText}
                  placeholder="案件ID・物件名で検索"
                  onFocus={() => setProjectPickerOpen(true)}
                  onClick={() => setProjectPickerOpen(true)}
                  onChange={(event) => {
                    setProjectSearchText(event.target.value);
                    setProjectPickerOpen(true);
                  }}
                  onKeyDown={handleProjectSearchKeyDown}
                />
                {projectPickerOpen ? (
                  <div className="project-picker-menu">
                    <p className="project-picker-current">
                      <span className="project-picker-current-label">選択中</span>
                      <span className="project-picker-current-name">{hasSelectedProject ? (selectedProject.propertyName || "（物件名未設定）") : "未選択"}</span>
                      <span className="project-picker-current-id">{hasSelectedProject ? `案件ID: ${selectedProject.projectId}` : "検索または入力開始で新規案件を作成できます"}</span>
                    </p>
                    {filteredProjectOptions.length ? (
                      filteredProjectOptions.map((project) => (
                        <button
                          key={`project_picker_${project.projectId}`}
                          type="button"
                          className={`project-picker-item ${project.projectId === selectedProject.projectId ? "is-active" : ""}`}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selectProjectFromSearch(project.projectId)}
                        >
                          <span className="project-picker-item-name">{project.propertyName || "（物件名未設定）"}</span>
                          <small className="project-picker-item-id">案件ID: {project.projectId}</small>
                        </button>
                      ))
                    ) : (
                      <p className="project-picker-empty">該当する案件がありません</p>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
          {!isTrackingMode && !isCsvMode ? (
            <button type="button" className="btn top-btn top-btn-create top-btn-inline top-action-btn" onClick={createProject} disabled={!canEdit}>
              <span className="btn-icon"><UiIcon name="plus" /></span>
              新規案件
            </button>
          ) : null}
          {!isTrackingMode && !isCsvMode ? (
              <button
                type="button"
                className="btn top-btn top-btn-delete top-btn-inline top-action-btn"
                onClick={deleteSelectedProject}
                disabled={!canEdit || !hasSelectedProject || projects.length <= 1}
              >
              <span className="btn-icon"><UiIcon name="delete" /></span>
              案件削除
            </button>
          ) : null}
          <button type="button" className="btn top-logout-btn top-action-btn" onClick={logout}>
            <span className="btn-icon"><UiIcon name="logout" /></span>
            ログアウト
          </button>
          <button
            type="button"
            className="btn top-menu-toggle"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-global-menu"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
          >
            <span className="btn-icon"><UiIcon name="menu" /></span>
            メニュー
          </button>
        </header>

        <nav className="workspace-switch" aria-label="Workspace navigation">
          <Link href="/editor" className={`workspace-link ${isEditorMode ? "active" : ""}`}>施工計画書編集</Link>
          <Link href="/csv" className={`workspace-link ${isCsvMode ? "active" : ""}`}>CSV編集スペース</Link>
          <Link href="/tracking" className={`workspace-link ${isTrackingMode ? "active" : ""}`}>ログイン管理</Link>
          <Link href="/menu" className="workspace-link subtle">メニューへ戻る</Link>
        </nav>

        <div className="ui-custom-bar" role="region" aria-label="表示カスタム">
          <span className="ui-custom-label"><span className="btn-icon"><UiIcon name="settings" /></span>表示カスタム</span>
          <div className="ui-preset-segment" role="group" aria-label="表示モード">
            {UI_PRESET_OPTIONS.map((option) => (
              <button
                key={`ui_preset_${option.value}`}
                type="button"
                className={`ui-preset-btn ${uiPreset === option.value ? "is-active" : ""}`}
                onClick={() => setUiPreset(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div
          className={`mobile-drawer-backdrop ${mobileMenuOpen ? "is-open" : ""}`}
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden={!mobileMenuOpen}
        />
        <aside id="mobile-global-menu" className={`mobile-drawer ${mobileMenuOpen ? "is-open" : ""}`} aria-hidden={!mobileMenuOpen}>
          <div className="mobile-drawer-head">
            <h3>操作メニュー</h3>
            <button type="button" className="btn btn-subtle mobile-drawer-close" onClick={() => setMobileMenuOpen(false)}>
              <span className="btn-icon"><UiIcon name="clear" /></span>
              閉じる
            </button>
          </div>
          <div className="mobile-drawer-section">
            {!isTrackingMode && !isCsvMode ? (
              <>
                <button
                  type="button"
                  className="btn top-btn top-btn-create"
                  onClick={() => {
                    createProject();
                    setMobileMenuOpen(false);
                  }}
                  disabled={!canEdit}
                >
                  <span className="btn-icon"><UiIcon name="plus" /></span>
                  新規案件
                </button>
                <button
                  type="button"
                  className="btn top-btn top-btn-delete"
                  onClick={() => {
                    deleteSelectedProject();
                    setMobileMenuOpen(false);
                  }}
                  disabled={!canEdit || !hasSelectedProject || projects.length <= 1}
                >
                  <span className="btn-icon"><UiIcon name="delete" /></span>
                  案件削除
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="btn top-logout-btn"
              onClick={() => {
                setMobileMenuOpen(false);
                logout();
              }}
            >
              <span className="btn-icon"><UiIcon name="logout" /></span>
              ログアウト
            </button>
          </div>
          <div className="mobile-drawer-section mobile-drawer-nav">
            <Link href="/editor" className={`workspace-link ${isEditorMode ? "active" : ""}`} onClick={() => setMobileMenuOpen(false)}>施工計画書編集</Link>
            <Link href="/csv" className={`workspace-link ${isCsvMode ? "active" : ""}`} onClick={() => setMobileMenuOpen(false)}>CSV編集スペース</Link>
            <Link href="/tracking" className={`workspace-link ${isTrackingMode ? "active" : ""}`} onClick={() => setMobileMenuOpen(false)}>ログイン管理</Link>
            <Link href="/menu" className="workspace-link subtle mobile-menu-back-link" onClick={() => setMobileMenuOpen(false)}>メニューへ戻る</Link>
          </div>
          <div className="mobile-drawer-section">
            <p className="mobile-drawer-section-title"><span className="btn-icon"><UiIcon name="settings" /></span>表示カスタム</p>
            <div className="ui-preset-segment mobile">
              {UI_PRESET_OPTIONS.map((option) => (
                <button
                  key={`ui_preset_mobile_${option.value}`}
                  type="button"
                  className={`ui-preset-btn ${uiPreset === option.value ? "is-active" : ""}`}
                  onClick={() => setUiPreset(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {isCsvMode ? <p className="import-status">{importStatus}</p> : null}

        {isCsvMode ? (
        <section className="panel csv-editor-panel">
          <div className="panel-head">
            <h3 className="section-title"><span className="section-icon"><UiIcon name="template" /></span>CSV編集スペース</h3>
            <p className="mini">取込後にこの画面で修正し、案件データへ再反映できます</p>
          </div>
          <details className="csv-mapping-guide">
            <summary>CSVカラム対応表（ここだけ埋めれば、ほぼ自動でPDF化）</summary>
            <div className="csv-mapping-body">
              <p className="mini">必須: <code>project_id（または 案件ID）</code></p>
              <p className="mini">推奨: <code>案件名 / 物件名</code>、<code>件名</code>、<code>工事開始日・工事終了日</code>、<code>停電開始日・停電終了日・停電開始時間・停電終了時間</code>、工事項目フラグ</p>
              <div className="table-wrap">
                <table className="schedule-table csv-mapping-table">
                  <thead>
                    <tr>
                      <th>反映先</th>
                      <th>CSVカラム（どれか1つで可）</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>案件ID</td><td><code>project_id</code>, <code>案件ID</code></td></tr>
                    <tr><td>物件名</td><td><code>property_name</code>, <code>物件名</code>, <code>案件名</code>, <code>建物名</code></td></tr>
                    <tr><td>住所</td><td><code>property_address</code>, <code>住所</code>, <code>所在地</code>, <code>工事場所</code></td></tr>
                    <tr><td>件名</td><td><code>title_subject</code>, <code>件名</code>, <code>工事件名</code>, <code>工事名</code></td></tr>
                    <tr><td>工事期間</td><td><code>work_date_start</code>, <code>work_date_end</code>, <code>工事開始日</code>, <code>工事終了日</code></td></tr>
                    <tr><td>停電期間</td><td><code>outage_date_start</code>, <code>outage_date_end</code>, <code>停電開始日</code>, <code>停電終了日</code></td></tr>
                    <tr><td>停電時間</td><td><code>outage_time_start</code>, <code>outage_time_end</code>, <code>停電開始時間</code>, <code>停電終了時間</code></td></tr>
                    <tr><td>停電バー表示</td><td><code>outage_enabled</code>, <code>停電あり</code>, <code>停電有無</code>（例: 1/0, true/false, 有/無）</td></tr>
                    <tr><td>工事項目</td><td><code>flag_kouatsu_cable</code>, <code>flag_ugs</code>, <code>flag_pas</code>, <code>flag_ground_a</code>, <code>flag_ground_b</code>, <code>flag_ground_c</code> または <code>工事項目</code>（カンマ区切り）</td></tr>
                    <tr><td>特記事項・承認事項</td><td><code>note_special</code>, <code>note_approval_extra</code></td></tr>
                    <tr><td>PDF連絡先</td><td><code>pdf_company_name</code>, <code>pdf_team</code>, <code>pdf_contact_person</code>, <code>pdf_address</code>, <code>pdf_email</code>, <code>pdf_tel</code>, <code>pdf_fax</code></td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </details>
          <div className="csv-editor-toolbar">
            <div className="inline-row wrap">
              <label className="btn btn-subtle file-btn">
                <span className="btn-icon"><UiIcon name="upload" /></span>
                CSV取込
                <input type="file" accept=".csv,text/csv" onChange={handleCsvImport} disabled={!canEdit} />
              </label>
              <button type="button" className="btn btn-accent" onClick={() => applyCsvRowsToProjects(csvDraftRows, "editor")} disabled={!canEdit || !csvDraftRows.length}>
                <span className="btn-icon"><UiIcon name="apply" /></span>この編集内容を案件に反映
              </button>
              <button type="button" className="btn btn-subtle" onClick={exportCsvEditor} disabled={!csvDraftRows.length}>
                <span className="btn-icon"><UiIcon name="save" /></span>CSVファイルを保存（ダウンロード）
              </button>
              <button type="button" className="btn btn-subtle" onClick={addCsvRow} disabled={!canEdit || !csvHeaders.length}>
                <span className="btn-icon"><UiIcon name="plus" /></span>行追加
              </button>
              <button type="button" className="btn btn-danger" onClick={deleteSelectedCsvRows} disabled={!canEdit || !csvSelectedRows.length}>
                <span className="btn-icon"><UiIcon name="delete" /></span>選択削除
              </button>
              <button type="button" className="btn btn-danger" onClick={deleteAllCsvRows} disabled={!canEdit || !csvDraftRows.length}>
                <span className="btn-icon"><UiIcon name="clear" /></span>一括削除
              </button>
            </div>
            <div className="inline-row wrap">
              <label className="field csv-small-field">
                <span>検索</span>
                <input className="control" value={csvSearch} onChange={(event) => setCsvSearch(event.target.value)} placeholder="案件ID・物件名など" />
              </label>
              <label className="field csv-small-field">
                <span>表示件数</span>
                <select className="control" value={csvPageSize} onChange={(event) => setCsvPageSize(Number(event.target.value))}>
                  {CSV_PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={`csv_size_${size}`} value={size}>{size}件</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="csv-editor-toolbar">
            <div className="inline-row wrap csv-column-add-row">
              <label className="field csv-small-field">
                <span>列追加（任意）</span>
                <input className="control" value={newCsvColumn} onChange={(event) => setNewCsvColumn(event.target.value)} placeholder="new_column" />
              </label>
              <button type="button" className="btn btn-subtle" onClick={addCsvColumn} disabled={!canEdit || !newCsvColumn.trim()}>
                <span className="btn-icon"><UiIcon name="plus" /></span>列追加
              </button>
              <label className="field csv-small-field">
                <span>列削除（任意）</span>
                <select
                  className="control"
                  value={csvDeleteHeader}
                  onChange={(event) => {
                    setCsvDeleteHeader(event.target.value);
                    setCsvBulkNotice(null);
                  }}
                  disabled={!canEdit || !csvHeaders.length}
                >
                  {!csvHeaders.length ? <option value="">削除できる列がありません</option> : null}
                  {csvHeaders.map((header) => (
                    <option key={`delete_col_${header}`} value={header}>
                      {getCsvHeaderLabel(header)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="btn btn-danger"
                onClick={deleteCsvColumn}
                disabled={!canEdit || !csvHeaders.length || !csvDeleteHeader}
              >
                <span className="btn-icon"><UiIcon name="delete" /></span>列削除
              </button>
            </div>
            <div className="inline-row wrap csv-bulk-edit-row">
              <label className="field csv-small-field">
                <span>選択編集（列）</span>
                <select
                  className="control"
                  value={csvBulkHeader}
                  onChange={(event) => {
                    setCsvBulkHeader(event.target.value);
                    setCsvBulkNotice(null);
                  }}
                  disabled={!canEdit || !csvHeaders.length}
                >
                  {csvHeaders.map((header) => (
                    <option key={`bulk_col_${header}`} value={header}>
                      {getCsvHeaderLabel(header)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field csv-small-field">
                <span>一括入力する値</span>
                <input
                  className="control"
                  value={csvBulkValue}
                  onChange={(event) => {
                    setCsvBulkValue(event.target.value);
                    setCsvBulkNotice(null);
                  }}
                  placeholder="選択行に入力する値"
                  disabled={!canEdit}
                />
              </label>
              <div className="field csv-bulk-action-field">
                <span className="csv-bulk-action-label">実行</span>
                <button
                  type="button"
                  className="btn btn-subtle csv-bulk-action-btn"
                  onClick={applyBulkCsvEdit}
                  disabled={!canEdit || !csvSelectedRows.length || !csvHeaders.length}
                >
                  <span className="btn-icon"><UiIcon name="apply" /></span>選択行へ一括反映
                </button>
              </div>
            </div>
            {csvBulkNotice ? <p className={`mini ${csvBulkNotice.type === "error" ? "error-text" : "ok-text"}`}>{csvBulkNotice.text}</p> : null}
            <p className="mini">行: {csvDraftRows.length} / 列: {csvHeaders.length} / 選択: {csvSelectedRows.length}</p>
          </div>

          {!csvHeaders.length ? (
            <p className="mini">CSVを取り込むと、ここで編集できるようになります。</p>
          ) : (
            <>
              <div className="table-wrap csv-editor-wrap">
                <table className="schedule-table csv-editor-table">
                  <thead>
                    <tr>
                      <th style={{ width: 56 }}>
                        <input
                          type="checkbox"
                          aria-label="表示中の行を全選択"
                          checked={csvAllVisibleSelected}
                          onChange={(event) => toggleCsvVisibleSelection(event.target.checked)}
                          disabled={!canEdit || !csvVisibleRows.length}
                        />
                      </th>
                      {csvHeaders.map((header) => (
                        <th key={`csv_header_${header}`} style={csvColumnWidthMap[header]}>
                          {getCsvHeaderLabel(header)}
                        </th>
                      ))}
                      <th className="csv-op-col">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvVisibleRows.length ? (
                      csvVisibleRows.map(({ row, index }) => (
                        <tr key={`csv_row_${index}`}>
                          <td>
                            <input
                              type="checkbox"
                              aria-label={`${index + 1}行目を選択`}
                              checked={csvSelectedSet.has(index)}
                              onChange={() => toggleCsvRowSelection(index)}
                              disabled={!canEdit}
                            />
                          </td>
                          {csvHeaders.map((header) => (
                            <td key={`csv_cell_${index}_${header}`} style={csvColumnWidthMap[header]}>
                              <input
                                className="control csv-cell-input"
                                value={row[header] ?? ""}
                                onChange={(event) => updateCsvCell(index, header, event.target.value)}
                                disabled={!canEdit}
                              />
                            </td>
                          ))}
                          <td className="csv-op-cell">
                            <button type="button" className="btn btn-danger csv-row-delete-btn" onClick={() => deleteCsvRow(index)} disabled={!canEdit}>
                              <span className="btn-icon"><UiIcon name="delete" /></span>削除
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={csvHeaders.length + 2}>該当データがありません</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="csv-pagination">
                <button type="button" className="btn btn-subtle" onClick={() => setCsvPage((prev) => Math.max(0, prev - 1))} disabled={csvPage <= 0}>
                  <span className="btn-icon"><UiIcon name="arrowLeft" /></span>前へ
                </button>
                <span className="mini">{csvPage + 1} / {csvTotalPages}</span>
                <button type="button" className="btn btn-subtle" onClick={() => setCsvPage((prev) => Math.min(csvTotalPages - 1, prev + 1))} disabled={csvPage >= csvTotalPages - 1}>
                  <span className="btn-icon"><UiIcon name="arrowRight" /></span>次へ
                </button>
              </div>
            </>
          )}
        </section>
        ) : null}

        {isTrackingMode ? (
        <section className="panel security-panel">
          <div className="panel-head">
            <h3 className="section-title"><span className="section-icon"><UiIcon name="login" /></span>ログイン管理</h3>
            {currentUser ? <p className="status-chip ok">ログイン中: {currentUser.name} / {ROLE_LABELS[currentUser.role]}</p> : <p className="status-chip warn">未ログイン</p>}
          </div>
          {!currentUser ? (
            <div className="field-grid">
              <label className="field">
                <span>メールアドレス</span>
                <input className="control" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} placeholder="name@example.com" />
              </label>
              <label className="field">
                <span>パスワード</span>
                <input className="control" type="password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} placeholder="********" />
              </label>
              <div className="inline-row wrap">
                <button type="button" className="btn btn-accent" onClick={login}><span className="btn-icon"><UiIcon name="login" /></span>ログイン</button>
                <p className="mini">初期登録済みのメールアドレスでログインしてください</p>
              </div>
              {loginError ? <p className="mini error-text">{loginError}</p> : null}
            </div>
          ) : (
            <div className="inline-row wrap">
              <p className="mini">ログアウトは画面上部のボタンから実行できます。</p>
              {!canEdit ? <p className="mini">閲覧専用ユーザーです（編集不可）</p> : null}
            </div>
          )}
          {canAdmin ? <p className="mini">管理者/システム管理者はこの画面で、ユーザー管理・バックアップ保存・復元・操作履歴確認ができます。</p> : null}

          {canAdmin ? (
            <section className="sub-panel user-admin-panel">
              <h4 className="user-admin-title"><span className="section-icon"><UiIcon name="userPlus" /></span>管理者向け: ユーザー追加</h4>
              <h4>利用ユーザー登録一覧</h4>
              <p className="mini">登録ユーザーを一覧管理できます（承認・権限変更・有効/無効の切替）。承認操作は管理者/システム管理者のみ可能です。</p>
              <div className="user-stats-grid" aria-label="ユーザー集計">
                <article className="user-stat-card">
                  <p className="user-stat-label">総ユーザー</p>
                  <p className="user-stat-value">{userStats.total}名</p>
                </article>
                <article className="user-stat-card">
                  <p className="user-stat-label">有効</p>
                  <p className="user-stat-value">{userStats.activeUsers}名</p>
                </article>
                <article className="user-stat-card">
                  <p className="user-stat-label">承認済み</p>
                  <p className="user-stat-value">{userStats.approvedUsers}名</p>
                </article>
                <article className="user-stat-card">
                  <p className="user-stat-label">承認待ち</p>
                  <p className="user-stat-value">{userStats.pendingUsers}名</p>
                </article>
                <article className="user-stat-card">
                  <p className="user-stat-label">管理者</p>
                  <p className="user-stat-value">{userStats.admins}名</p>
                  <p className="user-stat-meta">有効承認済み {userStats.activeAdmins}名</p>
                </article>
              </div>
              <div className="field-grid">
                <label className="field"><span>名前</span><input className="control" value={newUserName} placeholder="例: 山田 太郎" onChange={(event) => setNewUserName(event.target.value)} /></label>
                <label className="field"><span>メール</span><input className="control" value={newUserEmail} placeholder="例: name@gmail.com" onChange={(event) => setNewUserEmail(event.target.value)} /></label>
                <label className="field"><span>パスワード</span><input className="control" type="password" value={newUserPassword} placeholder="8文字以上推奨" onChange={(event) => setNewUserPassword(event.target.value)} /></label>
                <label className="field">
                  <span>権限</span>
                  <select className="control" value={newUserRole} onChange={(event) => setNewUserRole(event.target.value as UserRole)}>
                    {currentUser?.role === "system_admin" ? <option value="system_admin">システム管理者</option> : null}
                    <option value="admin">管理者</option>
                    <option value="editor">編集者</option>
                    <option value="viewer">閲覧者</option>
                  </select>
                </label>
                <div className="inline-row wrap user-add-row">
                  <button type="button" className="btn btn-accent" onClick={() => createUser()}><span className="btn-icon"><UiIcon name="userPlus" /></span>ユーザー追加</button>
                </div>
                {userCreateNotice ? <p className={`mini ${userCreateNotice.type === "error" ? "error-text" : "ok-text"}`}>{userCreateNotice.text}</p> : null}
                {userManageNotice ? <p className={`mini ${userManageNotice.type === "error" ? "error-text" : "ok-text"}`}>{userManageNotice.text}</p> : null}
              </div>
              <h4 className="user-admin-heading">登録済みユーザー</h4>
              <p className="mini user-admin-table-help">承認区分: 管理者の審査状態 / 利用状態: ログイン可否（有効・無効）</p>
              <div className="table-wrap user-table-wrap">
                <table className="schedule-table user-table">
                  <thead>
                    <tr><th>名前</th><th>メール</th><th>承認区分</th><th>権限</th><th>利用状態</th><th>承認者</th><th>登録日時</th><th>最終ログイン</th><th className="user-op-col">操作</th></tr>
                  </thead>
                  <tbody>
                    {(userListExpanded ? users : users.slice(0, USER_LIST_VISIBLE_COUNT)).map((user) => (
                      <tr key={`user_table_${user.id}`}>
                        <td>{user.name}</td>
                        <td>{user.email}</td>
                        <td>
                          <select
                            className="control"
                            value={user.approvalStatus}
                            onChange={(event) => updateUserApprovalStatusByAdmin(user.id, event.target.value as UserApprovalStatus)}
                            disabled={user.role === "system_admin"}
                          >
                            <option value="pending">承認待ち</option>
                            <option value="approved">承認済み</option>
                            <option value="rejected">利用不可</option>
                          </select>
                        </td>
                        <td>
                          <select
                            className="control"
                            value={user.role}
                            onChange={(event) => updateUserRoleByAdmin(user.id, event.target.value as UserRole)}
                            disabled={user.role === "system_admin"}
                          >
                            {(currentUser?.role === "system_admin" || user.role === "system_admin")
                              ? <option value="system_admin">システム管理者</option>
                              : null}
                            <option value="admin">管理者</option>
                            <option value="editor">編集者</option>
                            <option value="viewer">閲覧者</option>
                          </select>
                        </td>
                        <td>{user.active && user.approvalStatus === "approved" ? <span className="status-chip ok">有効</span> : <span className="status-chip warn">無効</span>}</td>
                        <td><span className="user-meta-chip">{formatUserApprovedByLabel(user)}</span></td>
                        <td>{user.createdAt ? new Date(user.createdAt).toLocaleString("ja-JP") : "未記録"}</td>
                        <td>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("ja-JP") : "未ログイン"}</td>
                        <td className="user-op-cell">
                          <div className="user-actions">
                            {user.role === "system_admin" ? (
                              <span className="mini">固定</span>
                            ) : (
                              <button type="button" className="btn btn-danger" onClick={() => deleteUserByAdmin(user.id)}>
                                <span className="btn-icon"><UiIcon name="delete" /></span>削除
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!users.length ? <tr><td colSpan={9}>ユーザーが未登録です</td></tr> : null}
                    {users.length > USER_LIST_VISIBLE_COUNT ? (
                      <tr className="access-log-more-row">
                        <td className="access-log-more-cell" colSpan={9}>
                          <button
                            type="button"
                            className="access-log-more-link"
                            onClick={() => setUserListExpanded((prev) => !prev)}
                          >
                            {userListExpanded ? "登録済みユーザーをたたむ" : "登録済みユーザーをもっと表示する"}
                          </button>
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <h4 className="user-admin-heading">アクセス試行履歴（成功/失敗）</h4>
              <div className="table-wrap">
                <table className="schedule-table access-log-table">
                  <thead>
                    <tr><th>日時</th><th>メール</th><th>判定</th><th>ユーザー名</th><th>経路</th></tr>
                  </thead>
                  <tbody>
                    {(accessLogExpanded ? accessLogs : accessLogs.slice(0, 5)).map((log) => (
                      <tr key={`access_log_${log.id}`}>
                        <td>{new Date(log.at).toLocaleString("ja-JP")}</td>
                        <td>{log.email || "-"}</td>
                        <td>{log.result === "success" ? "成功" : "失敗"}</td>
                        <td>{log.userName || "-"}</td>
                        <td>{log.source === "login_page" ? "ログインページ" : "トラッキング画面"}</td>
                      </tr>
                    ))}
                    {!accessLogs.length ? <tr><td colSpan={5}>アクセス履歴はまだありません</td></tr> : null}
                    {accessLogs.length > 5 ? (
                      <tr className="access-log-more-row">
                        <td className="access-log-more-cell" colSpan={5}>
                          <button
                            type="button"
                            className="access-log-more-link"
                            onClick={() => setAccessLogExpanded((prev) => !prev)}
                          >
                            {accessLogExpanded ? "アクセス履歴をたたむ" : "アクセス履歴をもっと表示する"}
                          </button>
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <h4 className="user-admin-heading">操作履歴（誰が / どこで / 何を）</h4>
              <p className="mini">この欄で「保存」と「復元」を行います。操作履歴は下の表で確認できます。</p>
              <div className="tracking-history-controls">
                <div className="tracking-history-row">
                  <label className="field tracking-revision-select tracking-filter-select">
                    <span>ユーザーで絞り込み</span>
                    <select className="control" value={operationLogUserFilter} onChange={(event) => setOperationLogUserFilter(event.target.value)}>
                      <option value="all">全ユーザー</option>
                      {adminAuditUserOptions.map((option) => (
                        <option key={`operation_log_user_${option.id}`} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="button" className="btn btn-subtle tracking-history-action-btn" onClick={saveManualRevision} disabled={!canEdit}>
                    <span className="btn-icon"><UiIcon name="save" /></span>現在内容を履歴保存
                  </button>
                </div>
                <div className="tracking-history-row">
                  <div className="mini">この端末のlocalStorage全データをJSONでダウンロードします。</div>
                  <button type="button" className="btn btn-subtle tracking-history-action-btn" onClick={exportLocalStorageData}>
                    <span className="btn-icon"><UiIcon name="save" /></span>データをエクスポート
                  </button>
                </div>
                <div className="tracking-history-row">
                  <div className="mini">エクスポート済みJSONを読み込み、localStorageへ上書き保存します。</div>
                  <div>
                    <input
                      ref={importFileInputRef}
                      type="file"
                      accept="application/json,.json"
                      onChange={importLocalStorageData}
                      style={{ display: "none" }}
                    />
                    <button type="button" className="btn btn-subtle tracking-history-action-btn" onClick={openImportFileDialog}>
                      <span className="btn-icon"><UiIcon name="upload" /></span>データをインポート
                    </button>
                  </div>
                </div>
                <div className="tracking-history-row">
                  <label className="field tracking-revision-select">
                    <span>復元する履歴</span>
                    <select className="control" value={selectedRevisionId} onChange={(event) => setSelectedRevisionId(event.target.value)}>
                      <option value="">履歴を選択</option>
                      {projectRevisions.map((revision) => (
                        <option key={revision.id} value={revision.id}>
                          {new Date(revision.at).toLocaleString("ja-JP")} / {revision.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="button" className="btn btn-subtle tracking-history-action-btn" onClick={restoreRevision} disabled={!canEdit || !selectedRevision}>
                    <span className="btn-icon"><UiIcon name="history" /></span>この時点に戻す
                  </button>
                </div>
              </div>
              <div className="table-wrap">
                <table className="schedule-table access-log-table">
                  <thead>
                    <tr><th>日時</th><th>ユーザー</th><th>画面</th><th>案件ID</th><th>操作</th><th>詳細</th></tr>
                  </thead>
                  <tbody>
                    {adminVisibleAuditLogs.map((log) => (
                      <tr key={`admin_audit_${log.id}`}>
                        <td>{new Date(log.at).toLocaleString("ja-JP")}</td>
                        <td>{log.userName || "-"}</td>
                        <td>{formatAuditScreen(log.action)}</td>
                        <td>{log.projectId || "-"}</td>
                        <td>{formatAuditAction(log.action)}</td>
                        <td>{formatAuditDetail(log.detail || "-")}</td>
                      </tr>
                    ))}
                    {!adminVisibleAuditLogs.length ? <tr><td colSpan={6}>操作履歴はまだありません</td></tr> : null}
                    {adminFilteredAuditLogs.length > 5 ? (
                      <tr className="access-log-more-row">
                        <td className="access-log-more-cell" colSpan={6}>
                          <button
                            type="button"
                            className="access-log-more-link"
                            onClick={() => setOperationLogExpanded((prev) => !prev)}
                          >
                            {operationLogExpanded ? "操作履歴をたたむ" : "操作履歴をもっと表示する"}
                          </button>
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </section>
        ) : null}

        {isTrackingMode && !!currentUser && !canAdmin ? (
        <section className="panel history-panel">
          <div className="panel-head">
            <h3 className="section-title"><span className="section-icon"><UiIcon name="history" /></span>履歴管理</h3>
            <p className="mini">編集者/閲覧者向け: 履歴復元と変更ログ確認ができます。</p>
          </div>
          <p className="mini">登録済みユーザー一覧・ユーザー管理情報は管理者のみ確認できます。変更履歴はログイン中ユーザー本人の作業のみ表示します。</p>
          <article className="sub-panel">
            <h4>履歴保存・復元</h4>
            <p className="mini">「履歴を保存」を押すと今の状態を保存し、「この時点に戻す」で復元できます。</p>
            <div className="inline-row wrap">
              <button type="button" className="btn btn-subtle" onClick={saveManualRevision} disabled={!canEdit}><span className="btn-icon"><UiIcon name="save" /></span>現在内容を履歴保存</button>
            </div>
            <label className="field">
              <span>復元する履歴</span>
              <select className="control" value={selectedRevisionId} onChange={(event) => setSelectedRevisionId(event.target.value)}>
                <option value="">履歴を選択</option>
                {projectRevisions.map((revision) => (
                  <option key={revision.id} value={revision.id}>
                    {new Date(revision.at).toLocaleString("ja-JP")} / {revision.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="inline-row wrap">
              <button type="button" className="btn btn-subtle" onClick={restoreRevision} disabled={!canEdit || !selectedRevision}><span className="btn-icon"><UiIcon name="history" /></span>この時点に戻す</button>
            </div>
          </article>
          <article className="sub-panel">
            <h4>変更履歴（監査ログ）</h4>
            <div className="table-wrap">
              <table className="schedule-table">
                <thead>
                  <tr><th>日時</th><th>操作</th><th>詳細</th></tr>
                </thead>
                <tbody>
                  {userScopedProjectAuditLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{new Date(log.at).toLocaleString("ja-JP")}</td>
                      <td>{formatAuditAction(log.action)}</td>
                      <td>{formatAuditDetailForNonAdmin(log)}</td>
                    </tr>
                  ))}
                  {!userScopedProjectAuditLogs.length ? (
                    <tr><td colSpan={3}>履歴はまだありません</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </article>
          <article className="sub-panel">
            <h4>全案件の変更履歴</h4>
            <p className="mini">ログイン中ユーザー本人の全案件履歴を直近30件で表示します。</p>
            <div className="table-wrap">
              <table className="schedule-table">
                <thead>
                  <tr><th>日時</th><th>案件ID</th><th>操作</th><th>詳細</th></tr>
                </thead>
                <tbody>
                  {userScopedGlobalAuditLogs.map((log) => (
                    <tr key={`global_${log.id}`}>
                      <td>{new Date(log.at).toLocaleString("ja-JP")}</td>
                      <td>{log.projectId}</td>
                      <td>{formatAuditAction(log.action)}</td>
                      <td>{formatAuditDetailForNonAdmin(log)}</td>
                    </tr>
                  ))}
                  {!userScopedGlobalAuditLogs.length ? (
                    <tr><td colSpan={4}>履歴はまだありません</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </article>
        </section>
        ) : null}

        {isEditorMode && showEditorAssist ? (
        <section className="panel onboarding-panel">
          <div className="onboarding-head">
            <h2>このツールでできること</h2>
            <p className="mini">現場情報を入力するだけで、PDF1〜7ページの施工計画書を自動作成します。</p>
          </div>
          <div className="onboarding-grid">
            <article className="onboarding-item"><strong>1.</strong> 基本情報・工程表を入力</article>
            <article className="onboarding-item"><strong>2.</strong> 写真・体制表をカードごとに入力</article>
            <article className="onboarding-item"><strong>3.</strong> 完成チェック後にPDF出力</article>
          </div>
        </section>
        ) : null}

        {isEditorMode && showEditorAssist ? (
        <section className="panel progress-panel">
          <div className="panel-head">
            <h3>施工計画書の完成チェック</h3>
            <p className={`status-chip ${incompleteCards.length ? "warn" : "ok"}`}>
              {incompleteCards.length ? `未完了 ${incompleteCards.length}カード` : "出力可能"}
            </p>
          </div>
          <div className="progress-track" aria-label="completion">
            <div className="progress-fill" style={{ width: `${completionRate}%` }} />
          </div>
          <p className="mini">進捗: {completionRate}%</p>
          {incompleteCards.length ? (
            <div className="missing-list">
              {incompleteCards.map((key) => (
                <p key={`missing_${key}`}>
                  {key.toUpperCase()}: {cardStatus[key].missing.join(" / ")}
                </p>
              ))}
            </div>
          ) : null}
        </section>
        ) : null}

        {isEditorMode && showEditorAssist ? (
        <section className="panel card-nav-panel">
          <h3>入力ナビゲーション（どこを埋めればいいか）</h3>
          <div className="card-nav-grid">
            <a href="#card-pdf1" className={`card-nav-item ${cardStatus.pdf1.done ? "done" : "todo"}`}>PDF1 表紙</a>
            <a href="#card-pdf2" className={`card-nav-item ${cardStatus.pdf2.done ? "done" : "todo"}`}>PDF2 目次</a>
            <a href="#card-pdf3" className={`card-nav-item ${cardStatus.pdf3.done ? "done" : "todo"}`}>PDF3 工事概要・工程表</a>
            <a href="#card-pdf4" className={`card-nav-item ${cardStatus.pdf4.done ? "done" : "todo"}`}>PDF4 工事詳細説明</a>
            <a href="#card-pdf5" className={`card-nav-item ${cardStatus.pdf5.done ? "done" : "todo"}`}>PDF5 承認事項</a>
            <a href="#card-pdf6" className={`card-nav-item ${cardStatus.pdf6.done ? "done" : "todo"}`}>PDF6 施工体制・連絡体制</a>
            <a href="#card-pdf7" className={`card-nav-item ${cardStatus.pdf7.done ? "done" : "todo"}`}>PDF7 配置図・写真</a>
          </div>
        </section>
        ) : null}

        {isEditorMode && showEditorAssist ? (
        <section className="panel template-center-panel">
          <div className="panel-head">
            <h3 className="section-title"><span className="section-icon"><UiIcon name="template" /></span>テンプレート管理センター</h3>
            <p className="mini">カードから分離。ここだけで保存・適用・引用を操作できます。</p>
          </div>
          <div className="template-scope-tabs" role="tablist" aria-label="テンプレート対象カード">
            {(Object.keys(TEMPLATE_SCOPE_META) as TemplateScope[]).map((scope) => {
              const meta = TEMPLATE_SCOPE_META[scope];
              const active = templateScope === scope;
              return (
                <button
                  key={`template_scope_${scope}`}
                  type="button"
                  className={`template-scope-tab ${active ? "active" : ""}`}
                  onClick={() => setTemplateScope(scope)}
                  role="tab"
                  aria-selected={active}
                >
                  <span className="chip">{meta.cardLabel}</span>
                  <span>{meta.title}</span>
                </button>
              );
            })}
          </div>
          <p className="mini">{activeTemplateMeta.shortHelp}</p>
          <div className="template-center-grid">
            <article className="sub-panel">
              <h4>保存済みテンプレート</h4>
              <label className="field">
                <span>テンプレート選択</span>
                <p className="field-help">まず一覧から1つ選ぶと、下の「適用」「保存」「削除」ボタンが使えます。</p>
                <select className="control" value={activeTemplateId} onChange={(event) => setTemplateIdForScope(templateScope, event.target.value)}>
                  <option value="">テンプレートを選択</option>
                  {activeTemplateList.map((template) => (
                    <option key={`template_option_${template.id}`} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="inline-row wrap">
                <button type="button" className="btn btn-subtle" onClick={applyActiveTemplate} disabled={!hasActiveTemplateSelection}>
                  <span className="btn-icon"><UiIcon name="apply" /></span>適用
                </button>
                <button type="button" className="btn btn-subtle" onClick={saveActiveTemplate} disabled={!canEdit}>
                  <span className="btn-icon"><UiIcon name="save" /></span>現在内容を保存
                </button>
                <button type="button" className="btn btn-danger" onClick={deleteActiveTemplate} disabled={!canEdit || !hasActiveTemplateSelection}>
                  <span className="btn-icon"><UiIcon name="delete" /></span>削除
                </button>
              </div>
              <div className="template-list">
                {activeTemplateList.slice(0, 6).map((template) => (
                  <p key={`template_list_${template.id}`}>
                    <strong>{template.name}</strong>
                    <span>{new Date(template.createdAt).toLocaleString("ja-JP")}</span>
                  </p>
                ))}
                {!activeTemplateList.length ? <p>まだテンプレートがありません</p> : null}
              </div>
            </article>

            <article className="sub-panel">
              <h4>他案件から引用</h4>
              <label className="field">
                <span>引用元案件（案件ID / 物件名）</span>
                <p className="field-help">案件を選んで「引用」すると、今のカードだけ内容を取り込めます。</p>
                <select className="control" value={copySourceProjectId} onChange={(event) => setCopySourceProjectId(event.target.value)} disabled={!hasOtherProjects}>
                  {!hasOtherProjects ? <option value="">他案件がありません</option> : null}
                  {otherProjects.map((project) => (
                    <option key={`copy_src_template_center_${project.projectId}`} value={project.projectId}>
                      {project.projectId} | {project.propertyName}
                    </option>
                  ))}
                </select>
              </label>
              <div className="inline-row wrap">
                <button type="button" className="btn btn-subtle" onClick={() => copyFromSource(templateScope)} disabled={!canEdit || !copySourceProject}>
                  <span className="btn-icon"><UiIcon name="copy" /></span>{activeTemplateMeta.copyLabel}
                </button>
              </div>
              <p className="mini">まず引用でベースを取り込み、必要な箇所だけ各カードで微調整する運用がおすすめです。</p>
            </article>
          </div>
        </section>
        ) : null}

        {isEditorMode && !hasSelectedProject ? (
        <section className="panel project-empty-panel">
          <h3>未入力状態で開始できます</h3>
          <p className="mini">PDF1〜7を空欄のまま表示しています。上部検索で既存案件を開くか、このまま入力を始めると新規案件を自動作成します。</p>
        </section>
        ) : null}

        {isEditorMode ? (
        <>
        <section className="panel required-summary-panel">
          <div className="panel-head">
            <h3>必須入力チェック</h3>
            <p className={`status-chip ${canExportPdf ? "ok" : "warn"}`}>
              {canExportPdf ? "入力完了" : `未入力 ${totalMissingRequiredCount}件`}
            </p>
          </div>
          {!canExportPdf ? (
            <>
              <p className="mini">未入力項目があるため、PDF出力は無効です。最初の未入力へ移動して入力してください。</p>
              <div className="inline-row wrap">
                <button type="button" className="btn btn-subtle" onClick={() => scrollToMissingField()}>
                  <span className="btn-icon"><UiIcon name="down" /></span>最初の未入力へ移動
                </button>
              </div>
            </>
          ) : (
            <p className="mini">必須項目はすべて入力済みです。PDF出力できます。</p>
          )}
          {requiredHint ? <p className="error-text">{requiredHint}</p> : null}
        </section>
        <section className="panel page-card" id="card-pdf1">
          <div className="page-card-head">
            <p className="page-card-index">PDF 1</p>
            <div>
              <h2>表紙</h2>
              <p className="mini">このカードの入力がPDF1ページ目に反映されます</p>
            </div>
          </div>
          <CardPreview title="PDF1 表紙">
            <article className="preview-page">
              <div className="preview-cover-top">
                <p>{formatDateWithWeekday(selectedProject.workDateStart)}</p>
                <p>{activePdfTemplate.coverKicker}</p>
              </div>
              <h3 className="preview-cover-building">{selectedProject.propertyName}　{selectedProject.coverRecipientSuffix || "管理組合御中"}</h3>
              <p className="preview-cover-subject">{selectedProject.titleSubject}</p>
              <p className="preview-cover-subject">施工計画書</p>
              <div className="preview-logo-wrap">
                <img
                  className="preview-logo"
                  src={activeLogoSrc}
                  alt="Rezil ロゴ"
                  onError={(event) => {
                    event.currentTarget.src = PDF_LOGO_FALLBACK_SRC;
                  }}
                />
              </div>
              <section className="preview-company">
                <h4>{activeParties.owner.company || selectedProject.pdfCompanyName || "-"}</h4>
                <dl>
                  <dt>{activePdfTemplate.coverTeamLabel}</dt>
                  <dd>{activeParties.owner.office || selectedProject.pdfTeam || "-"}</dd>
                  <dt>担当者</dt>
                  <dd>{activeParties.owner.person || selectedProject.pdfContactPerson || "-"}</dd>
                  <dt>住所</dt>
                  <dd>{selectedProject.pdfAddress || "-"}</dd>
                  <dt>E-mail</dt>
                  <dd>{selectedProject.pdfEmail || "-"}</dd>
                  <dt>電話番号（TEL）</dt>
                  <dd>{activeParties.owner.tel || selectedProject.pdfTel || "-"}</dd>
                  <dt>FAX</dt>
                  <dd>{selectedProject.pdfFax || "-"}</dd>
                </dl>
              </section>
            </article>
          </CardPreview>
          <article className="sub-panel">
            <h3>表紙テキスト</h3>
            <p className="field-help">上から順に入力すると迷いません。物件名 → 宛名 → 件名 の順で入力してください。</p>
            <div className="field-grid">
              <label className="field span-2">
                <span>PDFフォーマット</span>
                <select
                  className="control"
                  value={selectedProject.pdfTemplateId}
                  onChange={(event) => handleProjectField("pdfTemplateId", normalizePdfTemplateId(event.target.value))}
                >
                  {PDF_TEMPLATE_PRESETS.map((template) => (
                    <option key={`pdf_template_${template.id}`} value={template.id}>
                      {template.label}
                    </option>
                  ))}
                </select>
                <p className="mini">{activePdfTemplate.description}</p>
              </label>
              <label className="field"><span>物件名</span><input data-required-key="propertyName" className={`control ${requiredMissingMap.propertyName ? "control-missing" : ""}`} value={selectedProject.propertyName} onChange={(event) => handleProjectField("propertyName", event.target.value)} /></label>
              <label className="field"><span>表紙宛名（末尾）</span><input data-required-key="coverRecipientSuffix" className={`control ${requiredMissingMap.coverRecipientSuffix ? "control-missing" : ""}`} value={selectedProject.coverRecipientSuffix} onChange={(event) => handleProjectField("coverRecipientSuffix", event.target.value)} /></label>
              <label className="field span-2"><span>件名</span><input data-required-key="titleSubject" className={`control ${requiredMissingMap.titleSubject ? "control-missing" : ""}`} value={selectedProject.titleSubject} onChange={(event) => handleProjectField("titleSubject", event.target.value)} /></label>
            </div>
          </article>
        </section>

        <section className="panel page-card" id="card-pdf2">
          <div className="page-card-head">
            <p className="page-card-index">PDF 2</p>
            <div>
              <h2>目次</h2>
              <p className="mini">
                目次は選択したPDFフォーマットに連動します
                （1:{activePdfTemplate.tocItems[0]} / 2:{activePdfTemplate.tocItems[1]} / 3:{activePdfTemplate.tocItems[2]} / 4:{activePdfTemplate.tocItems[3]} / 5:{activePdfTemplate.tocItems[4]}）
              </p>
            </div>
          </div>
          <CardPreview title="PDF2 目次">
            <article className="preview-page">
              <h3>目次</h3>
              <ol className="preview-toc-list">
                {activePdfTemplate.tocItems.map((item) => (
                  <li key={`preview_toc_${item}`}>{item}</li>
                ))}
              </ol>
            </article>
          </CardPreview>
        </section>

        <section className="panel page-card" id="card-pdf3">
          <div className="page-card-head">
            <p className="page-card-index">PDF 3</p>
            <div>
              <h2>工事概要・工程表</h2>
              <p className="mini">このカードの入力がPDF3ページ（工事概要）に反映されます</p>
            </div>
          </div>
          <CardPreview title="PDF3 工事概要・工程表">
            <article className="preview-page">
              <h3>1．工事概要</h3>
              <div className="preview-summary-lines">
                <p><strong>■ 工事件名</strong> {selectedProject.titleSubject}</p>
                <p><strong>■ 工事場所</strong> {selectedProject.propertyAddress || "-"}</p>
                <p><strong>■ 工事期間</strong> {dateRangeLabel}</p>
                <p><strong>■ 停電期間</strong> {outageDateTimeLabel}</p>
              </div>
              <h4>工事工程グラフ</h4>
              <div className="preview-timeline-stack">
                {timeline.windows.map((window, windowIndex) => (
                  <div className="preview-timeline" key={`preview_window_${window.id}`}>
                    {timeline.windows.length > 1 ? (
                      <p className="mini timeline-split-caption">工程表 {windowIndex + 1}/{timeline.windows.length}（{formatDateRange(window.startDate, window.endDate)}）</p>
                    ) : null}
                    <div className="preview-timeline-scale">
                      {window.labelTicks.map((tick) => {
                        const left = ((tick - window.viewStart) / window.viewSpan) * 100;
                        const point = fromTimelineOffset(tick, timeline.baseDate);
                        const labelDate = formatShortDate(point.date);
                        const labelTime = tickLabel(toMinutes(point.time));
                        const labelText = labelTime === "00:00" || tick === window.viewStart || tick === window.viewEnd ? `${labelDate} ${labelTime}` : labelTime;
                        return (
                          <span
                            key={`preview_pdf3_${window.id}_tick_${tick}`}
                            className={tick === window.viewStart ? "edge-left" : tick === window.viewEnd ? "edge-right" : ""}
                            style={{ left: `${Math.max(0, Math.min(100, left))}%` }}
                          >
                            {labelText}
                          </span>
                        );
                      })}
                    </div>
                    <div className="preview-timeline-grid">
                      {window.lineTicks.map((tick) => {
                        const left = ((tick - window.viewStart) / window.viewSpan) * 100;
                        return <i key={`preview_pdf3_${window.id}_line_${tick}`} style={{ left: `${Math.max(0, Math.min(100, left))}%` }} />;
                      })}
                      {graphRows.map((row) => {
                        const normalized = normalizeRowRange(
                          toTimelineOffset(row.startDate, row.start, timeline.baseDate),
                          toTimelineOffset(row.endDate, row.end, timeline.baseDate),
                          timeline.fullSpan,
                        );
                        const clippedStart = clamp(normalized.start, window.viewStart, window.viewEnd);
                        const clippedEnd = clamp(normalized.end, window.viewStart, window.viewEnd);
                        const visibleSpan = clippedEnd - clippedStart;
                        if (visibleSpan <= 0) {
                          return (
                            <div className="preview-timeline-row" key={`preview_pdf3_${window.id}_row_${row.id}`}>
                              <span className="preview-row-label">{row.label}</span>
                              <div className="preview-row-track" />
                            </div>
                          );
                        }
                        const left = ((clippedStart - window.viewStart) / window.viewSpan) * 100;
                        const width = Math.max(0.5, (visibleSpan / window.viewSpan) * 100);
                        const colorType = getRowColorType(row);
                        return (
                          <div className="preview-timeline-row" key={`preview_pdf3_${window.id}_row_${row.id}`}>
                            <span className="preview-row-label">{row.label}</span>
                            <div className="preview-row-track">
                              <div className={`preview-row-bar is-${colorType}`} style={{ left: `${left}%`, width: `${width}%` }}>
                                {row.label}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <h4>工事工程表</h4>
              <div className="table-wrap">
                <table className="schedule-table preview-table">
                  <thead>
                    <tr><th>項目</th><th>開始日時</th><th>終了日時</th><th>停電</th><th>備考</th></tr>
                  </thead>
                  <tbody>
                    {selectedProject.outageEnabled ? (
                      <tr>
                        <td>停電時間</td>
                        <td>{`${formatDateWithWeekday(selectedProject.outageDateStart)} ${selectedProject.outageTimeStart}`}</td>
                        <td>{`${formatDateWithWeekday(selectedProject.outageDateEnd)} ${selectedProject.outageTimeEnd}`}</td>
                        <td>有</td>
                        <td>全館停電</td>
                      </tr>
                    ) : null}
                    {selectedProject.scheduleRows.slice(0, 5).map((row) => (
                      <tr key={`preview_pdf3_table_${row.id}`}>
                        <td>{row.label}</td>
                        <td>{`${formatDateWithWeekday(row.startDate)} ${row.start}`}</td>
                        <td>{`${formatDateWithWeekday(row.endDate)} ${row.end}`}</td>
                        <td>{row.outage ? "有" : "無"}</td>
                        <td>{row.note || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </CardPreview>
          <div className="grid-2 pdf3-info-stack">
            <article className="sub-panel">
              <h3>基本情報</h3>
              <p className="field-help">日付は「開始→終了」の順で入力してください。停電期間は下段に自動表示されます。</p>
              <div className="field-grid">
                <label className="field span-2"><span>住所</span><input data-required-key="propertyAddress" className={`control ${requiredMissingMap.propertyAddress ? "control-missing" : ""}`} value={selectedProject.propertyAddress} onChange={(event) => handleProjectField("propertyAddress", event.target.value)} /></label>
                <label className="field"><span>工事開始日</span><input data-required-key="workDateStart" className={`control ${requiredMissingMap.workDateStart ? "control-missing" : ""}`} type="date" value={selectedProject.workDateStart} onChange={(event) => updateWorkDateStart(event.target.value)} /></label>
                <label className="field"><span>工事終了日</span><input data-required-key="workDateEnd" className={`control ${requiredMissingMap.workDateEnd ? "control-missing" : ""}`} type="date" value={selectedProject.workDateEnd} onChange={(event) => updateWorkDateEnd(event.target.value)} /></label>
                <label className="field"><span>停電開始日</span><input data-required-key="outageDateStart" className={`control ${requiredMissingMap.outageDateStart ? "control-missing" : ""}`} type="date" value={selectedProject.outageDateStart} onChange={(event) => updateOutageDateStart(event.target.value)} /></label>
                <label className="field"><span>停電終了日</span><input data-required-key="outageDateEnd" className={`control ${requiredMissingMap.outageDateEnd ? "control-missing" : ""}`} type="date" value={selectedProject.outageDateEnd} onChange={(event) => updateOutageDateEnd(event.target.value)} /></label>
                <label className="field"><span>停電開始時間</span><input data-required-key="outageTimeStart" className={`control ${requiredMissingMap.outageTimeStart ? "control-missing" : ""}`} type="time" value={selectedProject.outageTimeStart} onChange={(event) => updateOutageRange({ outageTimeStart: normalizeTime(event.target.value, selectedProject.outageTimeStart) }, "field_outage_time_start")} /></label>
                <label className="field"><span>停電終了時間</span><input data-required-key="outageTimeEnd" className={`control ${requiredMissingMap.outageTimeEnd ? "control-missing" : ""}`} type="time" value={selectedProject.outageTimeEnd} onChange={(event) => updateOutageRange({ outageTimeEnd: normalizeTime(event.target.value, selectedProject.outageTimeEnd) }, "field_outage_time_end")} /></label>
                <label className="field span-2"><span>停電を工程表に表示</span><span className="check-pill"><input type="checkbox" checked={selectedProject.outageEnabled} onChange={(event) => handleProjectField("outageEnabled", event.target.checked)} /> 停電時間バーを表示する</span></label>
                <label className="field span-2"><span>停電期間（自動）</span><div className="date-range-preview">{outageDateTimeLabel}</div></label>
              </div>
            </article>

            <article className="sub-panel">
              <h3>工事項目</h3>
              <p className="mini">必要な工事項目をチェックしてください</p>
              <div className="checks">
                {WORK_MASTER.map((work) => (
                  <label key={`sel_${work.code}`}><input type="checkbox" checked={selectedProject.selectedWorkCodes.includes(work.code)} onChange={() => toggleWork(work.code)} /> {work.name}</label>
                ))}
              </div>
            </article>
          </div>

          <div className="panel-head">
            <h3>工程表（日付・時間グラフ + 編集）</h3>
            <div className="inline-row">
              <button type="button" className="btn btn-action-add" onClick={addScheduleRow}><span className="btn-icon"><UiIcon name="addRow" /></span>行追加</button>
              <button type="button" className="btn btn-action-regenerate" onClick={regenerateSchedule}><span className="btn-icon"><UiIcon name="refresh" /></span>工事項目から再生成</button>
            </div>
          </div>
          <div className="schedule-template-tools">
            <div className="schedule-template-head">
              <label className="field schedule-template-picker">
                <span>工程テンプレート（段取り）</span>
                <select
                  className="control"
                  value={selectedScheduleProcedureTemplateId}
                  onChange={(event) => setSelectedScheduleProcedureTemplateId(event.target.value)}
                >
                  <option value="">テンプレートを選択</option>
                  {scheduleProcedureTemplates.map((template) => (
                    <option key={`schedule_proc_tpl_${template.id}`} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="inline-row wrap schedule-template-actions">
                <button
                  type="button"
                  className="btn btn-action-regenerate"
                  onClick={regenerateScheduleFromProcedureTemplate}
                  disabled={!selectedScheduleProcedureTemplate}
                >
                  <span className="btn-icon"><UiIcon name="refresh" /></span>テンプレートで再生成
                </button>
                <button
                  type="button"
                  className="btn btn-subtle"
                  onClick={appendProcedureTemplateRows}
                  disabled={!selectedScheduleProcedureTemplate}
                >
                  <span className="btn-icon"><UiIcon name="addRow" /></span>工程を自動追加
                </button>
              </div>
            </div>
            <div className="schedule-template-save-row">
              <label className="field schedule-template-name-field">
                <span>テンプレート名（新規保存）</span>
                <input
                  className="control"
                  value={newScheduleProcedureTemplateName}
                  onChange={(event) => setNewScheduleProcedureTemplateName(event.target.value)}
                  placeholder="例: 高圧ケーブル交換_標準段取り"
                />
              </label>
              <div className="inline-row wrap schedule-template-actions">
                <button type="button" className="btn btn-subtle" onClick={saveCurrentScheduleAsProcedureTemplate} disabled={!canEdit}>
                  <span className="btn-icon"><UiIcon name="save" /></span>現在工程をテンプレ登録
                </button>
                <button
                  type="button"
                  className="btn btn-subtle"
                  onClick={appendCurrentRowsToSelectedProcedureTemplate}
                  disabled={!canEdit || !selectedScheduleProcedureTemplate}
                >
                  <span className="btn-icon"><UiIcon name="plus" /></span>選択テンプレに追記
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={deleteScheduleProcedureTemplate}
                  disabled={!canEdit || !selectedScheduleProcedureTemplate}
                >
                  <span className="btn-icon"><UiIcon name="delete" /></span>テンプレート削除
                </button>
              </div>
            </div>
            <p className="mini">
              工事項目や停電時間をもとに工程バーを自動生成します。日時はUTC基準で正規化し、日付+1日のズレを防止しています。
            </p>
          </div>
          <p className="timeline-date-line">
            工事期間: {dateRangeLabel} / 停電期間: {selectedProject.outageEnabled ? outageDateTimeLabel : "停電なし"}
          </p>

          <div className={`timeline-stack ${requiredMissingMap.scheduleRows ? "required-missing-block" : ""}`} data-required-key="scheduleRows">
            {timeline.windows.map((window, windowIndex) => (
              <div className="timeline-wrap" aria-label="可変時間レンジ工程グラフ" key={`timeline_window_${window.id}`}>
                {timeline.windows.length > 1 ? (
                  <p className="mini timeline-split-caption">工程表 {windowIndex + 1}/{timeline.windows.length}（{formatDateRange(window.startDate, window.endDate)}）</p>
                ) : null}
                <div className="timeline-scale">
                  {window.labelTicks.map((tick) => {
                    const left = ((tick - window.viewStart) / window.viewSpan) * 100;
                    if (left < -5 || left > 105) {
                      return null;
                    }
                    const point = fromTimelineOffset(tick, timeline.baseDate);
                    const labelDate = formatShortDate(point.date);
                    const labelTime = tickLabel(toMinutes(point.time));
                    const labelText = labelTime === "00:00" || tick === window.viewStart || tick === window.viewEnd ? `${labelDate} ${labelTime}` : labelTime;
                    return (
                      <span
                        key={`${window.id}_${tick}`}
                        className={tick === window.viewStart ? "edge-left" : tick === window.viewEnd ? "edge-right" : ""}
                        style={{ left: `${Math.max(0, Math.min(100, left))}%` }}
                      >
                        {labelText}
                      </span>
                    );
                  })}
                </div>
                <div className="timeline-grid">
                  {window.lineTicks.map((tick) => {
                    const left = ((tick - window.viewStart) / window.viewSpan) * 100;
                    return <i key={`${window.id}_line_${tick}`} style={{ left: `${Math.max(0, Math.min(100, left))}%` }} />;
                  })}

                  {graphRows.map((row) => {
                    const baseRange = normalizeRowRange(
                      toTimelineOffset(row.startDate, row.start, timeline.baseDate),
                      toTimelineOffset(row.endDate, row.end, timeline.baseDate),
                      timeline.fullSpan,
                    );
                    const normalized =
                      dragInfo?.rowId === row.id
                        ? normalizeRowRange(dragInfo.currentStart, dragInfo.currentEnd, timeline.fullSpan)
                        : baseRange;
                    const displayStartPoint = fromTimelineOffset(normalized.start, timeline.baseDate);
                    const displayEndPoint = fromTimelineOffset(normalized.end, timeline.baseDate);
                    const rowTimeLabel = displayStartPoint.date === displayEndPoint.date
                      ? `${displayStartPoint.time}〜${displayEndPoint.time}`
                      : `${formatShortDate(displayStartPoint.date)} ${displayStartPoint.time}〜${formatShortDate(displayEndPoint.date)} ${displayEndPoint.time}`;
                    const clippedStart = clamp(normalized.start, window.viewStart, window.viewEnd);
                    const clippedEnd = clamp(normalized.end, window.viewStart, window.viewEnd);
                    const visibleSpan = clippedEnd - clippedStart;
                    const dragging = dragInfo?.rowId === row.id;
                    const colorType = getRowColorType(row);
                    const left = ((clippedStart - window.viewStart) / window.viewSpan) * 100;
                    const width = visibleSpan > 0 ? Math.max(0.5, (visibleSpan / window.viewSpan) * 100) : 0;
                    const displayWidth = Math.max(width, 2);

                    return (
                      <div className="timeline-row" key={`${window.id}_graph_${row.id}`}>
                        <span className="row-label">
                          <strong>{row.label}</strong>
                          <small>{rowTimeLabel}</small>
                        </span>
                        <div className="row-track">
                          {visibleSpan > 0 ? (
                            <div
                              className={`row-bar is-${colorType} ${dragging ? "is-dragging" : ""} ${displayWidth < 6 ? "is-narrow" : ""}`}
                              style={{ left: `${left}%`, width: `${displayWidth}%` }}
                              title={`${row.label} ${rowTimeLabel}`}
                              onPointerDown={(event) => beginRowDrag(row, "move", event, window.viewSpan)}
                            >
                              <span className="row-handle start" aria-label="開始時刻を調整" onPointerDown={(event) => beginRowDrag(row, "start", event, window.viewSpan)} />
                              <span className="row-text">{row.label}</span>
                              <span className="row-handle end" aria-label="終了時刻を調整" onPointerDown={(event) => beginRowDrag(row, "end", event, window.viewSpan)} />
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="table-wrap">
            <table className="schedule-table timeline-edit-table">
              <thead>
                <tr><th>項目</th><th>開始日時</th><th>終了日時</th><th>停電</th><th>備考</th><th>操作</th></tr>
              </thead>
              <tbody>
                <tr key="row_outage_edit">
                  <td><input className="control" value="停電時間" readOnly /></td>
                  <td>
                    <input
                      className="control"
                      type="datetime-local"
                      value={`${selectedProject.outageDateStart}T${selectedProject.outageTimeStart}`}
                      onChange={(event) => {
                        const next = normalizeDateTimeValue(event.target.value, selectedProject.outageDateStart, selectedProject.outageTimeStart);
                        updateOutageRange({ outageDateStart: next.date, outageTimeStart: next.time }, "table_datetime_start");
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className="control"
                      type="datetime-local"
                      value={`${selectedProject.outageDateEnd}T${selectedProject.outageTimeEnd}`}
                      onChange={(event) => {
                        const next = normalizeDateTimeValue(event.target.value, selectedProject.outageDateEnd, selectedProject.outageTimeEnd);
                        updateOutageRange({ outageDateEnd: next.date, outageTimeEnd: next.time }, "table_datetime_end");
                      }}
                    />
                  </td>
                  <td><input type="checkbox" checked={selectedProject.outageEnabled} onChange={(event) => handleProjectField("outageEnabled", event.target.checked)} /></td>
                  <td><input className="control" value="全館停電" readOnly /></td>
                  <td><span className="mini">表示切替</span></td>
                </tr>
                {selectedProject.scheduleRows.map((row) => (
                  <tr key={row.id}>
                    <td><input className="control" value={row.label} onChange={(event) => updateScheduleRow(row.id, { label: event.target.value })} /></td>
                    <td>
                      <input
                        className="control"
                        type="datetime-local"
                        value={`${row.startDate}T${row.start}`}
                        onChange={(event) => {
                          const next = normalizeDateTimeValue(event.target.value, row.startDate, row.start);
                          updateScheduleRow(row.id, { startDate: next.date, start: next.time });
                        }}
                      />
                    </td>
                    <td>
                      <input
                        className="control"
                        type="datetime-local"
                        value={`${row.endDate}T${row.end}`}
                        onChange={(event) => {
                          const next = normalizeDateTimeValue(event.target.value, row.endDate, row.end);
                          updateScheduleRow(row.id, { endDate: next.date, end: next.time });
                        }}
                      />
                    </td>
                    <td><input type="checkbox" checked={row.outage} onChange={(event) => updateScheduleRow(row.id, { outage: event.target.checked })} /></td>
                    <td>
                      <textarea
                        className="control textarea schedule-note-input"
                        value={row.note}
                        onChange={(event) => updateScheduleRow(row.id, { note: event.target.value })}
                        placeholder="備考を入力（長文可）"
                      />
                    </td>
                    <td className="timeline-action-cell">
                      <div className="row-action-group">
                        <button type="button" className="btn btn-subtle row-action-btn" onClick={() => moveScheduleRow(row.id, -1)}><span className="btn-icon"><UiIcon name="up" /></span>上へ</button>
                        <button type="button" className="btn btn-subtle row-action-btn" onClick={() => moveScheduleRow(row.id, 1)}><span className="btn-icon"><UiIcon name="down" /></span>下へ</button>
                        <button type="button" className="btn btn-danger row-action-btn" onClick={() => removeScheduleRow(row.id)}><span className="btn-icon"><UiIcon name="delete" /></span>削除</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel page-card" id="card-pdf4">
          <div className="page-card-head">
            <p className="page-card-index">PDF 4</p>
            <div>
              <h2>工事詳細説明</h2>
              <p className="mini">工程表の各行 + 参考写真（PDF4専用）が反映されます</p>
            </div>
          </div>
          <CardPreview title="PDF4 工事詳細説明">
            <article className="preview-page">
              <h3>2．工事詳細説明</h3>
              {selectedProject.scheduleRows.length === 0 ? (
                <p className="mini">工程表の作業行が未設定です。</p>
              ) : null}
              {selectedProject.scheduleRows.map((row) => (
                <section key={`preview_pdf4_${row.id}`} className="preview-work-detail">
                  <h4>■ {row.label}</h4>
                  <p>作業時間: {formatDateWithWeekday(row.startDate)} {row.start}〜{formatDateWithWeekday(row.endDate)} {row.end}{row.outage ? "（停電あり）" : "（停電なし）"}</p>
                  {row.note ? <p>備考: {row.note}</p> : null}
                </section>
              ))}
              <h4>参考写真</h4>
              <div className="preview-photo-grid">
                {detailPhotosFilled.slice(0, 4).map((slot) => (
                  <figure key={`preview_pdf4_photo_${slot.id}`} className="preview-photo-item">
                    <div>
                      {slot.dataUrl ? (
                        <LayoutAnnotatedImage imageUrl={slot.dataUrl} annotations={slot.layoutAnnotations || []} alt={slot.label} />
                      ) : (
                        <span>写真未設定</span>
                      )}
                    </div>
                    <figcaption>{slot.label}</figcaption>
                  </figure>
                ))}
                {!detailPhotosFilled.length ? (
                  <figure className="preview-photo-item">
                    <div><span>参考写真が未設定です</span></div>
                    <figcaption>写真を追加するとここに表示されます</figcaption>
                  </figure>
                ) : null}
              </div>
            </article>
          </CardPreview>
          <div className="table-wrap">
            <table className="schedule-table">
              <thead>
                <tr><th>項目</th><th>開始日時</th><th>終了日時</th><th>備考</th></tr>
              </thead>
              <tbody>
                {selectedProject.scheduleRows.map((row) => (
                  <tr key={`detail_card_${row.id}`}>
                    <td>{row.label}</td>
                    <td>{`${formatDateWithWeekday(row.startDate)} ${row.start}`}</td>
                    <td>{`${formatDateWithWeekday(row.endDate)} ${row.end}`}</td>
                    <td>{row.note || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3>参考写真（PDF4専用）</h3>
          <div className="photo-slider-nav">
            <button type="button" className="btn btn-subtle" onClick={() => addPhotoItem("detailPhotos")}><span className="btn-icon"><UiIcon name="photo" /></span>写真ページ追加</button>
            <div className="inline-row">
              <button type="button" className="btn btn-subtle" onClick={() => setDetailPhotoSlide((prev) => Math.max(0, prev - 1))} disabled={detailPhotoSlide <= 0}><span className="btn-icon"><UiIcon name="arrowLeft" /></span>前</button>
              <span className="mini">{detailPhotoSlide + 1} / {totalDetailPhotoSlides}</span>
              <button type="button" className="btn btn-subtle" onClick={() => setDetailPhotoSlide((prev) => Math.min(totalDetailPhotoSlides - 1, prev + 1))} disabled={detailPhotoSlide >= totalDetailPhotoSlides - 1}><span className="btn-icon"><UiIcon name="arrowRight" /></span>次</button>
            </div>
          </div>
          <div className={`photo-slider-window ${requiredMissingMap.detailPhotos ? "required-missing-block" : ""}`} data-required-key="detailPhotos">
            <div className="photo-slide-grid pair">
              {currentDetailSlidePhotos.map((slot) => (
                <article key={`detail_card_photo_${slot.id}`} className="photo-card">
                  <input
                    className="control"
                    value={slot.label}
                    onChange={(event) => updatePhotoItem("detailPhotos", slot.id, { label: event.target.value })}
                  />
                  <UploadDropZone
                    imageUrl={slot.dataUrl}
                    annotations={slot.layoutAnnotations || []}
                    alt={slot.label}
                    onFileSelect={(event) => replacePhoto("detailPhotos", slot.id, event)}
                    onFileDrop={(file) => applyPhotoFile("detailPhotos", slot.id, file)}
                    onDeleteImage={() => clearPhotoImage("detailPhotos", slot.id)}
                  />
                  <div className="inline-row photo-card-actions">
                    <button type="button" className="btn btn-subtle" onClick={() => openPhotoAnnotationEditor("detailPhotos", slot.id)} disabled={!canEdit || !slot.dataUrl}>画像編集</button>
                    <button type="button" className="btn btn-subtle" onClick={() => clearPhotoAnnotations("detailPhotos", slot.id)} disabled={!canEdit || (slot.layoutAnnotations?.length || 0) === 0}><span className="btn-icon"><UiIcon name="clear" /></span>画像編集クリア</button>
                    <button type="button" className="btn btn-danger" onClick={() => removePhotoItem("detailPhotos", slot.id)}><span className="btn-icon"><UiIcon name="delete" /></span>削除</button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="panel page-card" id="card-pdf5">
          <div className="page-card-head">
            <p className="page-card-index">PDF 5</p>
            <div>
              <h2>ご承認いただきたい事項</h2>
              <p className="mini">工程表の内容 + 追記メモがPDF5ページに反映されます</p>
            </div>
          </div>
          <CardPreview title="PDF5 ご承認いただきたい事項">
            <article className="preview-page">
              <h3>3．ご承認いただきたい事項</h3>
              <div className="table-wrap">
                <table className="schedule-table preview-table">
                  <thead>
                    <tr><th style={{ width: "56px" }}>No</th><th style={{ width: "180px" }}>項目</th><th>内容</th></tr>
                  </thead>
                  <tbody>
                    {selectedProject.scheduleRows.slice(0, 5).map((row, idx) => (
                      <tr key={`preview_pdf5_${row.id}`}>
                        <td>{idx + 1}</td>
                        <td>{row.label}</td>
                        <td>{`時間: ${formatDateWithWeekday(row.startDate)} ${row.start}〜${formatDateWithWeekday(row.endDate)} ${row.end}`}</td>
                      </tr>
                    ))}
                    <tr>
                      <td>9</td>
                      <td>特記事項</td>
                      <td>{selectedProject.noteSpecial || "なし"}</td>
                    </tr>
                    <tr>
                      <td>10</td>
                      <td>承認事項追記</td>
                      <td>{selectedProject.noteApprovalExtra || "なし"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>
          </CardPreview>
          <label className="field">
            <span>承認事項 追記</span>
            <textarea className="control textarea" value={selectedProject.noteApprovalExtra} onChange={(event) => handleProjectField("noteApprovalExtra", event.target.value)} />
          </label>
        </section>

        <section className="panel page-card" id="card-pdf6">
          <div className="page-card-head">
            <p className="page-card-index">PDF 6</p>
            <div>
              <h2>{activePdfTemplate.sectionOrganization}・{activePdfTemplate.sectionEmergency}</h2>
              <p className="mini">関係各社カードの「反映する」をONにしたものだけPDF6ページへ反映されます</p>
            </div>
          </div>
          <CardPreview title={`PDF6 ${activePdfTemplate.sectionOrganization}・${activePdfTemplate.sectionEmergency}`}>
            <article className="preview-page">
              <h3>4．{activePdfTemplate.sectionOrganization}</h3>
              <div className="preview-org-grid">
                {activeParties.owner.enabled ? (
                  <div className="preview-org-box">
                    <p>{activeParties.owner.title}：{activeParties.owner.company || "-"}</p>
                    {activeParties.owner.person ? <p>担当者：{activeParties.owner.person}</p> : null}
                    {activeParties.owner.office ? <p>部署：{activeParties.owner.office}</p> : null}
                    <p>電話番号（TEL）：{activeParties.owner.tel || "-"}</p>
                  </div>
                ) : null}
                {activeParties.utility.enabled ? (
                  <div className="preview-org-box">
                    <p>{activeParties.utility.company || "-"}</p>
                    {activeParties.utility.office ? <p>事業所：{activeParties.utility.office}</p> : null}
                    <p>電話番号（TEL）：{activeParties.utility.tel || "-"}</p>
                  </div>
                ) : null}
                {activeParties.contractor.enabled ? (
                  <div className="preview-org-box preview-org-large">
                    <p>{activeParties.contractor.title}：{activeParties.contractor.company || "-"}</p>
                    {activeParties.contractor.office ? <p>{activeParties.contractor.office}</p> : null}
                    {activeParties.contractor.person ? <p>担当者：{activeParties.contractor.person}</p> : null}
                    <p>電話番号（TEL）：{activeParties.contractor.tel || "-"}</p>
                  </div>
                ) : null}
              </div>
              <h3>5．{activePdfTemplate.sectionEmergency}</h3>
              <div className="preview-org-grid compact">
                {activeParties.management.enabled ? <div className="preview-org-box">{activeParties.management.company || "-"}</div> : null}
                {activeParties.owner.enabled ? <div className="preview-org-box">{activeParties.owner.company || "-"}<br />電話番号（TEL）：{activeParties.owner.tel || "-"}</div> : null}
                {activeParties.utility.enabled ? <div className="preview-org-box">{activeParties.utility.company || "-"}<br />電話番号（TEL）：{activeParties.utility.tel || "-"}</div> : null}
                {activeParties.contractor.enabled ? <div className="preview-org-box">{activeParties.contractor.company || "-"}<br />電話番号（TEL）：{activeParties.contractor.tel || "-"}</div> : null}
                {activeParties.residents.enabled ? <div className="preview-org-box">{activeParties.residents.company || "-"}</div> : null}
              </div>
            </article>
          </CardPreview>
          <div className="party-template-row">
            <label className="field party-template-field">
              <span>体制表テンプレート</span>
              <select
                className="control"
                value={selectedPartyTemplateId}
                onChange={(event) => setSelectedPartyTemplateId(event.target.value)}
              >
                <option value="">テンプレートを選択</option>
                {partyTemplates.map((template) => (
                  <option key={`party_template_local_${template.id}`} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="inline-row wrap">
              <button
                type="button"
                className="btn btn-subtle"
                onClick={applyPartyTemplate}
                disabled={!selectedPartyTemplate}
              >
                <span className="btn-icon"><UiIcon name="apply" /></span>
                テンプレート適用
              </button>
              <button
                type="button"
                className="btn btn-subtle"
                onClick={savePartyTemplate}
                disabled={!canEdit}
              >
                <span className="btn-icon"><UiIcon name="save" /></span>
                現在内容をテンプレート登録
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={deletePartyTemplate}
                disabled={!canEdit || !selectedPartyTemplateId}
              >
                <span className="btn-icon"><UiIcon name="delete" /></span>
                テンプレート削除
              </button>
            </div>
          </div>
          <div className={`party-grid ${requiredMissingMap.relatedPartiesEnabled ? "required-missing-block" : ""}`} data-required-key="relatedPartiesEnabled">
            <div className="party-slider-nav">
              <button type="button" className="btn btn-subtle" onClick={() => setPartySlide((prev) => Math.max(0, prev - 1))} disabled={partySlide <= 0}>
                <span className="btn-icon"><UiIcon name="arrowLeft" /></span>
                前のスライド
              </button>
              <span className="mini">
                {partySlide + 1} / {totalPartySlides}
              </span>
              <button
                type="button"
                className="btn btn-subtle"
                onClick={() => setPartySlide((prev) => Math.min(totalPartySlides - 1, prev + 1))}
                disabled={partySlide >= totalPartySlides - 1}
              >
                <span className="btn-icon"><UiIcon name="arrowRight" /></span>
                次のスライド
              </button>
            </div>
            <div className="party-slider-window">
              <div className="party-slider-track" style={{ transform: `translateX(-${partySlide * 100}%)` }}>
                {Array.from({ length: totalPartySlides }, (_, slideIndex) => {
                  const start = slideIndex * partySlideSize;
                  const end = start + partySlideSize;
                  const keys = partyEntries.slice(start, end);
                  return (
                    <div key={`party_slide_${slideIndex}`} className="party-slide">
                      {keys.map((key) => {
                        const party = selectedProject.relatedParties[key];
                        const companyTemplateOptions = [
                          ...(partyCompanyTemplates[key] || []),
                          ...PARTY_COMPANY_TEMPLATE_PRESETS[key],
                        ];
                        return (
                          <article key={`party_${key}`} className="sub-panel party-card">
                            <div className="party-head">
                              <h3>{party.title}</h3>
                              <label className="party-check">
                                <input
                                  type="checkbox"
                                  checked={party.enabled}
                                  onChange={(event) => updateRelatedParty(key, { enabled: event.target.checked })}
                                />
                                計画書に反映する
                              </label>
                            </div>
                            <div className="field-grid">
                              <label className="field span-2">
                                <span>会社テンプレート（選択すると自動反映）</span>
                                <select
                                  className="control"
                                  value={partyTemplateSelections[key]}
                                  onChange={(event) => applyRelatedPartyCompanyTemplate(key, event.target.value)}
                                >
                                  <option value="">テンプレートを選択（任意）</option>
                                  {companyTemplateOptions.map((template) => (
                                    <option key={`party_company_template_${key}_${template.id}`} value={template.id}>
                                      {template.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <div className="inline-row wrap span-2 party-company-template-actions">
                                <button
                                  type="button"
                                  className="btn btn-subtle"
                                  onClick={() => saveRelatedPartyCompanyTemplate(key)}
                                  disabled={!canEdit}
                                >
                                  <span className="btn-icon"><UiIcon name="save" /></span>
                                  この内容をテンプレート登録
                                </button>
                              </div>
                              <label className="field"><span>見出し</span><input className="control" value={party.title} onChange={(event) => updateRelatedParty(key, { title: event.target.value })} /></label>
                              <label className="field"><span>会社名 / 表示名</span><input data-required-key={`relatedPartyCompany:${key}`} className={`control ${party.enabled && !party.company.trim() ? "control-missing" : ""}`} value={party.company} onChange={(event) => updateRelatedParty(key, { company: event.target.value })} /></label>
                              <label className="field"><span>担当者</span><input className="control" value={party.person} onChange={(event) => updateRelatedParty(key, { person: event.target.value })} /></label>
                              <label className="field"><span>部署・事業所</span><input className="control" value={party.office} onChange={(event) => updateRelatedParty(key, { office: event.target.value })} /></label>
                              <label className="field span-2"><span>電話番号（TEL）</span><input className="control" value={party.tel} onChange={(event) => updateRelatedParty(key, { tel: event.target.value })} /></label>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="panel page-card" id="card-pdf7">
          <div className="page-card-head">
            <p className="page-card-index">PDF 7</p>
            <div>
              <h2>配置図・写真アップロード</h2>
              <p className="mini">配置図上段 + 写真A〜D（PDF7専用）が反映されます</p>
            </div>
          </div>
          <CardPreview title="PDF7 配置図・写真">
            <article className="preview-page">
              <h3>【工事車両、作業場所等の配置図】</h3>
              <div className="preview-layout-photo">
                <LayoutAnnotatedImage
                  imageUrl={selectedProject.layoutImageDataUrl}
                  annotations={selectedProject.layoutAnnotations}
                  alt="配置図プレビュー"
                />
              </div>
              <div className="preview-photo-grid">
                {layoutPhotosFilled.slice(0, 4).map((slot) => (
                  <figure key={`preview_pdf7_photo_${slot.id}`} className="preview-photo-item">
                    <div>
                      {slot.dataUrl ? (
                        <LayoutAnnotatedImage imageUrl={slot.dataUrl} annotations={slot.layoutAnnotations || []} alt={slot.label} />
                      ) : (
                        <span>写真未設定</span>
                      )}
                    </div>
                    <figcaption>{slot.label}</figcaption>
                  </figure>
                ))}
                {!layoutPhotosFilled.length ? (
                  <figure className="preview-photo-item">
                    <div><span>写真が未設定です</span></div>
                    <figcaption>写真を追加するとここに表示されます</figcaption>
                  </figure>
                ) : null}
              </div>
            </article>
          </CardPreview>
          <article className={`photo-card ${requiredMissingMap.layoutAssets ? "required-missing-block" : ""}`} data-required-key="layoutAssets">
            <p className="mini">配置図画像（PDFの「工事車両、作業場所等の配置図」上段）</p>
            <UploadDropZone
              imageUrl={selectedProject.layoutImageDataUrl}
              annotations={selectedProject.layoutAnnotations}
              alt="配置図画像"
              onFileSelect={replaceLayoutImage}
              onFileDrop={applyLayoutImageFile}
              onDeleteImage={() =>
                updateSelectedProject(
                  (project) => ({ ...project, layoutImageDataUrl: "", layoutAnnotations: [], layoutAnnotationsV2: [] }),
                  { action: "layout_image_replace", detail: "配置図画像を削除（注釈を初期化）" },
                )
              }
            />
            <div className="inline-row photo-card-actions">
              <button type="button" className="btn btn-subtle" onClick={openLayoutAnnotationEditor} disabled={!canEdit || !selectedProject.layoutImageDataUrl}>
                画像編集
              </button>
              <button
                type="button"
                className="btn btn-subtle"
                onClick={() =>
                  updateSelectedProject(
                    (project) => ({ ...project, layoutAnnotations: [], layoutAnnotationsV2: [] }),
                    { action: "layout_annotation_save", detail: "配置図注釈をクリア" },
                  )
                }
                disabled={!canEdit || selectedProject.layoutAnnotations.length === 0}
              >
                画像編集クリア
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() =>
                  updateSelectedProject(
                    (project) => ({ ...project, layoutImageDataUrl: "", layoutAnnotations: [], layoutAnnotationsV2: [] }),
                    { action: "layout_image_replace", detail: "配置図画像を削除（注釈を初期化）" },
                  )
                }
              >
                <span className="btn-icon"><UiIcon name="delete" /></span>削除
              </button>
            </div>
          </article>
          <div className="photo-slider-nav">
            <button type="button" className="btn btn-subtle" onClick={() => addPhotoItem("layoutPhotos")}><span className="btn-icon"><UiIcon name="photo" /></span>写真ページ追加</button>
            <div className="inline-row">
              <button type="button" className="btn btn-subtle" onClick={() => setLayoutPhotoSlide((prev) => Math.max(0, prev - 1))} disabled={layoutPhotoSlide <= 0}><span className="btn-icon"><UiIcon name="arrowLeft" /></span>前</button>
              <span className="mini">{layoutPhotoSlide + 1} / {totalLayoutPhotoSlides}</span>
              <button type="button" className="btn btn-subtle" onClick={() => setLayoutPhotoSlide((prev) => Math.min(totalLayoutPhotoSlides - 1, prev + 1))} disabled={layoutPhotoSlide >= totalLayoutPhotoSlides - 1}><span className="btn-icon"><UiIcon name="arrowRight" /></span>次</button>
            </div>
          </div>
          <div className={`photo-slider-window ${requiredMissingMap.layoutAssets ? "required-missing-block" : ""}`}>
            <div className="photo-slide-grid pair">
              {currentLayoutSlidePhotos.map((slot) => (
                <article key={`layout_card_photo_${slot.id}`} className="photo-card">
                  <input className="control" value={slot.label} onChange={(event) => updatePhotoItem("layoutPhotos", slot.id, { label: event.target.value })} />
                  <UploadDropZone
                    imageUrl={slot.dataUrl}
                    annotations={slot.layoutAnnotations || []}
                    alt={slot.label}
                    onFileSelect={(event) => replacePhoto("layoutPhotos", slot.id, event)}
                    onFileDrop={(file) => applyPhotoFile("layoutPhotos", slot.id, file)}
                    onDeleteImage={() => clearPhotoImage("layoutPhotos", slot.id)}
                  />
                  <div className="inline-row photo-card-actions">
                    <button type="button" className="btn btn-subtle" onClick={() => openPhotoAnnotationEditor("layoutPhotos", slot.id)} disabled={!canEdit || !slot.dataUrl}>画像編集</button>
                    <button type="button" className="btn btn-subtle" onClick={() => clearPhotoAnnotations("layoutPhotos", slot.id)} disabled={!canEdit || (slot.layoutAnnotations?.length || 0) === 0}><span className="btn-icon"><UiIcon name="clear" /></span>画像編集クリア</button>
                    <button type="button" className="btn btn-danger" onClick={() => removePhotoItem("layoutPhotos", slot.id)}><span className="btn-icon"><UiIcon name="delete" /></span>削除</button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
        </>
        ) : null}

      </main>

      {isEditorMode && layoutEditorOpen ? (
      <section className="annotation-editor-backdrop" role="dialog" aria-modal="true" aria-label="画像注釈エディタ">
        <article className="annotation-editor-panel">
          <div className="annotation-editor-head">
            <div>
              <h3>{layoutEditorTarget ? `${layoutEditorTarget.label} 注釈エディタ` : "画像 注釈エディタ"}</h3>
              <p className="mini">線・四角形・折れ線・テキストを追加し、保存後に再編集できます（線種で矢印も選択可）。</p>
            </div>
            <div className="inline-row">
              <button type="button" className="btn btn-subtle" onClick={closeLayoutAnnotationEditor}>閉じる</button>
              <button type="button" className="btn btn-accent" onClick={saveLayoutAnnotationEditor}>保存</button>
            </div>
          </div>
          <div className="annotation-toolbar-shell">
            <div className="annotation-toolbar-row annotation-toolbar-row-tools">
              <div className="annotation-tool-dock" role="toolbar" aria-label="描画ツール">
                <button type="button" className={`btn btn-subtle annotation-tool-btn ${layoutEditorTool === "select" ? "is-active" : ""}`} onClick={() => activateLayoutTool("select")}><span className="btn-icon"><UiIcon name="cursor" /></span>選択</button>
                <button type="button" className={`btn btn-subtle annotation-tool-btn ${layoutEditorTool === "arrow" ? "is-active" : ""}`} onClick={activateLineTool}><span className="btn-icon"><UiIcon name="shapeLine" /></span>線</button>
                <button type="button" className={`btn btn-subtle annotation-tool-btn ${layoutEditorTool === "rect" ? "is-active" : ""}`} onClick={() => activateLayoutTool("rect")}><span className="btn-icon"><UiIcon name="shapeRect" /></span>四角形</button>
                <button type="button" className={`btn btn-subtle annotation-tool-btn ${layoutEditorTool === "chain" ? "is-active" : ""}`} onClick={activateChainTool}><span className="btn-icon"><UiIcon name="shapeLine" /></span>折れ線</button>
                <button type="button" className={`btn btn-subtle annotation-tool-btn ${layoutEditorTool === "text" ? "is-active" : ""}`} onClick={() => activateLayoutTool("text")}><span className="btn-icon"><UiIcon name="shapeText" /></span>テキスト</button>
              </div>
              <div className="annotation-tool-dock annotation-action-dock" role="toolbar" aria-label="履歴操作">
                <button type="button" className="btn btn-subtle" onClick={undoLayoutEditor} disabled={!canUndoLayoutEditor}><span className="btn-icon"><UiIcon name="undo" /></span>戻す</button>
                <button type="button" className="btn btn-subtle" onClick={redoLayoutEditor} disabled={!canRedoLayoutEditor}><span className="btn-icon"><UiIcon name="history" /></span>やり直し</button>
                <button type="button" className="btn btn-subtle" onClick={duplicateSelectedLayoutAnnotation} disabled={!layoutEditorSelectedIds.length}><span className="btn-icon"><UiIcon name="copy" /></span>複製</button>
                <button type="button" className="btn btn-danger" onClick={removeSelectedLayoutAnnotation} disabled={!layoutEditorSelectedIds.length}><span className="btn-icon"><UiIcon name="delete" /></span>削除</button>
              </div>
              <div className="annotation-tool-dock annotation-zoom-dock" aria-label="キャンバスズーム">
                <button type="button" className="btn btn-subtle" onClick={zoomOutLayoutEditor}>−</button>
                <span className="mini">{layoutEditorZoomPercent}%</span>
                <button type="button" className="btn btn-subtle" onClick={zoomInLayoutEditor}>＋</button>
                <button type="button" className="btn btn-subtle" onClick={setLayoutEditorActualSize}>100%</button>
              </div>
            </div>
            <div className="annotation-toolbar-row annotation-toolbar-row-style">
              <label className="field-inline">
                <span>{layoutEditorTool === "text" || selectedLayoutAnnotation?.type === "text" ? "文字色" : "線色"}</span>
                <input
                  type="color"
                  value={layoutEditorColor}
                  onChange={(event) => {
                    const nextColor = normalizeAnnotationColor(event.target.value);
                    setLayoutEditorColor(nextColor);
                    if (selectedLayoutAnnotation?.type === "text") {
                      updateLayoutEditorAnnotation(selectedLayoutAnnotation.id, { color: nextColor });
                    }
                  }}
                />
              </label>
              <label className="field-inline">
                <span>太さ {layoutEditorStrokeWidth}px</span>
                <input
                  type="range"
                  min={1}
                  max={16}
                  value={layoutEditorStrokeWidth}
                  onChange={(event) => setLayoutEditorStrokeWidth(Number(event.target.value))}
                />
              </label>
              {(layoutEditorTool === "rect" || selectedLayoutAnnotation?.type === "rect" || selectedLayoutAnnotation?.type === "polygon") ? (
                <>
                  <label className="field-inline">
                    <span>塗り</span>
                    <input type="color" value={layoutEditorFillColor} onChange={(event) => setLayoutEditorFillColor(event.target.value)} />
                  </label>
                  <label className="field-inline">
                    <span>透明度 {Math.round(layoutEditorFillOpacity * 100)}%</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={layoutEditorFillOpacity}
                      onChange={(event) => setLayoutEditorFillOpacity(normalizeFillOpacity(event.target.value))}
                    />
                  </label>
                </>
              ) : null}
              {selectedLayoutAnnotation?.type === "polygon" ? (
                <label className="field-inline">
                  <span>辺数</span>
                  <input
                    className="control"
                    type="number"
                    min={3}
                    max={12}
                    value={selectedLayoutAnnotation?.type === "polygon" ? selectedLayoutAnnotation.sides : layoutEditorPolygonSides}
                    onChange={(event) => {
                      const nextSides = normalizePolygonSides(event.target.value, 6);
                      setLayoutEditorPolygonSides(nextSides);
                      if (selectedLayoutAnnotation?.type === "polygon") {
                        updateLayoutEditorAnnotation(selectedLayoutAnnotation.id, { sides: nextSides });
                      }
                    }}
                  />
                </label>
              ) : null}
              {layoutEditorTool === "arrow" || selectedLayoutAnnotation?.type === "arrow" ? (
                <label className="field-inline">
                  <span>線種</span>
                  <select
                    className="control"
                    value={(selectedLayoutAnnotation?.type === "arrow" ? selectedLayoutAnnotation.arrowHead !== false : layoutEditorArrowHeadEnabled) ? "arrow" : "line"}
                    onChange={(event) => {
                      const nextArrowHead = event.target.value === "arrow";
                      setLayoutEditorArrowHeadEnabled(nextArrowHead);
                      if (selectedLayoutAnnotation?.type === "arrow") {
                        updateLayoutEditorAnnotation(selectedLayoutAnnotation.id, { arrowHead: nextArrowHead });
                      }
                    }}
                  >
                    <option value="line">線（矢印なし）</option>
                    <option value="arrow">矢印</option>
                  </select>
                </label>
              ) : null}
              {layoutEditorTool === "text" || selectedLayoutAnnotation?.type === "text" ? (
                <>
                  <label className="field-inline field-inline-wide">
                    <span>{selectedLayoutAnnotation?.type === "text" ? "選択テキスト" : "追加テキスト"}</span>
                    <textarea
                      className="control"
                      rows={3}
                      spellCheck={false}
                      value={selectedLayoutAnnotation?.type === "text" ? selectedLayoutAnnotation.text : layoutEditorText}
                      onChange={(event) => {
                        if (selectedLayoutAnnotation?.type === "text") {
                          updateLayoutEditorAnnotation(selectedLayoutAnnotation.id, { text: event.target.value });
                        } else {
                          setLayoutEditorText(event.target.value);
                        }
                      }}
                    />
                  </label>
                  <label className="field-inline">
                    <span>フォント</span>
                    <select
                      className="control"
                      value={selectedLayoutAnnotation?.type === "text" ? selectedLayoutAnnotation.fontFamily : layoutEditorFontFamily}
                      onChange={(event) => {
                        const nextFamily = normalizeFontFamily(event.target.value);
                        setLayoutEditorFontFamily(nextFamily);
                        if (selectedLayoutAnnotation?.type === "text") {
                          updateLayoutEditorAnnotation(selectedLayoutAnnotation.id, { fontFamily: nextFamily });
                        }
                      }}
                    >
                      {LAYOUT_TEXT_FONT_OPTIONS.map((option) => (
                        <option key={`text_font_primary_${option.value}`} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field-inline">
                    <span>縁色</span>
                    <input
                      type="color"
                      value={selectedLayoutAnnotation?.type === "text" ? selectedLayoutAnnotation.textStrokeColor : layoutEditorTextStrokeColor}
                      onChange={(event) => {
                        const nextColor = normalizeAnnotationColor(event.target.value);
                        setLayoutEditorTextStrokeColor(nextColor);
                        if (selectedLayoutAnnotation?.type === "text") {
                          updateLayoutEditorAnnotation(selectedLayoutAnnotation.id, { textStrokeColor: nextColor });
                        }
                      }}
                    />
                  </label>
                  <label className="field-inline">
                    <span>縁 {selectedLayoutAnnotation?.type === "text" ? selectedLayoutAnnotation.textStrokeWidth : layoutEditorTextStrokeWidth}px</span>
                    <input
                      type="range"
                      min={0}
                      max={12}
                      value={selectedLayoutAnnotation?.type === "text" ? selectedLayoutAnnotation.textStrokeWidth : layoutEditorTextStrokeWidth}
                      onChange={(event) => {
                        const nextWidth = normalizeTextStrokeWidth(event.target.value, DEFAULT_TEXT_STROKE_WIDTH);
                        setLayoutEditorTextStrokeWidth(nextWidth);
                        if (selectedLayoutAnnotation?.type === "text") {
                          updateLayoutEditorAnnotation(selectedLayoutAnnotation.id, { textStrokeWidth: nextWidth });
                        }
                      }}
                    />
                  </label>
                  {selectedLayoutAnnotation?.type === "text" ? (
                    <label className="field-inline">
                      <span>文字 {selectedLayoutAnnotation.fontSize}px</span>
                      <input
                        type="range"
                        min={10}
                        max={72}
                        value={selectedLayoutAnnotation.fontSize}
                        onChange={(event) => updateLayoutEditorAnnotation(selectedLayoutAnnotation.id, { fontSize: Number(event.target.value) })}
                      />
                    </label>
                  ) : null}
                </>
              ) : null}
              <button type="button" className="btn btn-subtle" onClick={applyEditorStyleToSelectedAnnotation} disabled={!layoutEditorSelectedIds.length}>
                <span className="btn-icon"><UiIcon name="apply" /></span>選択要素に適用
              </button>
            </div>
          </div>
          <p className="annotation-simple-guide">
            かんたん操作: ① 上のツールを選ぶ ② 図面をドラッグ/クリック ③ 追加後はそのまま移動・拡大縮小 ④ 保存
          </p>
          <p className="annotation-shortcut-hint">
            ショートカット: 矢印キー=移動 / Shift+矢印=10px / Cmd(Ctrl)+D=複製 / Esc=選択解除・折れ線終了
          </p>
          <details
            className="annotation-advanced-panel"
            open={layoutEditorAdvancedOpen}
            onToggle={(event) => setLayoutEditorAdvancedOpen(event.currentTarget.open)}
          >
            <summary>
              詳細編集（必要なときだけ開く）
              <span className={`annotation-advanced-status ${hasLayoutSelection ? "is-ready" : "is-empty"}`}>
                {hasLayoutSelection ? `選択 ${layoutEditorSelectedIds.length}` : "未選択"}
              </span>
            </summary>
            {!hasLayoutSelection ? (
              <p className="annotation-advanced-empty">図形を選択すると、回転・座標・整列・レイヤー順などの詳細操作が表示されます。</p>
            ) : (
              <>
                <div className="annotation-advanced-tabs" role="tablist" aria-label="詳細編集カテゴリ">
                  <button
                    type="button"
                    className={`btn btn-subtle ${layoutEditorAdvancedTab === "transform" ? "is-active" : ""}`}
                    onClick={() => setLayoutEditorAdvancedTab("transform")}
                  >
                    位置
                  </button>
                  <button
                    type="button"
                    className={`btn btn-subtle ${layoutEditorAdvancedTab === "style" ? "is-active" : ""}`}
                    onClick={() => setLayoutEditorAdvancedTab("style")}
                  >
                    見た目
                  </button>
                  <button
                    type="button"
                    className={`btn btn-subtle ${layoutEditorAdvancedTab === "arrange" ? "is-active" : ""}`}
                    onClick={() => setLayoutEditorAdvancedTab("arrange")}
                  >
                    整列
                  </button>
                </div>
                <p className="annotation-tab-help">
                  {layoutEditorAdvancedTab === "transform"
                    ? "位置タブ: 図形の場所・サイズ・回転を数値で調整できます。ズレを正確に直したいときに使います。"
                    : layoutEditorAdvancedTab === "style"
                      ? "見た目タブ: 線色・太さ・塗り・文字サイズを変更できます。見やすさを整えるときに使います。"
                      : "整列タブ: 複数図形の前後順・整列・等間隔をまとめて調整できます。レイアウトを揃えるときに使います。"}
                </p>
                <div className="annotation-editor-toolbar">
                  <div className="annotation-tool-group">
                    <button type="button" className={`btn btn-subtle ${layoutEditorTool === "select" ? "is-active" : ""}`} onClick={() => activateLayoutTool("select")}>選択</button>
                    <button type="button" className={`btn btn-subtle ${layoutEditorTool === "arrow" ? "is-active" : ""}`} onClick={activateLineTool}>線</button>
                    <button type="button" className={`btn btn-subtle ${layoutEditorTool === "rect" ? "is-active" : ""}`} onClick={() => activateLayoutTool("rect")}>四角形</button>
                    <button type="button" className={`btn btn-subtle ${layoutEditorTool === "chain" ? "is-active" : ""}`} onClick={activateChainTool}>折れ線</button>
                    <button type="button" className={`btn btn-subtle ${layoutEditorTool === "text" ? "is-active" : ""}`} onClick={() => activateLayoutTool("text")}>テキスト</button>
                  </div>
                  {layoutEditorAdvancedTab === "transform" ? (
                    <div className="annotation-zoom-group" aria-label="キャンバスズーム">
                      <button type="button" className="btn btn-subtle" onClick={zoomOutLayoutEditor}>−</button>
                      <input
                        type="range"
                        min={0.25}
                        max={4}
                        step={0.05}
                        value={layoutEditorZoom}
                        onChange={(event) => setLayoutEditorZoomLevel(parseNumericInput(event.target.value, layoutEditorZoom))}
                      />
                      <button type="button" className="btn btn-subtle" onClick={zoomInLayoutEditor}>＋</button>
                      <span className="mini">{layoutEditorZoomPercent}%</span>
                      <button type="button" className="btn btn-subtle" onClick={setLayoutEditorActualSize}>100%</button>
                    </div>
                  ) : null}
                  {layoutEditorAdvancedTab === "style" ? (
                    <>
                      <label className="field-inline">
                        <span>線色</span>
                        <input type="color" value={layoutEditorColor} onChange={(event) => setLayoutEditorColor(event.target.value)} />
                      </label>
                      <label className="field-inline">
                        <span>太さ</span>
                        <input
                          type="range"
                          min={1}
                          max={16}
                          value={layoutEditorStrokeWidth}
                          onChange={(event) => setLayoutEditorStrokeWidth(Number(event.target.value))}
                        />
                      </label>
                      <label className="field-inline">
                        <span>塗り</span>
                        <input type="color" value={layoutEditorFillColor} onChange={(event) => setLayoutEditorFillColor(event.target.value)} />
                      </label>
                      <label className="field-inline">
                        <span>塗り透明</span>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={layoutEditorFillOpacity}
                          onChange={(event) => setLayoutEditorFillOpacity(normalizeFillOpacity(event.target.value))}
                        />
                      </label>
                      {layoutEditorTool === "arrow" || selectedLayoutAnnotation?.type === "arrow" ? (
                        <label className="field-inline">
                          <span>線種</span>
                          <select
                            className="control"
                            value={(selectedLayoutAnnotation?.type === "arrow" ? selectedLayoutAnnotation.arrowHead !== false : layoutEditorArrowHeadEnabled) ? "arrow" : "line"}
                            onChange={(event) => {
                              const nextArrowHead = event.target.value === "arrow";
                              setLayoutEditorArrowHeadEnabled(nextArrowHead);
                              if (selectedLayoutAnnotation?.type === "arrow") {
                                updateLayoutEditorAnnotation(selectedLayoutAnnotation.id, { arrowHead: nextArrowHead });
                              }
                            }}
                          >
                            <option value="line">線（矢印なし）</option>
                            <option value="arrow">矢印</option>
                          </select>
                        </label>
                      ) : null}
                      {selectedLayoutAnnotation?.type === "polygon" ? (
                        <label className="field-inline">
                          <span>辺数</span>
                          <input
                            className="control"
                            type="number"
                            min={3}
                            max={12}
                            value={layoutEditorPolygonSides}
                            onChange={(event) => setLayoutEditorPolygonSides(normalizePolygonSides(event.target.value, 6))}
                          />
                        </label>
                      ) : null}
                      <label className="field-inline field-inline-wide">
                        <span>追加テキスト</span>
                        <textarea
                          className="control"
                          rows={3}
                          spellCheck={false}
                          value={layoutEditorText}
                          onChange={(event) => setLayoutEditorText(event.target.value)}
                        />
                      </label>
                      <button type="button" className="btn btn-subtle" onClick={applyEditorStyleToSelectedAnnotation} disabled={!layoutEditorSelectedIds.length}>
                        選択要素にスタイル適用
                      </button>
                    </>
                  ) : null}
                  {layoutEditorAdvancedTab === "arrange" ? (
                    <>
                      <button type="button" className="btn btn-subtle" onClick={duplicateSelectedLayoutAnnotation} disabled={!layoutEditorSelectedIds.length}>
                        複製
                      </button>
                      <button type="button" className="btn btn-subtle" onClick={undoLayoutEditor} disabled={!canUndoLayoutEditor}>
                        元に戻す
                      </button>
                      <button type="button" className="btn btn-subtle" onClick={redoLayoutEditor} disabled={!canRedoLayoutEditor}>
                        やり直し
                      </button>
                      {layoutEditorSelectedIds.length ? (
                        <div className="annotation-layer-order-group">
                          <button type="button" className="btn btn-subtle" onClick={() => reorderSelectedLayers("front")}>最前面</button>
                          <button type="button" className="btn btn-subtle" onClick={() => reorderSelectedLayers("forward")}>前へ</button>
                          <button type="button" className="btn btn-subtle" onClick={() => reorderSelectedLayers("backward")}>後へ</button>
                          <button type="button" className="btn btn-subtle" onClick={() => reorderSelectedLayers("back")}>最背面</button>
                        </div>
                      ) : null}
                      {selectedLayoutAnnotations.length >= 2 ? (
                        <div className="annotation-align-group">
                          <button type="button" className="btn btn-subtle" onClick={() => alignSelectedLayoutAnnotations("left")}>左</button>
                          <button type="button" className="btn btn-subtle" onClick={() => alignSelectedLayoutAnnotations("center")}>中</button>
                          <button type="button" className="btn btn-subtle" onClick={() => alignSelectedLayoutAnnotations("right")}>右</button>
                          <button type="button" className="btn btn-subtle" onClick={() => alignSelectedLayoutAnnotations("top")}>上</button>
                          <button type="button" className="btn btn-subtle" onClick={() => alignSelectedLayoutAnnotations("middle")}>中央</button>
                          <button type="button" className="btn btn-subtle" onClick={() => alignSelectedLayoutAnnotations("bottom")}>下</button>
                          <button type="button" className="btn btn-subtle" onClick={() => distributeSelectedLayoutAnnotations("horizontal")} disabled={selectedEditableLayoutAnnotations.length < 3}>等間隔H</button>
                          <button type="button" className="btn btn-subtle" onClick={() => distributeSelectedLayoutAnnotations("vertical")} disabled={selectedEditableLayoutAnnotations.length < 3}>等間隔V</button>
                        </div>
                      ) : null}
                      <button type="button" className="btn btn-danger" onClick={removeSelectedLayoutAnnotation} disabled={!layoutEditorSelectedIds.length}>
                        選択削除
                      </button>
                      <button type="button" className="btn btn-subtle" onClick={clearLayoutAnnotationsInEditor} disabled={layoutEditorAnnotations.length === 0}>
                        全削除
                      </button>
                    </>
                  ) : null}
                </div>
                <p className="annotation-shortcut-hint">
                  ショートカット: 矢印=移動 / Shift+矢印=10px移動 / Cmd(Ctrl)+D=複製 / Cmd(Ctrl)+A=全選択 / Esc=解除
                </p>
                {layoutEditorAdvancedTab === "style" && selectedLayoutAnnotation?.type === "text" ? (
                  <div className="annotation-editor-text-row">
                    <label className="field-inline field-inline-wide">
                      <span>選択テキスト</span>
                      <textarea
                        className="control"
                        value={selectedLayoutAnnotation.text}
                        onChange={(event) => updateLayoutEditorAnnotation(selectedLayoutAnnotation.id, { text: event.target.value })}
                      />
                    </label>
                    <label className="field-inline">
                      <span>文字色</span>
                      <input
                        type="color"
                        value={selectedLayoutAnnotation.color}
                        onChange={(event) => {
                          updateLayoutEditorAnnotation(selectedLayoutAnnotation.id, { color: event.target.value });
                          setLayoutEditorColor(event.target.value);
                        }}
                      />
                    </label>
                    <label className="field-inline">
                      <span>フォント</span>
                      <select
                        className="control"
                        value={selectedLayoutAnnotation.fontFamily}
                        onChange={(event) => {
                          const nextFamily = normalizeFontFamily(event.target.value);
                          updateLayoutEditorAnnotation(selectedLayoutAnnotation.id, { fontFamily: nextFamily });
                          setLayoutEditorFontFamily(nextFamily);
                        }}
                      >
                        {LAYOUT_TEXT_FONT_OPTIONS.map((option) => (
                          <option key={`text_font_advanced_${option.value}`} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field-inline">
                      <span>縁色</span>
                      <input
                        type="color"
                        value={selectedLayoutAnnotation.textStrokeColor}
                        onChange={(event) => {
                          const nextColor = normalizeAnnotationColor(event.target.value);
                          updateLayoutEditorAnnotation(selectedLayoutAnnotation.id, { textStrokeColor: nextColor });
                          setLayoutEditorTextStrokeColor(nextColor);
                        }}
                      />
                    </label>
                    <label className="field-inline">
                      <span>縁太さ</span>
                      <input
                        className="control"
                        type="number"
                        min={0}
                        max={12}
                        value={selectedLayoutAnnotation.textStrokeWidth}
                        onChange={(event) => {
                          const nextWidth = normalizeTextStrokeWidth(
                            parseNumericInput(event.target.value, selectedLayoutAnnotation.textStrokeWidth),
                            selectedLayoutAnnotation.textStrokeWidth,
                          );
                          updateLayoutEditorAnnotation(selectedLayoutAnnotation.id, { textStrokeWidth: nextWidth });
                          setLayoutEditorTextStrokeWidth(nextWidth);
                        }}
                      />
                    </label>
                    <label className="field-inline">
                      <span>文字サイズ</span>
                      <input
                        type="range"
                        min={10}
                        max={72}
                        value={selectedLayoutAnnotation.fontSize}
                        onChange={(event) => updateLayoutEditorAnnotation(selectedLayoutAnnotation.id, { fontSize: Number(event.target.value) })}
                      />
                    </label>
                    <label className="field-inline">
                      <span>太さ</span>
                      <select
                        className="control"
                        value={selectedLayoutAnnotation.fontWeight}
                        onChange={(event) => updateLayoutEditorAnnotation(selectedLayoutAnnotation.id, { fontWeight: Number(event.target.value) })}
                      >
                        <option value={400}>400</option>
                        <option value={500}>500</option>
                        <option value={700}>700</option>
                        <option value={900}>900</option>
                      </select>
                    </label>
                    <label className="field-inline">
                      <span>揃え</span>
                      <select
                        className="control"
                        value={selectedLayoutAnnotation.textAlign}
                        onChange={(event) => updateLayoutEditorAnnotation(selectedLayoutAnnotation.id, { textAlign: normalizeTextAlign(event.target.value) })}
                      >
                        <option value="left">左揃え</option>
                        <option value="center">中央</option>
                        <option value="right">右揃え</option>
                      </select>
                    </label>
                  </div>
                ) : null}
                {layoutEditorAdvancedTab === "transform" && selectedLayoutAnnotations.length > 1 && selectedEditableLayoutGroupBounds ? (
                  <div className="annotation-editor-text-row">
                    <label className="field-inline"><span>Group X</span><input className="control" type="number" value={Math.round(selectedEditableLayoutGroupBounds.x)} onChange={(event) => moveSelectedGroupTo(clampCanvasCoord(parseNumericInput(event.target.value, selectedEditableLayoutGroupBounds.x)), selectedEditableLayoutGroupBounds.y)} /></label>
                    <label className="field-inline"><span>Group Y</span><input className="control" type="number" value={Math.round(selectedEditableLayoutGroupBounds.y)} onChange={(event) => moveSelectedGroupTo(selectedEditableLayoutGroupBounds.x, clampCanvasCoord(parseNumericInput(event.target.value, selectedEditableLayoutGroupBounds.y)))} /></label>
                    <label className="field-inline"><span>Group W</span><input className="control" type="number" value={Math.round(selectedEditableLayoutGroupBounds.width)} onChange={(event) => resizeSelectedGroupTo(parseNumericInput(event.target.value, selectedEditableLayoutGroupBounds.width), selectedEditableLayoutGroupBounds.height)} /></label>
                    <label className="field-inline"><span>Group H</span><input className="control" type="number" value={Math.round(selectedEditableLayoutGroupBounds.height)} onChange={(event) => resizeSelectedGroupTo(selectedEditableLayoutGroupBounds.width, parseNumericInput(event.target.value, selectedEditableLayoutGroupBounds.height))} /></label>
                    <button type="button" className="btn btn-subtle" onClick={() => rotateSelectedGroupBy(-15)} disabled={selectedEditableLayoutAnnotations.length < 2}>-15°</button>
                    <button type="button" className="btn btn-subtle" onClick={() => rotateSelectedGroupBy(15)} disabled={selectedEditableLayoutAnnotations.length < 2}>+15°</button>
                  </div>
                ) : null}
                {layoutEditorAdvancedTab === "arrange" && selectedLayoutAnnotation ? (
                  <div className="annotation-editor-text-row">
                    <label className="field-inline field-inline-wide">
                      <span>レイヤー名</span>
                      <input
                        className="control"
                        value={selectedLayoutAnnotation.name || ""}
                        onChange={(event) => renameLayoutAnnotation(selectedLayoutAnnotation.id, event.target.value)}
                      />
                    </label>
                    <label className="field-inline">
                      <span>表示</span>
                      <input
                        type="checkbox"
                        checked={selectedLayoutAnnotation.visible !== false}
                        onChange={(event) => setLayoutAnnotationVisibility(selectedLayoutAnnotation.id, event.target.checked)}
                      />
                    </label>
                    <label className="field-inline">
                      <span>ロック</span>
                      <input
                        type="checkbox"
                        checked={selectedLayoutAnnotation.locked === true}
                        onChange={(event) => setLayoutAnnotationLocked(selectedLayoutAnnotation.id, event.target.checked)}
                      />
                    </label>
                  </div>
                ) : null}
                {layoutEditorAdvancedTab === "transform" && selectedLayoutAnnotation ? (
                  <div className="annotation-editor-text-row">
              <label className="field-inline">
                <span>回転</span>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  value={selectedLayoutAnnotation.rotation ?? 0}
                  onChange={(event) => setSelectedAnnotationRotation(parseNumericInput(event.target.value, selectedLayoutAnnotation.rotation ?? 0))}
                />
              </label>
              <label className="field-inline">
                <span>角度</span>
                <input
                  className="control"
                  type="number"
                  value={Math.round(selectedLayoutAnnotation.rotation ?? 0)}
                  onChange={(event) => setSelectedAnnotationRotation(parseNumericInput(event.target.value, selectedLayoutAnnotation.rotation ?? 0))}
                />
              </label>
              <button type="button" className="btn btn-subtle" onClick={() => setSelectedAnnotationRotation(0)}>
                回転リセット
              </button>
              {selectedLayoutAnnotation.type === "rect" || selectedLayoutAnnotation.type === "polygon" ? (
                <>
                  <label className="field-inline"><span>X</span><input className="control" type="number" value={Math.round(selectedLayoutAnnotation.x)} onChange={(event) => updateLayoutEditorAnnotation(selectedLayoutAnnotation.id, { x: clampCanvasCoord(parseNumericInput(event.target.value, selectedLayoutAnnotation.x)) })} /></label>
                  <label className="field-inline"><span>Y</span><input className="control" type="number" value={Math.round(selectedLayoutAnnotation.y)} onChange={(event) => updateLayoutEditorAnnotation(selectedLayoutAnnotation.id, { y: clampCanvasCoord(parseNumericInput(event.target.value, selectedLayoutAnnotation.y)) })} /></label>
                  <label className="field-inline"><span>W</span><input className="control" type="number" value={Math.round(selectedLayoutAnnotation.width)} onChange={(event) => updateLayoutEditorAnnotation(selectedLayoutAnnotation.id, { width: clamp(parseNumericInput(event.target.value, selectedLayoutAnnotation.width), 8, LAYOUT_CANVAS_SIZE) })} /></label>
                  <label className="field-inline"><span>H</span><input className="control" type="number" value={Math.round(selectedLayoutAnnotation.height)} onChange={(event) => updateLayoutEditorAnnotation(selectedLayoutAnnotation.id, { height: clamp(parseNumericInput(event.target.value, selectedLayoutAnnotation.height), 8, LAYOUT_CANVAS_SIZE) })} /></label>
                  <label className="field-inline"><span>線幅</span><input className="control" type="number" min={1} max={16} value={selectedLayoutAnnotation.strokeWidth} onChange={(event) => updateLayoutEditorAnnotation(selectedLayoutAnnotation.id, { strokeWidth: normalizeStrokeWidth(parseNumericInput(event.target.value, selectedLayoutAnnotation.strokeWidth), selectedLayoutAnnotation.strokeWidth) })} /></label>
                  <label className="field-inline"><span>塗り色</span><input type="color" value={selectedLayoutAnnotation.fillColor || DEFAULT_ANNOTATION_FILL_COLOR} onChange={(event) => updateLayoutEditorAnnotation(selectedLayoutAnnotation.id, { fillColor: event.target.value })} /></label>
                  <label className="field-inline"><span>塗り透明</span><input className="control" type="number" min={0} max={1} step={0.05} value={selectedLayoutAnnotation.fillOpacity ?? 0} onChange={(event) => updateLayoutEditorAnnotation(selectedLayoutAnnotation.id, { fillOpacity: normalizeFillOpacity(parseNumericInput(event.target.value, selectedLayoutAnnotation.fillOpacity ?? 0)) })} /></label>
                  {selectedLayoutAnnotation.type === "polygon" ? (
                    <label className="field-inline"><span>辺数</span><input className="control" type="number" min={3} max={12} value={selectedLayoutAnnotation.sides} onChange={(event) => updateLayoutEditorAnnotation(selectedLayoutAnnotation.id, { sides: normalizePolygonSides(parseNumericInput(event.target.value, selectedLayoutAnnotation.sides), selectedLayoutAnnotation.sides) })} /></label>
                  ) : null}
                </>
              ) : null}
              {selectedLayoutAnnotation.type === "arrow" ? (
                <>
                  <label className="field-inline">
                    <span>線種</span>
                    <select
                      className="control"
                      value={selectedLayoutAnnotation.arrowHead !== false ? "arrow" : "line"}
                      onChange={(event) => {
                        const nextArrowHead = event.target.value === "arrow";
                        updateLayoutEditorAnnotation(selectedLayoutAnnotation.id, { arrowHead: nextArrowHead });
                        setLayoutEditorArrowHeadEnabled(nextArrowHead);
                      }}
                    >
                      <option value="line">線（矢印なし）</option>
                      <option value="arrow">矢印</option>
                    </select>
                  </label>
                  <label className="field-inline"><span>始点X</span><input className="control" type="number" value={Math.round(selectedLayoutAnnotation.fromX)} onChange={(event) => updateLayoutEditorAnnotation(selectedLayoutAnnotation.id, { fromX: clampCanvasCoord(parseNumericInput(event.target.value, selectedLayoutAnnotation.fromX)) })} /></label>
                  <label className="field-inline"><span>始点Y</span><input className="control" type="number" value={Math.round(selectedLayoutAnnotation.fromY)} onChange={(event) => updateLayoutEditorAnnotation(selectedLayoutAnnotation.id, { fromY: clampCanvasCoord(parseNumericInput(event.target.value, selectedLayoutAnnotation.fromY)) })} /></label>
                  <label className="field-inline"><span>終点X</span><input className="control" type="number" value={Math.round(selectedLayoutAnnotation.toX)} onChange={(event) => updateLayoutEditorAnnotation(selectedLayoutAnnotation.id, { toX: clampCanvasCoord(parseNumericInput(event.target.value, selectedLayoutAnnotation.toX)) })} /></label>
                  <label className="field-inline"><span>終点Y</span><input className="control" type="number" value={Math.round(selectedLayoutAnnotation.toY)} onChange={(event) => updateLayoutEditorAnnotation(selectedLayoutAnnotation.id, { toY: clampCanvasCoord(parseNumericInput(event.target.value, selectedLayoutAnnotation.toY)) })} /></label>
                  <label className="field-inline"><span>線幅</span><input className="control" type="number" min={1} max={16} value={selectedLayoutAnnotation.strokeWidth} onChange={(event) => updateLayoutEditorAnnotation(selectedLayoutAnnotation.id, { strokeWidth: normalizeStrokeWidth(parseNumericInput(event.target.value, selectedLayoutAnnotation.strokeWidth), selectedLayoutAnnotation.strokeWidth) })} /></label>
                </>
              ) : null}
              {selectedLayoutAnnotation.type === "text" ? (
                <>
                  <label className="field-inline"><span>X</span><input className="control" type="number" value={Math.round(selectedLayoutAnnotation.x)} onChange={(event) => updateLayoutEditorAnnotation(selectedLayoutAnnotation.id, { x: clampCanvasCoord(parseNumericInput(event.target.value, selectedLayoutAnnotation.x)) })} /></label>
                  <label className="field-inline"><span>Y</span><input className="control" type="number" value={Math.round(selectedLayoutAnnotation.y)} onChange={(event) => updateLayoutEditorAnnotation(selectedLayoutAnnotation.id, { y: clampCanvasCoord(parseNumericInput(event.target.value, selectedLayoutAnnotation.y)) })} /></label>
                </>
              ) : null}
            </div>
          ) : null}
            </>
          )}
          </details>
          <div className="annotation-editor-main">
            <div
              ref={layoutEditorStageRef}
              className={`annotation-editor-stage ${layoutEditorSpacePressed ? "is-pan-ready" : ""} ${layoutEditorPanState ? "is-panning" : ""}`}
              onWheel={handleLayoutEditorStageWheel}
            >
              {layoutEditorImageDataUrl ? (
                <>
                  <div
                    className="annotation-editor-canvas"
                    style={{ transform: `translate(${layoutEditorPan.x}px, ${layoutEditorPan.y}px) scale(${layoutEditorZoom})` }}
                  >
                    <img src={layoutEditorImageDataUrl} alt={layoutEditorTarget ? `${layoutEditorTarget.label} 編集対象` : "画像編集対象"} />
                    <svg
                      ref={layoutEditorSvgRef}
                      className="annotation-editor-svg"
                      viewBox={`0 0 ${LAYOUT_CANVAS_SIZE} ${LAYOUT_CANVAS_SIZE}`}
                      preserveAspectRatio="none"
                      onPointerDown={handleLayoutEditorCanvasPointerDown}
                      onPointerMove={handleLayoutEditorCanvasPointerMove}
                      onPointerUp={handleLayoutEditorCanvasPointerUp}
                    >
                    {layoutEditorAnnotations.map((annotation) => {
                      if (annotation.visible === false) {
                        return null;
                      }
                      const selected = layoutEditorSelectedIdSet.has(annotation.id);
                      const shapeClass = `annotation-shape ${selected ? "is-selected" : ""} ${annotation.locked ? "is-locked" : ""}`;
                      const bounds = getAnnotationBounds(annotation);
                      const rotation = annotation.rotation ?? 0;
                      if (annotation.type === "arrow") {
                        return (
                          <g
                            key={annotation.id}
                            transform={rotation ? `rotate(${rotation} ${bounds.centerX} ${bounds.centerY})` : undefined}
                          >
                            <line
                              x1={annotation.fromX}
                              y1={annotation.fromY}
                              x2={annotation.toX}
                              y2={annotation.toY}
                              stroke={annotation.color}
                              strokeWidth={annotation.strokeWidth}
                              strokeLinecap="round"
                              className={shapeClass}
                              onPointerDown={(event) => startLayoutAnnotationMove(annotation.id, event)}
                            />
                            {annotation.arrowHead !== false ? (
                              <polygon
                                points={buildArrowHeadPoints(annotation.fromX, annotation.fromY, annotation.toX, annotation.toY)}
                                fill={annotation.color}
                                className={shapeClass}
                                onPointerDown={(event) => startLayoutAnnotationMove(annotation.id, event)}
                              />
                            ) : null}
                          </g>
                        );
                      }
                      if (annotation.type === "rect") {
                        return (
                          <rect
                            key={annotation.id}
                            x={annotation.x}
                            y={annotation.y}
                            width={annotation.width}
                            height={annotation.height}
                            fill={annotation.fillColor || DEFAULT_ANNOTATION_FILL_COLOR}
                            fillOpacity={normalizeFillOpacity(annotation.fillOpacity, 0)}
                            stroke={annotation.color}
                            strokeWidth={annotation.strokeWidth}
                            rx={6}
                            ry={6}
                            transform={rotation ? `rotate(${rotation} ${bounds.centerX} ${bounds.centerY})` : undefined}
                            className={shapeClass}
                            onPointerDown={(event) => startLayoutAnnotationMove(annotation.id, event)}
                          />
                        );
                      }
                      if (annotation.type === "polygon") {
                        return (
                          <polygon
                            key={annotation.id}
                            points={buildRegularPolygonPoints(annotation.x, annotation.y, annotation.width, annotation.height, annotation.sides)}
                            fill={annotation.fillColor || DEFAULT_ANNOTATION_FILL_COLOR}
                            fillOpacity={normalizeFillOpacity(annotation.fillOpacity, 0)}
                            stroke={annotation.color}
                            strokeWidth={annotation.strokeWidth}
                            strokeLinejoin="round"
                            transform={rotation ? `rotate(${rotation} ${bounds.centerX} ${bounds.centerY})` : undefined}
                            className={shapeClass}
                            onPointerDown={(event) => startLayoutAnnotationMove(annotation.id, event)}
                          />
                        );
                      }
                      const textStrokeWidth = normalizeTextStrokeWidth(annotation.textStrokeWidth, DEFAULT_TEXT_STROKE_WIDTH);
                      const textStrokeColor = textStrokeWidth > 0
                        ? normalizeAnnotationColor(annotation.textStrokeColor || DEFAULT_TEXT_STROKE_COLOR)
                        : "transparent";
                      return (
                        <text
                          key={annotation.id}
                          x={annotation.x}
                          y={annotation.y}
                          fill={annotation.color}
                          fontSize={annotation.fontSize}
                          fontWeight={annotation.fontWeight}
                          fontFamily={annotation.fontFamily || DEFAULT_TEXT_FONT_FAMILY}
                          textAnchor={annotation.textAlign === "center" ? "middle" : annotation.textAlign === "right" ? "end" : "start"}
                          transform={rotation ? `rotate(${rotation} ${annotation.x} ${annotation.y})` : undefined}
                          className={shapeClass}
                          style={{ paintOrder: "stroke", stroke: textStrokeColor, strokeWidth: textStrokeWidth }}
                          onPointerDown={(event) => startLayoutAnnotationMove(annotation.id, event)}
                        >
                          {String(annotation.text || "注記").split("\n").map((line, index) => (
                            <tspan key={`${annotation.id}_edit_line_${index}`} x={annotation.x} dy={index === 0 ? 0 : annotation.fontSize * 1.25}>
                              {line || " "}
                            </tspan>
                          ))}
                        </text>
                      );
                    })}
                    {layoutEditorGuideLines.map((guide) => (
                      <line
                        key={`guide_${guide.id}_${guide.x1}_${guide.y1}_${guide.x2}_${guide.y2}`}
                        x1={guide.x1}
                        y1={guide.y1}
                        x2={guide.x2}
                        y2={guide.y2}
                        className="annotation-guide-line"
                      />
                    ))}
                    {layoutEditorMarquee ? (
                      <rect
                        x={Math.min(layoutEditorMarquee.startX, layoutEditorMarquee.endX)}
                        y={Math.min(layoutEditorMarquee.startY, layoutEditorMarquee.endY)}
                        width={Math.abs(layoutEditorMarquee.endX - layoutEditorMarquee.startX)}
                        height={Math.abs(layoutEditorMarquee.endY - layoutEditorMarquee.startY)}
                        className="annotation-marquee"
                      />
                    ) : null}
                    {layoutEditorTool === "select" && selectedLayoutAnnotations.length > 1 && selectedLayoutGroupBounds ? (
                      <g className="annotation-handle-layer">
                        <rect
                          x={selectedLayoutGroupBounds.x}
                          y={selectedLayoutGroupBounds.y}
                          width={selectedLayoutGroupBounds.width}
                          height={selectedLayoutGroupBounds.height}
                          className="annotation-bounds"
                        />
                        <line
                          x1={selectedLayoutGroupBounds.centerX}
                          y1={selectedLayoutGroupBounds.y}
                          x2={selectedLayoutGroupBounds.centerX}
                          y2={selectedLayoutGroupBounds.y - 20}
                          className="annotation-rotate-line"
                        />
                        {selectedEditableLayoutGroupBounds && selectedEditableLayoutAnnotations.length >= 2 ? (
                          <>
                            <circle
                              cx={selectedEditableLayoutGroupBounds.centerX}
                              cy={selectedEditableLayoutGroupBounds.y - 24}
                              r={6}
                              className="annotation-handle annotation-handle-rotate"
                              onPointerDown={startLayoutGroupRotate}
                            />
                            <rect
                              x={selectedEditableLayoutGroupBounds.x - 5}
                              y={selectedEditableLayoutGroupBounds.y - 5}
                              width={10}
                              height={10}
                              className="annotation-handle"
                              onPointerDown={(event) => startLayoutGroupBoxResize("nw", event)}
                            />
                            <rect
                              x={selectedEditableLayoutGroupBounds.x + selectedEditableLayoutGroupBounds.width - 5}
                              y={selectedEditableLayoutGroupBounds.y - 5}
                              width={10}
                              height={10}
                              className="annotation-handle"
                              onPointerDown={(event) => startLayoutGroupBoxResize("ne", event)}
                            />
                            <rect
                              x={selectedEditableLayoutGroupBounds.x - 5}
                              y={selectedEditableLayoutGroupBounds.y + selectedEditableLayoutGroupBounds.height - 5}
                              width={10}
                              height={10}
                              className="annotation-handle"
                              onPointerDown={(event) => startLayoutGroupBoxResize("sw", event)}
                            />
                            <rect
                              x={selectedEditableLayoutGroupBounds.x + selectedEditableLayoutGroupBounds.width - 5}
                              y={selectedEditableLayoutGroupBounds.y + selectedEditableLayoutGroupBounds.height - 5}
                              width={10}
                              height={10}
                              className="annotation-handle"
                              onPointerDown={(event) => startLayoutGroupBoxResize("se", event)}
                            />
                          </>
                        ) : null}
                      </g>
                    ) : null}
                    {layoutEditorTool === "select" && selectedLayoutAnnotation && selectedLayoutAnnotation.visible !== false && selectedLayoutAnnotationBounds ? (
                      <g className="annotation-handle-layer">
                        <rect
                          x={selectedLayoutAnnotationBounds.x}
                          y={selectedLayoutAnnotationBounds.y}
                          width={selectedLayoutAnnotationBounds.width}
                          height={selectedLayoutAnnotationBounds.height}
                          className="annotation-bounds"
                        />
                        <line
                          x1={selectedLayoutAnnotationBounds.centerX}
                          y1={selectedLayoutAnnotationBounds.y}
                          x2={selectedLayoutAnnotationBounds.centerX}
                          y2={selectedLayoutAnnotationBounds.y - 20}
                          className="annotation-rotate-line"
                        />
                        {!selectedLayoutAnnotation.locked ? (
                          <circle
                            cx={selectedLayoutAnnotationBounds.centerX}
                            cy={selectedLayoutAnnotationBounds.y - 24}
                            r={6}
                            className="annotation-handle annotation-handle-rotate"
                            onPointerDown={(event) => startLayoutAnnotationRotate(selectedLayoutAnnotation.id, event)}
                          />
                        ) : null}
                        {(selectedLayoutAnnotation.type === "rect" || selectedLayoutAnnotation.type === "polygon") && !selectedLayoutAnnotation.locked ? (
                          <>
                            <rect
                              x={selectedLayoutAnnotationBounds.x - 5}
                              y={selectedLayoutAnnotationBounds.y - 5}
                              width={10}
                              height={10}
                              className="annotation-handle"
                              onPointerDown={(event) => startLayoutBoxResize(selectedLayoutAnnotation.id, "nw", event)}
                            />
                            <rect
                              x={selectedLayoutAnnotationBounds.x + selectedLayoutAnnotationBounds.width - 5}
                              y={selectedLayoutAnnotationBounds.y - 5}
                              width={10}
                              height={10}
                              className="annotation-handle"
                              onPointerDown={(event) => startLayoutBoxResize(selectedLayoutAnnotation.id, "ne", event)}
                            />
                            <rect
                              x={selectedLayoutAnnotationBounds.x - 5}
                              y={selectedLayoutAnnotationBounds.y + selectedLayoutAnnotationBounds.height - 5}
                              width={10}
                              height={10}
                              className="annotation-handle"
                              onPointerDown={(event) => startLayoutBoxResize(selectedLayoutAnnotation.id, "sw", event)}
                            />
                            <rect
                              x={selectedLayoutAnnotationBounds.x + selectedLayoutAnnotationBounds.width - 5}
                              y={selectedLayoutAnnotationBounds.y + selectedLayoutAnnotationBounds.height - 5}
                              width={10}
                              height={10}
                              className="annotation-handle"
                              onPointerDown={(event) => startLayoutBoxResize(selectedLayoutAnnotation.id, "se", event)}
                            />
                          </>
                        ) : null}
                        {selectedLayoutAnnotation.type === "arrow" && !selectedLayoutAnnotation.locked ? (
                          <>
                            <circle
                              cx={selectedLayoutAnnotation.fromX}
                              cy={selectedLayoutAnnotation.fromY}
                              r={6}
                              className="annotation-handle"
                              onPointerDown={(event) => startLayoutArrowEndpointResize(selectedLayoutAnnotation.id, "from", event)}
                            />
                            <circle
                              cx={selectedLayoutAnnotation.toX}
                              cy={selectedLayoutAnnotation.toY}
                              r={6}
                              className="annotation-handle"
                              onPointerDown={(event) => startLayoutArrowEndpointResize(selectedLayoutAnnotation.id, "to", event)}
                            />
                          </>
                        ) : null}
                        {selectedLayoutAnnotation.type === "text" && !selectedLayoutAnnotation.locked ? (
                          <circle
                            cx={selectedLayoutAnnotationBounds.x + selectedLayoutAnnotationBounds.width + 8}
                            cy={selectedLayoutAnnotationBounds.y + selectedLayoutAnnotationBounds.height + 8}
                            r={6}
                            className="annotation-handle"
                            onPointerDown={(event) => startLayoutTextResize(selectedLayoutAnnotation.id, event)}
                          />
                        ) : null}
                      </g>
                    ) : null}
                    {layoutEditorDrawing?.type === "arrow" ? (
                      <g>
                        <line
                          x1={layoutEditorDrawing.startX}
                          y1={layoutEditorDrawing.startY}
                          x2={layoutEditorDrawing.endX}
                          y2={layoutEditorDrawing.endY}
                          stroke={layoutEditorDrawing.color}
                          strokeWidth={layoutEditorDrawing.strokeWidth}
                          strokeDasharray="10 6"
                        />
                        {layoutEditorDrawing.arrowHead !== false ? (
                          <polygon
                            points={buildArrowHeadPoints(
                              layoutEditorDrawing.startX,
                              layoutEditorDrawing.startY,
                              layoutEditorDrawing.endX,
                              layoutEditorDrawing.endY,
                            )}
                            fill={layoutEditorDrawing.color}
                          />
                        ) : null}
                      </g>
                    ) : null}
                    {layoutEditorDrawing?.type === "rect" ? (
                      <rect
                        x={Math.min(layoutEditorDrawing.startX, layoutEditorDrawing.endX)}
                        y={Math.min(layoutEditorDrawing.startY, layoutEditorDrawing.endY)}
                        width={Math.abs(layoutEditorDrawing.endX - layoutEditorDrawing.startX)}
                        height={Math.abs(layoutEditorDrawing.endY - layoutEditorDrawing.startY)}
                        fill={layoutEditorDrawing.fillColor}
                        fillOpacity={layoutEditorDrawing.fillOpacity}
                        stroke={layoutEditorDrawing.color}
                        strokeWidth={layoutEditorDrawing.strokeWidth}
                        strokeDasharray="10 6"
                        rx={6}
                        ry={6}
                      />
                    ) : null}
                    {layoutEditorTool === "chain" && layoutEditorChainStart ? (
                      <g>
                        <circle
                          cx={layoutEditorChainStart.x}
                          cy={layoutEditorChainStart.y}
                          r={5}
                          fill={layoutEditorColor}
                          opacity={0.75}
                        />
                        {layoutEditorChainHover ? (
                          <line
                            x1={layoutEditorChainStart.x}
                            y1={layoutEditorChainStart.y}
                            x2={layoutEditorChainHover.x}
                            y2={layoutEditorChainHover.y}
                            stroke={layoutEditorColor}
                            strokeWidth={layoutEditorStrokeWidth}
                            strokeDasharray="10 6"
                          />
                        ) : null}
                      </g>
                    ) : null}
                    </svg>
                  </div>
                </>
              ) : (
                <span>先に配置図画像を設定してください。</span>
              )}
            </div>
            <aside className="annotation-editor-side">
              <h4>注釈一覧 {layoutEditorSelectedIds.length ? `（選択 ${layoutEditorSelectedIds.length}）` : ""}</h4>
              <p className="annotation-list-helper">行をクリックで選択。折れ線はグループで1行表示。表示 と ロック は左のチェックで切替。</p>
              <div className="annotation-list">
                {layoutEditorAnnotationListEntries.map((entry, index) => (
                  <button
                    key={`anno_list_${entry.key}`}
                    type="button"
                    className={`annotation-list-item ${entry.annotationIds.some((id) => layoutEditorSelectedIdSet.has(id)) ? "is-selected" : ""} ${entry.primaryId === layoutEditorSelectedId ? "is-primary" : ""} ${!entry.visible ? "is-hidden" : ""} ${entry.locked ? "is-locked" : ""}`}
                    onClick={(event) => {
                      const targetSelectionIds = entry.annotationIds;
                      if (event.shiftKey) {
                        setLayoutEditorSelectedIds((prev) => {
                          const nextSet = new Set(prev);
                          const allSelected = targetSelectionIds.every((id) => nextSet.has(id));
                          if (allSelected) {
                            targetSelectionIds.forEach((id) => nextSet.delete(id));
                            const next = Array.from(nextSet);
                            if (!nextSet.has(layoutEditorSelectedId)) {
                              setLayoutEditorSelectedId(next[next.length - 1] ?? "");
                            }
                            return next;
                          }
                          targetSelectionIds.forEach((id) => nextSet.add(id));
                          setLayoutEditorSelectedId(entry.primaryId);
                          return Array.from(nextSet);
                        });
                        return;
                      }
                      setLayoutEditorSelectedIds(targetSelectionIds);
                      setLayoutEditorSelectedId(entry.primaryId);
                    }}
                  >
                    <span className="annotation-list-item-main">
                      <span className="annotation-list-item-title">
                        <span className="annotation-index-badge">{index + 1}</span>
                        <span>{entry.title}</span>
                      </span>
                      <span className="annotation-list-item-actions">
                        <label className="annotation-toggle" onClick={(event) => event.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={entry.visible}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) => setLayoutAnnotationVisibilityBulk(entry.annotationIds, event.target.checked)}
                          />
                          表示
                        </label>
                        <label className="annotation-toggle" onClick={(event) => event.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={entry.locked}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) => setLayoutAnnotationLockedBulk(entry.annotationIds, event.target.checked)}
                          />
                          ロック
                        </label>
                        {!entry.visible ? <span className="annotation-list-chip">非表示</span> : null}
                        {entry.locked ? <span className="annotation-list-chip">ロック中</span> : null}
                      </span>
                    </span>
                  </button>
                ))}
                {!layoutEditorAnnotations.length ? <p className="mini">注釈はまだありません。</p> : null}
              </div>
              <div className="annotation-help-card">
                <p className="mini">かんたん操作ガイド</p>
                <ol className="annotation-help-list">
                  <li>上のボタンで「線」「四角形」「折れ線」「テキスト」を選びます（矢印は線種で切替）。</li>
                  <li>図面の上でドラッグ（テキスト・折れ線はクリック）して追加します。</li>
                  <li>追加した図形はすぐに選択され、そのまま移動・サイズ変更できます。</li>
                  <li>色・太さ・塗りは上段の設定で変更できます。</li>
                </ol>
                <p className="mini">細かい数値調整は「詳細編集」を開いてください。</p>
              </div>
            </aside>
          </div>
        </article>
      </section>
      ) : null}

      {isEditorMode && hasSelectedProject ? (
      <footer className="bottom-bar" aria-label="Bottom">
        <p>
          保存: {lastSavedAt} / {selectedProject.projectId}
          <span className={`pdf-hint ${incompleteCards.length ? "warn" : "ok"}`}>
            {incompleteCards.length ? `未完了 ${incompleteCards.length}カード` : "PDF出力OK"}
          </span>
        </p>
        <div className="inline-row">
          <button type="button" className="btn btn-subtle" onClick={regenerateSchedule}><span className="btn-icon"><UiIcon name="refresh" /></span>工程再生成</button>
          {!canExportPdf ? (
            <button type="button" className="btn btn-subtle" onClick={() => scrollToMissingField()}>
              <span className="btn-icon"><UiIcon name="down" /></span>未入力へ移動
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-accent"
            onClick={exportPdf}
            disabled={!canExportPdf}
            title={!canExportPdf ? "必須項目を入力するとPDF出力できます" : ""}
          >
            <span className="btn-icon"><UiIcon name="pdf" /></span>PDF出力
          </button>
        </div>
      </footer>
      ) : null}

      {isEditorMode && printMode ? (
      <section className="print-only">
        <div className="print-doc">
          <article className="print-page cover-page">
            <p className="cover-date">{formatDateWithWeekday(selectedProject.workDateStart)}</p>
            <h1 className="cover-building">{selectedProject.propertyName}　{selectedProject.coverRecipientSuffix || "管理組合御中"}</h1>
            <p className="cover-title">{selectedProject.titleSubject}</p>
            <p className="cover-subtitle">施工計画書</p>
            <img
              className="cover-logo"
              src={activeLogoSrc}
              alt="Rezil ロゴ"
              onError={(event) => {
                event.currentTarget.src = PDF_LOGO_FALLBACK_SRC;
              }}
            />
            <section className="cover-company">
              <h3>{activeParties.owner.company || selectedProject.pdfCompanyName}</h3>
              <dl>
                <dt>{activePdfTemplate.coverOfficeLabel}</dt>
                <dd>{activeParties.owner.office || selectedProject.pdfTeam || "-"}</dd>
                <dt>担当者</dt>
                <dd>{activeParties.owner.person || selectedProject.pdfContactPerson || "-"}</dd>
                <dt>住所</dt>
                <dd>{selectedProject.pdfAddress || "-"}</dd>
                <dt>E-mail</dt>
                <dd>{selectedProject.pdfEmail || "-"}</dd>
                <dt>電話番号（TEL）</dt>
                <dd>{activeParties.owner.tel || selectedProject.pdfTel || "-"}</dd>
                <dt>FAX</dt>
                <dd>{selectedProject.pdfFax || "-"}</dd>
              </dl>
            </section>
          </article>

          <article className="print-page toc-page">
            <h2>目次</h2>
            <ol>
              {activePdfTemplate.tocItems.map((item) => (
                <li key={`print_toc_${item}`}>{item}</li>
              ))}
            </ol>
          </article>

          <article className="print-page">
            <h2>1．{activePdfTemplate.sectionOverview}</h2>
            <div className="summary-lines">
              <p><strong>■ 工事件名</strong> {selectedProject.titleSubject}</p>
              <p><strong>■ 工事場所</strong> {selectedProject.propertyAddress}</p>
              <p><strong>■ 工事期間</strong> {dateRangeLabel}</p>
              <p><strong>■ 停電期間</strong> {outageDateTimeLabel}</p>
            </div>

            <h3>工事工程グラフ</h3>
            <div className="print-timeline-stack">
              {timeline.windows.map((window, windowIndex) => (
                <div className="print-timeline" aria-label="印刷用工程グラフ" key={`print_window_${window.id}`}>
                  {timeline.windows.length > 1 ? (
                    <p className="mini timeline-split-caption">工程表 {windowIndex + 1}/{timeline.windows.length}（{formatDateRange(window.startDate, window.endDate)}）</p>
                  ) : null}
                  <div className="print-timeline-scale">
                    {window.labelTicks.map((tick) => {
                      const left = ((tick - window.viewStart) / window.viewSpan) * 100;
                      const point = fromTimelineOffset(tick, timeline.baseDate);
                      const labelDate = formatShortDate(point.date);
                      const labelTime = tickLabel(toMinutes(point.time));
                      const labelText = labelTime === "00:00" || tick === window.viewStart || tick === window.viewEnd ? `${labelDate} ${labelTime}` : labelTime;
                      return (
                        <span
                          key={`print_${window.id}_tick_${tick}`}
                          className={tick === window.viewStart ? "edge-left" : tick === window.viewEnd ? "edge-right" : ""}
                          style={{ left: `${Math.max(0, Math.min(100, left))}%` }}
                        >
                          {labelText}
                        </span>
                      );
                    })}
                  </div>
                  <div className="print-timeline-grid">
                    {window.lineTicks.map((tick) => {
                      const left = ((tick - window.viewStart) / window.viewSpan) * 100;
                      return <i key={`print_${window.id}_line_${tick}`} style={{ left: `${Math.max(0, Math.min(100, left))}%` }} />;
                    })}
                    {graphRows.map((row) => {
                      const normalized = normalizeRowRange(
                        toTimelineOffset(row.startDate, row.start, timeline.baseDate),
                        toTimelineOffset(row.endDate, row.end, timeline.baseDate),
                        timeline.fullSpan,
                      );
                      const clippedStart = clamp(normalized.start, window.viewStart, window.viewEnd);
                      const clippedEnd = clamp(normalized.end, window.viewStart, window.viewEnd);
                      const visibleSpan = clippedEnd - clippedStart;
                      const colorType = getRowColorType(row);
                      const left = ((clippedStart - window.viewStart) / window.viewSpan) * 100;
                      const width = visibleSpan > 0 ? Math.max(0.5, (visibleSpan / window.viewSpan) * 100) : 0;
                      return (
                        <div className="print-timeline-row" key={`print_${window.id}_graph_${row.id}`}>
                          <span className="print-row-label">{row.label}</span>
                          <div className="print-row-track">
                            {visibleSpan > 0 ? (
                              <div className={`print-row-bar is-${colorType}`} style={{ left: `${left}%`, width: `${width}%` }}>
                                {row.label}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <h3>工事工程表</h3>
            <table className="schedule-table print-schedule">
              <thead>
                <tr><th>項目</th><th>開始日時</th><th>終了日時</th><th>停電</th><th>備考</th></tr>
              </thead>
              <tbody>
                {selectedProject.outageEnabled ? (
                  <tr key="print_summary_outage">
                    <td>停電時間</td>
                    <td>{`${formatDateWithWeekday(selectedProject.outageDateStart)} ${selectedProject.outageTimeStart}`}</td>
                    <td>{`${formatDateWithWeekday(selectedProject.outageDateEnd)} ${selectedProject.outageTimeEnd}`}</td>
                    <td><span className="print-outage-on">有</span></td>
                    <td>全館停電</td>
                  </tr>
                ) : null}
                {selectedProject.scheduleRows.map((row) => (
                  <tr key={`print_summary_${row.id}`}>
                    <td>{row.label}</td>
                    <td>{`${formatDateWithWeekday(row.startDate)} ${row.start}`}</td>
                    <td>{`${formatDateWithWeekday(row.endDate)} ${row.end}`}</td>
                    <td>
                      <span className={row.outage ? "print-outage-on" : ""}>{row.outage ? "有" : "無"}</span>
                    </td>
                    <td>{row.note || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>

          <article className="print-page">
            <h2>2．{activePdfTemplate.sectionDetail}</h2>
            {selectedProject.scheduleRows.length === 0 && (
              <p>工程表の作業行が未設定です。工程表を編集すると本セクションにも反映されます。</p>
            )}
            {selectedProject.scheduleRows.map((row) => (
              <section key={`detail_${row.id}`} className="work-detail">
                <h3>■ {row.label}</h3>
                <p>作業時間: {formatDateWithWeekday(row.startDate)} {row.start}〜{formatDateWithWeekday(row.endDate)} {row.end}{row.outage ? "（停電あり）" : "（停電なし）"}</p>
                {row.note ? <p>備考: {row.note}</p> : null}
              </section>
            ))}
            {selectedWorks.length > 0 && (
              <section className="work-detail">
                <h3>■ 選択工事項目</h3>
                <p>{selectedWorks.map((work) => work.name).join(" / ")}</p>
              </section>
            )}

            {detailPhotoChunks.length > 0 ? <p className="mini">参考写真は次ページ以降に出力されます</p> : null}
          </article>

          {detailPhotoChunks.map((chunk, index) => (
            <article className="print-page" key={`detail_photo_page_${index}`}>
              <h2>2．{activePdfTemplate.sectionDetail}（参考写真）</h2>
              <div className="detail-photo-grid">
                {chunk.map((slot) => (
                  <figure key={`detail_photo_${slot.id}`}>
                    <div><LayoutAnnotatedImage imageUrl={slot.dataUrl} annotations={slot.layoutAnnotations || []} alt={slot.label} /></div>
                    <figcaption>{slot.label}</figcaption>
                  </figure>
                ))}
              </div>
            </article>
          ))}

          <article className="print-page">
            <h2>3．{activePdfTemplate.sectionApproval}</h2>
            <table className="schedule-table approval-table">
              <thead>
                <tr><th style={{ width: "48px" }}>No</th><th style={{ width: "180px" }}>項目</th><th>内容</th></tr>
              </thead>
              <tbody>
                {selectedProject.scheduleRows.map((row, idx) => (
                  <tr key={`approval_${row.id}`}>
                    <td>{idx + 1}</td>
                    <td>{row.label}</td>
                    <td>
                      {row.label || "内容未入力"}
                      {row.note ? ` / 備考: ${row.note}` : ""}
                      {` / 時間: ${formatDateWithWeekday(row.startDate)} ${row.start}〜${formatDateWithWeekday(row.endDate)} ${row.end}`}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td>9</td>
                  <td>特記事項</td>
                  <td>{selectedProject.noteSpecial || "なし"}</td>
                </tr>
                <tr>
                  <td>10</td>
                  <td>承認事項追記</td>
                  <td>{selectedProject.noteApprovalExtra || "なし"}</td>
                </tr>
              </tbody>
            </table>
          </article>

          <article className="print-page">
            <h2>4．{activePdfTemplate.sectionOrganization}</h2>
            <div className="organization-grid">
              {activeParties.owner.enabled ? (
                <div className="org-box">
                  <p>{activeParties.owner.title}：{activeParties.owner.company || "-"}</p>
                  {activeParties.owner.person ? <p>担当者：{activeParties.owner.person}</p> : null}
                  {activeParties.owner.office ? <p>部署：{activeParties.owner.office}</p> : null}
                  <p>電話番号（TEL）：{activeParties.owner.tel || "-"}</p>
                </div>
              ) : null}
              {activeParties.owner.enabled && activeParties.utility.enabled ? <div className="org-arrow horizontal">↔</div> : null}
              {activeParties.utility.enabled ? (
                <div className="org-box">
                  <p>{activeParties.utility.company || "-"}</p>
                  {activeParties.utility.office ? <p>事業所：{activeParties.utility.office}</p> : null}
                  <p>電話番号（TEL）：{activeParties.utility.tel || "-"}</p>
                </div>
              ) : null}
              {(activeParties.owner.enabled || activeParties.utility.enabled) && activeParties.contractor.enabled ? <div className="org-arrow down">↓</div> : null}
              {activeParties.contractor.enabled ? (
                <div className="org-box large">
                  <p>{activeParties.contractor.title}：{activeParties.contractor.company || "-"}</p>
                  {activeParties.contractor.office ? <p>{activeParties.contractor.office}</p> : null}
                  {activeParties.contractor.person ? <p>担当者：{activeParties.contractor.person}</p> : null}
                  <p>電話番号（TEL）：{activeParties.contractor.tel || "-"}</p>
                </div>
              ) : null}
            </div>

            <h2>5．{activePdfTemplate.sectionEmergency}</h2>
            <div className="emergency-grid">
              {activeParties.management.enabled ? <div className="org-box emergency-a">{activeParties.management.company || "-"}</div> : null}
              {activeParties.management.enabled && activeParties.owner.enabled ? <div className="org-arrow horizontal emergency-ab">↔</div> : null}
              {activeParties.owner.enabled ? (
                <div className="org-box emergency-b">
                  {activeParties.owner.company || "-"}
                  <br />
                  電話番号（TEL）：{activeParties.owner.tel || "-"}
                </div>
              ) : null}
              {activeParties.owner.enabled && activeParties.utility.enabled ? <div className="org-arrow down emergency-bc">↕</div> : null}
              {activeParties.utility.enabled ? (
                <div className="org-box emergency-c">
                  {activeParties.utility.company || "-"}
                  <br />
                  電話番号（TEL）：{activeParties.utility.tel || "-"}
                </div>
              ) : null}
              {activeParties.owner.enabled && activeParties.contractor.enabled ? <div className="org-arrow horizontal emergency-bd">↔</div> : null}
              {activeParties.contractor.enabled ? (
                <div className="org-box emergency-d">
                  {activeParties.contractor.company || "-"}
                  {activeParties.contractor.person ? (
                    <>
                      <br />
                      担当者：{activeParties.contractor.person}
                    </>
                  ) : null}
                  <br />
                  電話番号（TEL）：{activeParties.contractor.tel || "-"}
                </div>
              ) : null}
              {activeParties.residents.enabled ? <div className="org-box emergency-resident">{activeParties.residents.company || "-"}</div> : null}
            </div>
          </article>

          {(selectedProject.layoutImageDataUrl || layoutPhotoChunks.length > 0) && (
            <article className="print-page">
              <h2>【工事車両、作業場所等の配置図】</h2>
              {selectedProject.layoutImageDataUrl ? (
                <div className="layout-photo">
                  <LayoutAnnotatedImage
                    imageUrl={selectedProject.layoutImageDataUrl}
                    annotations={selectedProject.layoutAnnotations}
                    alt="配置図"
                  />
                </div>
              ) : null}
              {layoutPhotoChunks[0]?.length ? (
                <div className="detail-photo-grid">
                  {layoutPhotoChunks[0].map((slot) => (
                    <figure key={`layout_photo_first_${slot.id}`}>
                      <div><LayoutAnnotatedImage imageUrl={slot.dataUrl} annotations={slot.layoutAnnotations || []} alt={slot.label} /></div>
                      <figcaption>{slot.label}</figcaption>
                    </figure>
                  ))}
                </div>
              ) : null}
            </article>
          )}
          {layoutPhotoChunks.slice(1).map((chunk, index) => (
            <article className="print-page" key={`layout_photo_page_${index}`}>
              <h2>【工事車両、作業場所等の配置図（写真）】</h2>
              <div className="detail-photo-grid">
                {chunk.map((slot) => (
                  <figure key={`layout_photo_${slot.id}`}>
                    <div><LayoutAnnotatedImage imageUrl={slot.dataUrl} annotations={slot.layoutAnnotations || []} alt={slot.label} /></div>
                    <figcaption>{slot.label}</figcaption>
                  </figure>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
      ) : null}
    </>
  );
}
