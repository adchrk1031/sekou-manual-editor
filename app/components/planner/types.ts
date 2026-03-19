export type WorkCode = "KOUATSU_CABLE" | "UGS" | "PAS" | "GROUND_A" | "GROUND_B" | "GROUND_C";

export type ScheduleRow = {
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

export type PhotoSlot = {
  id: string;
  label: string;
  dataUrl: string;
  layoutAnnotations: LayoutAnnotation[];
  layoutAnnotationsV2: LayoutAnnotationV2[];
};

export type PhotoSlots = PhotoSlot[];
export type LayoutTextAlign = "left" | "center" | "right";

export type LayoutAnnotationType = "arrow" | "rect" | "polygon" | "text";

export type LayoutAnnotationBase = {
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

export type LayoutArrowAnnotation = LayoutAnnotationBase & {
  type: "arrow";
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  strokeWidth: number;
  arrowHead?: boolean;
};

export type LayoutRectAnnotation = LayoutAnnotationBase & {
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  strokeWidth: number;
};

export type LayoutPolygonAnnotation = LayoutAnnotationBase & {
  type: "polygon";
  x: number;
  y: number;
  width: number;
  height: number;
  sides: number;
  strokeWidth: number;
};

export type LayoutTextAnnotation = LayoutAnnotationBase & {
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

export type LayoutAnnotation = LayoutArrowAnnotation | LayoutRectAnnotation | LayoutPolygonAnnotation | LayoutTextAnnotation;

export type LayoutAnnotationV2Type = "arrow" | "rect" | "polygon" | "text";

export type LayoutAnnotationV2Transform = {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
};

export type LayoutAnnotationV2Style = {
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

export type LayoutAnnotationV2Base = {
  id: string;
  type: LayoutAnnotationV2Type;
  groupId?: string;
  transform: LayoutAnnotationV2Transform;
  style: LayoutAnnotationV2Style;
  name?: string;
  visible?: boolean;
  locked?: boolean;
};

export type LayoutArrowAnnotationV2 = LayoutAnnotationV2Base & {
  type: "arrow";
  points: [number, number, number, number];
  arrowHead?: boolean;
};

export type LayoutRectAnnotationV2 = LayoutAnnotationV2Base & {
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LayoutPolygonAnnotationV2 = LayoutAnnotationV2Base & {
  type: "polygon";
  x: number;
  y: number;
  width: number;
  height: number;
  sides: number;
};

export type LayoutTextAnnotationV2 = LayoutAnnotationV2Base & {
  type: "text";
  x: number;
  y: number;
  text: string;
};

export type LayoutAnnotationV2 = LayoutArrowAnnotationV2 | LayoutRectAnnotationV2 | LayoutPolygonAnnotationV2 | LayoutTextAnnotationV2;

export type LayoutAnnotationListEntry = {
  key: string;
  annotationIds: string[];
  primaryId: string;
  title: string;
  visible: boolean;
  locked: boolean;
  isGroup: boolean;
};

export type RelatedParty = {
  enabled: boolean;
  title: string;
  company: string;
  person: string;
  office: string;
  tel: string;
};

export type UserRole = "system_admin" | "admin" | "editor" | "viewer";
export type UserApprovalStatus = "approved" | "pending" | "rejected";
export type RelatedPartyKey = "owner" | "utility" | "contractor" | "management" | "residents";

export type UserAccount = {
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

export type AuditLog = {
  id: string;
  projectId: string;
  at: string;
  userId: string;
  userName: string;
  action: string;
  detail: string;
};

export type PartyCompanyTemplatePreset = {
  id: string;
  label: string;
  title: string;
  company: string;
  person: string;
  office: string;
  tel: string;
};

export type NoticeWorkType = "事前工事" | "本工事";
export type NoticeOutageState = "停電なし" | "停電あり";
export type NoticeAdvicePhase = "before" | "during" | "after";

export type NoticeScheduleRow = {
  id: string;
  date: string;
  workType: NoticeWorkType;
  outageState: NoticeOutageState;
  note: string;
};

export type NoticeAdviceItem = {
  id: string;
  phase: NoticeAdvicePhase;
  title: string;
  body: string;
};

export type Project = {
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
  pdfExportCount: number;
  pdfLastExportedAt: string;
  noticePropertyName: string;
  noticeRecipientName: string;
  noticeSenderCompany: string;
  noticeHeadline: string;
  noticeIntroText: string;
  noticeMainWorkDate: string;
  noticeOutageDate: string;
  noticeOutageTimeStart: string;
  noticeOutageTimeEnd: string;
  noticeScheduleRows: NoticeScheduleRow[];
  noticePrivateAreaText: string;
  noticeCommonAreaText: string;
  noticeCompensationText: string;
  noticeContactCompany: string;
  noticeContactDepartment: string;
  noticeContactAddress: string;
  noticeContactTel: string;
  noticeContactHours: string;
  noticeAdviceItems: NoticeAdviceItem[];
};

export type ProjectSnapshot = Pick<
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
  | "pdfExportCount"
  | "pdfLastExportedAt"
  | "noticePropertyName"
  | "noticeRecipientName"
  | "noticeSenderCompany"
  | "noticeHeadline"
  | "noticeIntroText"
  | "noticeMainWorkDate"
  | "noticeOutageDate"
  | "noticeOutageTimeStart"
  | "noticeOutageTimeEnd"
  | "noticeScheduleRows"
  | "noticePrivateAreaText"
  | "noticeCommonAreaText"
  | "noticeCompensationText"
  | "noticeContactCompany"
  | "noticeContactDepartment"
  | "noticeContactAddress"
  | "noticeContactTel"
  | "noticeContactHours"
  | "noticeAdviceItems"
  | "layoutAnnotations"
  | "layoutAnnotationsV2"
  | "scheduleRows"
  | "relatedParties"
>;

export type ProjectRevision = {
  id: string;
  projectId: string;
  at: string;
  userId: string;
  userName: string;
  label: string;
  snapshot: ProjectSnapshot;
};

export type CsvRecord = Record<string, string>;

export type WorkMaster = {
  code: WorkCode;
  name: string;
  detailText: string;
  defaultText: string;
};

export type ScheduleProcedureTemplateStep = {
  id: string;
  label: string;
  durationMinutes: number;
  outage: boolean;
  note: string;
};

export type ScheduleProcedureTemplate = {
  id: string;
  name: string;
  createdAt: string;
  workCodes: WorkCode[];
  steps: ScheduleProcedureTemplateStep[];
};

export type TemplateScope = "schedule" | "detailPhotos" | "relatedParties" | "layout";
export type PdfTemplateId = "standard" | "kansai" | "night";

export type PdfTemplatePreset = {
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

export type LayoutTemplatePayload = {
  layoutImageDataUrl: string;
  layoutPhotos: PhotoSlots;
  layoutAnnotations: LayoutAnnotation[];
  layoutAnnotationsV2?: LayoutAnnotationV2[];
};

export type DragInfo = {
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

export type TimelineWindow = {
  id: string;
  viewStart: number;
  viewEnd: number;
  viewSpan: number;
  lineTicks: number[];
  labelTicks: number[];
  startDate: string;
  endDate: string;
};

export type SimpleTemplate<T> = {
  id: string;
  name: string;
  createdAt: string;
  payload: T;
};

export type LayoutEditorTool = "select" | "arrow" | "rect" | "chain" | "text";
export type LayoutAdvancedTab = "transform" | "style" | "arrange";
export type LayoutEditorTarget =
  | { kind: "layoutImage"; label: string }
  | { kind: "photo"; section: "detailPhotos" | "layoutPhotos"; photoId: string; label: string };
export type CropSelectionRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CropSelectionDragState = {
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
  previousSelection: CropSelectionRect;
};

export type LayoutDrawingDraft = {
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

export type LayoutMoveState = {
  annotationIds: string[];
  startX: number;
  startY: number;
  snapshots: LayoutAnnotation[];
};

export type LayoutResizeCorner = "nw" | "ne" | "sw" | "se";

export type LayoutResizeState =
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

export type LayoutRotateState = {
  annotationIds: string[];
  centerX: number;
  centerY: number;
  startAngle: number;
  snapshots: LayoutAnnotation[];
};

export type LayoutPanState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPanX: number;
  startPanY: number;
};

export type LayoutMarqueeState = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  additive: boolean;
};

export type LayoutGuideLine = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type UiIconName =
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
  | "template"
  | "crop";

export type UserCreateNotice = {
  type: "ok" | "error";
  text: string;
};

export type CsvExportFilter = "all" | "exported" | "unexported";

export type LocalStorageExportItem = {
  key: string;
  value: string;
};

export type LocalStorageExportPayload = {
  app: "sekou-manual-editor";
  exportedAt: string;
  items: LocalStorageExportItem[];
};

export type OutageWindow = Pick<Project, "outageDateStart" | "outageTimeStart" | "outageDateEnd" | "outageTimeEnd">;

export type OutageTraceEntry = {
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

export type LegacyDateRiskEntry = {
  source: string;
  projectId: string;
  field: string;
  raw: string;
};
