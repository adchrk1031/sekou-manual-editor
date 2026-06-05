"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CSSProperties, ChangeEvent, DragEvent as ReactDragEvent, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LOGIN_GUARD_STORAGE_KEY as AUTH_LOGIN_GUARD_STORAGE_KEY, SESSION_STORAGE_KEY as AUTH_SESSION_STORAGE_KEY, clearSession, createUserByAdmin, ensureUsers, getLoginAttempts, getLoginFailureMessage, getSessionUser, loginWithCredentials, pullAuthUsersSnapshot, pushAuthUsersSnapshot, type LoginAttemptLog } from "./auth";
import {
  SHARED_STORAGE_RESYNC_INTERVAL_MS,
  SHARED_STORAGE_UPDATED_EVENT,
  removeSharedStorageItem,
  pullSharedStorageSnapshot,
  pushSharedStorageSnapshot,
  resetSharedStorageSnapshotCache,
  writeSharedStorageItem,
} from "./sharedStorage";
import { isAdminLikeRole, formatAuditAction, formatAuditScreen, formatAuditDetail, formatAuditDetailForNonAdmin, formatUserCreatedByLabel, formatUserApprovedByLabel } from "./planner/utils/audit";
import {
  APPROVAL_STATUS_LABELS,
  APPROVAL_NOTE_TEMPLATE_STORAGE_KEY,
  AUDIT_STORAGE_KEY,
  CSV_EDITOR_STORAGE_KEY,
  CSV_INTERNAL_ROW_ID_KEY,
  CSV_PROJECT_FIELD_ALIASES,
  CSV_SAVE_DEBOUNCE_MS,
  CSV_WORK_COLUMN_ALIASES,
  DEFAULT_ANNOTATION_COLOR,
  DEFAULT_ANNOTATION_FILL_COLOR,
  DEFAULT_ANNOTATION_FILL_OPACITY,
  DEFAULT_ANNOTATION_STROKE_WIDTH,
  DEFAULT_LAYOUT_MAX_SIZE,
  DEFAULT_PHOTO_MAX_SIZE,
  DEFAULT_SCHEDULE_PROCEDURE_TEMPLATES,
  DEFAULT_TEXT_FONT_FAMILY,
  DEFAULT_TEXT_STROKE_COLOR,
  DEFAULT_TEXT_STROKE_WIDTH,
  DETAIL_PHOTO_TEMPLATE_STORAGE_KEY,
  DRAG_SNAP_MINUTES,
  EMPTY_PARTY_TEMPLATE_SELECTIONS,
  getCsvHeaderLabel,
  HEADER_LOGO_SRC,
  LAYOUT_CANVAS_SIZE,
  LAYOUT_SNAP_THRESHOLD,
  LAYOUT_TEMPLATE_STORAGE_KEY,
  LAYOUT_TEXT_FONT_OPTIONS,
  LEGACY_DATE_TRACE_DEBUG_KEY,
  LOCAL_SAVE_META_STORAGE_KEY,
  MAX_ANNOTATION_HISTORY,
  MAX_AUDIT_LOGS,
  MAX_REVISIONS,
  MAX_UPLOAD_FILE_BYTES,
  MIN_BLOCK_MINUTES,
  OUTAGE_TRACE_DEBUG_KEY,
  PARTY_COMPANY_TEMPLATE_PRESETS,
  PARTY_COMPANY_TEMPLATE_STORAGE_KEY,
  PARTY_TEMPLATE_STORAGE_KEY,
  PDF_LOGO_FALLBACK_SRC,
  PDF_LOGO_SRC,
  PDF_TEMPLATE_PRESETS,
  PDF_TEMPLATE_PRESET_MAP,
  PROJECT_DATA_STORAGE_PREFIX,
  PROJECT_PRESETS,
  PROJECT_INDEX_STORAGE_KEY,
  PROJECT_SAVE_DEBOUNCE_MS,
  REVISION_STORAGE_KEY,
  ROLE_LABELS,
  SCHEDULE_PROCEDURE_TEMPLATE_STORAGE_KEY,
  SCHEDULE_TEMPLATE_STORAGE_KEY,
  STORAGE_KEY,
  TARGET_LAYOUT_DATA_URL_BYTES,
  TARGET_PHOTO_DATA_URL_BYTES,
  TEMPLATE_SCOPE_META,
  TEST_EDITOR_SEED_STORAGE_KEY,
  TEST_EDITOR_USER_PRESETS,
  USERS_STORAGE_KEY,
  USER_APPROVAL_LABELS,
  USER_LIST_VISIBLE_COUNT,
  WORK_MASTER,
} from "./planner/constants";
import { PdfApprovalPrintPages, PdfApprovalSection } from "./features/pdf/PdfApprovalSection";
import { PdfLayoutPhotoPreview, PdfLayoutPhotoPrintPages } from "./features/pdf/PdfLayoutPhotoSection";
import { PdfOrganizationPrintPages, PdfOrganizationSection } from "./features/pdf/PdfOrganizationSection";
import { APPROVAL_REQUEST_TEMPLATE_MAP } from "./planner/approvalTemplates";
import {
  chunkItems,
  formatByteSize,
  getUsageTone,
  OPERATION_LIMITS,
  PDF_LAYOUT_LIMITS,
} from "./planner/operationPolicy";
import {
  applyConfigSnapshotToLocalStorage,
  fetchConfigSnapshot,
  getLocalConfigSnapshotSignature,
  hasLocalConfigData,
  saveConfigSnapshot,
  buildConfigPersistencePayloadFromLocalStorage,
} from "./planner/configPersistence";
import {
  applyWorkspaceSnapshotToLocalStorage,
  buildWorkspacePersistencePayload,
  fetchWorkspaceSnapshot,
  hasLocalWorkspaceData,
  saveWorkspaceSnapshot,
} from "./planner/workspacePersistence";
import {
  appendAuditLogEntry,
  appendRevisionEntry,
  buildCsvHeaderSyncEntry,
  buildCsvRowSyncEntries,
  buildProjectItemSyncEntries,
  buildTemplateItemSyncEntriesFromLocalStorage,
  deleteCsvRow as deleteCsvRowItem,
  deleteProjectItem,
  deleteTemplateItem,
  saveCsvHeaders,
  saveCsvRow,
  saveProjectItem,
  saveTemplateItem,
} from "./planner/itemPersistence";
import {
  buildRestoreStatusValue,
  readRestoreStatus,
  writeRestoreStatus,
  type RestoreStatus,
  type RestoreSource,
} from "./planner/restoreStatus";
import { createCsvValueGetter, decodeCsvFile, inferCsvHeaders, normalizeCsvRows, parseCsv, recordsToCsv, repairCsvSnapshot, type CsvRepairStats } from "./planner/utils/csv";
import { DAY_TOTAL_MINUTES, addDays, buildTimelineTicks, diffDays, formatDateRange, formatDateTimeRange, formatDateWithWeekday, formatShortDate, fromTimelineOffset, normalizeDate, normalizeDateTimeValue, normalizeTime, startOfDay, tickLabel, toBoolean, toHHMM, toMinutes, toTimelineOffset, todayLocalISO } from "./planner/utils/dateTime";
import { parseStorageJson, stringifyForStorage } from "./planner/utils/storage";
import {
  createEmptyPartyCompanyTemplates,
  normalizePartyCompanyTemplateMap,
} from "./planner/utils/partyCompanyTemplates";
import {
  createBlankProject,
  createDefaultRelatedParties,
  createPhotoSlots,
  layoutAnnotationsV2ToLegacy,
  legacyLayoutAnnotationsToV2,
  normalizeLayoutAnnotations,
  normalizeLayoutAnnotationsV2,
  normalizePdfTemplateId,
  normalizeProject,
} from "./features/project-core/project-normalize";
import {
  formatProjectEditLockNotice,
  getProjectEditLockKey,
  getProjectEditLockOwner,
  PROJECT_EDIT_LOCK_HEARTBEAT_MS,
  releaseProjectEditLock,
  syncProjectEditLock,
  type ProjectEditLock,
  type ProjectEditLockSyncResult,
} from "./features/project-core/project-edit-lock";
import type {
  AuditLog,
  CropSelectionDragState,
  CropSelectionRect,
  CsvExportFilter,
  CsvRecord,
  DragInfo,
  LayoutAdvancedTab,
  LayoutAnnotation,
  LayoutAnnotationBase,
  LayoutAnnotationListEntry,
  LayoutAnnotationV2,
  LayoutAnnotationV2Base,
  LayoutAnnotationV2Style,
  LayoutAnnotationV2Transform,
  LayoutAnnotationV2Type,
  LayoutArrowAnnotation,
  LayoutArrowAnnotationV2,
  LayoutDrawingDraft,
  LayoutEditorTarget,
  LayoutEditorTool,
  LayoutGuideLine,
  LayoutMarqueeState,
  LayoutMoveState,
  LayoutPolygonAnnotation,
  LayoutPolygonAnnotationV2,
  LayoutTextAlign,
  LayoutPanState,
  LayoutRectAnnotation,
  LayoutRectAnnotationV2,
  LayoutResizeCorner,
  LayoutResizeState,
  LayoutRotateState,
  LayoutTemplatePayload,
  LocalStorageExportItem,
  LocalStorageExportPayload,
  ApprovalRequestItem,
  NoticeAdviceItem,
  NoticeAdvicePhase,
  NoticeTemplateId,
  NoticeOutageState,
  NoticeScheduleRow,
  NoticeWorkType,
  OutageTraceEntry,
  OutageWindow,
  PartyCompanyTemplatePreset,
  PdfTemplateId,
  PdfTemplatePreset,
  PhotoSlot,
  PhotoSlots,
  Project,
  ProjectPreset,
  ProjectPresetId,
  ProjectRevision,
  ProjectSnapshot,
  RelatedParty,
  RelatedPartyKey,
  ScheduleProcedureTemplate,
  ScheduleProcedureTemplateStep,
  ScheduleRow,
  SimpleTemplate,
  TemplateScope,
  TimelineWindow,
  UserAccount,
  UserApprovalStatus,
  UserCreateNotice,
  UserRole,
  WorkCode,
  WorkMaster,
  LegacyDateRiskEntry,
  LayoutAnnotationType,
  LayoutTextAnnotation,
  LayoutTextAnnotationV2,
} from "./planner/types";
import { UiIcon } from "./planner/ui/UiIcon";
import { CardPreview } from "./planner/ui/CardPreview";
import { CsvEditorSection } from "./planner/ui/CsvEditorSection";
import { TrackingSection } from "./planner/ui/TrackingSection";
import { PdfCoverAndTocSection } from "./planner/ui/PdfCoverAndTocSection";
import { PdfWorkOverviewPreview } from "./planner/ui/PdfWorkOverviewPreview";
import { StatusSummaryPanel, type StatusSummaryItem } from "./planner/ui/StatusSummaryPanel";
import { NoticePrintDocument, NoticeWorkspace } from "./features/notice/NoticeWorkspace";
import { useCsvTableView } from "./features/csv/useCsvTableView";

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

function cloneApprovalRequestItems(items: ApprovalRequestItem[]): ApprovalRequestItem[] {
  return items.map((item) => ({ ...item }));
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

function cloneNoticeScheduleRows(rows: NoticeScheduleRow[]): NoticeScheduleRow[] {
  return rows.map((row) => ({ ...row }));
}

function cloneNoticeAdviceItems(items: NoticeAdviceItem[]): NoticeAdviceItem[] {
  return items.map((item) => ({ ...item }));
}

function shiftIsoDate(baseDate: string, days: number): string {
  const parsed = new Date(`${baseDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  parsed.setDate(parsed.getDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function createDefaultNoticeScheduleRows(mainWorkDate?: string): NoticeScheduleRow[] {
  if (!mainWorkDate) {
    return [
      {
        id: crypto.randomUUID(),
        date: "",
        workType: "本工事",
        outageState: "停電あり",
        note: "本工事",
      },
    ];
  }

  return [
    {
      id: crypto.randomUUID(),
      date: shiftIsoDate(mainWorkDate, -2),
      workType: "事前工事",
      outageState: "停電なし",
      note: "前工事",
    },
    {
      id: crypto.randomUUID(),
      date: shiftIsoDate(mainWorkDate, -1),
      workType: "事前工事",
      outageState: "停電なし",
      note: "前工事",
    },
    {
      id: crypto.randomUUID(),
      date: mainWorkDate,
      workType: "本工事",
      outageState: "停電あり",
      note: "本工事",
    },
  ];
}

function createDefaultNoticeAdviceItems(): NoticeAdviceItem[] {
  return [
    {
      id: crypto.randomUUID(),
      phase: "before",
      title: "電気機器",
      body: "復電時の火災防止のため、ドライヤー、トースター、アイロンなどの電熱機器のプラグはコンセントから抜いてください。",
    },
    {
      id: crypto.randomUUID(),
      phase: "before",
      title: "パソコンなどの精密機器",
      body: "パソコン、テレビ、HDDレコーダー、電話機、インターネット関連機器などは、データの消失や再起動時のトラブルを防止するため、電源をあらかじめ切り、コンセントからプラグを抜いてください。",
    },
    {
      id: crypto.randomUUID(),
      phase: "before",
      title: "インターネット環境",
      body: "マンション共用設備を通じたインターネット、ホームWi-Fiはご利用できません。必要に応じてスマートフォンのテザリング機能等をご準備ください。",
    },
    {
      id: crypto.randomUUID(),
      phase: "before",
      title: "水道",
      body: "停電中は共用部の水道ポンプが作動しないため、ポンプ式の場合は断水します。トイレの利用等も制限されますので、必要に応じて汲み置きなどにより水を確保してください。",
    },
    {
      id: crypto.randomUUID(),
      phase: "before",
      title: "給水直結型の家電製品",
      body: "洗濯機、食洗器、ウォシュレットなどをご使用されており、停電中に外出される場合は、可能であれば止水栓の閉栓を行ってください。また、蛇口の締め忘れがないようにご注意ください。",
    },
    {
      id: crypto.randomUUID(),
      phase: "before",
      title: "セキュリティシステム",
      body: "セキュリティシステムをご契約の方は、停電を警備会社が異常として感知し現地に出動する場合があるため、あらかじめ警備会社へご連絡ください。",
    },
    {
      id: crypto.randomUUID(),
      phase: "before",
      title: "医療機器",
      body: "人工呼吸器などの医療機器をご使用されている場合は、バッテリーなどの代替電源のご準備や、医療機関等への退避などによりご対応ください。特別なご事情があり停電中に電源が必要な場合は、弊社までご連絡ください。",
    },
    {
      id: crypto.randomUUID(),
      phase: "during",
      title: "冷蔵庫",
      body: "停電中はドアの開閉を控えていただき、庫内の保冷にご注意ください。",
    },
    {
      id: crypto.randomUUID(),
      phase: "after",
      title: "タイマー機能のある電気製品",
      body: "HDDレコーダー、炊飯器、電気給湯器など、停電に伴いタイマーが初期化される場合があるため、ご確認のうえ再設定してください。",
    },
    {
      id: crypto.randomUUID(),
      phase: "after",
      title: "エアコン",
      body: "自動復帰機能付のエアコンの場合、動作しているかどうか、再度電源をご確認ください。",
    },
    {
      id: crypto.randomUUID(),
      phase: "after",
      title: "水道",
      body: "停電復旧後に濁り水が出る場合があります。その際は濁った水が出なくなるまで水を出してください。",
    },
  ];
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
function getRowColorType(row: Pick<ScheduleRow, "id" | "label"> & { outage?: boolean }): "outage" | "main" | "additional" {
  if (row.id === "__outage_fixed__" || row.outage) {
    return "outage";
  }
  return row.label.includes("追加") ? "additional" : "main";
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

type CropImageOptions = {
  selection: CropSelectionRect;
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

function loadImageElement(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = dataUrl;
  });
}

function normalizeCropSelectionRect(selection: CropSelectionRect | null): CropSelectionRect {
  const MIN_RATIO = 0.02;
  if (!selection) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }
  let x = clamp(Number.isFinite(selection.x) ? selection.x : 0, 0, 1);
  let y = clamp(Number.isFinite(selection.y) ? selection.y : 0, 0, 1);
  let width = clamp(Number.isFinite(selection.width) ? selection.width : 1, 0, 1 - x);
  let height = clamp(Number.isFinite(selection.height) ? selection.height : 1, 0, 1 - y);

  if (width < MIN_RATIO) {
    width = Math.min(1 - x, MIN_RATIO);
    if (width < MIN_RATIO) {
      x = Math.max(0, 1 - MIN_RATIO);
      width = Math.min(1 - x, MIN_RATIO);
    }
  }
  if (height < MIN_RATIO) {
    height = Math.min(1 - y, MIN_RATIO);
    if (height < MIN_RATIO) {
      y = Math.max(0, 1 - MIN_RATIO);
      height = Math.min(1 - y, MIN_RATIO);
    }
  }
  return {
    x: clamp(x, 0, 1),
    y: clamp(y, 0, 1),
    width: clamp(width, MIN_RATIO, 1),
    height: clamp(height, MIN_RATIO, 1),
  };
}

function createCropSelectionRect(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): CropSelectionRect {
  const x1 = clamp(startX, 0, 1);
  const y1 = clamp(startY, 0, 1);
  const x2 = clamp(endX, 0, 1);
  const y2 = clamp(endY, 0, 1);
  return normalizeCropSelectionRect({
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  });
}

async function cropImageDataUrl(
  sourceDataUrl: string,
  {
    selection,
    maxEdge,
    quality = 0.84,
    targetBytes = TARGET_PHOTO_DATA_URL_BYTES,
  }: CropImageOptions,
): Promise<string> {
  const fallback = sourceDataUrl;
  if (typeof window === "undefined") {
    return fallback;
  }
  try {
    const img = await loadImageElement(sourceDataUrl);
    const sourceWidth = Math.max(1, img.naturalWidth || img.width);
    const sourceHeight = Math.max(1, img.naturalHeight || img.height);
    const safeSelection = normalizeCropSelectionRect(selection);

    const sourceX = clamp(Math.round(safeSelection.x * sourceWidth), 0, Math.max(0, sourceWidth - 1));
    const sourceY = clamp(Math.round(safeSelection.y * sourceHeight), 0, Math.max(0, sourceHeight - 1));
    const maxCropWidth = Math.max(1, sourceWidth - sourceX);
    const maxCropHeight = Math.max(1, sourceHeight - sourceY);
    const cropWidth = clamp(Math.round(safeSelection.width * sourceWidth), 1, maxCropWidth);
    const cropHeight = clamp(Math.round(safeSelection.height * sourceHeight), 1, maxCropHeight);

    let outputWidth = Math.max(1, Math.round(cropWidth));
    let outputHeight = Math.max(1, Math.round(cropHeight));
    if (maxEdge > 0 && Math.max(outputWidth, outputHeight) > maxEdge) {
      const scale = maxEdge / Math.max(outputWidth, outputHeight);
      outputWidth = Math.max(1, Math.round(outputWidth * scale));
      outputHeight = Math.max(1, Math.round(outputHeight * scale));
    }

    const canvas = document.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return fallback;
    }
    ctx.clearRect(0, 0, outputWidth, outputHeight);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sourceX, sourceY, cropWidth, cropHeight, 0, 0, outputWidth, outputHeight);

    const qualityCandidates = [quality, Math.max(0.72, quality - 0.08), Math.max(0.6, quality - 0.18), 0.5];
    let best = canvas.toDataURL("image/webp", qualityCandidates[0]) || fallback;
    let bestBytes = estimateDataUrlBytes(best);

    for (const q of qualityCandidates) {
      const candidate = canvas.toDataURL("image/webp", q);
      if (!candidate) {
        continue;
      }
      const bytes = estimateDataUrlBytes(candidate);
      if (bytes < bestBytes) {
        best = candidate;
        bestBytes = bytes;
      }
      if (bytes <= targetBytes) {
        return candidate;
      }
    }
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

function shiftScheduleRowsByDateDelta(
  rows: ScheduleRow[],
  previousStart: string,
  nextStart: string,
  nextEnd: string,
): ScheduleRow[] {
  if (!previousStart || !nextStart || previousStart === nextStart) {
    return rows.map((row) => fitRowIntoRange(row, nextStart, nextEnd));
  }
  const deltaDays = diffDays(previousStart, nextStart);
  return rows.map((row) => fitRowIntoRange({
    ...row,
    startDate: addDays(row.startDate, deltaDays),
    endDate: addDays(row.endDate, deltaDays),
  }, nextStart, nextEnd));
}

function syncProjectWorkRange(project: Project): Project {
  const dates = [
    project.workDateStart,
    project.workDateEnd,
    project.outageDateStart,
    project.outageDateEnd,
    ...project.scheduleRows.flatMap((row) => [row.startDate, row.endDate]),
  ].filter(Boolean);
  const fallbackStart = [...dates].sort()[0] || todayLocalISO();
  const fallbackEnd = [...dates].sort().slice(-1)[0] || fallbackStart;
  const workDateStart = normalizeDate(project.workDateStart) || fallbackStart;
  const workDateEndRaw = normalizeDate(project.workDateEnd) || fallbackEnd;
  const workDateEnd = workDateEndRaw < workDateStart ? workDateStart : workDateEndRaw;
  return {
    ...project,
    workDateStart,
    workDateEnd,
  };
}

function floorToStep(value: number, step: number): number {
  return Math.floor(value / step) * step;
}

function ceilToStep(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

type LocalSaveState = "idle" | "dirty" | "saving" | "saved" | "error";
type RemoteSyncState = "idle" | "pending" | "syncing" | "synced" | "error";

type LocalSaveMeta = {
  projectLastSavedAt?: string;
  csvLastSavedAt?: string;
};

type SharedBootstrapRestoreFlags = {
  workspace: boolean;
  config: boolean;
};

function currentTimeLabel(): string {
  return new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatSyncTimestampLabel(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }
  return parsed.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function readLocalSaveMeta(): LocalSaveMeta {
  if (typeof window === "undefined") {
    return {};
  }
  const parsed = parseStorageJson<LocalSaveMeta>(window.localStorage.getItem(LOCAL_SAVE_META_STORAGE_KEY));
  if (!parsed || typeof parsed !== "object") {
    return {};
  }
  return {
    projectLastSavedAt: typeof parsed.projectLastSavedAt === "string" ? parsed.projectLastSavedAt : undefined,
    csvLastSavedAt: typeof parsed.csvLastSavedAt === "string" ? parsed.csvLastSavedAt : undefined,
  };
}

function writeLocalSaveMeta(patch: Partial<LocalSaveMeta>): void {
  if (typeof window === "undefined") {
    return;
  }
  const current = readLocalSaveMeta();
  const next = {
    ...current,
    ...patch,
  };
  window.localStorage.setItem(LOCAL_SAVE_META_STORAGE_KEY, JSON.stringify(next));
}

function buildRestoreStatusNote(workspaceSource: RestoreSource, configSource: RestoreSource): string {
  if (workspaceSource === "json_import" || configSource === "json_import") {
    return "JSONインポートした内容をこのタブで採用中です。";
  }
  if (workspaceSource === "server_backup" || configSource === "server_backup") {
    return "この端末に保存が無かったため、サーバーバックアップから復元しました。";
  }
  if (workspaceSource === "shared_sync" || configSource === "shared_sync") {
    return "共有同期で届いた内容をこの端末へ反映しました。";
  }
  if (workspaceSource === "browser_local" || configSource === "browser_local") {
    return "この端末に保存されていた内容を優先して開いています。";
  }
  return "まだ復元対象のデータはありません。";
}

function canUserAccessProject(project: Project, user: UserAccount | null): boolean {
  if (!user) {
    return false;
  }
  if (isAdminLikeRole(user.role)) {
    return true;
  }
  if (project.accessScope !== "private") {
    return true;
  }
  return project.ownerUserId === user.id;
}

function canUserManageProjectAccess(project: Project, user: UserAccount | null): boolean {
  if (!user) {
    return false;
  }
  if (isAdminLikeRole(user.role)) {
    return true;
  }
  return project.ownerUserId === user.id;
}

function canUserEditProject(project: Project, user: UserAccount | null): boolean {
  if (!user || user.role === "viewer") {
    return false;
  }
  if (isAdminLikeRole(user.role)) {
    return true;
  }
  if (project.accessScope !== "private") {
    return true;
  }
  return project.ownerUserId === user.id;
}

function describeProjectAccess(project: Project): string {
  const ownerLabel = project.ownerUserName.trim() || "未設定";
  return project.accessScope === "private" ? `自分専用 / 所有者: ${ownerLabel}` : `共有案件 / 所有者: ${ownerLabel}`;
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

function buildNoticeTemplatePatch(project: Project, noticeTemplateId: NoticeTemplateId): Partial<Project> {
  const scenario = NOTICE_TEMPLATE_SCENARIOS[noticeTemplateId] ?? NOTICE_TEMPLATE_SCENARIOS.default;
  const companyName = scenario.provider === "nttae" ? "NTTアノードエナジー株式会社" : "レジル株式会社";
  const workLabel = scenario.meterReplacement ? "メーター交換および電気設備点検" : "電気設備点検";
  const introLines = [
    "平素より弊社サービスをご利用いただき誠にありがとうございます。",
    `この度、以下日程にて${workLabel}を実施いたします。`,
    scenario.unitInspectionEnabled
      ? "停電当日に在宅をご希望される方を対象に、各戸の点検もあわせて実施いたします。"
      : "今回は共用部および設備点検のみの実施で、各戸点検はございません。",
    "お客さまにはご不便をお掛け致しますが、ご理解とご協力のほどよろしくお願い申し上げます。",
  ];
  const nextScheduleRows = createBlankProject({
    workDateStart: project.workDateStart,
    outageDateStart: project.outageDateStart,
    outageTimeStart: project.outageTimeStart,
    outageTimeEnd: project.outageTimeEnd,
  }).noticeScheduleRows.map((row, index) => {
    if (index > 0 || !scenario.meterReplacement) {
      return row;
    }
    return {
      ...row,
      note: row.note ? `${row.note} / メーター交換あり` : "メーター交換あり",
    };
  });

  return {
    noticeTemplateId,
    noticeSenderCompany: companyName,
    noticeContactCompany: companyName,
    noticeHeadline: `${workLabel}に伴う全館停電のお知らせ`,
    noticeIntroText: introLines.join("\n"),
    noticeUnitInspectionEnabled: scenario.unitInspectionEnabled,
    noticePrivateAreaText: scenario.meterReplacement
      ? "【専有部】家電製品（電気で作動するもの全て）、水道、電力量計まわり\n※専有部についてのご注意は裏面をご覧ください"
      : project.noticePrivateAreaText,
    noticeCommonAreaText: scenario.meterReplacement
      ? "【共用部】エレベーター、オートロック式ドア、インターホン、宅配ボックス、機械式駐車場、共用計器類など\n※上記設備は停電中ご利用いただけませんのでご注意ください"
      : project.noticeCommonAreaText,
    noticeScheduleRows: nextScheduleRows,
  };
}

function applyPhotoLabels(slots: PhotoSlots, labels: string[]): PhotoSlots {
  return slots.map((slot, index) => ({
    ...slot,
    label: labels[index] || slot.label,
  }));
}

function applyProjectPreset(
  project: Project,
  presetId: ProjectPresetId,
  options: { overwriteScheduleRows?: boolean; overwriteNotice?: boolean } = {},
): Project {
  const preset = PROJECT_PRESET_MAP.get(presetId);
  if (!preset) {
    return {
      ...project,
      projectPresetId: "custom",
      noticeTemplateId: project.noticeTemplateId || "default",
    };
  }

  const scheduleTemplate = preset.scheduleProcedureTemplateId
    ? DEFAULT_SCHEDULE_PROCEDURE_TEMPLATES.find((template) => template.id === preset.scheduleProcedureTemplateId)
    : undefined;
  const nextWorkCodes = preset.workCodes.length ? preset.workCodes : project.selectedWorkCodes;
  const nextProjectBase: Project = {
    ...project,
    projectPresetId: preset.id,
    selectedWorkCodes: nextWorkCodes,
    detailPhotos: preset.detailPhotoLabels ? applyPhotoLabels(project.detailPhotos, preset.detailPhotoLabels) : project.detailPhotos,
    layoutPhotos: preset.layoutPhotoLabels ? applyPhotoLabels(project.layoutPhotos, preset.layoutPhotoLabels) : project.layoutPhotos,
    noticeTemplateId: preset.noticeTemplateId ?? project.noticeTemplateId,
  };
  const shouldReplaceScheduleRows = options.overwriteScheduleRows || nextProjectBase.scheduleRows.length === 0;
  const nextWithSchedule = shouldReplaceScheduleRows
    ? {
        ...nextProjectBase,
        scheduleRows: scheduleTemplate ? buildRowsFromProcedureTemplate(nextProjectBase, scheduleTemplate) : createScheduleFromWorks(nextProjectBase),
      }
    : nextProjectBase;

  if (!preset.noticeTemplateId || !options.overwriteNotice) {
    return nextWithSchedule;
  }
  return {
    ...nextWithSchedule,
    ...buildNoticeTemplatePatch(nextWithSchedule, preset.noticeTemplateId),
  };
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

function normalizeWorkToken(value: string): string {
  return String(value ?? "").trim().toLowerCase().replace(/[ \t　_\-\/]/g, "");
}

function normalizeProjectPresetId(value: string): ProjectPresetId {
  const normalized = normalizeWorkToken(value);
  if (
    normalized === "kouatsucable"
    || normalized === "高圧ケーブル交換工事"
    || normalized === "高圧ケーブル交換"
    || normalized === "ケーブル交換工事"
    || normalized === "設備改修ケーブル交換工事"
  ) {
    return "kouatsu_cable";
  }
  if (normalized === "pas" || normalized === "pas交換工事" || normalized === "パス交換工事" || normalized === "設備改修pas") {
    return "pas";
  }
  if (normalized === "ugs" || normalized === "ugs交換工事" || normalized === "設備改修ugs") {
    return "ugs";
  }
  if (normalized === "pasugs" || normalized === "pas/ugs更新工事" || normalized === "pasugs更新工事") {
    return "pas_ugs";
  }
  if (normalized === "digitalmeter" || normalized === "デジタルメーター" || normalized === "デジタルメーター交換") {
    return "digital_meter";
  }
  if (normalized === "nttae" || normalized === "nttアノードエナジー" || normalized === "nttanodeenergy") {
    return "ntt_ae";
  }
  return "custom";
}

function normalizeNoticeTemplateId(value: string): NoticeTemplateId {
  const normalized = normalizeWorkToken(value);
  if (
    normalized === "rezilmeter"
    || normalized === "メーター交換あり"
    || normalized === "メーター交換ありバージョン"
    || normalized === "デジタルメーター"
  ) {
    return "rezil_meter";
  }
  if (normalized === "nttaebasic" || normalized === "nttae" || normalized === "nttアノードエナジー") {
    return "nttae_basic";
  }
  if (normalized === "nttaemeter") {
    return "nttae_meter";
  }
  if (normalized === "rezilbasic" || normalized === "レジル" || normalized === "設備改修") {
    return "rezil_basic";
  }
  return "default";
}

function applyNoticeUnitInspectionSetting(project: Project, enabled: boolean): Project {
  const withFlag = {
    ...project,
    noticeUnitInspectionEnabled: enabled,
  };
  const positiveLine = "停電当日に在宅をご希望される方を対象に、各戸の点検もあわせて実施いたします。";
  const negativeLine = "今回は共用部および設備点検のみの実施で、各戸点検はございません。";
  const nextIntroText = withFlag.noticeIntroText.includes(positiveLine)
    ? withFlag.noticeIntroText.replace(positiveLine, enabled ? positiveLine : negativeLine)
    : withFlag.noticeIntroText.includes(negativeLine)
      ? withFlag.noticeIntroText.replace(negativeLine, enabled ? positiveLine : negativeLine)
      : withFlag.noticeIntroText;
  return {
    ...withFlag,
    noticeIntroText: nextIntroText,
  };
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
  const projectPresetId = normalizeProjectPresetId(getField(...CSV_PROJECT_FIELD_ALIASES.projectPresetId));
  const csvNoticeTemplateId = normalizeNoticeTemplateId(getField(...CSV_PROJECT_FIELD_ALIASES.noticeTemplateId));
  const hasCsvNoticeUnitInspection = hasCsvValue(getField, CSV_PROJECT_FIELD_ALIASES.noticeUnitInspectionEnabled);
  const csvNoticeUnitInspectionEnabled = hasCsvNoticeUnitInspection
    ? toBoolean(getField(...CSV_PROJECT_FIELD_ALIASES.noticeUnitInspectionEnabled))
    : undefined;
  const parsedExportCount = Number(getField(...CSV_PROJECT_FIELD_ALIASES.pdfExportCount));
  const normalizedExportCount = Number.isFinite(parsedExportCount) ? Math.max(0, Math.floor(parsedExportCount)) : 0;
  const parsedLastExportedAt = getField(...CSV_PROJECT_FIELD_ALIASES.pdfLastExportedAt).trim();

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
    projectPresetId,
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
    pdfExportCount: normalizedExportCount,
    pdfLastExportedAt: parsedLastExportedAt,
    noticeTemplateId: csvNoticeTemplateId,
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
  const resolvedNoticeTemplateId = csvNoticeTemplateId !== "default"
    ? csvNoticeTemplateId
    : (PROJECT_PRESET_MAP.get(projectPresetId)?.noticeTemplateId ?? "default");
  const withPreset = projectPresetId !== "custom"
    ? applyProjectPreset(project, projectPresetId, { overwriteScheduleRows: true, overwriteNotice: resolvedNoticeTemplateId !== "default" })
    : project;
  const withNoticeTemplate = resolvedNoticeTemplateId !== "default"
    ? {
        ...withPreset,
        ...buildNoticeTemplatePatch(withPreset, resolvedNoticeTemplateId),
      }
    : withPreset;
  return typeof csvNoticeUnitInspectionEnabled === "boolean"
    ? applyNoticeUnitInspectionSetting(withNoticeTemplate, csvNoticeUnitInspectionEnabled)
    : withNoticeTemplate;
}

function hasCsvValue(getField: (...keys: string[]) => string, aliases: readonly string[]): boolean {
  return aliases.some((alias) => getField(alias).trim() !== "");
}

function patchPhotoSlotLabelsFromCsv(
  slots: PhotoSlots,
  getField: (...keys: string[]) => string,
  aliases: readonly (readonly string[])[],
): PhotoSlots {
  return slots.map((slot, index) => {
    const nextLabel = getField(...aliases[index]).trim();
    if (!nextLabel) {
      return slot;
    }
    return {
      ...slot,
      label: nextLabel,
    };
  });
}

function mergeProjectFromCsvRecord(existing: Project, record: CsvRecord): Project {
  const imported = projectFromCsv(record);
  if (!imported) {
    return existing;
  }

  const getField = createCsvValueGetter(record);
  const hasWorkDateStart = hasCsvValue(getField, CSV_PROJECT_FIELD_ALIASES.workDateStart);
  const hasWorkDateEnd = hasCsvValue(getField, CSV_PROJECT_FIELD_ALIASES.workDateEnd);
  const hasProjectPreset = hasCsvValue(getField, CSV_PROJECT_FIELD_ALIASES.projectPresetId);
  const hasOutageDateStart = hasCsvValue(getField, CSV_PROJECT_FIELD_ALIASES.outageDateStart);
  const hasOutageDateEnd = hasCsvValue(getField, CSV_PROJECT_FIELD_ALIASES.outageDateEnd);
  const hasOutageTimeStart = hasCsvValue(getField, CSV_PROJECT_FIELD_ALIASES.outageTimeStart);
  const hasOutageTimeEnd = hasCsvValue(getField, CSV_PROJECT_FIELD_ALIASES.outageTimeEnd);
  const hasOutageEnabled = hasCsvValue(getField, CSV_PROJECT_FIELD_ALIASES.outageEnabled);
  const hasSelectedWorks =
    hasCsvValue(getField, CSV_PROJECT_FIELD_ALIASES.workList)
    || (Object.values(CSV_WORK_COLUMN_ALIASES) as string[][]).some((aliases) => hasCsvValue(getField, aliases));
  const hasNoticeTemplate = hasCsvValue(getField, CSV_PROJECT_FIELD_ALIASES.noticeTemplateId);
  const hasPdfExportCount = hasCsvValue(getField, CSV_PROJECT_FIELD_ALIASES.pdfExportCount);
  const hasPdfLastExportedAt = hasCsvValue(getField, CSV_PROJECT_FIELD_ALIASES.pdfLastExportedAt);

  const nextProject: Project = {
    ...existing,
    projectPresetId: hasProjectPreset ? imported.projectPresetId : existing.projectPresetId,
    propertyName: hasCsvValue(getField, CSV_PROJECT_FIELD_ALIASES.propertyName) ? imported.propertyName : existing.propertyName,
    propertyAddress: hasCsvValue(getField, CSV_PROJECT_FIELD_ALIASES.propertyAddress) ? imported.propertyAddress : existing.propertyAddress,
    titleSubject: hasCsvValue(getField, CSV_PROJECT_FIELD_ALIASES.titleSubject) ? imported.titleSubject : existing.titleSubject,
    workDateStart: hasWorkDateStart ? imported.workDateStart : existing.workDateStart,
    workDateEnd: hasWorkDateEnd ? imported.workDateEnd : existing.workDateEnd,
    outageDateStart: hasOutageDateStart ? imported.outageDateStart : existing.outageDateStart,
    outageDateEnd: hasOutageDateEnd ? imported.outageDateEnd : existing.outageDateEnd,
    outageTimeStart: hasOutageTimeStart ? imported.outageTimeStart : existing.outageTimeStart,
    outageTimeEnd: hasOutageTimeEnd ? imported.outageTimeEnd : existing.outageTimeEnd,
    outageEnabled: hasOutageEnabled ? imported.outageEnabled : existing.outageEnabled,
    flags: hasSelectedWorks ? imported.flags : existing.flags,
    selectedWorkCodes: hasSelectedWorks ? imported.selectedWorkCodes : existing.selectedWorkCodes,
    noteSpecial: hasCsvValue(getField, CSV_PROJECT_FIELD_ALIASES.noteSpecial) ? imported.noteSpecial : existing.noteSpecial,
    noteApprovalExtra: hasCsvValue(getField, CSV_PROJECT_FIELD_ALIASES.noteApprovalExtra) ? imported.noteApprovalExtra : existing.noteApprovalExtra,
    coverRecipientSuffix: hasCsvValue(getField, CSV_PROJECT_FIELD_ALIASES.coverRecipientSuffix) ? imported.coverRecipientSuffix : existing.coverRecipientSuffix,
    pdfTemplateId: hasCsvValue(getField, CSV_PROJECT_FIELD_ALIASES.pdfTemplateId) ? imported.pdfTemplateId : existing.pdfTemplateId,
    pdfCompanyName: hasCsvValue(getField, CSV_PROJECT_FIELD_ALIASES.pdfCompanyName) ? imported.pdfCompanyName : existing.pdfCompanyName,
    pdfTeam: hasCsvValue(getField, CSV_PROJECT_FIELD_ALIASES.pdfTeam) ? imported.pdfTeam : existing.pdfTeam,
    pdfContactPerson: hasCsvValue(getField, CSV_PROJECT_FIELD_ALIASES.pdfContactPerson) ? imported.pdfContactPerson : existing.pdfContactPerson,
    pdfAddress: hasCsvValue(getField, CSV_PROJECT_FIELD_ALIASES.pdfAddress) ? imported.pdfAddress : existing.pdfAddress,
    pdfEmail: hasCsvValue(getField, CSV_PROJECT_FIELD_ALIASES.pdfEmail) ? imported.pdfEmail : existing.pdfEmail,
    pdfTel: hasCsvValue(getField, CSV_PROJECT_FIELD_ALIASES.pdfTel) ? imported.pdfTel : existing.pdfTel,
    pdfFax: hasCsvValue(getField, CSV_PROJECT_FIELD_ALIASES.pdfFax) ? imported.pdfFax : existing.pdfFax,
    pdfExportCount: hasPdfExportCount ? imported.pdfExportCount : existing.pdfExportCount,
    pdfLastExportedAt: hasPdfLastExportedAt ? imported.pdfLastExportedAt : existing.pdfLastExportedAt,
    noticeTemplateId: hasNoticeTemplate ? imported.noticeTemplateId : existing.noticeTemplateId,
    detailPhotos: patchPhotoSlotLabelsFromCsv(existing.detailPhotos, getField, [
      CSV_PROJECT_FIELD_ALIASES.photoSlotALabel,
      CSV_PROJECT_FIELD_ALIASES.photoSlotBLabel,
      CSV_PROJECT_FIELD_ALIASES.photoSlotCLabel,
      CSV_PROJECT_FIELD_ALIASES.photoSlotDLabel,
    ]),
    layoutPhotos: patchPhotoSlotLabelsFromCsv(existing.layoutPhotos, getField, [
      CSV_PROJECT_FIELD_ALIASES.layoutPhotoSlotALabel,
      CSV_PROJECT_FIELD_ALIASES.layoutPhotoSlotBLabel,
      CSV_PROJECT_FIELD_ALIASES.layoutPhotoSlotCLabel,
      CSV_PROJECT_FIELD_ALIASES.layoutPhotoSlotDLabel,
    ]),
    relatedParties: {
      ...existing.relatedParties,
      owner: {
        ...existing.relatedParties.owner,
        company: hasCsvValue(getField, CSV_PROJECT_FIELD_ALIASES.pdfCompanyName)
          ? imported.relatedParties.owner.company
          : existing.relatedParties.owner.company,
        office: hasCsvValue(getField, CSV_PROJECT_FIELD_ALIASES.pdfTeam)
          ? imported.relatedParties.owner.office
          : existing.relatedParties.owner.office,
        person: hasCsvValue(getField, CSV_PROJECT_FIELD_ALIASES.pdfContactPerson)
          ? imported.relatedParties.owner.person
          : existing.relatedParties.owner.person,
        tel: hasCsvValue(getField, CSV_PROJECT_FIELD_ALIASES.pdfTel)
          ? imported.relatedParties.owner.tel
          : existing.relatedParties.owner.tel,
      },
    },
    scheduleRows:
      hasSelectedWorks && existing.scheduleRows.length === 0
        ? imported.scheduleRows
        : existing.scheduleRows,
  };

  if (!existing.noticePropertyName.trim()) {
    nextProject.noticePropertyName = imported.noticePropertyName;
  }
  if (!existing.noticeSenderCompany.trim()) {
    nextProject.noticeSenderCompany = imported.noticeSenderCompany;
    nextProject.noticeContactCompany = imported.noticeContactCompany;
  }
  if (!existing.noticeContactDepartment.trim()) {
    nextProject.noticeContactDepartment = imported.noticeContactDepartment;
  }
  if (!existing.noticeContactAddress.trim()) {
    nextProject.noticeContactAddress = imported.noticeContactAddress;
  }
  if (!existing.noticeContactTel.trim()) {
    nextProject.noticeContactTel = imported.noticeContactTel;
  }
  if (!existing.noticeMainWorkDate) {
    nextProject.noticeMainWorkDate = imported.noticeMainWorkDate;
  }
  if (!existing.noticeOutageDate) {
    nextProject.noticeOutageDate = imported.noticeOutageDate;
  }
  if (!existing.noticeOutageTimeStart) {
    nextProject.noticeOutageTimeStart = imported.noticeOutageTimeStart;
  }
  if (!existing.noticeOutageTimeEnd) {
    nextProject.noticeOutageTimeEnd = imported.noticeOutageTimeEnd;
  }

  if (hasProjectPreset && imported.projectPresetId !== "custom") {
    return applyProjectPreset(nextProject, imported.projectPresetId, {
      overwriteScheduleRows: existing.scheduleRows.length === 0,
      overwriteNotice: hasNoticeTemplate || imported.noticeTemplateId !== "default",
    });
  }

  if (hasNoticeTemplate && imported.noticeTemplateId !== "default") {
    return {
      ...nextProject,
      ...buildNoticeTemplatePatch(nextProject, imported.noticeTemplateId),
    };
  }

  return nextProject;
}

function escapeExcelCell(value: string): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function recordsToExcelHtml(headers: string[], rows: CsvRecord[]): string {
  const headerCells = headers.map((header) => `<th>${escapeExcelCell(getCsvHeaderLabel(header))}</th>`).join("");
  const bodyRows = rows
    .map((row) => {
      const cells = headers
        .map((header) => `<td>${escapeExcelCell(row[header] ?? "")}</td>`)
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  return [
    "<html><head><meta charset=\"utf-8\"></head><body>",
    "<table border=\"1\">",
    `<thead><tr>${headerCells}</tr></thead>`,
    `<tbody>${bodyRows}</tbody>`,
    "</table>",
    "</body></html>",
  ].join("");
}

function isDeferredRequiredKey(key: string): boolean {
  return key === "detailPhotos"
    || key === "layoutAssets"
    || key === "relatedPartiesEnabled"
    || key.startsWith("relatedPartyCompany:");
}

function mergeProjectForNoticeFromCsv(existing: Project, imported: Project): Project {
  const merged = {
    ...existing,
    projectPresetId: imported.projectPresetId,
    propertyName: imported.propertyName,
    propertyAddress: imported.propertyAddress,
    titleSubject: imported.titleSubject,
    workDateStart: imported.workDateStart,
    workDateEnd: imported.workDateEnd,
    outageDateStart: imported.outageDateStart,
    outageDateEnd: imported.outageDateEnd,
    outageTimeStart: imported.outageTimeStart,
    outageTimeEnd: imported.outageTimeEnd,
    outageEnabled: imported.outageEnabled,
    flags: imported.flags,
    selectedWorkCodes: imported.selectedWorkCodes,
    noteSpecial: imported.noteSpecial,
    noteApprovalExtra: imported.noteApprovalExtra,
    coverRecipientSuffix: imported.coverRecipientSuffix,
    pdfTemplateId: imported.pdfTemplateId,
    pdfCompanyName: imported.pdfCompanyName,
    pdfTeam: imported.pdfTeam,
    pdfContactPerson: imported.pdfContactPerson,
    pdfAddress: imported.pdfAddress,
    pdfEmail: imported.pdfEmail,
    pdfTel: imported.pdfTel,
    pdfFax: imported.pdfFax,
    scheduleRows: imported.scheduleRows,
    relatedParties: {
      ...existing.relatedParties,
      owner: {
        ...existing.relatedParties.owner,
        ...imported.relatedParties.owner,
      },
    },
    noticePropertyName: imported.noticePropertyName,
    noticeRecipientName: imported.noticeRecipientName,
    noticeSenderCompany: imported.noticeSenderCompany,
    noticeTemplateId: imported.noticeTemplateId,
    noticeHeadline: imported.noticeHeadline,
    noticeIntroText: imported.noticeIntroText,
    noticeMainWorkDate: imported.noticeMainWorkDate,
    noticeOutageDate: imported.noticeOutageDate,
    noticeOutageTimeStart: imported.noticeOutageTimeStart,
    noticeOutageTimeEnd: imported.noticeOutageTimeEnd,
    noticeUnitInspectionEnabled: imported.noticeUnitInspectionEnabled,
    noticeScheduleRows: imported.noticeScheduleRows,
    noticePrivateAreaText: imported.noticePrivateAreaText,
    noticeCommonAreaText: imported.noticeCommonAreaText,
    noticeCompensationText: imported.noticeCompensationText,
    noticeContactCompany: imported.noticeContactCompany,
    noticeContactDepartment: imported.noticeContactDepartment,
    noticeContactAddress: imported.noticeContactAddress,
    noticeContactTel: imported.noticeContactTel,
    noticeContactHours: imported.noticeContactHours,
    noticeAdviceItems: imported.noticeAdviceItems,
  };
  if (imported.projectPresetId !== "custom") {
    return applyProjectPreset(merged, imported.projectPresetId, {
      overwriteScheduleRows: true,
      overwriteNotice: imported.noticeTemplateId !== "default",
    });
  }
  return imported.noticeTemplateId !== "default"
    ? {
        ...merged,
        ...buildNoticeTemplatePatch(merged, imported.noticeTemplateId),
      }
    : merged;
}

const seedProjects: Project[] = [
];

type MobileEditorSection = "pdf1" | "pdf2" | "pdf3" | "pdf4" | "pdf5" | "pdf6" | "pdf7";
type NoticeScenarioProvider = "rezil" | "nttae";

const MOBILE_EDITOR_SECTION_OPTIONS: Array<{ key: MobileEditorSection; label: string }> = [
  { key: "pdf1", label: "PDF1 表紙" },
  { key: "pdf2", label: "PDF2 目次" },
  { key: "pdf3", label: "PDF3 工事概要" },
  { key: "pdf4", label: "PDF4 写真" },
  { key: "pdf5", label: "PDF5 承認" },
  { key: "pdf6", label: "PDF6 体制" },
  { key: "pdf7", label: "PDF7 配置図" },
];

const PROJECT_PRESET_MAP = new Map<ProjectPresetId, ProjectPreset>(
  PROJECT_PRESETS.map((preset) => [preset.id, preset]),
);

const NOTICE_TEMPLATE_SCENARIOS: Record<
  NoticeTemplateId,
  { provider: NoticeScenarioProvider; meterReplacement: boolean; unitInspectionEnabled: boolean }
> = {
  default: { provider: "rezil", meterReplacement: false, unitInspectionEnabled: true },
  rezil_basic: { provider: "rezil", meterReplacement: false, unitInspectionEnabled: true },
  rezil_meter: { provider: "rezil", meterReplacement: true, unitInspectionEnabled: true },
  nttae_basic: { provider: "nttae", meterReplacement: false, unitInspectionEnabled: true },
  nttae_meter: { provider: "nttae", meterReplacement: true, unitInspectionEnabled: true },
};

const NOTICE_TEMPLATE_LABELS: Record<NoticeTemplateId, string> = {
  default: "標準",
  rezil_basic: "レジル / 標準",
  rezil_meter: "レジル / メーター交換",
  nttae_basic: "NTTアノードエナジー / 標準",
  nttae_meter: "NTTアノードエナジー / メーター交換",
};

function isMobileFieldViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;
}

function getMobileEditorSectionForRequiredKey(key: string): MobileEditorSection {
  if (key === "propertyName" || key === "coverRecipientSuffix" || key === "titleSubject") {
    return "pdf1";
  }
  if (key === "detailPhotos") {
    return "pdf4";
  }
  if (key === "relatedPartiesEnabled" || key.startsWith("relatedPartyCompany:")) {
    return "pdf6";
  }
  if (key === "layoutAssets") {
    return "pdf7";
  }
  return "pdf3";
}

export default function PlannerApp({ mode = "editor" }: { mode?: "editor" | "csv" | "tracking" | "notice" }) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>(seedProjects);
  const [selectedId, setSelectedId] = useState<string>("");
  const [projectSearchText, setProjectSearchText] = useState<string>("");
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileEditorSection, setMobileEditorSection] = useState<MobileEditorSection>("pdf1");
  const [missingPanelOpen, setMissingPanelOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [sharedStorageReady, setSharedStorageReady] = useState(false);
  const [sharedSyncState, setSharedSyncState] = useState<RemoteSyncState>("idle");
  const [workspaceDbSyncState, setWorkspaceDbSyncState] = useState<RemoteSyncState>("idle");
  const [configDbSyncState, setConfigDbSyncState] = useState<RemoteSyncState>("idle");
  const [projectEditLock, setProjectEditLock] = useState<ProjectEditLock | null>(null);
  const [projectEditLockStatus, setProjectEditLockStatus] = useState<ProjectEditLockSyncResult["status"]>("idle");
  const [projectEditLockNotice, setProjectEditLockNotice] = useState("");
  const [projectSaveState, setProjectSaveState] = useState<LocalSaveState>("idle");
  const [csvSaveState, setCsvSaveState] = useState<LocalSaveState>("idle");
  const [projectSaveError, setProjectSaveError] = useState("");
  const [csvSaveError, setCsvSaveError] = useState("");
  const [workspaceDbError, setWorkspaceDbError] = useState("");
  const [configDbError, setConfigDbError] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState("-");
  const [lastCsvSavedAt, setLastCsvSavedAt] = useState("-");
  const [lastSharedSyncAt, setLastSharedSyncAt] = useState("-");
  const [lastWorkspaceDbSavedAt, setLastWorkspaceDbSavedAt] = useState("-");
  const [lastConfigDbSavedAt, setLastConfigDbSavedAt] = useState("-");
  const [restoreStatus, setRestoreStatus] = useState<RestoreStatus | null>(() => readRestoreStatus());
  const [isOnline, setIsOnline] = useState<boolean>(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [importStatus, setImportStatus] = useState("CSV未取込");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvDraftRows, setCsvDraftRows] = useState<CsvRecord[]>([]);
  const [csvSearch, setCsvSearch] = useState("");
  const [csvPage, setCsvPage] = useState(0);
  const [csvPageSize, setCsvPageSize] = useState<number>(50);
  const [csvExportFilter, setCsvExportFilter] = useState<CsvExportFilter>("all");
  const [newCsvColumn, setNewCsvColumn] = useState("");
  const [csvSelectedRows, setCsvSelectedRows] = useState<number[]>([]);
  const [csvBulkHeader, setCsvBulkHeader] = useState("");
  const [csvDeleteHeader, setCsvDeleteHeader] = useState("");
  const [csvBulkValue, setCsvBulkValue] = useState("");
  const [csvBulkNotice, setCsvBulkNotice] = useState<UserCreateNotice | null>(null);
  const [dragInfo, setDragInfo] = useState<DragInfo | null>(null);
  const [partySlide, setPartySlide] = useState(0);
  const [detailPhotoSlide, setDetailPhotoSlide] = useState(0);
  const [layoutPhotoSlide, setLayoutPhotoSlide] = useState(0);
  const [printMode, setPrintMode] = useState(false);
  const [noticePrintMode, setNoticePrintMode] = useState(false);
  const [scheduleTemplates, setScheduleTemplates] = useState<Array<SimpleTemplate<ScheduleRow[]>>>([]);
  const [scheduleProcedureTemplates, setScheduleProcedureTemplates] = useState<ScheduleProcedureTemplate[]>(
    cloneScheduleProcedureTemplates(DEFAULT_SCHEDULE_PROCEDURE_TEMPLATES),
  );
  const [approvalNoteTemplates, setApprovalNoteTemplates] = useState<Array<SimpleTemplate<string>>>([]);
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
  const [selectedApprovalNoteTemplateId, setSelectedApprovalNoteTemplateId] = useState("");
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
  const [operationLogScreenFilter, setOperationLogScreenFilter] = useState("all");
  const [operationLogActionFilter, setOperationLogActionFilter] = useState("all");
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
  const [cropEditorOpen, setCropEditorOpen] = useState(false);
  const [cropEditorTarget, setCropEditorTarget] = useState<LayoutEditorTarget | null>(null);
  const [cropEditorSourceDataUrl, setCropEditorSourceDataUrl] = useState("");
  const [cropEditorImageSize, setCropEditorImageSize] = useState<{ width: number; height: number } | null>(null);
  const [cropEditorSelection, setCropEditorSelection] = useState<CropSelectionRect>({ x: 0, y: 0, width: 1, height: 1 });
  const [cropEditorDrag, setCropEditorDrag] = useState<CropSelectionDragState | null>(null);
  const [cropEditorSaving, setCropEditorSaving] = useState(false);
  const [cropEditorError, setCropEditorError] = useState("");
  const [partyTemplateSelections, setPartyTemplateSelections] = useState<Record<RelatedPartyKey, string>>(
    EMPTY_PARTY_TEMPLATE_SELECTIONS,
  );
  const projectRefCacheRef = useRef<Record<string, Project>>({});
  const projectSerializedCacheRef = useRef<Record<string, string>>({});
  const saveTimerRef = useRef<number | null>(null);
  const csvSaveTimerRef = useRef<number | null>(null);
  const workspaceDbSaveTimerRef = useRef<number | null>(null);
  const configDbSaveTimerRef = useRef<number | null>(null);
  const csvSerializedCacheRef = useRef("");
  const projectAutosaveReadyRef = useRef(false);
  const csvAutosaveReadyRef = useRef(false);
  const workspaceDbAutosaveReadyRef = useRef(false);
  const configDbAutosaveReadyRef = useRef(false);
  const workspaceDbPrimeSyncRef = useRef(false);
  const configDbPrimeSyncRef = useRef(false);
  const skipNextProjectAutosaveRef = useRef(false);
  const skipNextCsvAutosaveRef = useRef(false);
  const skipNextWorkspaceDbAutosaveRef = useRef(false);
  const skipNextConfigDbAutosaveRef = useRef(false);
  const sharedSyncTimerRef = useRef<number | null>(null);
  const workspaceDbUpdatedAtRef = useRef<string | null>(null);
  const configDbUpdatedAtRef = useRef<string | null>(null);
  const configSnapshotSignatureRef = useRef("");
  const projectItemDbSyncRef = useRef<Record<string, { serialized: string; updatedAt: string | null; sortOrder: number }>>({});
  const csvRowDbSyncRef = useRef<Record<string, { serialized: string; updatedAt: string | null; rowOrder: number }>>({});
  const csvHeaderDbSyncRef = useRef<{ serialized: string; updatedAt: string | null }>({ serialized: "", updatedAt: null });
  const templateItemDbSyncRef = useRef<Record<string, { serialized: string; updatedAt: string | null }>>({});
  const projectItemDbSeededRef = useRef(false);
  const csvItemDbSeededRef = useRef(false);
  const templateItemDbSeededRef = useRef(false);
  const outageTraceSeqRef = useRef(0);
  const layoutEditorSvgRef = useRef<SVGSVGElement | null>(null);
  const layoutEditorStageRef = useRef<HTMLDivElement | null>(null);
  const cropEditorPreviewRef = useRef<HTMLDivElement | null>(null);
  const layoutEditorHistorySerializedRef = useRef("");
  const layoutEditorHistorySuppressRef = useRef(false);
  const projectPickerRef = useRef<HTMLDivElement | null>(null);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const sharedBootstrapRestoreRef = useRef<SharedBootstrapRestoreFlags>({ workspace: false, config: false });
  const projectsRef = useRef<Project[]>(projects);
  const csvHeadersRef = useRef<string[]>(csvHeaders);
  const csvDraftRowsRef = useRef<CsvRecord[]>(csvDraftRows);

  const persistProjectsToStorage = useCallback((targetProjects: Project[]): boolean => {
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
          writeSharedStorageItem(`${PROJECT_DATA_STORAGE_PREFIX}${project.projectId}`, serialized);
          nextSerializedCache[project.projectId] = serialized;
        } else {
          nextSerializedCache[project.projectId] = projectSerializedCacheRef.current[project.projectId];
        }
      });

      Object.keys(projectRefCacheRef.current).forEach((oldId) => {
        if (!nextRefCache[oldId]) {
          removeSharedStorageItem(`${PROJECT_DATA_STORAGE_PREFIX}${oldId}`);
        }
      });

      writeSharedStorageItem(PROJECT_INDEX_STORAGE_KEY, JSON.stringify(ids));
      removeSharedStorageItem(STORAGE_KEY);
      projectRefCacheRef.current = nextRefCache;
      projectSerializedCacheRef.current = nextSerializedCache;
      const savedAt = currentTimeLabel();
      setLastSavedAt(savedAt);
      writeLocalSaveMeta({ projectLastSavedAt: savedAt });
      return true;
    } catch {
      return false;
    }
  }, []);

  const persistCsvEditorToStorage = useCallback((headers: string[], rows: CsvRecord[]): boolean => {
    try {
      const serialized = stringifyForStorage({ headers, rows });
      if (serialized !== csvSerializedCacheRef.current) {
        writeSharedStorageItem(CSV_EDITOR_STORAGE_KEY, serialized);
        csvSerializedCacheRef.current = serialized;
      }
      const savedAt = currentTimeLabel();
      setLastCsvSavedAt(savedAt);
      writeLocalSaveMeta({ csvLastSavedAt: savedAt });
      return true;
    } catch {
      return false;
    }
  }, []);

  const buildCurrentWorkspaceBackupPayload = useCallback(() => {
    const projectIndex: string[] = [];
    const projectDataById: Record<string, string> = {};

    projectsRef.current.forEach((project) => {
      projectIndex.push(project.projectId);
      const cachedSerialized = projectSerializedCacheRef.current[project.projectId];
      const cachedProject = projectRefCacheRef.current[project.projectId];
      projectDataById[project.projectId] = cachedSerialized && cachedProject === project
        ? cachedSerialized
        : stringifyForStorage(project);
    });

    const csvEditorRaw = csvSerializedCacheRef.current || stringifyForStorage({
      headers: csvHeadersRef.current,
      rows: csvDraftRowsRef.current,
    });

    return buildWorkspacePersistencePayload(projectIndex, projectDataById, csvEditorRaw);
  }, []);

  const persistWorkspaceSnapshotNow = useCallback(async (
    options?: { keepalive?: boolean },
  ): Promise<boolean> => {
    if (!hydrated || !currentUserId) {
      return false;
    }
    if (!isOnline) {
      setWorkspaceDbSyncState("pending");
      return false;
    }

    setWorkspaceDbSyncState("syncing");
    setWorkspaceDbError("");
    const result = await saveWorkspaceSnapshot(
      buildCurrentWorkspaceBackupPayload(),
      workspaceDbUpdatedAtRef.current,
      options,
    );

    if (!result.ok) {
      setWorkspaceDbSyncState("error");
      setWorkspaceDbError(
        result.error === "conflict"
          ? "別の端末で更新されたため、案件/CSVのサーバーバックアップを保留しました。"
          : "案件/CSVのサーバーバックアップに失敗しました。",
      );
      return false;
    }

    workspaceDbUpdatedAtRef.current = result.updatedAt;
    setLastWorkspaceDbSavedAt(formatSyncTimestampLabel(result.updatedAt));
    setWorkspaceDbSyncState("synced");
    setWorkspaceDbError("");
    return true;
  }, [buildCurrentWorkspaceBackupPayload, currentUserId, hydrated, isOnline]);

  const persistConfigSnapshotNow = useCallback(async (
    options?: { keepalive?: boolean },
  ): Promise<boolean> => {
    if (!hydrated || !currentUserId) {
      return false;
    }
    if (!isOnline) {
      setConfigDbSyncState("pending");
      return false;
    }

    setConfigDbSyncState("syncing");
    setConfigDbError("");
    const result = await saveConfigSnapshot(
      buildConfigPersistencePayloadFromLocalStorage(),
      configDbUpdatedAtRef.current,
      options,
    );

    if (!result.ok) {
      setConfigDbSyncState("error");
      setConfigDbError(
        result.error === "conflict"
          ? "別の端末で更新されたため、テンプレート/履歴のサーバーバックアップを保留しました。"
          : "テンプレート/履歴のサーバーバックアップに失敗しました。",
      );
      return false;
    }

    configDbUpdatedAtRef.current = result.updatedAt;
    configSnapshotSignatureRef.current = getLocalConfigSnapshotSignature();
    setLastConfigDbSavedAt(formatSyncTimestampLabel(result.updatedAt));
    setConfigDbSyncState("synced");
    setConfigDbError("");
    return true;
  }, [currentUserId, hydrated, isOnline]);

  const persistStructuredProjectItemsNow = useCallback(async (): Promise<boolean> => {
    if (!hydrated || !currentUserId) {
      return false;
    }
    if (!isOnline) {
      setWorkspaceDbSyncState("pending");
      return false;
    }

    const workspacePayload = buildCurrentWorkspaceBackupPayload();
    const nextEntries = buildProjectItemSyncEntries(
      workspacePayload.projectIndex,
      workspacePayload.projectDataById,
    );
    const nextEntryMap = new Map(nextEntries.map((entry) => [entry.projectId, entry]));
    const previousEntries = projectItemDbSyncRef.current;
    const deletedProjectIds = Object.keys(previousEntries).filter((projectId) => !nextEntryMap.has(projectId));

    if (!nextEntries.some((entry) => {
      const previous = previousEntries[entry.projectId];
      return !previous || previous.serialized !== entry.rawProject || previous.sortOrder !== entry.sortOrder;
    }) && !deletedProjectIds.length) {
      return true;
    }

    setWorkspaceDbSyncState("syncing");
    setWorkspaceDbError("");
    let resolvedConflict = false;

    for (const entry of nextEntries) {
      const previous = previousEntries[entry.projectId];
      if (previous && previous.serialized === entry.rawProject && previous.sortOrder === entry.sortOrder) {
        continue;
      }
      const result = await saveProjectItem(
        entry,
        previous?.updatedAt ?? workspaceDbUpdatedAtRef.current ?? null,
      );
      if (!result.ok) {
        setWorkspaceDbSyncState("error");
        setWorkspaceDbError("案件の構造化保存に失敗しました。ネットワークまたは競合状態をご確認ください。");
        return false;
      }
      previousEntries[entry.projectId] = {
        serialized: result.payload?.rawProject ?? entry.rawProject,
        updatedAt: result.updatedAt,
        sortOrder: entry.sortOrder,
      };
      resolvedConflict = resolvedConflict || result.resolvedConflict;
    }

    for (const projectId of deletedProjectIds) {
      const previous = previousEntries[projectId];
      const result = await deleteProjectItem(projectId, previous?.updatedAt ?? workspaceDbUpdatedAtRef.current ?? null);
      if (!result.ok) {
        setWorkspaceDbSyncState("error");
        setWorkspaceDbError("削除した案件の構造化保存反映に失敗しました。");
        return false;
      }
      delete previousEntries[projectId];
      resolvedConflict = resolvedConflict || result.resolvedConflict;
    }

    setLastWorkspaceDbSavedAt(currentTimeLabel());
    setWorkspaceDbSyncState("synced");
    setWorkspaceDbError(resolvedConflict ? "他端末更新と重なった案件は自動マージして保存しました。" : "");
    return true;
  }, [
    buildCurrentWorkspaceBackupPayload,
    currentUserId,
    hydrated,
    isOnline,
  ]);

  const persistStructuredCsvItemsNow = useCallback(async (): Promise<boolean> => {
    if (!hydrated || !currentUserId) {
      return false;
    }
    if (!isOnline) {
      setWorkspaceDbSyncState("pending");
      return false;
    }

    const nextHeaderEntry = buildCsvHeaderSyncEntry(csvHeadersRef.current);
    const nextHeaderSerialized = JSON.stringify(nextHeaderEntry.headers);
    const nextRows = buildCsvRowSyncEntries(csvDraftRowsRef.current);
    const nextRowMap = new Map(nextRows.map((entry) => [entry.rowId, entry]));
    const previousRows = csvRowDbSyncRef.current;
    const previousHeader = csvHeaderDbSyncRef.current;
    const deletedRowIds = Object.keys(previousRows).filter((rowId) => !nextRowMap.has(rowId));
    const hasHeaderChange = previousHeader.serialized !== nextHeaderSerialized;
    const hasRowChange = nextRows.some((entry) => {
      const previous = previousRows[entry.rowId];
      return !previous || previous.serialized !== entry.rawJson || previous.rowOrder !== entry.rowOrder;
    });

    if (!hasHeaderChange && !hasRowChange && !deletedRowIds.length) {
      return true;
    }

    setWorkspaceDbSyncState("syncing");
    setWorkspaceDbError("");
    let resolvedConflict = false;

    if (nextHeaderEntry.headers.length) {
      const headerResult = await saveCsvHeaders(
        nextHeaderEntry,
        previousHeader.updatedAt ?? workspaceDbUpdatedAtRef.current ?? null,
      );
      if (!headerResult.ok) {
        setWorkspaceDbSyncState("error");
        setWorkspaceDbError("CSVヘッダの構造化保存に失敗しました。");
        return false;
      }
      csvHeaderDbSyncRef.current = {
        serialized: JSON.stringify(headerResult.payload?.headers ?? nextHeaderEntry.headers),
        updatedAt: headerResult.updatedAt,
      };
      resolvedConflict = resolvedConflict || headerResult.resolvedConflict;
    }

    for (const entry of nextRows) {
      const previous = previousRows[entry.rowId];
      if (previous && previous.serialized === entry.rawJson && previous.rowOrder === entry.rowOrder) {
        continue;
      }
      const result = await saveCsvRow(
        entry,
        previous?.updatedAt ?? csvHeaderDbSyncRef.current.updatedAt ?? workspaceDbUpdatedAtRef.current ?? null,
      );
      if (!result.ok) {
        setWorkspaceDbSyncState("error");
        setWorkspaceDbError("CSV行の構造化保存に失敗しました。ネットワークまたは競合状態をご確認ください。");
        return false;
      }
      previousRows[entry.rowId] = {
        serialized: result.payload?.rawJson ?? entry.rawJson,
        updatedAt: result.updatedAt,
        rowOrder: entry.rowOrder,
      };
      resolvedConflict = resolvedConflict || result.resolvedConflict;
    }

    for (const rowId of deletedRowIds) {
      const previous = previousRows[rowId];
      const result = await deleteCsvRowItem(
        rowId,
        previous?.updatedAt ?? csvHeaderDbSyncRef.current.updatedAt ?? workspaceDbUpdatedAtRef.current ?? null,
      );
      if (!result.ok) {
        setWorkspaceDbSyncState("error");
        setWorkspaceDbError("削除したCSV行の構造化保存反映に失敗しました。");
        return false;
      }
      delete previousRows[rowId];
      resolvedConflict = resolvedConflict || result.resolvedConflict;
    }

    setLastWorkspaceDbSavedAt(currentTimeLabel());
    setWorkspaceDbSyncState("synced");
    setWorkspaceDbError(resolvedConflict ? "他端末更新と重なったCSV行は自動マージして保存しました。" : "");
    return true;
  }, [currentUserId, hydrated, isOnline]);

  const persistStructuredTemplateItemsNow = useCallback(async (): Promise<boolean> => {
    if (!hydrated || !currentUserId) {
      return false;
    }
    if (!isOnline) {
      setConfigDbSyncState("pending");
      return false;
    }

    const nextEntries = buildTemplateItemSyncEntriesFromLocalStorage();
    const nextEntryMap = new Map(nextEntries.map((entry) => [`${entry.storageKey}::${entry.itemId}`, entry]));
    const previousEntries = templateItemDbSyncRef.current;
    const deletedKeys = Object.keys(previousEntries).filter((key) => !nextEntryMap.has(key));

    if (!nextEntries.some((entry) => {
      const key = `${entry.storageKey}::${entry.itemId}`;
      const previous = previousEntries[key];
      return !previous || previous.serialized !== entry.rawJson;
    }) && !deletedKeys.length) {
      return true;
    }

    setConfigDbSyncState("syncing");
    setConfigDbError("");
    let resolvedConflict = false;

    for (const entry of nextEntries) {
      const key = `${entry.storageKey}::${entry.itemId}`;
      const previous = previousEntries[key];
      if (previous && previous.serialized === entry.rawJson) {
        continue;
      }
      const result = await saveTemplateItem(
        entry,
        previous?.updatedAt ?? configDbUpdatedAtRef.current ?? null,
      );
      if (!result.ok) {
        setConfigDbSyncState("error");
        setConfigDbError("テンプレートの構造化保存に失敗しました。ネットワークまたは競合状態をご確認ください。");
        return false;
      }
      previousEntries[key] = {
        serialized: result.payload?.rawJson ?? entry.rawJson,
        updatedAt: result.updatedAt,
      };
      resolvedConflict = resolvedConflict || result.resolvedConflict;
    }

    for (const key of deletedKeys) {
      const previous = previousEntries[key];
      const [storageKey, itemId] = key.split("::");
      if (!storageKey || !itemId) {
        continue;
      }
      const result = await deleteTemplateItem(storageKey, itemId, previous?.updatedAt ?? configDbUpdatedAtRef.current ?? null);
      if (!result.ok) {
        setConfigDbSyncState("error");
        setConfigDbError("削除したテンプレートの構造化保存反映に失敗しました。");
        return false;
      }
      delete previousEntries[key];
      resolvedConflict = resolvedConflict || result.resolvedConflict;
    }

    setLastConfigDbSavedAt(currentTimeLabel());
    setConfigDbSyncState("synced");
    setConfigDbError(resolvedConflict ? "他端末更新と重なったテンプレートは自動マージして保存しました。" : "");
    return true;
  }, [currentUserId, hydrated, isOnline]);

  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  useEffect(() => {
    csvHeadersRef.current = csvHeaders;
    csvDraftRowsRef.current = csvDraftRows;
  }, [csvHeaders, csvDraftRows]);

  useEffect(() => {
    if (!hydrated || projectItemDbSeededRef.current) {
      return;
    }
    const workspacePayload = buildCurrentWorkspaceBackupPayload();
    const nextEntries = buildProjectItemSyncEntries(
      workspacePayload.projectIndex,
      workspacePayload.projectDataById,
    );
    projectItemDbSyncRef.current = Object.fromEntries(
      nextEntries.map((entry) => [
        entry.projectId,
        {
          serialized: entry.rawProject,
          updatedAt: workspaceDbUpdatedAtRef.current,
          sortOrder: entry.sortOrder,
        },
      ]),
    );
    projectItemDbSeededRef.current = true;
  }, [buildCurrentWorkspaceBackupPayload, hydrated]);

  useEffect(() => {
    if (!hydrated || csvItemDbSeededRef.current) {
      return;
    }
    const nextRows = buildCsvRowSyncEntries(csvDraftRows);
    csvRowDbSyncRef.current = Object.fromEntries(
      nextRows.map((entry) => [
        entry.rowId,
        {
          serialized: entry.rawJson,
          updatedAt: workspaceDbUpdatedAtRef.current,
          rowOrder: entry.rowOrder,
        },
      ]),
    );
    csvHeaderDbSyncRef.current = {
      serialized: JSON.stringify(csvHeaders),
      updatedAt: workspaceDbUpdatedAtRef.current,
    };
    csvItemDbSeededRef.current = true;
  }, [csvDraftRows, csvHeaders, hydrated]);

  useEffect(() => {
    if (!hydrated || templateItemDbSeededRef.current) {
      return;
    }
    const nextEntries = buildTemplateItemSyncEntriesFromLocalStorage();
    templateItemDbSyncRef.current = Object.fromEntries(
      nextEntries.map((entry) => [
        `${entry.storageKey}::${entry.itemId}`,
        {
          serialized: entry.rawJson,
          updatedAt: configDbUpdatedAtRef.current,
        },
      ]),
    );
    templateItemDbSeededRef.current = true;
  }, [hydrated]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncNetworkState = (): void => {
      setIsOnline(window.navigator.onLine);
    };

    syncNetworkState();
    window.addEventListener("online", syncNetworkState);
    window.addEventListener("offline", syncNetworkState);

    return () => {
      window.removeEventListener("online", syncNetworkState);
      window.removeEventListener("offline", syncNetworkState);
    };
  }, []);

  useEffect(() => {
    if (sharedSyncState === "synced") {
      setLastSharedSyncAt(currentTimeLabel());
    }
  }, [sharedSyncState]);

  useEffect(() => {
    const meta = readLocalSaveMeta();
    if (meta.projectLastSavedAt) {
      setLastSavedAt(meta.projectLastSavedAt);
      setProjectSaveState("saved");
    }
    if (meta.csvLastSavedAt) {
      setLastCsvSavedAt(meta.csvLastSavedAt);
      setCsvSaveState("saved");
    }
  }, []);

  const commitRestoreStatus = useCallback((nextStatus: RestoreStatus) => {
    setRestoreStatus(nextStatus);
    writeRestoreStatus(nextStatus);
  }, []);

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
        skipNextProjectAutosaveRef.current = true;
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
          const repairedSnapshot = repairCsvSnapshot(headers, parsed.rows);
          const rows = normalizeCsvRows(repairedSnapshot.records, repairedSnapshot.headers);
          skipNextCsvAutosaveRef.current = true;
          setCsvHeaders(repairedSnapshot.headers);
          setCsvDraftRows(rows);
          csvSerializedCacheRef.current = stringifyForStorage({
            headers: repairedSnapshot.headers,
            rows,
          });
          if (repairedSnapshot.stats.repairedCount > 0) {
            setImportStatus(`旧CSV保存データの文字化けを ${repairedSnapshot.stats.repairedCount} 箇所補正しました。`);
          } else if (repairedSnapshot.stats.unrecoverableCount > 0) {
            setImportStatus(`旧CSV保存データに復元できない文字化けが ${repairedSnapshot.stats.unrecoverableCount} 箇所残っています。CSVを再取込してください。`);
          }
        } else {
          skipNextCsvAutosaveRef.current = true;
          setCsvHeaders([]);
          setCsvDraftRows([]);
          csvSerializedCacheRef.current = "";
        }
      } else {
        skipNextCsvAutosaveRef.current = true;
        setCsvHeaders([]);
        setCsvDraftRows([]);
        csvSerializedCacheRef.current = "";
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
          writeSharedStorageItem(TEST_EDITOR_SEED_STORAGE_KEY, "1");
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
    const hadWorkspaceBeforePull = hasLocalWorkspaceData();
    const hadConfigBeforePull = hasLocalConfigData();
    const pulled = await pullSharedStorageSnapshot();
    if (!cancelled) {
      sharedBootstrapRestoreRef.current = {
        workspace: pulled && !hadWorkspaceBeforePull && hasLocalWorkspaceData(),
        config: pulled && !hadConfigBeforePull && hasLocalConfigData(),
      };
      setSharedSyncState(pulled ? "synced" : "idle");
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
    let cancelled = false;

    const hydrateWorkspace = async (): Promise<void> => {
      const sessionUser = getSessionUser();
      const localWorkspaceExists = hasLocalWorkspaceData();
      const localConfigExists = hasLocalConfigData();
      let workspaceRestoreSource: RestoreSource = localWorkspaceExists
        ? (sharedBootstrapRestoreRef.current.workspace ? "shared_sync" : "browser_local")
        : "empty";
      let configRestoreSource: RestoreSource = localConfigExists
        ? (sharedBootstrapRestoreRef.current.config ? "shared_sync" : "browser_local")
        : "empty";

      if (sessionUser) {
        if (!isOnline) {
          workspaceDbPrimeSyncRef.current = localWorkspaceExists;
          configDbPrimeSyncRef.current = localConfigExists;
          setWorkspaceDbSyncState(localWorkspaceExists ? "pending" : "idle");
          setConfigDbSyncState(localConfigExists ? "pending" : "idle");
        } else {
          setWorkspaceDbSyncState("syncing");
          const snapshot = await fetchWorkspaceSnapshot();
          if (cancelled) {
            return;
          }
          if (snapshot.ok) {
            workspaceDbUpdatedAtRef.current = snapshot.updatedAt;
            setLastWorkspaceDbSavedAt(formatSyncTimestampLabel(snapshot.updatedAt));
            if (!localWorkspaceExists && snapshot.exists && snapshot.payload) {
              applyWorkspaceSnapshotToLocalStorage(snapshot.payload);
              workspaceRestoreSource = "server_backup";
              skipNextProjectAutosaveRef.current = true;
              skipNextCsvAutosaveRef.current = true;
              skipNextWorkspaceDbAutosaveRef.current = true;
              projectItemDbSeededRef.current = false;
              csvItemDbSeededRef.current = false;
            }
            workspaceDbPrimeSyncRef.current = localWorkspaceExists && !snapshot.exists;
            setWorkspaceDbSyncState(snapshot.exists ? "synced" : (localWorkspaceExists ? "pending" : "idle"));
            setWorkspaceDbError("");
          } else {
            workspaceDbPrimeSyncRef.current = localWorkspaceExists;
            setWorkspaceDbSyncState(localWorkspaceExists ? "pending" : "error");
            setWorkspaceDbError(
              localWorkspaceExists
                ? "サーバー状態を確認できなかったため、次回保存時に案件/CSVを再送します。"
                : "案件/CSVのサーバーバックアップを読み込めませんでした。",
            );
          }

          setConfigDbSyncState("syncing");
          const configSnapshot = await fetchConfigSnapshot();
          if (cancelled) {
            return;
          }
          if (configSnapshot.ok) {
            configDbUpdatedAtRef.current = configSnapshot.updatedAt;
            setLastConfigDbSavedAt(formatSyncTimestampLabel(configSnapshot.updatedAt));
            if (!localConfigExists && configSnapshot.exists && configSnapshot.payload) {
              applyConfigSnapshotToLocalStorage(configSnapshot.payload);
              configRestoreSource = "server_backup";
              skipNextConfigDbAutosaveRef.current = true;
              templateItemDbSeededRef.current = false;
            }
            configDbPrimeSyncRef.current = localConfigExists && !configSnapshot.exists;
            setConfigDbSyncState(configSnapshot.exists ? "synced" : (localConfigExists ? "pending" : "idle"));
            setConfigDbError("");
          } else {
            configDbPrimeSyncRef.current = localConfigExists;
            setConfigDbSyncState(localConfigExists ? "pending" : "error");
            setConfigDbError(
              localConfigExists
                ? "サーバー状態を確認できなかったため、次回保存時にテンプレート/履歴を再送します。"
                : "テンプレート/履歴のサーバーバックアップを読み込めませんでした。",
            );
          }
        }
      }

      loadWorkspaceStateFromStorage(false);
      configSnapshotSignatureRef.current = getLocalConfigSnapshotSignature();
      if (!cancelled) {
        const computedRestoreStatus: RestoreStatus = {
          version: 1,
          recordedAt: currentTimeLabel(),
          workspaceSource: workspaceRestoreSource,
          configSource: configRestoreSource,
          note: buildRestoreStatusNote(workspaceRestoreSource, configRestoreSource),
          detail: `${buildRestoreStatusValue({
            version: 1,
            recordedAt: "",
            workspaceSource: workspaceRestoreSource,
            configSource: configRestoreSource,
            note: "",
          })} を採用しました。`,
        };
        const previousRestoreStatus = readRestoreStatus();
        const shouldPreserveImportRestoreStatus = Boolean(
          previousRestoreStatus
          && (previousRestoreStatus.workspaceSource === "json_import" || previousRestoreStatus.configSource === "json_import")
          && computedRestoreStatus.workspaceSource === "browser_local"
          && computedRestoreStatus.configSource === "browser_local",
        );
        commitRestoreStatus(shouldPreserveImportRestoreStatus ? previousRestoreStatus as RestoreStatus : computedRestoreStatus);
        setHydrated(true);
      }
    };

    void hydrateWorkspace();
    return () => {
      cancelled = true;
    };
  }, [commitRestoreStatus, isOnline, loadWorkspaceStateFromStorage, sharedStorageReady]);

useEffect(() => {
  if (!hydrated) {
    return;
  }
  const handleSharedStorageUpdated = () => {
    skipNextWorkspaceDbAutosaveRef.current = true;
    projectItemDbSeededRef.current = false;
    csvItemDbSeededRef.current = false;
    templateItemDbSeededRef.current = false;
    loadWorkspaceStateFromStorage(true);
    configSnapshotSignatureRef.current = getLocalConfigSnapshotSignature();
    setSharedSyncState("synced");
    commitRestoreStatus({
      version: 1,
      recordedAt: currentTimeLabel(),
      workspaceSource: "shared_sync",
      configSource: "shared_sync",
      note: buildRestoreStatusNote("shared_sync", "shared_sync"),
      detail: "共有同期で届いた内容をこの端末へ反映しました。",
    });
  };
  window.addEventListener(SHARED_STORAGE_UPDATED_EVENT, handleSharedStorageUpdated);
  return () => {
      window.removeEventListener(SHARED_STORAGE_UPDATED_EVENT, handleSharedStorageUpdated);
    };
  }, [commitRestoreStatus, hydrated, loadWorkspaceStateFromStorage]);

  useEffect(() => {
    let cancelled = false;
    const currentUserCurrent = users.find((user) => user.id === currentUserId && user.active && user.approvalStatus === "approved") ?? null;
    const canEditCurrent = Boolean(currentUserCurrent && currentUserCurrent.role !== "viewer");
    const projectEditOwnerCurrent = currentUserCurrent ? getProjectEditLockOwner(currentUserCurrent) : null;

    const applyLockResult = (result: ProjectEditLockSyncResult): void => {
      if (cancelled) {
        return;
      }
      setProjectEditLock(result.lock);
      setProjectEditLockStatus(result.status);
      if (result.status === "locked_by_other") {
        setProjectEditLockNotice(formatProjectEditLockNotice(result.lock, currentUserCurrent?.id));
      } else {
        setProjectEditLockNotice("");
      }
    };

    if (!selectedId || !currentUserCurrent || mode === "csv") {
      applyLockResult({ status: "idle", lock: null });
      return () => {
        cancelled = true;
      };
    }

    const refreshLock = async (acquire: boolean): Promise<void> => {
      const result = await syncProjectEditLock(selectedId, projectEditOwnerCurrent, { acquire });
      applyLockResult(result);
    };

    void refreshLock(canEditCurrent);

    const heartbeat = window.setInterval(() => {
      void refreshLock(canEditCurrent);
    }, PROJECT_EDIT_LOCK_HEARTBEAT_MS);

    const onStorage = (event: StorageEvent): void => {
      if (event.key && event.key !== getProjectEditLockKey(selectedId)) {
        return;
      }
      void refreshLock(false);
    };

    window.addEventListener("storage", onStorage);

    return () => {
      cancelled = true;
      window.clearInterval(heartbeat);
      window.removeEventListener("storage", onStorage);
      if (canEditCurrent) {
        void releaseProjectEditLock(selectedId, projectEditOwnerCurrent);
      }
    };
  }, [currentUserId, mode, selectedId, users]);

  const ensureSelectedProjectWriteLock = useCallback(async (): Promise<boolean> => {
    const currentUserCurrent = users.find((user) => user.id === currentUserId && user.active && user.approvalStatus === "approved") ?? null;
    const canEditCurrent = Boolean(currentUserCurrent && currentUserCurrent.role !== "viewer");
    const projectEditOwnerCurrent = currentUserCurrent ? getProjectEditLockOwner(currentUserCurrent) : null;

    if (selectedId && projectEditOwnerCurrent && canEditCurrent && mode !== "csv") {
      const lockResult = await syncProjectEditLock(selectedId, projectEditOwnerCurrent, { acquire: true });
      setProjectEditLock(lockResult.lock);
      setProjectEditLockStatus(lockResult.status);
      if (lockResult.status !== "owned") {
        setProjectEditLockNotice(formatProjectEditLockNotice(lockResult.lock, currentUserCurrent?.id) || "この案件は現在ほかのユーザーが編集中です。");
        setSharedSyncState("error");
        return false;
      }
      setProjectEditLockNotice("");
    }

    return true;
  }, [currentUserId, mode, selectedId, users]);

  const flushWorkspaceNow = useCallback(async (): Promise<boolean> => {
    if (!hydrated) {
      return false;
    }

    const lockOk = await ensureSelectedProjectWriteLock();
    if (!lockOk) {
      return false;
    }

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    setProjectSaveState("saving");
    const projectSaved = persistProjectsToStorage(projectsRef.current);
    setProjectSaveState(projectSaved ? "saved" : "error");
    setProjectSaveError(projectSaved ? "" : "案件データの端末保存に失敗しました。容量またはブラウザ設定をご確認ください。");

    if (csvSaveTimerRef.current) {
      window.clearTimeout(csvSaveTimerRef.current);
      csvSaveTimerRef.current = null;
    }
    setCsvSaveState("saving");
    const csvSaved = persistCsvEditorToStorage(csvHeadersRef.current, csvDraftRowsRef.current);
    setCsvSaveState(csvSaved ? "saved" : "error");
    setCsvSaveError(csvSaved ? "" : "CSV下書きの端末保存に失敗しました。容量またはブラウザ設定をご確認ください。");

    if (sharedSyncTimerRef.current) {
      window.clearTimeout(sharedSyncTimerRef.current);
      sharedSyncTimerRef.current = null;
    }
    if (workspaceDbSaveTimerRef.current) {
      window.clearTimeout(workspaceDbSaveTimerRef.current);
      workspaceDbSaveTimerRef.current = null;
    }
    if (configDbSaveTimerRef.current) {
      window.clearTimeout(configDbSaveTimerRef.current);
      configDbSaveTimerRef.current = null;
    }

    if (!projectSaved || !csvSaved) {
      setSharedSyncState("error");
      setWorkspaceDbSyncState("error");
      return false;
    }

    let projectItemsOk = false;
    if (currentUserId) {
      projectItemsOk = await persistStructuredProjectItemsNow();
    }

    let csvItemsOk = false;
    if (currentUserId) {
      csvItemsOk = await persistStructuredCsvItemsNow();
    }

    let templateItemsOk = false;
    if (currentUserId) {
      templateItemsOk = await persistStructuredTemplateItemsNow();
    }

    let workspaceBackupOk = false;
    if (currentUserId) {
      workspaceBackupOk = await persistWorkspaceSnapshotNow();
    }
    let configBackupOk = false;
    if (currentUserId) {
      configBackupOk = await persistConfigSnapshotNow();
    }

    if (!isOnline) {
      setSharedSyncState("pending");
      return projectItemsOk && csvItemsOk && templateItemsOk && workspaceBackupOk && configBackupOk;
    }

    setSharedSyncState("syncing");
    const pushed = await pushSharedStorageSnapshot({ force: true });
    setSharedSyncState(pushed ? "synced" : "error");
    return pushed && (!currentUserId || (projectItemsOk && csvItemsOk && templateItemsOk && workspaceBackupOk && configBackupOk));
  }, [
    currentUserId,
    ensureSelectedProjectWriteLock,
    hydrated,
    isOnline,
    persistCsvEditorToStorage,
    persistConfigSnapshotNow,
    persistStructuredCsvItemsNow,
    persistStructuredProjectItemsNow,
    persistStructuredTemplateItemsNow,
    persistProjectsToStorage,
    persistWorkspaceSnapshotNow,
  ]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    if (!projectAutosaveReadyRef.current) {
      projectAutosaveReadyRef.current = true;
      if (skipNextProjectAutosaveRef.current) {
        skipNextProjectAutosaveRef.current = false;
        return;
      }
    }
    if (skipNextProjectAutosaveRef.current) {
      skipNextProjectAutosaveRef.current = false;
      return;
    }
    setProjectSaveState("dirty");
    setProjectSaveError("");
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      void (async () => {
        setProjectSaveState("saving");
        const lockOk = await ensureSelectedProjectWriteLock();
        if (!lockOk) {
          saveTimerRef.current = null;
          setProjectSaveState("error");
          setProjectSaveError("ほかのユーザーが編集中のため、案件データを保存できませんでした。");
          return;
        }
        const saved = persistProjectsToStorage(projects);
        setProjectSaveState(saved ? "saved" : "error");
        setProjectSaveError(saved ? "" : "案件データの端末保存に失敗しました。容量またはブラウザ設定をご確認ください。");
        saveTimerRef.current = null;
      })();
    }, PROJECT_SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [ensureSelectedProjectWriteLock, hydrated, persistProjectsToStorage, projects]);

useEffect(() => {
  if (!hydrated) {
    return;
  }
  setSharedSyncState("pending");
  if (sharedSyncTimerRef.current) {
    window.clearTimeout(sharedSyncTimerRef.current);
  }
  sharedSyncTimerRef.current = window.setTimeout(() => {
    setSharedSyncState("syncing");
    void pushSharedStorageSnapshot().then((ok) => {
      setSharedSyncState(ok ? "synced" : "error");
    });
    sharedSyncTimerRef.current = null;
  }, 900);
    return () => {
      if (sharedSyncTimerRef.current) {
        window.clearTimeout(sharedSyncTimerRef.current);
        sharedSyncTimerRef.current = null;
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
        saveTimerRef.current = null;
      }
      const projectSaved = persistProjectsToStorage(projectsRef.current);
      setProjectSaveState(projectSaved ? "saved" : "error");
      setProjectSaveError(projectSaved ? "" : "案件データの端末保存に失敗しました。容量またはブラウザ設定をご確認ください。");
      if (csvSaveTimerRef.current) {
        window.clearTimeout(csvSaveTimerRef.current);
        csvSaveTimerRef.current = null;
      }
      const csvSaved = persistCsvEditorToStorage(csvHeadersRef.current, csvDraftRowsRef.current);
      setCsvSaveState(csvSaved ? "saved" : "error");
      setCsvSaveError(csvSaved ? "" : "CSV下書きの端末保存に失敗しました。容量またはブラウザ設定をご確認ください。");
      if (sharedSyncTimerRef.current) {
        window.clearTimeout(sharedSyncTimerRef.current);
        sharedSyncTimerRef.current = null;
      }
      if (workspaceDbSaveTimerRef.current) {
        window.clearTimeout(workspaceDbSaveTimerRef.current);
        workspaceDbSaveTimerRef.current = null;
      }
      if (configDbSaveTimerRef.current) {
        window.clearTimeout(configDbSaveTimerRef.current);
        configDbSaveTimerRef.current = null;
      }
      if (!projectSaved || !csvSaved) {
        setSharedSyncState("error");
        setWorkspaceDbSyncState("error");
        setConfigDbSyncState("error");
        return;
      }
      if (currentUserId && isOnline) {
        void persistStructuredProjectItemsNow();
        void persistStructuredCsvItemsNow();
        void persistStructuredTemplateItemsNow();
        void persistWorkspaceSnapshotNow({ keepalive: true });
        void persistConfigSnapshotNow({ keepalive: true });
      } else if (currentUserId) {
        setWorkspaceDbSyncState("pending");
        setConfigDbSyncState("pending");
      }
      setSharedSyncState("syncing");
      void pushSharedStorageSnapshot({ keepalive: true, force: true, timeoutMs: 1500 }).then((ok) => {
        setSharedSyncState(ok ? "synced" : "error");
      });
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
      flushNow();
      window.removeEventListener("pagehide", flushNow);
      window.removeEventListener("beforeunload", flushNow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [currentUserId, hydrated, isOnline, persistConfigSnapshotNow, persistCsvEditorToStorage, persistProjectsToStorage, persistStructuredCsvItemsNow, persistStructuredProjectItemsNow, persistStructuredTemplateItemsNow, persistWorkspaceSnapshotNow]);

useEffect(() => {
  if (!hydrated) {
    return;
  }

  const hasPendingLocalWrites = (): boolean => Boolean(saveTimerRef.current || csvSaveTimerRef.current);

  const pullLatestWorkspace = async (): Promise<void> => {
    if (hasPendingLocalWrites()) {
      return;
    }
    const pulled = await pullSharedStorageSnapshot();
    if (!pulled) {
      return;
    }
    loadWorkspaceStateFromStorage(true);
    setSharedSyncState("synced");
  };

  const resyncWorkspace = async () => {
    if (hasPendingLocalWrites()) {
      return;
    }
    setSharedSyncState("syncing");
    const pulled = await pullSharedStorageSnapshot();
    loadWorkspaceStateFromStorage(true);
    const pushed = await pushSharedStorageSnapshot({ force: true });
    setSharedSyncState(pulled || pushed ? "synced" : "error");
  };

  const handleOnline = () => {
    void resyncWorkspace();
  };

  const handleVisible = () => {
    if (document.visibilityState === "visible") {
      void pullLatestWorkspace();
    }
  };

  const interval = window.setInterval(() => {
    if (document.visibilityState === "visible") {
      void pullLatestWorkspace();
    }
  }, SHARED_STORAGE_RESYNC_INTERVAL_MS);

  window.addEventListener("online", handleOnline);
  document.addEventListener("visibilitychange", handleVisible);

  return () => {
    window.clearInterval(interval);
    window.removeEventListener("online", handleOnline);
    document.removeEventListener("visibilitychange", handleVisible);
  };
}, [hydrated, loadWorkspaceStateFromStorage]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    if (users.length > 0) {
      void pushAuthUsersSnapshot(users);
    }
  }, [users, hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    writeSharedStorageItem(AUDIT_STORAGE_KEY, stringifyForStorage(auditLogs));
  }, [auditLogs, hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    writeSharedStorageItem(REVISION_STORAGE_KEY, stringifyForStorage(revisions));
  }, [revisions, hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    if (!csvAutosaveReadyRef.current) {
      csvAutosaveReadyRef.current = true;
      if (skipNextCsvAutosaveRef.current) {
        skipNextCsvAutosaveRef.current = false;
        return;
      }
    }
    if (skipNextCsvAutosaveRef.current) {
      skipNextCsvAutosaveRef.current = false;
      return;
    }
    setCsvSaveState("dirty");
    setCsvSaveError("");
    if (csvSaveTimerRef.current) {
      window.clearTimeout(csvSaveTimerRef.current);
    }
    csvSaveTimerRef.current = window.setTimeout(() => {
      setCsvSaveState("saving");
      const saved = persistCsvEditorToStorage(csvHeaders, csvDraftRows);
      setCsvSaveState(saved ? "saved" : "error");
      setCsvSaveError(saved ? "" : "CSV下書きの端末保存に失敗しました。容量またはブラウザ設定をご確認ください。");
      csvSaveTimerRef.current = null;
    }, CSV_SAVE_DEBOUNCE_MS);
    return () => {
      if (csvSaveTimerRef.current) {
        window.clearTimeout(csvSaveTimerRef.current);
        csvSaveTimerRef.current = null;
      }
    };
  }, [csvDraftRows, csvHeaders, hydrated, persistCsvEditorToStorage]);

  useEffect(() => {
    if (!hydrated || !currentUserId) {
      return;
    }
    if (!workspaceDbAutosaveReadyRef.current) {
      workspaceDbAutosaveReadyRef.current = true;
      if (!workspaceDbPrimeSyncRef.current) {
        return;
      }
    }
    if (skipNextWorkspaceDbAutosaveRef.current) {
      skipNextWorkspaceDbAutosaveRef.current = false;
      return;
    }

    workspaceDbPrimeSyncRef.current = false;
    setWorkspaceDbSyncState("pending");
    setWorkspaceDbError("");

    if (!isOnline) {
      return;
    }

    if (workspaceDbSaveTimerRef.current) {
      window.clearTimeout(workspaceDbSaveTimerRef.current);
    }
    workspaceDbSaveTimerRef.current = window.setTimeout(() => {
      void (async () => {
        await persistStructuredProjectItemsNow();
        await persistStructuredCsvItemsNow();
        await persistWorkspaceSnapshotNow();
      })();
      workspaceDbSaveTimerRef.current = null;
    }, 1200);

    return () => {
      if (workspaceDbSaveTimerRef.current) {
        window.clearTimeout(workspaceDbSaveTimerRef.current);
        workspaceDbSaveTimerRef.current = null;
      }
    };
  }, [
    csvDraftRows,
    csvHeaders,
    currentUserId,
    hydrated,
    isOnline,
    persistStructuredCsvItemsNow,
    persistStructuredProjectItemsNow,
    persistWorkspaceSnapshotNow,
    projects,
    users,
    auditLogs,
    revisions,
    scheduleTemplates,
    detailPhotoTemplates,
    partyTemplates,
    partyCompanyTemplates,
    layoutTemplates,
    approvalNoteTemplates,
  ]);

  useEffect(() => {
    if (!hydrated || !currentUserId || !isOnline || workspaceDbSyncState !== "pending") {
      return;
    }
    if (workspaceDbSaveTimerRef.current) {
      return;
    }
    workspaceDbSaveTimerRef.current = window.setTimeout(() => {
      void (async () => {
        await persistStructuredProjectItemsNow();
        await persistStructuredCsvItemsNow();
        await persistWorkspaceSnapshotNow();
      })();
      workspaceDbSaveTimerRef.current = null;
    }, 400);
  }, [currentUserId, hydrated, isOnline, persistStructuredCsvItemsNow, persistStructuredProjectItemsNow, persistWorkspaceSnapshotNow, workspaceDbSyncState]);

  useEffect(() => {
    if (!hydrated || !currentUserId) {
      return;
    }
    if (!configDbAutosaveReadyRef.current) {
      configDbAutosaveReadyRef.current = true;
      if (!configDbPrimeSyncRef.current) {
        return;
      }
    }
    if (skipNextConfigDbAutosaveRef.current) {
      skipNextConfigDbAutosaveRef.current = false;
      configSnapshotSignatureRef.current = getLocalConfigSnapshotSignature();
      return;
    }

    const nextSignature = getLocalConfigSnapshotSignature();
    if (nextSignature === configSnapshotSignatureRef.current) {
      return;
    }

    configDbPrimeSyncRef.current = false;
    setConfigDbSyncState("pending");
    setConfigDbError("");

    if (!isOnline) {
      return;
    }

    if (configDbSaveTimerRef.current) {
      window.clearTimeout(configDbSaveTimerRef.current);
    }
    configDbSaveTimerRef.current = window.setTimeout(() => {
      void (async () => {
        await persistStructuredTemplateItemsNow();
        await persistConfigSnapshotNow();
      })();
      configDbSaveTimerRef.current = null;
    }, 1200);

    return () => {
      if (configDbSaveTimerRef.current) {
        window.clearTimeout(configDbSaveTimerRef.current);
        configDbSaveTimerRef.current = null;
      }
    };
  }, [
    approvalNoteTemplates,
    auditLogs,
    currentUserId,
    detailPhotoTemplates,
    hydrated,
    isOnline,
    layoutTemplates,
    partyCompanyTemplates,
    partyTemplates,
    persistConfigSnapshotNow,
    persistStructuredTemplateItemsNow,
    revisions,
    scheduleProcedureTemplates,
    scheduleTemplates,
  ]);

  useEffect(() => {
    if (!hydrated || !currentUserId || !isOnline || configDbSyncState !== "pending") {
      return;
    }
    if (configDbSaveTimerRef.current) {
      return;
    }
    configDbSaveTimerRef.current = window.setTimeout(() => {
      void (async () => {
        await persistStructuredTemplateItemsNow();
        await persistConfigSnapshotNow();
      })();
      configDbSaveTimerRef.current = null;
    }, 400);
  }, [configDbSyncState, currentUserId, hydrated, isOnline, persistConfigSnapshotNow, persistStructuredTemplateItemsNow]);

  useEffect(() => {
    if (!hydrated || !currentUserId) {
      return;
    }

    const inspectLocalConfigSnapshot = () => {
      if (document.visibilityState !== "visible") {
        return;
      }
      const nextSignature = getLocalConfigSnapshotSignature();
      if (nextSignature === configSnapshotSignatureRef.current) {
        return;
      }
      setConfigDbSyncState("pending");
      setConfigDbError("");
      if (isOnline && !configDbSaveTimerRef.current) {
        configDbSaveTimerRef.current = window.setTimeout(() => {
          void (async () => {
            await persistStructuredTemplateItemsNow();
            await persistConfigSnapshotNow();
          })();
          configDbSaveTimerRef.current = null;
        }, 1200);
      }
    };

    const interval = window.setInterval(inspectLocalConfigSnapshot, 2500);
    document.addEventListener("visibilitychange", inspectLocalConfigSnapshot);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", inspectLocalConfigSnapshot);
    };
  }, [currentUserId, hydrated, isOnline, persistConfigSnapshotNow, persistStructuredTemplateItemsNow]);

  useEffect(() => {
    try {
      const scheduleRaw = localStorage.getItem(SCHEDULE_TEMPLATE_STORAGE_KEY);
      const scheduleProcedureRaw = localStorage.getItem(SCHEDULE_PROCEDURE_TEMPLATE_STORAGE_KEY);
      const approvalNoteRaw = localStorage.getItem(APPROVAL_NOTE_TEMPLATE_STORAGE_KEY);
      const detailRaw = localStorage.getItem(DETAIL_PHOTO_TEMPLATE_STORAGE_KEY);
      const partyRaw = localStorage.getItem(PARTY_TEMPLATE_STORAGE_KEY);
      const partyCompanyRaw = localStorage.getItem(PARTY_COMPANY_TEMPLATE_STORAGE_KEY);
      const layoutRaw = localStorage.getItem(LAYOUT_TEMPLATE_STORAGE_KEY);
      const scheduleParsed = parseStorageJson<Array<SimpleTemplate<ScheduleRow[]>>>(scheduleRaw) ?? [];
      const scheduleProcedureParsed = parseStorageJson<ScheduleProcedureTemplate[]>(scheduleProcedureRaw);
      const approvalNoteParsed = parseStorageJson<Array<SimpleTemplate<string>>>(approvalNoteRaw) ?? [];
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
      if (Array.isArray(approvalNoteParsed)) {
        const normalizedApprovalTemplates = approvalNoteParsed.filter(
          (template): template is SimpleTemplate<string> =>
            Boolean(template)
            && typeof template.id === "string"
            && typeof template.name === "string"
            && typeof template.createdAt === "string"
            && typeof template.payload === "string",
        );
        setApprovalNoteTemplates(normalizedApprovalTemplates);
        setSelectedApprovalNoteTemplateId(normalizedApprovalTemplates[0]?.id ?? "");
      }
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
    writeSharedStorageItem(SCHEDULE_TEMPLATE_STORAGE_KEY, stringifyForStorage(scheduleTemplates));
  }, [scheduleTemplates, hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    writeSharedStorageItem(SCHEDULE_PROCEDURE_TEMPLATE_STORAGE_KEY, stringifyForStorage(scheduleProcedureTemplates));
  }, [scheduleProcedureTemplates, hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    writeSharedStorageItem(APPROVAL_NOTE_TEMPLATE_STORAGE_KEY, stringifyForStorage(approvalNoteTemplates));
  }, [approvalNoteTemplates, hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    writeSharedStorageItem(DETAIL_PHOTO_TEMPLATE_STORAGE_KEY, stringifyForStorage(detailPhotoTemplates));
  }, [detailPhotoTemplates, hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    writeSharedStorageItem(PARTY_TEMPLATE_STORAGE_KEY, stringifyForStorage(partyTemplates));
  }, [partyTemplates, hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    writeSharedStorageItem(PARTY_COMPANY_TEMPLATE_STORAGE_KEY, stringifyForStorage(partyCompanyTemplates));
  }, [partyCompanyTemplates, hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    writeSharedStorageItem(LAYOUT_TEMPLATE_STORAGE_KEY, stringifyForStorage(layoutTemplates));
  }, [layoutTemplates, hydrated]);

  useEffect(() => {
    setPartyTemplateSelections(EMPTY_PARTY_TEMPLATE_SELECTIONS);
  }, [selectedId]);

  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId && user.active && user.approvalStatus === "approved") ?? null,
    [users, currentUserId],
  );
  const visibleProjects = useMemo(
    () => projects.filter((project) => canUserAccessProject(project, currentUser)),
    [currentUser, projects],
  );
  const selectedProject = useMemo(
    () =>
      visibleProjects.find((project) => project.projectId === selectedId)
      ?? createBlankProject({ projectId: "" }),
    [visibleProjects, selectedId],
  );
  const hasSelectedProject = useMemo(
    () => !!selectedId && visibleProjects.some((project) => project.projectId === selectedId),
    [visibleProjects, selectedId],
  );
  const filteredProjectOptions = useMemo(() => {
    const keyword = projectSearchText.trim().toLowerCase();
    if (!keyword) {
      return visibleProjects.slice(0, 100);
    }
    return visibleProjects
      .filter((project) => {
        const haystack = [
          project.projectId,
          project.propertyName,
        ].join(" ").toLowerCase();
        return haystack.includes(keyword);
      })
      .slice(0, 100);
  }, [visibleProjects, projectSearchText]);
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
    return auditLogs.filter((log) => {
      if (operationLogUserFilter !== "all" && log.userId !== operationLogUserFilter) {
        return false;
      }
      if (operationLogScreenFilter !== "all" && formatAuditScreen(log.action) !== operationLogScreenFilter) {
        return false;
      }
      if (operationLogActionFilter !== "all" && formatAuditAction(log.action) !== operationLogActionFilter) {
        return false;
      }
      return true;
    });
  }, [auditLogs, currentUser, operationLogActionFilter, operationLogScreenFilter, operationLogUserFilter]);
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
  const adminAuditScreenOptions = useMemo(() => {
    if (!currentUser || !isAdminLikeRole(currentUser.role)) {
      return [] as string[];
    }
    return Array.from(new Set(auditLogs.map((log) => formatAuditScreen(log.action)))).sort((a, b) => a.localeCompare(b, "ja-JP"));
  }, [auditLogs, currentUser]);
  const adminAuditActionOptions = useMemo(() => {
    if (!currentUser || !isAdminLikeRole(currentUser.role)) {
      return [] as string[];
    }
    return Array.from(new Set(auditLogs.map((log) => formatAuditAction(log.action)))).sort((a, b) => a.localeCompare(b, "ja-JP"));
  }, [auditLogs, currentUser]);
  const canEdit = !!currentUser && currentUser.role !== "viewer";
  const canAdmin = !!currentUser && isAdminLikeRole(currentUser.role);
  const canApprove = !!currentUser && (isAdminLikeRole(currentUser.role) || currentUser.role === "editor");
  const projectEditLockMessage = useMemo(
    () => formatProjectEditLockNotice(projectEditLock, currentUser?.id),
    [currentUser?.id, projectEditLock],
  );
  const canEditSelectedProject = canEdit
    && (!hasSelectedProject || canUserEditProject(selectedProject, currentUser))
    && (!hasSelectedProject || projectEditLockStatus !== "locked_by_other");
  const cropEditorFrameAspectRatio = useMemo(() => {
    if (!cropEditorImageSize || !cropEditorImageSize.width || !cropEditorImageSize.height) {
      return 4 / 3;
    }
    return cropEditorImageSize.width / cropEditorImageSize.height;
  }, [cropEditorImageSize]);
  const cropEditorSelectionStyle = useMemo<CSSProperties>(
    () => ({
      left: `${cropEditorSelection.x * 100}%`,
      top: `${cropEditorSelection.y * 100}%`,
      width: `${cropEditorSelection.width * 100}%`,
      height: `${cropEditorSelection.height * 100}%`,
    }),
    [cropEditorSelection],
  );
  const userStats = useMemo(() => {
    const total = users.length;
    const admins = users.filter((user) => isAdminLikeRole(user.role)).length;
    const activeAdmins = users.filter((user) => isAdminLikeRole(user.role) && user.active && user.approvalStatus === "approved").length;
    const activeUsers = users.filter((user) => user.active).length;
    const approvedUsers = users.filter((user) => user.active && user.approvalStatus === "approved").length;
    const pendingUsers = users.filter((user) => user.approvalStatus === "pending").length;
    return { total, admins, activeAdmins, activeUsers, approvedUsers, pendingUsers };
  }, [users]);
  const localStorageUsageBytes = useMemo(() => {
    if (typeof window === "undefined") {
      return 0;
    }
    let total = 0;
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key || !key.startsWith("sekou-")) {
        continue;
      }
      const value = window.localStorage.getItem(key) ?? "";
      total += new Blob([key]).size + new Blob([value]).size;
    }
    return total;
  }, [
    auditLogs,
    csvDraftRows,
    csvHeaders,
    detailPhotoTemplates,
    layoutTemplates,
    partyCompanyTemplates,
    partyTemplates,
    projects,
    revisions,
    scheduleTemplates,
    users,
  ]);
  const otherProjects = useMemo(
    () => visibleProjects.filter((project) => project.projectId !== selectedProject.projectId),
    [visibleProjects, selectedProject.projectId],
  );
  const hasOtherProjects = otherProjects.length > 0;
  const copySourceProject = useMemo(
    () => visibleProjects.find((project) => project.projectId === copySourceProjectId),
    [visibleProjects, copySourceProjectId],
  );
  useEffect(() => {
    if (!selectedId) {
      return;
    }
    if (visibleProjects.some((project) => project.projectId === selectedId)) {
      return;
    }
    setSelectedId("");
  }, [selectedId, visibleProjects]);
  const selectedScheduleTemplate = useMemo(
    () => scheduleTemplates.find((template) => template.id === selectedScheduleTemplateId),
    [scheduleTemplates, selectedScheduleTemplateId],
  );
  const selectedScheduleProcedureTemplate = useMemo(
    () => scheduleProcedureTemplates.find((template) => template.id === selectedScheduleProcedureTemplateId),
    [scheduleProcedureTemplates, selectedScheduleProcedureTemplateId],
  );
  const selectedApprovalNoteTemplate = useMemo(
    () => approvalNoteTemplates.find((template) => template.id === selectedApprovalNoteTemplateId),
    [approvalNoteTemplates, selectedApprovalNoteTemplateId],
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
  const projectExportMetaById = useMemo(() => {
    const map = new Map<string, { exported: boolean }>();
    projects.forEach((project) => {
      map.set(
        project.projectId,
        { exported: Boolean((project.pdfExportCount || 0) > 0 || project.pdfLastExportedAt) },
      );
    });
    return map;
  }, [projects]);
  const {
    csvFilteredRows,
    csvTotalPages,
    csvVisibleRows,
    csvSelectedSet,
    csvAllVisibleSelected,
    csvColumnWidthMap,
  } = useCsvTableView({
    csvDraftRows,
    csvHeaders,
    csvSearch,
    csvExportFilter,
    csvPage,
    csvPageSize,
    csvSelectedRows,
    projectExportMetaById,
  });
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
    if (!hydrated || !currentUserId) {
      return;
    }
    if (!isOnline) {
      setConfigDbSyncState("pending");
      return;
    }
    void appendAuditLogEntry(log).then((result) => {
      if (result.ok) {
        setLastConfigDbSavedAt(formatSyncTimestampLabel(result.updatedAt));
        setConfigDbSyncState("synced");
        return;
      }
      setConfigDbSyncState("pending");
      setConfigDbError("監査ログのサーバー追記に失敗しました。ローカル保存から再送します。");
    });
  }

  function buildSnapshot(project: Project): ProjectSnapshot {
    return {
      projectPresetId: project.projectPresetId,
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
      approvalRequestItems: cloneApprovalRequestItems(project.approvalRequestItems),
      coverRecipientSuffix: project.coverRecipientSuffix,
      pdfTemplateId: project.pdfTemplateId,
      pdfCompanyName: project.pdfCompanyName,
      pdfTeam: project.pdfTeam,
      pdfContactPerson: project.pdfContactPerson,
      pdfAddress: project.pdfAddress,
      pdfEmail: project.pdfEmail,
      pdfTel: project.pdfTel,
      pdfFax: project.pdfFax,
      pdfExportCount: project.pdfExportCount,
      pdfLastExportedAt: project.pdfLastExportedAt,
      noticeTemplateId: project.noticeTemplateId,
      noticePropertyName: project.noticePropertyName,
      noticeRecipientName: project.noticeRecipientName,
      noticeSenderCompany: project.noticeSenderCompany,
      noticeHeadline: project.noticeHeadline,
      noticeIntroText: project.noticeIntroText,
      noticeMainWorkDate: project.noticeMainWorkDate,
      noticeOutageDate: project.noticeOutageDate,
      noticeOutageTimeStart: project.noticeOutageTimeStart,
      noticeOutageTimeEnd: project.noticeOutageTimeEnd,
      noticeUnitInspectionEnabled: project.noticeUnitInspectionEnabled,
      noticeScheduleRows: cloneNoticeScheduleRows(project.noticeScheduleRows),
      noticePrivateAreaText: project.noticePrivateAreaText,
      noticeCommonAreaText: project.noticeCommonAreaText,
      noticeCompensationText: project.noticeCompensationText,
      noticeContactCompany: project.noticeContactCompany,
      noticeContactDepartment: project.noticeContactDepartment,
      noticeContactAddress: project.noticeContactAddress,
      noticeContactTel: project.noticeContactTel,
      noticeContactHours: project.noticeContactHours,
      noticeAdviceItems: cloneNoticeAdviceItems(project.noticeAdviceItems),
      layoutAnnotations: cloneLayoutAnnotations(project.layoutAnnotations),
      layoutAnnotationsV2: cloneLayoutAnnotationsV2(project.layoutAnnotationsV2),
      scheduleRows: project.scheduleRows.map((row) => ({ ...row })),
      deletedScheduleRowIds: [...project.deletedScheduleRowIds],
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
    if (!hydrated || !currentUserId) {
      return;
    }
    if (!isOnline) {
      setConfigDbSyncState("pending");
      return;
    }
    void appendRevisionEntry(revision).then((result) => {
      if (result.ok) {
        setLastConfigDbSavedAt(formatSyncTimestampLabel(result.updatedAt));
        setConfigDbSyncState("synced");
        return;
      }
      setConfigDbSyncState("pending");
      setConfigDbError("履歴のサーバー追記に失敗しました。ローカル保存から再送します。");
    });
  }

  const dateRangeLabel = useMemo(
    () => formatDateRange(selectedProject.workDateStart, selectedProject.workDateEnd),
    [selectedProject.workDateStart, selectedProject.workDateEnd],
  );
  const approvalRequestItems = selectedProject.approvalRequestItems;
  const approvalDuplicateTemplateIds = useMemo(() => {
    const counts = new Map<string, number>();
    approvalRequestItems.forEach((item) => {
      if (!item.templateId) {
        return;
      }
      counts.set(item.templateId, (counts.get(item.templateId) || 0) + 1);
    });
    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([templateId]) => templateId));
  }, [approvalRequestItems]);
  const approvalSelectedPrintItems = useMemo(
    () => approvalRequestItems.filter((item) => item.templateId && item.title.trim() && item.body.trim()),
    [approvalRequestItems],
  );
  const approvalHasUnselectedRows = useMemo(
    () => approvalRequestItems.some((item) => !item.templateId),
    [approvalRequestItems],
  );
  const approvalHasEmptyBodyRows = useMemo(
    () => approvalRequestItems.some((item) => item.templateId && !item.body.trim()),
    [approvalRequestItems],
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
  const selectedProjectExportCount = Math.max(0, selectedProject.pdfExportCount || 0);
  const selectedProjectLastExportLabel = (() => {
    if (!selectedProject.pdfLastExportedAt) {
      return "未出力";
    }
    const parsed = new Date(selectedProject.pdfLastExportedAt);
    return Number.isNaN(parsed.getTime()) ? "未出力" : parsed.toLocaleString("ja-JP");
  })();
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
    if (!approvalNoteTemplates.length) {
      setSelectedApprovalNoteTemplateId("");
      return;
    }
    if (
      !selectedApprovalNoteTemplateId
      || !approvalNoteTemplates.some((template) => template.id === selectedApprovalNoteTemplateId)
    ) {
      setSelectedApprovalNoteTemplateId(approvalNoteTemplates[0].id);
    }
  }, [approvalNoteTemplates, selectedApprovalNoteTemplateId]);

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
    if (hasSelectedProject && !canEditSelectedProject) {
      setProjectEditLockNotice(projectEditLockMessage || "この案件は現在ほかのユーザーが編集中です。");
      return;
    }
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
      const nextProject = attachProjectOwner(syncProjectWorkRange(updater(baseProject)), "private");
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
    const currentProject = projectsRef.current.find((project) => project.projectId === selectedId);
    if (!currentProject) {
      return;
    }
    const nextProject = syncProjectWorkRange(updater(currentProject));
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
    const email = loginEmail.trim().toLowerCase();
    const result = await loginWithCredentials(email, loginPassword, "tracking_page");
    if (!result.user) {
      setLoginError(getLoginFailureMessage(result.reason));
      appendAudit("login_failed", `ログイン失敗: ${email}`, selectedProject.projectId);
      setAccessLogs(getLoginAttempts());
      return;
    }
    const user = result.user;
    await pullAuthUsersSnapshot();
    const sharedPulled = await pullSharedStorageSnapshot({ force: true });
    if (sharedPulled) {
      loadWorkspaceStateFromStorage(true);
      setSharedSyncState("synced");
    } else {
      setSharedSyncState("error");
    }
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
    const result = await createUserByAdmin(name, email, password, roleToCreate);
    if (!result.user) {
      if (result.error === "duplicate_email") {
        setUserCreateNotice({ type: "error", text: "このメールアドレスは既に登録済みです。" });
        return;
      }
      if (result.error === "forbidden") {
        setUserCreateNotice({ type: "error", text: "この権限ではユーザー追加ができません。" });
        return;
      }
      setUserCreateNotice({ type: "error", text: "ユーザー追加に失敗しました。時間をおいて再試行してください。" });
      return;
    }
    await pullAuthUsersSnapshot();
    setUsers(ensureUsers() as UserAccount[]);
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
    if (!canEditSelectedProject) {
      setProjectEditLockNotice(projectEditLockMessage || "この案件は現在ほかのユーザーが編集中です。");
      return;
    }
    createRevision(selectedProject, `手動履歴保存 ${new Date().toLocaleString("ja-JP")}`);
    appendAudit("backup_save", "手動で履歴保存", selectedProject.projectId);
  }

  function attachProjectOwner(project: Project, scopeOverride?: Project["accessScope"]): Project {
    if (!currentUser) {
      return {
        ...project,
        accessScope: scopeOverride ?? project.accessScope,
      };
    }
    return {
      ...project,
      accessScope: scopeOverride ?? project.accessScope,
      ownerUserId: project.ownerUserId || currentUser.id,
      ownerUserName: project.ownerUserName || currentUser.name,
    };
  }

  const excludedExportKeys = new Set([
    AUTH_SESSION_STORAGE_KEY,
    AUTH_LOGIN_GUARD_STORAGE_KEY,
    LOCAL_SAVE_META_STORAGE_KEY,
    TEST_EDITOR_SEED_STORAGE_KEY,
  ]);

  function sanitizeLocalStorageImportItems(items: LocalStorageExportItem[]): LocalStorageExportItem[] {
    return items.filter((item) => !excludedExportKeys.has(item.key));
  }

  function collectLocalStorageExportItems(): LocalStorageExportItem[] {
    const items: LocalStorageExportItem[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key || excludedExportKeys.has(key)) {
        continue;
      }
      items.push({
        key,
        value: window.localStorage.getItem(key) ?? "",
      });
    }
    return items.sort((a, b) => a.key.localeCompare(b.key, "ja"));
  }

  function createLocalStorageExportPayload(): LocalStorageExportPayload {
    return {
      app: "sekou-manual-editor",
      exportedAt: new Date().toISOString(),
      items: collectLocalStorageExportItems(),
    };
  }

  function downloadLocalStorageExportPayload(payload: LocalStorageExportPayload, prefix: string): void {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const suffix = payload.exportedAt.replaceAll(":", "-").replaceAll(".", "-");
    anchor.href = url;
    anchor.download = `${prefix}-${suffix}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);
  }

  function replaceLocalStorageItems(items: LocalStorageExportItem[]): void {
    const existingKeys = collectLocalStorageExportItems().map((item) => item.key);
    existingKeys.forEach((key) => window.localStorage.removeItem(key));
    items.forEach((item) => {
      window.localStorage.setItem(item.key, item.value);
    });
    window.localStorage.removeItem(LOCAL_SAVE_META_STORAGE_KEY);
  }

  function exportLocalStorageData(): void {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const payload = createLocalStorageExportPayload();
      downloadLocalStorageExportPayload(payload, "sekou-localstorage-export");
      setUserManageNotice({ type: "ok", text: `データをエクスポートしました（${payload.items.length}件）。` });
    } catch {
      setUserManageNotice({ type: "error", text: "データのエクスポートに失敗しました。" });
    }
  }

  function backupLocalStorageBeforeImport(): LocalStorageExportPayload {
    const payload = createLocalStorageExportPayload();
    downloadLocalStorageExportPayload(payload, "sekou-localstorage-before-import");
    try {
      window.sessionStorage.setItem("sekou-localstorage-before-import-latest", JSON.stringify(payload));
    } catch {
      // Downloaded backup is the primary rollback path; sessionStorage is best-effort.
    }
    return payload;
  }

  function restoreLocalStorageBackup(payload: LocalStorageExportPayload): void {
    replaceLocalStorageItems(payload.items);
    resetSharedStorageSnapshotCache();
  }

  function getImportDuplicateKeys(items: LocalStorageExportItem[]): string[] {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    items.forEach((item) => {
      if (seen.has(item.key)) {
        duplicates.add(item.key);
      }
      seen.add(item.key);
    });
    return Array.from(duplicates).sort((a, b) => a.localeCompare(b, "ja"));
  }

  function getImportChangeSummary(currentItems: LocalStorageExportItem[], nextItems: LocalStorageExportItem[]): string {
    const currentMap = new Map(currentItems.map((item) => [item.key, item.value]));
    const nextMap = new Map(nextItems.map((item) => [item.key, item.value]));
    let added = 0;
    let updated = 0;
    let removed = 0;
    nextMap.forEach((value, key) => {
      if (!currentMap.has(key)) {
        added += 1;
      } else if (currentMap.get(key) !== value) {
        updated += 1;
      }
    });
    currentMap.forEach((_, key) => {
      if (!nextMap.has(key)) {
        removed += 1;
      }
    });
    return `追加 ${added}件 / 更新 ${updated}件 / 削除 ${removed}件`;
  }

  async function importLocalStorageData(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    let preImportBackup: LocalStorageExportPayload | null = null;
    try {
      const raw = await file.text();
      const parsed: unknown = JSON.parse(raw);
      if (!isLocalStorageExportPayload(parsed)) {
        throw new Error("invalid-structure");
      }
      const sanitizedItems = sanitizeLocalStorageImportItems(parsed.items);
      const ignoredKeyCount = parsed.items.length - sanitizedItems.length;
      const duplicateKeys = getImportDuplicateKeys(sanitizedItems);
      if (duplicateKeys.length > 0) {
        throw new Error(`duplicate-keys:${duplicateKeys.slice(0, 5).join(",")}`);
      }
      const currentItems = collectLocalStorageExportItems();
      const changeSummary = getImportChangeSummary(currentItems, sanitizedItems);
      const ok = window.confirm(
        [
          "現在の端末データを上書きしてインポートします。",
          "実行前に現在のデータを自動バックアップとしてダウンロードします。",
          `変更内容: ${changeSummary}`,
          ...(ignoredKeyCount > 0 ? [`補足: セッションや一時状態など ${ignoredKeyCount}件は安全のため読み込み対象から外します。`] : []),
          "続行しますか？",
        ].join("\n"),
      );
      if (!ok) {
        return;
      }
      preImportBackup = backupLocalStorageBeforeImport();
      replaceLocalStorageItems(sanitizedItems);
      resetSharedStorageSnapshotCache();
      commitRestoreStatus({
        version: 1,
        recordedAt: currentTimeLabel(),
        workspaceSource: "json_import",
        configSource: "json_import",
        note: buildRestoreStatusNote("json_import", "json_import"),
        detail: `${changeSummary}${ignoredKeyCount > 0 ? ` / 除外 ${ignoredKeyCount}件` : ""}`,
      });
      const sharedUpdated = await pushSharedStorageSnapshot({ force: true });
      if (!sharedUpdated) {
        setSharedSyncState("pending");
      }
      alert(
        sharedUpdated
          ? "データをインポートしました。インポート前の自動バックアップもダウンロード済みです。画面を再読み込みします。"
          : "データをインポートしました。共有同期は再送待ちです。インポート前の自動バックアップもダウンロード済みです。画面を再読み込みします。",
      );
      window.location.reload();
    } catch {
      if (preImportBackup) {
        try {
          restoreLocalStorageBackup(preImportBackup);
          commitRestoreStatus({
            version: 1,
            recordedAt: currentTimeLabel(),
            workspaceSource: "browser_local",
            configSource: "browser_local",
            note: "インポートに失敗したため、実行前バックアップへ戻しました。",
            detail: "インポート前にダウンロードした自動バックアップと同じ内容へロールバックしました。",
          });
          alert("インポートに失敗したため、実行前のデータへ戻しました。JSON形式とデータ構造を確認してください。");
        } catch {
          alert("インポートに失敗し、自動復元にも失敗しました。ダウンロード済みの before-import バックアップから復元してください。");
        }
      } else {
        alert("インポートに失敗しました。JSON形式とデータ構造を確認してください。");
      }
    } finally {
      event.target.value = "";
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
    if (typeof candidate.exportedAt !== "string") {
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

  function restoreRevision(): void {
    if (!canEditSelectedProject) {
      setProjectEditLockNotice(projectEditLockMessage || "この案件は現在ほかのユーザーが編集中です。");
      return;
    }
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
        deletedScheduleRowIds: [...(selectedRevision.snapshot.deletedScheduleRowIds || [])],
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
      const rows = shiftScheduleRowsByDateDelta(project.scheduleRows, project.workDateStart, normalized, end);
      const shiftedOutageStart = project.outageDateStart ? addDays(project.outageDateStart, diffDays(project.workDateStart, normalized)) : normalized;
      const shiftedOutageEnd = project.outageDateEnd ? addDays(project.outageDateEnd, diffDays(project.workDateStart, normalized)) : end;
      const outage = fitOutageIntoRange(
        shiftedOutageStart,
        project.outageTimeStart,
        shiftedOutageEnd,
        project.outageTimeEnd,
        normalized,
        end,
      );
      const nextNoticeMainWorkDate = project.noticeMainWorkDate === project.workDateStart
        ? normalized
        : project.noticeMainWorkDate;
      const nextNoticeOutageDate = project.noticeOutageDate === project.outageDateStart
        ? outage.startDate
        : project.noticeOutageDate;
      const nextProject = {
        ...project,
        workDateStart: normalized,
        workDateEnd: end,
        outageDateStart: outage.startDate,
        outageTimeStart: outage.startTime,
        outageDateEnd: outage.endDate,
        outageTimeEnd: outage.endTime,
        scheduleRows: rows,
        noticeMainWorkDate: nextNoticeMainWorkDate,
        noticeOutageDate: nextNoticeOutageDate,
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

  function applyProjectPresetSelection(presetId: ProjectPresetId): void {
    const preset = PROJECT_PRESET_MAP.get(presetId);
    updateSelectedProject(
      (project) => applyProjectPreset(project, presetId, { overwriteScheduleRows: true, overwriteNotice: true }),
      {
        action: "template_apply",
        detail: `工事プリセット適用: ${preset?.label ?? presetId}`,
        snapshotLabel: "工事プリセット適用前バックアップ",
      },
    );
    if (preset?.scheduleProcedureTemplateId) {
      setSelectedScheduleProcedureTemplateId(preset.scheduleProcedureTemplateId);
    }
  }

  function applyNoticeTemplateSelection(noticeTemplateId: NoticeTemplateId): void {
    updateSelectedProject(
      (project) => ({
        ...project,
        ...buildNoticeTemplatePatch(project, noticeTemplateId),
      }),
      {
        action: "template_apply",
        detail: `案内文テンプレート適用: ${NOTICE_TEMPLATE_LABELS[noticeTemplateId]}`,
        snapshotLabel: "案内文テンプレート適用前バックアップ",
      },
    );
  }

  function createProject(): void {
    if (!canEdit) {
      return;
    }
    const created = attachProjectOwner(createBlankProject(), "private");
    setProjects((prev) => [created, ...prev]);
    setSelectedId(created.projectId);
    appendAudit("project_create", `新規案件を作成: ${created.projectId}`, created.projectId);
    createRevision(created, "新規案件初期化");
  }

  function deleteSelectedProject(): void {
    if (!canEditSelectedProject) {
      setProjectEditLockNotice(projectEditLockMessage || "この案件は現在ほかのユーザーが編集中です。");
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

  function setCsvEditorData(records: CsvRecord[]): CsvRepairStats {
    const headers = inferCsvHeaders(records);
    const repairedSnapshot = repairCsvSnapshot(headers, records);
    setCsvHeaders(repairedSnapshot.headers);
    setCsvDraftRows(normalizeCsvRows(repairedSnapshot.records, repairedSnapshot.headers));
    setCsvPage(0);
    setCsvSelectedRows([]);
    return repairedSnapshot.stats;
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
      rows.forEach((record) => {
        const importedProject = projectFromCsv(record);
        if (!importedProject) {
          return;
        }
        const existing = map.get(importedProject.projectId);
        map.set(
          importedProject.projectId,
          existing ? mergeProjectFromCsvRecord(existing, record) : attachProjectOwner(importedProject, "shared"),
        );
      });
      return Array.from(map.values());
    });
    setSelectedId(imported[0].projectId);
    setImportStatus(`${imported.length}件を${sourceLabel === "import" ? "CSV取込" : "編集データ反映"}しました`);
    setCsvSelectedRows([]);
    appendAudit("csv_apply", `${imported.length}件を${sourceLabel === "import" ? "CSV取込" : "CSV編集から反映"}`, imported[0].projectId);
  }

  function startNoticeFromCsvRow(record: CsvRecord): void {
    if (!canEdit) {
      return;
    }
    const imported = projectFromCsv(record);
    if (!imported) {
      setImportStatus("案内文開始失敗: project_id 列がある行を選択してください");
      return;
    }

    const existing = projectsRef.current.find((project) => project.projectId === imported.projectId);
    if (existing) {
      const approved = window.confirm(
        `案件「${existing.projectId} | ${existing.propertyName || "（物件名未設定）"}」はすでに存在します。\nCSV の内容で停電案内文向けの基本情報を更新してよろしいですか？`,
      );
      if (!approved) {
        return;
      }
    }

    const nextProject = existing
      ? mergeProjectForNoticeFromCsv(existing, imported)
      : attachProjectOwner(imported, "shared");

    setProjects((prev) => {
      const map = new Map<string, Project>();
      prev.forEach((project) => map.set(project.projectId, project));
      map.set(nextProject.projectId, nextProject);
      return Array.from(map.values());
    });
    setSelectedId(nextProject.projectId);
    setImportStatus(existing
      ? `CSV内容をもとに停電案内文を更新しました: ${nextProject.projectId}`
      : `CSV内容から停電案内文用案件を開始しました: ${nextProject.projectId}`);
    appendAudit(
      existing ? "notice_csv_refresh" : "notice_csv_start",
      existing ? "CSV内容で停電案内文向け基本情報を更新" : "CSV内容から停電案内文を開始",
      nextProject.projectId,
    );
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
    next[CSV_INTERNAL_ROW_ID_KEY] = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? `csv_${crypto.randomUUID()}`
      : `csv_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
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

  function exportCsvEditorForExcel(): void {
    if (!csvHeaders.length || !csvDraftRows.length) {
      return;
    }
    const html = recordsToExcelHtml(csvHeaders, csvDraftRows);
    const utf8Bom = "\uFEFF";
    const blob = new Blob([utf8Bom, html], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sekou_csv_editor_${new Date().toISOString().slice(0, 10)}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCsvImport(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const input = event.currentTarget;
    if (!canEdit) {
      input.value = "";
      return;
    }
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    input.value = "";
    try {
      const decoded = await decodeCsvFile(file);
      const records = parseCsv(decoded.text);
      if (!records.length) {
        setImportStatus("取込失敗: project_id列があるCSVを選択してください");
        return;
      }
      if (decoded.replacementCount > 0) {
        setImportStatus(`取込失敗: 文字化けを検知しました。CSVの文字コードをご確認ください（判定: ${decoded.label}）。`);
        return;
      }
      const repairStats = setCsvEditorData(records);
      if (repairStats.unrecoverableCount > 0) {
        setImportStatus(`文字化けしたCSVデータが ${repairStats.unrecoverableCount} 箇所あります。元CSVを再取込してください。`);
        return;
      }
      if (repairStats.repairedCount > 0) {
        setImportStatus(`${records.length}件をCSV編集スペースへ取り込み、文字化けを ${repairStats.repairedCount} 箇所自動補正しました（文字コード: ${decoded.label}）。内容確認後に「この編集内容を案件に反映」を押してください。`);
        return;
      }
      setImportStatus(`${records.length}件をCSV編集スペースへ取り込みました（文字コード: ${decoded.label}）。内容確認後に「この編集内容を案件に反映」を押してください。`);
    } catch {
      setImportStatus("取込失敗: CSV形式または文字コードを確認してください");
    }
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
        deletedScheduleRowIds: Array.from(new Set([...project.deletedScheduleRowIds, rowId])),
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

  function openImageCropEditor(target: LayoutEditorTarget, sourceDataUrl: string): void {
    if (!sourceDataUrl) {
      return;
    }
    setCropEditorTarget(target);
    setCropEditorSourceDataUrl(sourceDataUrl);
    setCropEditorImageSize(null);
    setCropEditorSelection({ x: 0, y: 0, width: 1, height: 1 });
    setCropEditorDrag(null);
    setCropEditorError("");
    setCropEditorSaving(false);
    setCropEditorOpen(true);
    void loadImageElement(sourceDataUrl)
      .then((img) => {
        setCropEditorImageSize({
          width: Math.max(1, img.naturalWidth || img.width),
          height: Math.max(1, img.naturalHeight || img.height),
        });
      })
      .catch(() => {
        setCropEditorError("画像の読み込みに失敗しました。別の画像で再試行してください。");
      });
  }

  function closeImageCropEditor(): void {
    if (cropEditorSaving) {
      return;
    }
    setCropEditorOpen(false);
    setCropEditorTarget(null);
    setCropEditorSourceDataUrl("");
    setCropEditorImageSize(null);
    setCropEditorError("");
    setCropEditorSelection({ x: 0, y: 0, width: 1, height: 1 });
    setCropEditorDrag(null);
  }

  function resolveCropPointerPoint(event: ReactPointerEvent<HTMLDivElement>): { x: number; y: number } | null {
    const target = cropEditorPreviewRef.current;
    if (!target) {
      return null;
    }
    const rect = target.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }
    return {
      x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
    };
  }

  function onCropPointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    if (!cropEditorSourceDataUrl || cropEditorSaving) {
      return;
    }
    const point = resolveCropPointerPoint(event);
    if (!point) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setCropEditorDrag({
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
      moved: false,
      previousSelection: cropEditorSelection,
    });
    setCropEditorSelection(createCropSelectionRect(point.x, point.y, point.x, point.y));
  }

  function onCropPointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
    if (!cropEditorDrag || cropEditorDrag.pointerId !== event.pointerId) {
      return;
    }
    const point = resolveCropPointerPoint(event);
    if (!point) {
      return;
    }
    event.preventDefault();
    setCropEditorSelection(createCropSelectionRect(cropEditorDrag.startX, cropEditorDrag.startY, point.x, point.y));
    setCropEditorDrag((prev) => {
      if (!prev || prev.pointerId !== event.pointerId) {
        return prev;
      }
      const moved = prev.moved || Math.abs(point.x - prev.startX) > 0.002 || Math.abs(point.y - prev.startY) > 0.002;
      return moved === prev.moved ? prev : { ...prev, moved };
    });
  }

  function onCropPointerEnd(event: ReactPointerEvent<HTMLDivElement>): void {
    if (!cropEditorDrag || cropEditorDrag.pointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();
    const point = resolveCropPointerPoint(event);
    const movedNow = !!point && (Math.abs(point.x - cropEditorDrag.startX) > 0.002 || Math.abs(point.y - cropEditorDrag.startY) > 0.002);
    if (point) {
      setCropEditorSelection(createCropSelectionRect(cropEditorDrag.startX, cropEditorDrag.startY, point.x, point.y));
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!cropEditorDrag.moved && !movedNow) {
      setCropEditorSelection(cropEditorDrag.previousSelection);
    }
    setCropEditorDrag(null);
  }

  async function saveImageCropEditor(): Promise<void> {
    if (!cropEditorTarget || !cropEditorSourceDataUrl) {
      return;
    }
    setCropEditorSaving(true);
    setCropEditorError("");
    try {
      const maxEdge = cropEditorTarget.kind === "layoutImage" || cropEditorTarget.section === "layoutPhotos"
        ? DEFAULT_LAYOUT_MAX_SIZE
        : DEFAULT_PHOTO_MAX_SIZE;
      const quality = cropEditorTarget.kind === "layoutImage" || cropEditorTarget.section === "layoutPhotos"
        ? 0.8
        : 0.76;
      const targetBytes = cropEditorTarget.kind === "layoutImage" || cropEditorTarget.section === "layoutPhotos"
        ? TARGET_LAYOUT_DATA_URL_BYTES
        : TARGET_PHOTO_DATA_URL_BYTES;
      const croppedDataUrl = await cropImageDataUrl(cropEditorSourceDataUrl, {
        selection: normalizeCropSelectionRect(cropEditorSelection),
        maxEdge,
        quality,
        targetBytes,
      });
      if (cropEditorTarget.kind === "layoutImage") {
        updateSelectedProject(
          (project) => ({
            ...project,
            layoutImageDataUrl: croppedDataUrl,
            layoutAnnotations: [],
            layoutAnnotationsV2: [],
          }),
          { action: "layout_image_crop", detail: "配置図画像をトリミング（注釈を初期化）" },
        );
      } else {
        updateSelectedProject(
          (project) => ({
            ...project,
            [cropEditorTarget.section]: project[cropEditorTarget.section].map((item) =>
              item.id === cropEditorTarget.photoId
                ? { ...item, dataUrl: croppedDataUrl, layoutAnnotations: [], layoutAnnotationsV2: [] }
                : item,
            ),
          }),
          {
            action: "photo_crop",
            detail: `${cropEditorTarget.label}をトリミング（注釈を初期化）`,
          },
        );
      }
      closeImageCropEditor();
    } catch {
      setCropEditorError("トリミングの保存に失敗しました。");
    } finally {
      setCropEditorSaving(false);
    }
  }

  function exportPdf(): void {
    if (!canExportPdf) {
      setRequiredHint(`必須項目が未入力です（${totalMissingRequiredCount}件）。`);
      scrollToMissingField();
      return;
    }
    setRequiredHint("");
    if (canEditSelectedProject) {
      updateSelectedProject(
        (project) => ({
          ...project,
          pdfExportCount: Math.max(0, project.pdfExportCount || 0) + 1,
          pdfLastExportedAt: new Date().toISOString(),
        }),
        { action: "pdf_export", detail: "PDF出力を実行", snapshotLabel: "PDF出力実行前バックアップ" },
      );
    }
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

  function exportNoticePdf(): void {
    if (canEditSelectedProject && hasSelectedProject) {
      const noticeDate = selectedProject.noticeOutageDate || selectedProject.noticeMainWorkDate || "-";
      const managementCompany = selectedProject.relatedParties.management.company.trim() || "-";
      const propertyName = selectedProject.noticePropertyName.trim() || selectedProject.propertyName.trim() || "-";
      appendAudit(
        "notice_print",
        `日付: ${noticeDate} / 管理会社: ${managementCompany} / 物件名: ${propertyName}`,
        selectedProject.projectId,
      );
    }
    const originalTitle = document.title;
    setNoticePrintMode(true);
    document.title = "";
    const restore = () => {
      document.title = originalTitle;
      setNoticePrintMode(false);
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

  function addApprovalRequestItem(): void {
    updateSelectedProject((project) => ({
      ...project,
      approvalRequestItems: [
        ...project.approvalRequestItems,
        {
          id: uid("approval_row"),
          templateId: "",
          title: "",
          body: "",
          category: "",
        },
      ],
    }));
  }

  function updateApprovalRequestTemplate(rowId: string, templateId: string): void {
    const template = APPROVAL_REQUEST_TEMPLATE_MAP.get(templateId);
    updateSelectedProject((project) => ({
      ...project,
      approvalRequestItems: project.approvalRequestItems.map((item) => {
        if (item.id !== rowId) {
          return item;
        }
        if (!template) {
          return { ...item, templateId: "", title: "", body: "", category: "" };
        }
        return {
          ...item,
          templateId: template.id,
          title: template.title,
          body: template.body,
          category: template.category,
        };
      }),
    }));
  }

  function updateApprovalRequestBody(rowId: string, body: string): void {
    updateSelectedProject((project) => ({
      ...project,
      approvalRequestItems: project.approvalRequestItems.map((item) => (
        item.id === rowId ? { ...item, body } : item
      )),
    }));
  }

  function removeApprovalRequestItem(rowId: string): void {
    updateSelectedProject((project) => ({
      ...project,
      approvalRequestItems: project.approvalRequestItems.filter((item) => item.id !== rowId),
    }));
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
        writeSharedStorageItem(PARTY_COMPANY_TEMPLATE_STORAGE_KEY, stringifyForStorage(next));
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

  function autoApprovalNoteTemplateName(): string {
    const workHead = selectedProject.titleSubject || selectedProject.propertyName || "承認事項";
    return `${workHead}_承認事項_${autoTemplateName("tpl")}`;
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

  function saveApprovalNoteTemplate(): void {
    if (!canEdit) {
      return;
    }
    const payload = selectedProject.noteApprovalExtra.trim();
    if (!payload) {
      window.alert("承認事項追記を入力してからテンプレート登録してください。");
      return;
    }
    const item: SimpleTemplate<string> = {
      id: uid("tpl_approval_note"),
      name: autoApprovalNoteTemplateName(),
      createdAt: new Date().toISOString(),
      payload,
    };
    setApprovalNoteTemplates((prev) => [item, ...prev]);
    setSelectedApprovalNoteTemplateId(item.id);
  }

  function applyApprovalNoteTemplate(): void {
    if (!selectedApprovalNoteTemplate) {
      return;
    }
    updateSelectedProject(
      (project) => ({ ...project, noteApprovalExtra: selectedApprovalNoteTemplate.payload }),
      {
        action: "template_apply",
        detail: `承認事項テンプレート適用: ${selectedApprovalNoteTemplate.name}`,
        snapshotLabel: "承認事項テンプレート適用前バックアップ",
      },
    );
  }

  function deleteApprovalNoteTemplate(): void {
    if (!canEdit || !selectedApprovalNoteTemplateId) {
      return;
    }
    setApprovalNoteTemplates((prev) => {
      const next = prev.filter((template) => template.id !== selectedApprovalNoteTemplateId);
      setSelectedApprovalNoteTemplateId(next[0]?.id ?? "");
      return next;
    });
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
  const overviewScheduleChunks = useMemo(() => {
    const firstPageSize = Math.max(
      1,
      PDF_LAYOUT_LIMITS.overviewScheduleRowsFirstPage - (selectedProject.outageEnabled ? 1 : 0),
    );
    const firstChunk = selectedProject.scheduleRows.slice(0, firstPageSize);
    const remaining = selectedProject.scheduleRows.slice(firstPageSize);
    const continuationChunks = remaining.length
      ? chunkItems(remaining, PDF_LAYOUT_LIMITS.overviewScheduleRowsContinuationPage)
      : [];
    return [firstChunk, ...continuationChunks];
  }, [selectedProject.outageEnabled, selectedProject.scheduleRows]);
  const detailScheduleChunks = useMemo(
    () => chunkItems(selectedProject.scheduleRows, PDF_LAYOUT_LIMITS.detailRowsPerPage),
    [selectedProject.scheduleRows],
  );
  const approvalScheduleChunks = useMemo(() => {
    const firstChunk = selectedProject.scheduleRows.slice(0, 5);
    const remaining = selectedProject.scheduleRows.slice(5);
    const continuationChunks = remaining.length ? chunkItems(remaining, 10) : [];
    return [firstChunk, ...continuationChunks];
  }, [selectedProject.scheduleRows]);
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
  const localStorageUsageTone = getUsageTone(
    localStorageUsageBytes,
    OPERATION_LIMITS.localStorageWarnBytes,
    OPERATION_LIMITS.localStorageCriticalBytes,
  );
  const projectSaveStatusLabel = projectSaveState === "saving"
    ? "案件保存中..."
    : projectSaveState === "dirty"
      ? "案件に未保存変更あり"
      : projectSaveState === "error"
        ? "案件保存エラー"
        : lastSavedAt === "-"
          ? "案件未保存"
          : `案件保存済み ${lastSavedAt}`;
  const csvSaveStatusLabel = csvSaveState === "saving"
    ? "CSV保存中..."
    : csvSaveState === "dirty"
      ? "CSVに未保存変更あり"
      : csvSaveState === "error"
        ? "CSV保存エラー"
        : lastCsvSavedAt === "-"
          ? "CSV未保存"
          : `CSV保存済み ${lastCsvSavedAt}`;
  const workspaceDbStatusLabel = !currentUserId
    ? "ログイン後に有効化"
    : workspaceDbSyncState === "syncing"
      ? "サーバー保存中..."
      : workspaceDbSyncState === "pending"
        ? (lastWorkspaceDbSavedAt === "-" ? "送信待ち" : `再送待ち / 前回 ${lastWorkspaceDbSavedAt}`)
        : workspaceDbSyncState === "error"
          ? "サーバー保存エラー"
          : lastWorkspaceDbSavedAt === "-"
            ? "未バックアップ"
            : `保存済み ${lastWorkspaceDbSavedAt}`;
  const configDbStatusLabel = !currentUserId
    ? "ログイン後に有効化"
    : configDbSyncState === "syncing"
      ? "サーバー保存中..."
      : configDbSyncState === "pending"
        ? (lastConfigDbSavedAt === "-" ? "送信待ち" : `再送待ち / 前回 ${lastConfigDbSavedAt}`)
        : configDbSyncState === "error"
          ? "サーバー保存エラー"
          : lastConfigDbSavedAt === "-"
            ? "未バックアップ"
            : `保存済み ${lastConfigDbSavedAt}`;
  const workspaceStatusFootnote = "端末保存はこのブラウザ内の即時復元用、DB保存は再ログイン・別端末復元用、共有同期は既存共有APIとの互換用です。オフライン時は端末保存を先に守り、再接続後にDB/共有へ送信します。";
  const workspaceStatusItems: StatusSummaryItem[] = [
    {
      id: "restore-source",
      label: "現在採用中の復元元",
      value: restoreStatus ? buildRestoreStatusValue(restoreStatus) : "判定中...",
      tone: restoreStatus
        ? restoreStatus.workspaceSource === "empty" && restoreStatus.configSource === "empty"
          ? "info"
          : restoreStatus.workspaceSource === "server_backup" || restoreStatus.configSource === "server_backup"
            ? "ok"
            : restoreStatus.workspaceSource === "json_import" || restoreStatus.configSource === "json_import"
              ? "ok"
              : "info"
        : "info",
      detail: restoreStatus
        ? `${restoreStatus.note} (${restoreStatus.recordedAt})${restoreStatus.detail ? ` / ${restoreStatus.detail}` : ""}`
        : "初回読込時に、この端末保存・共有同期・サーバーバックアップのどれを採用したかを表示します。",
    },
    {
      id: "project-save",
      label: "端末保存（案件）",
      value: projectSaveStatusLabel,
      tone: projectSaveState === "error" ? "warn" : projectSaveState === "dirty" || projectSaveState === "saving" ? "info" : "ok",
      detail: projectSaveError || "このブラウザに保存します。再読込時に最初に復元される一次退避です。",
    },
    {
      id: "csv-save",
      label: "端末保存（CSV）",
      value: csvSaveStatusLabel,
      tone: csvSaveState === "error" ? "warn" : csvSaveState === "dirty" || csvSaveState === "saving" ? "info" : "ok",
      detail: csvSaveError || "CSV編集スペースの行・列編集内容をこのブラウザに保存します。",
    },
    {
      id: "workspace-backup",
      label: "DB保存（案件/CSV）",
      value: workspaceDbStatusLabel,
      tone: workspaceDbSyncState === "error"
        ? "warn"
        : workspaceDbSyncState === "pending" || workspaceDbSyncState === "syncing" || workspaceDbSyncState === "idle"
          ? "info"
          : "ok",
      detail: workspaceDbError || "再ログイン・別端末復元に使うサーバー側の構造化保存です。",
    },
    {
      id: "config-backup",
      label: "DB保存（テンプレ/履歴）",
      value: configDbStatusLabel,
      tone: configDbSyncState === "error"
        ? "warn"
        : configDbSyncState === "pending" || configDbSyncState === "syncing" || configDbSyncState === "idle"
          ? "info"
          : "ok",
      detail: configDbError || "テンプレート、履歴、監査ログをサーバー側へ保全します。",
    },
    {
      id: "shared-sync",
      label: "共有同期",
      value: !isOnline
        ? "オフライン / 再接続待ち"
        : sharedSyncState === "pending"
          ? "同期待ち"
          : sharedSyncState === "syncing"
            ? "同期中..."
            : sharedSyncState === "error"
              ? "同期エラー"
              : lastSharedSyncAt === "-"
                ? "共有未同期"
                : `同期済み ${lastSharedSyncAt}`,
      tone: !isOnline || sharedSyncState === "error" ? "warn" : sharedSyncState === "pending" || sharedSyncState === "syncing" ? "info" : "ok",
      detail: "オンライン時に shared storage API へ反映します。DB保存とは別系統です。",
    },
    {
      id: "local-capacity",
      label: "端末容量",
      value: `${formatByteSize(localStorageUsageBytes)} / ${formatByteSize(OPERATION_LIMITS.localStorageCriticalBytes)}`,
      tone: localStorageUsageTone,
      detail: "画像付き案件が増えるほど先に容量へ到達します。",
    },
  ];
  const operationStatusItems: StatusSummaryItem[] = [
    {
      id: "op-users",
      label: "承認済みユーザー",
      value: `${userStats.approvedUsers} / ${OPERATION_LIMITS.recommendedApprovedUsers}名`,
      tone: getUsageTone(userStats.approvedUsers, OPERATION_LIMITS.recommendedApprovedUsers),
      detail: "現行構成での推奨運用目安です。",
    },
    {
      id: "op-projects",
      label: "案件数",
      value: `${projects.length} / ${OPERATION_LIMITS.recommendedProjects}件`,
      tone: getUsageTone(projects.length, OPERATION_LIMITS.recommendedProjects),
      detail: "画像付き案件は件数より先に容量制約が効きます。",
    },
    {
      id: "op-csv",
      label: "CSV行数",
      value: `${csvDraftRows.length} / ${OPERATION_LIMITS.recommendedCsvRows}行`,
      tone: getUsageTone(csvDraftRows.length, OPERATION_LIMITS.recommendedCsvRows),
      detail: "一括編集や検索の体感速度を保つ目安です。",
    },
    {
      id: "op-schedule",
      label: "工程行数",
      value: `${selectedProject.scheduleRows.length} / ${OPERATION_LIMITS.recommendedScheduleRowsPerProject}行`,
      tone: getUsageTone(selectedProject.scheduleRows.length, OPERATION_LIMITS.recommendedScheduleRowsPerProject),
      detail: "超過時はPDFを自動で追加ページへ分割します。",
    },
    {
      id: "op-storage",
      label: "端末保存量",
      value: `${formatByteSize(localStorageUsageBytes)} / ${formatByteSize(OPERATION_LIMITS.localStorageCriticalBytes)}`,
      tone: localStorageUsageTone,
      detail: "容量が増えると保存失敗や上書きリスクが高まります。",
    },
  ];
  const operationRiskNotes = [
    ...(selectedProject.scheduleRows.length > OPERATION_LIMITS.recommendedScheduleRowsPerProject
      ? ["工程行数が多いため、PDF3/PDF4/PDF5は追加ページへ自動分割します。"]
      : []),
    ...(csvDraftRows.length > OPERATION_LIMITS.recommendedCsvRows
      ? ["CSV行数が多めです。操作負荷を抑えるには案件単位で分割したCSV運用がおすすめです。"]
      : []),
    ...(localStorageUsageBytes >= OPERATION_LIMITS.localStorageWarnBytes
      ? ["端末保存量が増えています。JSONエクスポート取得と古い案件の整理を先に行うと安全です。"]
      : []),
  ];
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
  const coreMissingRequiredKeys = useMemo(
    () => requiredMissingKeys.filter((key) => !isDeferredRequiredKey(key)),
    [requiredMissingKeys],
  );
  const deferredMissingRequiredKeys = useMemo(
    () => requiredMissingKeys.filter((key) => isDeferredRequiredKey(key)),
    [requiredMissingKeys],
  );
  const totalMissingRequiredCount = requiredMissingKeys.length;
  const coreMissingRequiredCount = coreMissingRequiredKeys.length;
  const deferredMissingRequiredCount = deferredMissingRequiredKeys.length;
  const canExportPdf = totalMissingRequiredCount === 0;
  const requiredMissingItems = useMemo(() => {
    const staticMap: Record<string, { section: string; label: string }> = {
      propertyName: { section: "基本情報", label: "物件名" },
      coverRecipientSuffix: { section: "基本情報", label: "表紙宛名" },
      titleSubject: { section: "基本情報", label: "件名" },
      propertyAddress: { section: "基本情報", label: "住所" },
      workDateStart: { section: "基本情報", label: "工事開始日" },
      workDateEnd: { section: "基本情報", label: "工事終了日" },
      outageDateStart: { section: "基本情報", label: "停電開始日" },
      outageDateEnd: { section: "基本情報", label: "停電終了日" },
      outageTimeStart: { section: "基本情報", label: "停電開始時間" },
      outageTimeEnd: { section: "基本情報", label: "停電終了時間" },
      scheduleRows: { section: "日程", label: "工程表を1行以上追加" },
      detailPhotos: { section: "写真", label: "参考写真を1枚以上追加" },
      relatedPartiesEnabled: { section: "体制表", label: "反映先会社を1件以上設定" },
      layoutAssets: { section: "配置図・写真", label: "配置図または配置写真を追加" },
    };
    const partyLabelMap: Record<RelatedPartyKey, string> = {
      owner: "発注者",
      utility: "電力会社",
      contractor: "施工会社",
      management: "管理会社",
      residents: "居住者",
    };

    return requiredMissingKeys.map((key) => {
      if (key.startsWith("relatedPartyCompany:")) {
        const partyKey = key.replace("relatedPartyCompany:", "") as RelatedPartyKey;
        return {
          key,
          section: "体制表",
          label: `${partyLabelMap[partyKey] ?? "関連先"}の会社名`,
        };
      }
      const item = staticMap[key];
      return {
        key,
        section: item?.section ?? "確認",
        label: item?.label ?? key,
      };
    });
  }, [requiredMissingKeys]);
  const requiredMissingSections = useMemo(() => {
    const sectionMap = new Map<string, typeof requiredMissingItems>();
    requiredMissingItems.forEach((item) => {
      const current = sectionMap.get(item.section) ?? [];
      current.push(item);
      sectionMap.set(item.section, current);
    });
    return Array.from(sectionMap.entries()).map(([section, items]) => ({ section, items }));
  }, [requiredMissingItems]);
  const syncStatusLabel = projectSaveStatusLabel;
  const syncStatusTone = projectSaveState === "error"
    ? "warn"
    : projectSaveState === "dirty" || projectSaveState === "saving"
      ? "info"
      : "ok";
  const saveStatusLabel = csvSaveStatusLabel;
  const saveStatusTone = csvSaveState === "error"
    ? "warn"
    : csvSaveState === "dirty" || csvSaveState === "saving"
      ? "info"
      : "ok";
  const cloudSyncLabel = !isOnline
    ? (lastSharedSyncAt === "-" ? "クラウド再接続待ち" : `クラウド再接続待ち / 前回 ${lastSharedSyncAt}`)
    : (lastSharedSyncAt === "-" ? "クラウド未同期" : `クラウド同期 ${lastSharedSyncAt}`);
  const cloudSyncTone = !isOnline || sharedSyncState === "error"
    ? "warn"
    : sharedSyncState === "syncing" || sharedSyncState === "pending"
      ? "info"
      : "ok";
  const scheduleStatusItems: StatusSummaryItem[] = [
    {
      id: "schedule-count",
      label: "工程行数",
      value: `${selectedProject.scheduleRows.length} / ${OPERATION_LIMITS.recommendedScheduleRowsPerProject}行`,
      tone: getUsageTone(selectedProject.scheduleRows.length, OPERATION_LIMITS.recommendedScheduleRowsPerProject),
      detail: "入力は増やせますが、多いほど確認負荷が上がります。",
    },
    {
      id: "schedule-pages",
      label: "自動追加ページ",
      value: `PDF3 ${overviewScheduleChunks.length} / PDF4 ${detailScheduleChunks.length} / PDF5 ${approvalScheduleChunks.length}`,
      tone: overviewScheduleChunks.length > 1 || detailScheduleChunks.length > 1 || approvalScheduleChunks.length > 1 ? "info" : "ok",
      detail: "行数が多い場合は印刷時に自動で続きページへ分割します。",
    },
    {
      id: "schedule-guideline",
      label: "出力の目安",
      value: "工程は1行1作業を基本化",
      tone: "ok",
      detail: "停電時間を含めて 12 行以内に収めると調整しやすいです。",
    },
  ];
  function scrollToFieldTarget(selector: string, reveal?: () => void): void {
    const performScroll = () => {
      const target = document.querySelector(selector) as HTMLElement | null;
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
    };

    if (reveal) {
      reveal();
      window.setTimeout(performScroll, 120);
      return;
    }
    performScroll();
  }

  function scrollToMissingField(targetKey?: string): void {
    const key = targetKey || requiredMissingKeys[0];
    if (!key) {
      return;
    }
    const reveal = isEditorMode && isMobileFieldViewport()
      ? () => setMobileEditorSection(getMobileEditorSectionForRequiredKey(key))
      : undefined;
    scrollToFieldTarget(`[data-required-key="${key}"]`, reveal);
  }

  function scrollToMiniInput(): void {
    if (requiredMissingKeys.length) {
      scrollToMissingField();
      return;
    }
    const selector = '[data-required-key="propertyName"]';
    const firstRequired = document.querySelector(selector) as HTMLElement | null;
    if (!firstRequired) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    scrollToFieldTarget(selector, isEditorMode && isMobileFieldViewport() ? () => setMobileEditorSection("pdf1") : undefined);
  }

  async function handleManualSave(): Promise<void> {
    if (!canEditSelectedProject) {
      return;
    }
    await flushWorkspaceNow();
  }

  function openActionMenu(): void {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      setMobileMenuOpen(true);
      return;
    }
    void router.push("/menu");
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
  const isNoticeMode = mode === "notice";
  const showEditorAssist = false;

  useEffect(() => {
    if (!isEditorMode || !hasSelectedProject || totalMissingRequiredCount === 0) {
      setMissingPanelOpen(false);
    }
  }, [hasSelectedProject, isEditorMode, totalMissingRequiredCount]);

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
    setMobileEditorSection("pdf1");
  }, [mode, selectedId]);

  const mobileEditorStepIndex = Math.max(
    0,
    MOBILE_EDITOR_SECTION_OPTIONS.findIndex((option) => option.key === mobileEditorSection),
  );
  const mobileEditorCurrentStep = MOBILE_EDITOR_SECTION_OPTIONS[mobileEditorStepIndex] ?? MOBILE_EDITOR_SECTION_OPTIONS[0];
  const mobileEditorPrevStep = MOBILE_EDITOR_SECTION_OPTIONS[mobileEditorStepIndex - 1];
  const mobileEditorNextStep = MOBILE_EDITOR_SECTION_OPTIONS[mobileEditorStepIndex + 1];

  function jumpToMobileEditorSection(section: MobileEditorSection): void {
    setMobileEditorSection(section);
    if (isMobileFieldViewport()) {
      window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 0);
    }
  }

  function getMobileEditorSectionClass(section: MobileEditorSection | MobileEditorSection[]): string {
    const sections = Array.isArray(section) ? section : [section];
    return `mobile-workflow-section${sections.includes(mobileEditorSection) ? " is-active" : ""}`;
  }

  return (
    <>
      <main className={`planner-app ${isCsvMode ? "planner-app-csv" : ""}`}>
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
                      {hasSelectedProject ? <span className="project-picker-current-id">{describeProjectAccess(selectedProject)}</span> : null}
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
                          <small className="project-picker-item-id">{project.accessScope === "private" ? "自分専用" : "共有案件"} / {project.ownerUserName || "所有者未設定"}</small>
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
                disabled={!canEditSelectedProject || !hasSelectedProject || projects.length <= 1}
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
        <button
          type="button"
          className={`btn mobile-fab-menu ${mobileMenuOpen ? "is-open" : ""}`}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-global-menu"
          aria-label={mobileMenuOpen ? "メニューを閉じる" : "メニューを開く"}
          onClick={() => setMobileMenuOpen((prev) => !prev)}
        >
          <span className="btn-icon"><UiIcon name={mobileMenuOpen ? "clear" : "menu"} /></span>
          {mobileMenuOpen ? "閉じる" : "メニュー"}
        </button>

        <nav className="workspace-switch" aria-label="Workspace navigation">
          <div className="workspace-switch-group">
            <Link href="/editor" className={`workspace-link ${isEditorMode ? "active" : ""}`}>施工計画書編集</Link>
            <Link href="/csv" className={`workspace-link ${isCsvMode ? "active" : ""}`}>CSV編集スペース</Link>
            <Link href="/notice" className={`workspace-link ${isNoticeMode ? "active" : ""}`}>停電案内文</Link>
            <Link href="/tracking" className={`workspace-link ${isTrackingMode ? "active" : ""}`}>ログイン管理</Link>
          </div>
          <Link href="/menu" className="workspace-link subtle workspace-link-back">メニューへ戻る</Link>
        </nav>

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
                  disabled={!canEditSelectedProject || !hasSelectedProject || projects.length <= 1}
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
            <Link href="/notice" className={`workspace-link ${isNoticeMode ? "active" : ""}`} onClick={() => setMobileMenuOpen(false)}>停電案内文</Link>
            <Link href="/tracking" className={`workspace-link ${isTrackingMode ? "active" : ""}`} onClick={() => setMobileMenuOpen(false)}>ログイン管理</Link>
            <Link href="/menu" className="workspace-link subtle workspace-link-back mobile-menu-back-link" onClick={() => setMobileMenuOpen(false)}>メニューへ戻る</Link>
          </div>
        </aside>
        {isEditorMode ? (
          <section className="mobile-workflow-switcher" aria-label="現場モード">
            <div className="mobile-workflow-tabs" role="tablist" aria-label="施工計画書の入力セクション">
              {MOBILE_EDITOR_SECTION_OPTIONS.map((option) => (
                <button
                  key={`mobile_editor_section_${option.key}`}
                  type="button"
                  className={`mobile-workflow-tab ${mobileEditorSection === option.key ? "is-active" : ""}`}
                  onClick={() => jumpToMobileEditorSection(option.key)}
                  role="tab"
                  aria-selected={mobileEditorSection === option.key}
                >
                  <span>{option.label}</span>
                  <span className={`mobile-workflow-tab-status ${cardStatus[option.key].done ? "is-done" : "is-todo"}`}>
                    {cardStatus[option.key].done ? "完了" : `${cardStatus[option.key].missing.length}件`}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}
        {isEditorMode && hasSelectedProject && coreMissingRequiredCount > 0 ? (
          <button
            type="button"
            className="btn missing-jump-fab"
            onClick={() => setMissingPanelOpen(true)}
            title={`今すぐ入力したい未入力項目 ${coreMissingRequiredCount} 件の一覧を開く`}
          >
            <span className="btn-icon"><UiIcon name="down" /></span>
            <span>未入力一覧</span>
            <span className="missing-jump-fab-count">{coreMissingRequiredCount}件</span>
          </button>
        ) : null}

        {isEditorMode && hasSelectedProject && missingPanelOpen ? (
          <>
            <div
              className="missing-panel-backdrop"
              onClick={() => setMissingPanelOpen(false)}
              aria-hidden="true"
            />
            <section className="missing-panel" role="dialog" aria-modal="true" aria-label="未入力項目一覧">
              <div className="missing-panel-head">
                <div>
                  <h3>未入力一覧</h3>
                  <p className="mini">
                    まず埋めたい基本項目を先に案内します。
                    {deferredMissingRequiredCount > 0 ? ` 写真・体制表・配置図など、PDF出力前に必要な項目は別で ${deferredMissingRequiredCount} 件あります。` : ""}
                  </p>
                </div>
                <button type="button" className="btn btn-subtle" onClick={() => setMissingPanelOpen(false)}>
                  <span className="btn-icon"><UiIcon name="clear" /></span>
                  閉じる
                </button>
              </div>
              <div className="missing-panel-summary">
                <span className={`status-chip ${syncStatusTone}`}>{syncStatusLabel}</span>
                <span className="status-chip warn">未入力 {totalMissingRequiredCount}件</span>
                <span className={`status-chip ${incompleteCards.length ? "warn" : "ok"}`}>進捗 {completionRate}%</span>
              </div>
              <div className="missing-panel-sections">
                {requiredMissingSections.map(({ section, items }) => (
                  <article key={`missing_section_${section}`} className="missing-panel-section">
                    <div className="missing-panel-section-head">
                      <h4>{section}</h4>
                      <span>{items.length}件</span>
                    </div>
                    <div className="missing-panel-list">
                      {items.map((item) => (
                        <button
                          key={`missing_item_${item.key}`}
                          type="button"
                          className="missing-panel-item"
                          onClick={() => {
                            setMissingPanelOpen(false);
                            scrollToMissingField(item.key);
                          }}
                        >
                          <span>{item.label}</span>
                          <span className="missing-panel-item-action">移動</span>
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : null}

        {projectEditLockNotice ? (
          <section className="panel">
            <p className="mini error-text">{projectEditLockNotice}</p>
          </section>
        ) : null}

        {isEditorMode ? (
          <section className="editor-sticky-status" aria-label="保存状態">
            <div className="editor-sticky-status-shell">
              <StatusSummaryPanel
                compact
                title="保存状態"
                lead="案件データ、CSV、サーバーバックアップの状態を常時表示します。"
                items={workspaceStatusItems}
                footnote={<p className="mini">{workspaceStatusFootnote}</p>}
              />
              {hasSelectedProject ? (
                <section className="panel" aria-label="案件アクセス設定">
                  <div className="panel-head">
                    <h3 className="section-title"><span className="section-icon"><UiIcon name="userPlus" /></span>案件アクセス</h3>
                    <div className="inline-row wrap">
                      <span className={`status-chip ${selectedProject.accessScope === "private" ? "warn" : "ok"}`}>
                        {selectedProject.accessScope === "private" ? "自分専用" : "共有案件"}
                      </span>
                      <span className="status-chip info">所有者: {selectedProject.ownerUserName || "未設定"}</span>
                    </div>
                  </div>
                  <p className="mini">
                    {selectedProject.accessScope === "private"
                      ? "自分専用の案件は、所有者本人と管理者だけが閲覧・編集できます。"
                      : "共有案件は、承認済みユーザー全体で閲覧できます。編集は通常の権限と編集ロックに従います。"}
                  </p>
                  {canUserManageProjectAccess(selectedProject, currentUser) ? (
                    <div className="inline-row wrap">
                      <button
                        type="button"
                        className="btn btn-subtle"
                        onClick={() => updateSelectedProject((project) => ({ ...project, accessScope: "shared" }), {
                          action: "project_access_update",
                          detail: "案件アクセス変更: 共有案件",
                        })}
                        disabled={selectedProject.accessScope === "shared"}
                      >
                        共有案件にする
                      </button>
                      <button
                        type="button"
                        className="btn btn-subtle"
                        onClick={() => updateSelectedProject((project) => ({ ...project, accessScope: "private" }), {
                          action: "project_access_update",
                          detail: "案件アクセス変更: 自分専用",
                        })}
                        disabled={selectedProject.accessScope === "private"}
                      >
                        自分専用にする
                      </button>
                    </div>
                  ) : (
                    <p className="mini">アクセス設定を変更できるのは、所有者本人または管理者です。</p>
                  )}
                </section>
              ) : null}
            </div>
          </section>
        ) : null}

        <CsvEditorSection
          isCsvMode={isCsvMode}
          importStatus={importStatus}
          canEdit={canEdit}
          handleCsvImport={handleCsvImport}
          applyCsvRowsToProjects={applyCsvRowsToProjects}
          csvDraftRows={csvDraftRows}
          exportCsvEditor={exportCsvEditor}
          exportCsvEditorForExcel={exportCsvEditorForExcel}
          addCsvRow={addCsvRow}
          deleteSelectedCsvRows={deleteSelectedCsvRows}
          csvSelectedRows={csvSelectedRows}
          deleteAllCsvRows={deleteAllCsvRows}
          csvSearch={csvSearch}
          setCsvSearch={setCsvSearch}
          csvExportFilter={csvExportFilter}
          setCsvExportFilter={setCsvExportFilter}
          csvPageSize={csvPageSize}
          setCsvPageSize={setCsvPageSize}
          newCsvColumn={newCsvColumn}
          setNewCsvColumn={setNewCsvColumn}
          addCsvColumn={addCsvColumn}
          csvDeleteHeader={csvDeleteHeader}
          setCsvDeleteHeader={setCsvDeleteHeader}
          csvHeaders={csvHeaders}
          deleteCsvColumn={deleteCsvColumn}
          csvBulkHeader={csvBulkHeader}
          setCsvBulkHeader={setCsvBulkHeader}
          csvBulkValue={csvBulkValue}
          setCsvBulkValue={setCsvBulkValue}
          applyBulkCsvEdit={applyBulkCsvEdit}
          csvBulkNotice={csvBulkNotice}
          setCsvBulkNotice={setCsvBulkNotice}
          csvAllVisibleSelected={csvAllVisibleSelected}
          toggleCsvVisibleSelection={toggleCsvVisibleSelection}
          csvVisibleRows={csvVisibleRows}
          csvColumnWidthMap={csvColumnWidthMap}
          csvSelectedSet={csvSelectedSet}
          toggleCsvRowSelection={toggleCsvRowSelection}
          updateCsvCell={updateCsvCell}
          deleteCsvRow={deleteCsvRow}
          projectExportMetaById={projectExportMetaById}
          csvPage={csvPage}
          setCsvPage={setCsvPage}
          csvTotalPages={csvTotalPages}
          workspaceStatusItems={workspaceStatusItems}
          workspaceStatusFootnote={workspaceStatusFootnote}
        />

        {isNoticeMode ? (
        <NoticeWorkspace
          hasSelectedProject={hasSelectedProject}
          selectedProject={selectedProject}
          canEdit={canEdit}
          canEditSelectedProject={canEditSelectedProject}
          projectOptions={visibleProjects.map((project) => ({
            projectId: project.projectId,
            propertyName: project.propertyName,
            propertyAddress: project.propertyAddress,
          }))}
          csvDraftRows={csvDraftRows}
          onSelectProject={selectProjectFromSearch}
          onStartFromCsvRow={startNoticeFromCsvRow}
          updateSelectedProject={updateSelectedProject}
          onPrint={exportNoticePdf}
        />
        ) : null}

        <TrackingSection
          isTrackingMode={isTrackingMode}
          currentUser={currentUser}
          loginEmail={loginEmail}
          setLoginEmail={setLoginEmail}
          loginPassword={loginPassword}
          setLoginPassword={setLoginPassword}
          login={login}
          loginError={loginError}
          canEdit={canEdit}
          canEditSelectedProject={canEditSelectedProject}
          canAdmin={canAdmin}
          userStats={userStats}
          newUserName={newUserName}
          setNewUserName={setNewUserName}
          newUserEmail={newUserEmail}
          setNewUserEmail={setNewUserEmail}
          newUserPassword={newUserPassword}
          setNewUserPassword={setNewUserPassword}
          newUserRole={newUserRole}
          setNewUserRole={setNewUserRole}
          createUser={createUser}
          userCreateNotice={userCreateNotice}
          userManageNotice={userManageNotice}
          userListExpanded={userListExpanded}
          setUserListExpanded={setUserListExpanded}
          users={users}
          updateUserApprovalStatusByAdmin={updateUserApprovalStatusByAdmin}
          updateUserRoleByAdmin={updateUserRoleByAdmin}
          deleteUserByAdmin={deleteUserByAdmin}
          accessLogExpanded={accessLogExpanded}
          setAccessLogExpanded={setAccessLogExpanded}
          accessLogs={accessLogs}
          operationLogUserFilter={operationLogUserFilter}
          setOperationLogUserFilter={setOperationLogUserFilter}
          operationLogScreenFilter={operationLogScreenFilter}
          setOperationLogScreenFilter={setOperationLogScreenFilter}
          operationLogActionFilter={operationLogActionFilter}
          setOperationLogActionFilter={setOperationLogActionFilter}
          adminAuditUserOptions={adminAuditUserOptions}
          adminAuditScreenOptions={adminAuditScreenOptions}
          adminAuditActionOptions={adminAuditActionOptions}
          saveManualRevision={saveManualRevision}
          exportLocalStorageData={exportLocalStorageData}
          importFileInputRef={importFileInputRef}
          importLocalStorageData={importLocalStorageData}
          openImportFileDialog={openImportFileDialog}
          selectedRevisionId={selectedRevisionId}
          setSelectedRevisionId={setSelectedRevisionId}
          projectRevisions={projectRevisions}
          restoreRevision={restoreRevision}
          selectedRevision={selectedRevision ?? undefined}
          adminVisibleAuditLogs={adminVisibleAuditLogs}
          adminFilteredAuditLogs={adminFilteredAuditLogs}
          operationLogExpanded={operationLogExpanded}
          setOperationLogExpanded={setOperationLogExpanded}
          userScopedProjectAuditLogs={userScopedProjectAuditLogs}
          userScopedGlobalAuditLogs={userScopedGlobalAuditLogs}
          operationStatusItems={operationStatusItems}
          operationStatusFootnote="上限ではなく推奨運用目安です。特に画像付き案件は件数より先に端末容量がボトルネックになります。"
          operationRiskNotes={operationRiskNotes}
          workspaceStatusItems={workspaceStatusItems}
          workspaceStatusFootnote={workspaceStatusFootnote}
        />

        {isEditorMode && showEditorAssist ? (
        <div className={getMobileEditorSectionClass("pdf1")}>
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
        </div>
        ) : null}

        {isEditorMode && showEditorAssist ? (
        <div className={getMobileEditorSectionClass("pdf1")}>
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
        </div>
        ) : null}

        {isEditorMode && showEditorAssist ? (
        <div className={getMobileEditorSectionClass("pdf1")}>
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
        </div>
        ) : null}

        {isEditorMode && showEditorAssist ? (
        <div className={getMobileEditorSectionClass("pdf1")}>
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
        </div>
        ) : null}

        {isEditorMode && !hasSelectedProject ? (
        <div className={getMobileEditorSectionClass("pdf1")}>
        <section className="panel project-empty-panel">
          <h3>未入力状態で開始できます</h3>
          <p className="mini">PDF1〜7を空欄のまま表示しています。上部検索で既存案件を開くか、このまま入力を始めると新規案件を自動作成します。</p>
          <div className="inline-row wrap">
            {PROJECT_PRESETS.map((preset) => (
              <button
                key={`empty_preset_${preset.id}`}
                type="button"
                className="btn btn-subtle"
                onClick={() => applyProjectPresetSelection(preset.id)}
              >
                <span className="btn-icon"><UiIcon name="template" /></span>{preset.label}
              </button>
            ))}
          </div>
        </section>
        </div>
        ) : null}

        {isEditorMode ? (
        <>
        <div className={getMobileEditorSectionClass(["pdf1", "pdf2"])}>
        <PdfCoverAndTocSection
          canExportPdf={canExportPdf}
          totalMissingRequiredCount={totalMissingRequiredCount}
          scrollToMissingField={scrollToMissingField}
          requiredHint={requiredHint}
          selectedProject={selectedProject}
          activePdfTemplate={activePdfTemplate}
          activeLogoSrc={activeLogoSrc}
          ownerParty={activeParties.owner}
          requiredMissingMap={requiredMissingMap}
          formatDateWithWeekday={formatDateWithWeekday}
          pdfTemplatePresets={PDF_TEMPLATE_PRESETS}
          handlePdfTemplateChange={(event) => handleProjectField("pdfTemplateId", normalizePdfTemplateId(event.target.value))}
          onPropertyNameChange={(value) => handleProjectField("propertyName", value)}
          onCoverRecipientSuffixChange={(value) => handleProjectField("coverRecipientSuffix", value)}
          onTitleSubjectChange={(value) => handleProjectField("titleSubject", value)}
        />
        </div>

        <div className={getMobileEditorSectionClass("pdf3")}>
        <section className="panel page-card" id="card-pdf3">
          <div className="page-card-head">
            <p className="page-card-index">PDF 3</p>
            <div>
              <h2>工事概要・工程表</h2>
              <p className="mini">このカードの入力がPDF3ページ（工事概要）に反映されます</p>
            </div>
          </div>
          <PdfWorkOverviewPreview
            selectedProject={selectedProject}
            dateRangeLabel={dateRangeLabel}
            outageDateTimeLabel={outageDateTimeLabel}
            timeline={timeline}
            graphRows={graphRows}
            formatDateRange={formatDateRange}
            fromTimelineOffset={fromTimelineOffset}
            formatShortDate={formatShortDate}
            tickLabel={tickLabel}
            toMinutes={toMinutes}
            normalizeRowRange={normalizeRowRange}
            toTimelineOffset={toTimelineOffset}
            clamp={clamp}
            getRowColorType={getRowColorType}
            formatDateWithWeekday={formatDateWithWeekday}
          />
          <StatusSummaryPanel
            compact
            title="工程表の運用状態"
            lead="工程行が増えた場合は、PDF3/PDF4/PDF5を自動で続きページへ分割します。"
            items={scheduleStatusItems}
            footnote={
              selectedProject.scheduleRows.length > OPERATION_LIMITS.recommendedScheduleRowsPerProject
                ? <p className="mini warn-text">工程行数が多いため、PDF3/PDF4/PDF5は続きページを自動追加します。</p>
                : undefined
            }
          />
          <div className="grid-2 pdf3-info-stack">
            <article className="sub-panel">
              <h3>基本情報</h3>
              <p className="field-help">日付は「開始→終了」の順で入力してください。停電期間は下段に自動表示されます。</p>
              <div className="field-grid">
                <label className="field span-2">
                  <span>工事プリセット</span>
                  <select className="control" value={selectedProject.projectPresetId} onChange={(event) => applyProjectPresetSelection(event.target.value as ProjectPresetId)}>
                    <option value="custom">手動入力</option>
                    {PROJECT_PRESETS.map((preset) => (
                      <option key={`project_preset_${preset.id}`} value={preset.id}>{preset.label}</option>
                    ))}
                  </select>
                </label>
                <label className="field span-2"><span>住所</span><input data-required-key="propertyAddress" className={`control ${requiredMissingMap.propertyAddress ? "control-missing" : ""}`} value={selectedProject.propertyAddress} onChange={(event) => handleProjectField("propertyAddress", event.target.value)} /></label>
                <label className="field"><span>工事開始日</span><input data-required-key="workDateStart" className={`control ${requiredMissingMap.workDateStart ? "control-missing" : ""}`} type="date" value={selectedProject.workDateStart} onChange={(event) => updateWorkDateStart(event.target.value)} /></label>
                <label className="field"><span>工事終了日</span><input data-required-key="workDateEnd" className={`control ${requiredMissingMap.workDateEnd ? "control-missing" : ""}`} type="date" value={selectedProject.workDateEnd} onChange={(event) => updateWorkDateEnd(event.target.value)} /></label>
                <label className="field"><span>停電開始日</span><input data-required-key="outageDateStart" className={`control ${requiredMissingMap.outageDateStart ? "control-missing" : ""}`} type="date" value={selectedProject.outageDateStart} onChange={(event) => updateOutageDateStart(event.target.value)} /></label>
                <label className="field"><span>停電終了日</span><input data-required-key="outageDateEnd" className={`control ${requiredMissingMap.outageDateEnd ? "control-missing" : ""}`} type="date" value={selectedProject.outageDateEnd} onChange={(event) => updateOutageDateEnd(event.target.value)} /></label>
                <label className="field"><span>停電開始時間</span><input data-required-key="outageTimeStart" className={`control ${requiredMissingMap.outageTimeStart ? "control-missing" : ""}`} type="time" value={selectedProject.outageTimeStart} onChange={(event) => updateOutageRange({ outageTimeStart: normalizeTime(event.target.value, selectedProject.outageTimeStart) }, "field_outage_time_start")} /></label>
                <label className="field"><span>停電終了時間</span><input data-required-key="outageTimeEnd" className={`control ${requiredMissingMap.outageTimeEnd ? "control-missing" : ""}`} type="time" value={selectedProject.outageTimeEnd} onChange={(event) => updateOutageRange({ outageTimeEnd: normalizeTime(event.target.value, selectedProject.outageTimeEnd) }, "field_outage_time_end")} /></label>
                <label className="field span-2"><span>停電を工程表に表示</span><span className="check-pill"><input type="checkbox" checked={selectedProject.outageEnabled} onChange={(event) => handleProjectField("outageEnabled", event.target.checked)} /> 停電時間バーを表示する</span></label>
                <label className="field span-2">
                  <span>案内文テンプレート</span>
                  <select className="control" value={selectedProject.noticeTemplateId} onChange={(event) => applyNoticeTemplateSelection(event.target.value as NoticeTemplateId)}>
                    {(Object.keys(NOTICE_TEMPLATE_LABELS) as NoticeTemplateId[]).map((templateId) => (
                      <option key={`notice_template_${templateId}`} value={templateId}>{NOTICE_TEMPLATE_LABELS[templateId]}</option>
                    ))}
                  </select>
                </label>
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

          {overviewScheduleChunks.length > 1 || detailScheduleChunks.length > 1 ? (
            <p className="mini">工程行が多いため、印刷時は続きページを自動追加します。</p>
          ) : null}
          <div className="table-wrap">
            <table className="schedule-table timeline-edit-table">
              <thead>
                <tr><th>項目</th><th>開始日時</th><th>終了日時</th><th>停電</th><th>備考</th><th>操作</th></tr>
              </thead>
              <tbody>
                <tr key="row_outage_edit">
                  <td data-label="項目"><input className="control" value="停電時間" readOnly /></td>
                  <td data-label="開始日時">
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
                  <td data-label="終了日時">
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
                  <td data-label="停電"><input type="checkbox" checked={selectedProject.outageEnabled} onChange={(event) => handleProjectField("outageEnabled", event.target.checked)} /></td>
                  <td data-label="備考"><input className="control" value="全館停電" readOnly /></td>
                  <td data-label="操作"><span className="mini">表示切替</span></td>
                </tr>
                {selectedProject.scheduleRows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="項目"><input className="control" value={row.label} onChange={(event) => updateScheduleRow(row.id, { label: event.target.value })} /></td>
                    <td data-label="開始日時">
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
                    <td data-label="終了日時">
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
                    <td data-label="停電"><input type="checkbox" checked={row.outage} onChange={(event) => updateScheduleRow(row.id, { outage: event.target.checked })} /></td>
                    <td data-label="備考">
                      <textarea
                        className="control textarea schedule-note-input"
                        value={row.note}
                        onChange={(event) => updateScheduleRow(row.id, { note: event.target.value })}
                        placeholder="備考を入力（長文可）"
                      />
                    </td>
                    <td className="timeline-action-cell" data-label="操作">
                      <details className="secondary-action-details schedule-row-action-menu">
                        <summary>
                          <span className="btn-icon"><UiIcon name="menu" /></span>操作
                        </summary>
                        <div className="secondary-action-content schedule-row-action-content">
                          <button type="button" className="btn btn-subtle row-action-btn" onClick={() => moveScheduleRow(row.id, -1)}>
                            <span className="btn-icon"><UiIcon name="up" /></span>上へ
                          </button>
                          <button type="button" className="btn btn-subtle row-action-btn" onClick={() => moveScheduleRow(row.id, 1)}>
                            <span className="btn-icon"><UiIcon name="down" /></span>下へ
                          </button>
                          <button type="button" className="btn btn-danger row-action-btn" onClick={() => removeScheduleRow(row.id)}>
                            <span className="btn-icon"><UiIcon name="delete" /></span>削除
                          </button>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        </div>

        <div className={getMobileEditorSectionClass("pdf4")}>
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
              {detailScheduleChunks[0]?.map((row) => (
                <section key={`preview_pdf4_${row.id}`} className="preview-work-detail">
                  <h4>■ {row.label}</h4>
                  <p>作業時間: {formatDateWithWeekday(row.startDate)} {row.start}〜{formatDateWithWeekday(row.endDate)} {row.end}{row.outage ? "（停電あり）" : "（停電なし）"}</p>
                  {row.note ? <p>備考: {row.note}</p> : null}
                </section>
              ))}
              {detailScheduleChunks.length > 1 ? <p className="mini">残りの工程は追加ページへ自動で分割されます。</p> : null}
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
                {detailScheduleChunks[0]?.map((row) => (
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
                    <button
                      type="button"
                      className="btn btn-subtle"
                      onClick={() =>
                        openImageCropEditor(
                          {
                            kind: "photo",
                            section: "detailPhotos",
                            photoId: slot.id,
                            label: `参考写真:${slot.label}`,
                          },
                          slot.dataUrl,
                        )
                      }
                      disabled={!canEdit || !slot.dataUrl}
                    >
                      <span className="btn-icon"><UiIcon name="crop" /></span>画像トリミング
                    </button>
                    <button type="button" className="btn btn-subtle" onClick={() => clearPhotoAnnotations("detailPhotos", slot.id)} disabled={!canEdit || (slot.layoutAnnotations?.length || 0) === 0}><span className="btn-icon"><UiIcon name="clear" /></span>画像編集クリア</button>
                    <button type="button" className="btn btn-danger" onClick={() => removePhotoItem("detailPhotos", slot.id)}><span className="btn-icon"><UiIcon name="delete" /></span>削除</button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
        </div>

        <PdfApprovalSection
          className={getMobileEditorSectionClass("pdf5")}
          selectedProject={selectedProject}
          canEdit={canEdit}
          approvalScheduleChunks={approvalScheduleChunks}
          approvalSelectedPrintItems={approvalSelectedPrintItems}
          approvalRequestItems={approvalRequestItems}
          approvalHasUnselectedRows={approvalHasUnselectedRows}
          approvalHasEmptyBodyRows={approvalHasEmptyBodyRows}
          approvalDuplicateTemplateIds={approvalDuplicateTemplateIds}
          formatDateWithWeekday={formatDateWithWeekday}
          addApprovalRequestItem={addApprovalRequestItem}
          removeApprovalRequestItem={removeApprovalRequestItem}
          updateApprovalRequestTemplate={updateApprovalRequestTemplate}
          updateApprovalRequestBody={updateApprovalRequestBody}
          onNoteApprovalExtraChange={(value) => handleProjectField("noteApprovalExtra", value)}
        />

        <PdfOrganizationSection
          className={getMobileEditorSectionClass("pdf6")}
          activePdfTemplate={activePdfTemplate}
          selectedProject={selectedProject}
          activeParties={activeParties}
          canEdit={canEdit}
          partyTemplates={partyTemplates}
          selectedPartyTemplateId={selectedPartyTemplateId}
          selectedPartyTemplate={selectedPartyTemplate}
          partyCompanyTemplates={partyCompanyTemplates}
          partyTemplateSelections={partyTemplateSelections}
          requiredMissingMap={requiredMissingMap}
          partySlide={partySlide}
          totalPartySlides={totalPartySlides}
          partySlideSize={partySlideSize}
          partyEntries={partyEntries}
          onSelectPartyTemplateId={setSelectedPartyTemplateId}
          onApplyPartyTemplate={applyPartyTemplate}
          onSavePartyTemplate={savePartyTemplate}
          onDeletePartyTemplate={deletePartyTemplate}
          onPartySlideChange={setPartySlide}
          onUpdateRelatedParty={updateRelatedParty}
          onApplyRelatedPartyCompanyTemplate={applyRelatedPartyCompanyTemplate}
          onSaveRelatedPartyCompanyTemplate={saveRelatedPartyCompanyTemplate}
        />

        <div className={getMobileEditorSectionClass("pdf7")}>
        <section className="panel page-card" id="card-pdf7">
          <div className="page-card-head">
            <p className="page-card-index">PDF 7</p>
            <div>
              <h2>配置図・写真アップロード</h2>
              <p className="mini">配置図上段 + 写真A〜D（PDF7専用）が反映されます</p>
            </div>
          </div>
          <CardPreview title="PDF7 配置図・写真">
            <PdfLayoutPhotoPreview
              selectedProject={selectedProject}
              layoutPhotosFilled={layoutPhotosFilled}
              renderAnnotatedImage={(props) => <LayoutAnnotatedImage {...props} />}
            />
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
                  openImageCropEditor(
                    { kind: "layoutImage", label: "配置図画像" },
                    selectedProject.layoutImageDataUrl,
                  )
                }
                disabled={!canEdit || !selectedProject.layoutImageDataUrl}
              >
                <span className="btn-icon"><UiIcon name="crop" /></span>画像トリミング
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
                    <button
                      type="button"
                      className="btn btn-subtle"
                      onClick={() =>
                        openImageCropEditor(
                          {
                            kind: "photo",
                            section: "layoutPhotos",
                            photoId: slot.id,
                            label: `配置写真:${slot.label}`,
                          },
                          slot.dataUrl,
                        )
                      }
                      disabled={!canEdit || !slot.dataUrl}
                    >
                      <span className="btn-icon"><UiIcon name="crop" /></span>画像トリミング
                    </button>
                    <button type="button" className="btn btn-subtle" onClick={() => clearPhotoAnnotations("layoutPhotos", slot.id)} disabled={!canEdit || (slot.layoutAnnotations?.length || 0) === 0}><span className="btn-icon"><UiIcon name="clear" /></span>画像編集クリア</button>
                    <button type="button" className="btn btn-danger" onClick={() => removePhotoItem("layoutPhotos", slot.id)}><span className="btn-icon"><UiIcon name="delete" /></span>削除</button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
        </div>
        <nav className="mobile-step-footer" aria-label="PDF入力ステップ操作">
          <div className="mobile-step-footer-head">
            <span>{mobileEditorCurrentStep.label}</span>
            <span className={`status-chip ${cardStatus[mobileEditorCurrentStep.key].done ? "ok" : "warn"}`}>
              {cardStatus[mobileEditorCurrentStep.key].done ? "このページ完了" : `未入力 ${cardStatus[mobileEditorCurrentStep.key].missing.length}件`}
            </span>
          </div>
          <div className="mobile-step-footer-progress" aria-label={`完成度 ${completionRate}%`}>
            <span style={{ width: `${completionRate}%` }} />
          </div>
          <div className="mobile-step-footer-actions">
            <button
              type="button"
              className="btn btn-subtle"
              onClick={() => mobileEditorPrevStep && jumpToMobileEditorSection(mobileEditorPrevStep.key)}
              disabled={!mobileEditorPrevStep}
            >
              <span className="btn-icon"><UiIcon name="arrowLeft" /></span>前へ
            </button>
            {mobileEditorNextStep ? (
              <button
                type="button"
                className="btn btn-accent"
                onClick={() => jumpToMobileEditorSection(mobileEditorNextStep.key)}
              >
                次へ<span className="btn-icon"><UiIcon name="arrowRight" /></span>
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-accent"
                onClick={exportPdf}
                disabled={!canExportPdf}
                title={!canExportPdf ? "必須項目を入力するとPDF出力できます" : ""}
              >
                <span className="btn-icon"><UiIcon name="pdf" /></span>PDF出力
              </button>
            )}
          </div>
        </nav>
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

      {isEditorMode && cropEditorOpen ? (
      <section className="crop-editor-backdrop" role="dialog" aria-modal="true" aria-label="画像トリミング">
        <article className="crop-editor-panel">
          <div className="crop-editor-head">
            <div>
              <h3>{cropEditorTarget ? `${cropEditorTarget.label} 画像トリミング` : "画像トリミング"}</h3>
              <p className="mini">画像の上をドラッグして切り抜き枠を決めてください。</p>
            </div>
            <div className="inline-row">
              <button type="button" className="btn btn-subtle" onClick={closeImageCropEditor} disabled={cropEditorSaving}>
                閉じる
              </button>
              <button
                type="button"
                className="btn btn-accent"
                onClick={() => {
                  void saveImageCropEditor();
                }}
                disabled={cropEditorSaving || !cropEditorSourceDataUrl}
              >
                {cropEditorSaving ? "保存中..." : "トリミングを保存"}
              </button>
            </div>
          </div>
          <div className="crop-editor-body">
            <div className="crop-editor-preview-wrap">
              <div
                ref={cropEditorPreviewRef}
                className="crop-editor-frame"
                style={{ aspectRatio: `${cropEditorFrameAspectRatio}` }}
                onPointerDown={onCropPointerDown}
                onPointerMove={onCropPointerMove}
                onPointerUp={onCropPointerEnd}
                onPointerCancel={onCropPointerEnd}
              >
                {cropEditorSourceDataUrl ? (
                  <img
                    src={cropEditorSourceDataUrl}
                    alt={cropEditorTarget ? `${cropEditorTarget.label} トリミングプレビュー` : "トリミングプレビュー"}
                    className="crop-editor-image"
                  />
                ) : (
                  <p className="mini">画像を読み込み中です...</p>
                )}
                <span className="crop-editor-selection" style={cropEditorSelectionStyle} />
                <span className="crop-editor-hint">{cropEditorDrag ? "ドラッグ中..." : "ドラッグして切り抜き範囲を選択"}</span>
              </div>
              {cropEditorImageSize ? (
                <p className="mini crop-editor-meta">元画像サイズ: {cropEditorImageSize.width} x {cropEditorImageSize.height}px</p>
              ) : null}
            </div>
            <div className="crop-editor-controls">
              <p className="mini">操作: 画像をドラッグして範囲を指定し、保存を押すだけです。</p>
              <p className="mini crop-editor-selection-meta">
                選択範囲: 横 {Math.round(cropEditorSelection.width * 100)}% / 縦 {Math.round(cropEditorSelection.height * 100)}%
              </p>
              <button
                type="button"
                className="btn btn-subtle"
                onClick={() => {
                  setCropEditorSelection({ x: 0, y: 0, width: 1, height: 1 });
                }}
                disabled={cropEditorSaving}
              >
                全体を選択（リセット）
              </button>
              {cropEditorError ? <p className="crop-editor-error">{cropEditorError}</p> : null}
            </div>
          </div>
        </article>
      </section>
      ) : null}

      {isEditorMode && hasSelectedProject ? (
      <footer className="bottom-bar" aria-label="Bottom">
        <div className="bottom-bar-status">
          <p className="bottom-bar-project">
            案件: {selectedProject.propertyName || "未設定"} / {selectedProject.projectId}
          </p>
          <div className="bottom-bar-status-chips">
            <span className={`status-chip ${syncStatusTone}`}>{syncStatusLabel}</span>
            <span className={`status-chip ${saveStatusTone}`}>{saveStatusLabel}</span>
            <span className={`status-chip ${cloudSyncTone}`}>{cloudSyncLabel}</span>
            <span className={`status-chip ${incompleteCards.length ? "warn" : "ok"}`}>
              {incompleteCards.length ? `未完了 ${incompleteCards.length}カード` : "PDF出力OK"}
            </span>
            <span className="status-chip">PDF {selectedProjectExportCount}回 / 最終 {selectedProjectLastExportLabel}</span>
          </div>
        </div>
        <div className="bottom-bar-actions">
          <button
            type="button"
            className="btn btn-subtle bottom-bar-save-action"
            data-testid="editor-manual-save"
            onClick={() => void handleManualSave()}
            disabled={!canEditSelectedProject}
            title="現在の案件内容を端末・DB保存へ反映します"
          >
            <span className="btn-icon"><UiIcon name="save" /></span>保存
          </button>
          <button type="button" className="btn btn-subtle bottom-bar-missing-action" onClick={() => setMissingPanelOpen(true)} disabled={totalMissingRequiredCount === 0}>
            <span className="btn-icon"><UiIcon name="down" /></span>{totalMissingRequiredCount > 0 ? `未入力一覧 ${totalMissingRequiredCount}件` : "未入力なし"}
          </button>
          <button
            type="button"
            className="btn btn-accent bottom-bar-pdf-action"
            onClick={exportPdf}
            disabled={!canExportPdf}
            title={!canExportPdf ? "必須項目を入力するとPDF出力できます" : ""}
          >
            <span className="btn-icon"><UiIcon name="pdf" /></span>PDF出力
          </button>
          <details className="secondary-action-details bottom-bar-secondary-actions">
            <summary>
              <span className="btn-icon"><UiIcon name="menu" /></span>その他
            </summary>
            <div className="secondary-action-content">
              <button type="button" className="btn btn-subtle" onClick={openActionMenu}>
                <span className="btn-icon"><UiIcon name="menu" /></span>メニュー
              </button>
            </div>
          </details>
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
                {overviewScheduleChunks[0]?.map((row) => (
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

          {overviewScheduleChunks.slice(1).map((chunk, chunkIndex) => (
            <article className="print-page" key={`overview_schedule_page_${chunkIndex}`}>
              <h2>1．{activePdfTemplate.sectionOverview}（工程表続き）</h2>
              <table className="schedule-table print-schedule">
                <thead>
                  <tr><th>項目</th><th>開始日時</th><th>終了日時</th><th>停電</th><th>備考</th></tr>
                </thead>
                <tbody>
                  {chunk.map((row) => (
                    <tr key={`print_summary_cont_${row.id}`}>
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
          ))}

          <article className="print-page">
            <h2>2．{activePdfTemplate.sectionDetail}</h2>
            {selectedProject.scheduleRows.length === 0 && (
              <p>工程表の作業行が未設定です。工程表を編集すると本セクションにも反映されます。</p>
            )}
            {detailScheduleChunks[0]?.map((row) => (
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

          {detailScheduleChunks.slice(1).map((chunk, chunkIndex) => (
            <article className="print-page" key={`detail_schedule_page_${chunkIndex}`}>
              <h2>2．{activePdfTemplate.sectionDetail}（作業詳細続き）</h2>
              {chunk.map((row) => (
                <section key={`detail_more_${row.id}`} className="work-detail">
                  <h3>■ {row.label}</h3>
                  <p>作業時間: {formatDateWithWeekday(row.startDate)} {row.start}〜{formatDateWithWeekday(row.endDate)} {row.end}{row.outage ? "（停電あり）" : "（停電なし）"}</p>
                  {row.note ? <p>備考: {row.note}</p> : null}
                </section>
              ))}
            </article>
          ))}

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

          <PdfApprovalPrintPages
            activePdfTemplate={activePdfTemplate}
            selectedProject={selectedProject}
            approvalScheduleChunks={approvalScheduleChunks}
            approvalSelectedPrintItems={approvalSelectedPrintItems}
            formatDateWithWeekday={formatDateWithWeekday}
          />

          <PdfOrganizationPrintPages
            activePdfTemplate={activePdfTemplate}
            activeParties={activeParties}
          />

          <PdfLayoutPhotoPrintPages
            selectedProject={selectedProject}
            layoutPhotoChunks={layoutPhotoChunks}
            renderAnnotatedImage={(props) => <LayoutAnnotatedImage {...props} />}
          />
        </div>
      </section>
      ) : null}
      {isNoticeMode && noticePrintMode ? (
      <section className="print-only">
        <NoticePrintDocument project={selectedProject} />
      </section>
      ) : null}
    </>
  );
}
