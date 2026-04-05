import {
  DEFAULT_ANNOTATION_COLOR,
  DEFAULT_ANNOTATION_FILL_COLOR,
  DEFAULT_ANNOTATION_FILL_OPACITY,
  DEFAULT_ANNOTATION_STROKE_WIDTH,
  DEFAULT_TEXT_FONT_FAMILY,
  DEFAULT_TEXT_STROKE_COLOR,
  DEFAULT_TEXT_STROKE_WIDTH,
  LAYOUT_CANVAS_SIZE,
  LAYOUT_TEXT_FONT_OPTIONS,
} from "../../planner/constants";
import type {
  LayoutAnnotation,
  LayoutAnnotationV2,
  LayoutAnnotationV2Style,
  LayoutAnnotationV2Transform,
  LayoutTextAlign,
  NoticeAdviceItem,
  NoticeScheduleRow,
  PdfTemplateId,
  PhotoSlot,
  PhotoSlots,
  Project,
  RelatedParty,
  ScheduleRow,
  WorkCode,
} from "../../planner/types";
import { normalizeDate, normalizeTime } from "../../planner/utils/dateTime";

export type ProjectNormalizationInput = Partial<Project> & {
  workDateMain?: string;
  photos?: Record<string, Partial<PhotoSlot>>;
  relatedParties?: Partial<Project["relatedParties"]>;
};

function nextId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function nextUuid(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return nextId(prefix);
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

function cloneNoticeScheduleRows(rows: NoticeScheduleRow[]): NoticeScheduleRow[] {
  return rows.map((row) => ({ ...row }));
}

function cloneNoticeAdviceItems(items: NoticeAdviceItem[]): NoticeAdviceItem[] {
  return items.map((item) => ({ ...item }));
}

function shiftIsoDate(baseDate: string, days: number): string {
  const parsed = new Date(`${baseDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  parsed.setDate(parsed.getDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function createDefaultNoticeScheduleRows(mainWorkDate?: string): NoticeScheduleRow[] {
  if (!mainWorkDate) {
    return [
      {
        id: nextUuid("notice_row"),
        date: "",
        workType: "本工事",
        outageState: "停電あり",
        note: "本工事",
      },
    ];
  }

  return [
    {
      id: nextUuid("notice_row"),
      date: shiftIsoDate(mainWorkDate, -2),
      workType: "事前工事",
      outageState: "停電なし",
      note: "前工事",
    },
    {
      id: nextUuid("notice_row"),
      date: shiftIsoDate(mainWorkDate, -1),
      workType: "事前工事",
      outageState: "停電なし",
      note: "前工事",
    },
    {
      id: nextUuid("notice_row"),
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
      id: nextUuid("notice_advice"),
      phase: "before",
      title: "電気機器",
      body: "復電時の火災防止のため、ドライヤー、トースター、アイロンなどの電熱機器のプラグはコンセントから抜いてください。",
    },
    {
      id: nextUuid("notice_advice"),
      phase: "before",
      title: "パソコンなどの精密機器",
      body: "パソコン、テレビ、HDDレコーダー、電話機、インターネット関連機器などは、データの消失や再起動時のトラブルを防止するため、電源をあらかじめ切り、コンセントからプラグを抜いてください。",
    },
    {
      id: nextUuid("notice_advice"),
      phase: "before",
      title: "インターネット環境",
      body: "マンション共用設備を通じたインターネット、ホームWi-Fiはご利用できません。必要に応じてスマートフォンのテザリング機能等をご準備ください。",
    },
    {
      id: nextUuid("notice_advice"),
      phase: "before",
      title: "水道",
      body: "停電中は共用部の水道ポンプが作動しないため、ポンプ式の場合は断水します。トイレの利用等も制限されますので、必要に応じて汲み置きなどにより水を確保してください。",
    },
    {
      id: nextUuid("notice_advice"),
      phase: "before",
      title: "給水直結型の家電製品",
      body: "洗濯機、食洗器、ウォシュレットなどをご使用されており、停電中に外出される場合は、可能であれば止水栓の閉栓を行ってください。また、蛇口の締め忘れがないようにご注意ください。",
    },
    {
      id: nextUuid("notice_advice"),
      phase: "before",
      title: "セキュリティシステム",
      body: "セキュリティシステムをご契約の方は、停電を警備会社が異常として感知し現地に出動する場合があるため、あらかじめ警備会社へご連絡ください。",
    },
    {
      id: nextUuid("notice_advice"),
      phase: "before",
      title: "医療機器",
      body: "人工呼吸器などの医療機器をご使用されている場合は、バッテリーなどの代替電源のご準備や、医療機関等への退避などによりご対応ください。特別なご事情があり停電中に電源が必要な場合は、弊社までご連絡ください。",
    },
    {
      id: nextUuid("notice_advice"),
      phase: "during",
      title: "冷蔵庫",
      body: "停電中はドアの開閉を控えていただき、庫内の保冷にご注意ください。",
    },
    {
      id: nextUuid("notice_advice"),
      phase: "after",
      title: "タイマー機能のある電気製品",
      body: "HDDレコーダー、炊飯器、電気給湯器など、停電に伴いタイマーが初期化される場合があるため、ご確認のうえ再設定してください。",
    },
    {
      id: nextUuid("notice_advice"),
      phase: "after",
      title: "エアコン",
      body: "自動復帰機能付のエアコンの場合、動作しているかどうか、再度電源をご確認ください。",
    },
    {
      id: nextUuid("notice_advice"),
      phase: "after",
      title: "水道",
      body: "停電復旧後に濁り水が出る場合があります。その際は濁った水が出なくなるまで水を出してください。",
    },
  ];
}

export function normalizePdfTemplateId(value: unknown): PdfTemplateId {
  if (typeof value !== "string") {
    return "standard";
  }
  const token = value.trim().toLowerCase();
  if (token === "standard" || token === "kansai" || token === "night") {
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

export function createPhotoSlots(labels?: string[]): PhotoSlots {
  const defaults = labels?.length
    ? labels
    : ["写真A（着工前）", "写真B（施工中）", "写真C（施工後）", "写真D（その他）"];
  return defaults.map((label, idx) => ({
    id: nextId(`photo_${idx + 1}`),
    label,
    dataUrl: "",
    layoutAnnotations: [],
    layoutAnnotationsV2: [],
  }));
}

export function createDefaultRelatedParties(
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

export function normalizeLayoutAnnotations(value: unknown): LayoutAnnotation[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const normalized: LayoutAnnotation[] = [];
  value.forEach((raw, index) => {
    if (!raw || typeof raw !== "object") {
      return;
    }
    const item = raw as Partial<LayoutAnnotation> & Record<string, unknown>;
    const id = item.id && String(item.id).trim() ? String(item.id) : nextId(`anno_${index + 1}`);
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

export function legacyLayoutAnnotationsToV2(annotations: LayoutAnnotation[]): LayoutAnnotationV2[] {
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

export function layoutAnnotationsV2ToLegacy(annotations: LayoutAnnotationV2[]): LayoutAnnotation[] {
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

export function normalizeLayoutAnnotationsV2(value: unknown): LayoutAnnotationV2[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const normalized: LayoutAnnotationV2[] = [];
  value.forEach((raw, index) => {
    if (!raw || typeof raw !== "object") {
      return;
    }
    const item = raw as Partial<LayoutAnnotationV2> & Record<string, unknown>;
    const id = item.id && String(item.id).trim() ? String(item.id) : nextId(`anno_v2_${index + 1}`);
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
      normalized.push({
        id,
        type: "arrow",
        groupId,
        name,
        visible,
        locked,
        points: [
          clampCanvasCoord(Number(points[0] ?? 0)),
          clampCanvasCoord(Number(points[1] ?? 0)),
          clampCanvasCoord(Number(points[2] ?? 0)),
          clampCanvasCoord(Number(points[3] ?? 0)),
        ],
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

export function createBlankProject(seed?: Partial<Project>): Project {
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
  const noticeMainWorkDate = seed?.noticeMainWorkDate ?? seed?.workDateStart ?? "";

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
    pdfExportCount: seed?.pdfExportCount ?? 0,
    pdfLastExportedAt: seed?.pdfLastExportedAt ?? "",
    noticePropertyName: seed?.noticePropertyName ?? seed?.propertyName ?? "",
    noticeRecipientName: seed?.noticeRecipientName ?? "お住まいの皆さまへ",
    noticeSenderCompany: seed?.noticeSenderCompany ?? seed?.pdfCompanyName ?? "レジル株式会社",
    noticeHeadline: seed?.noticeHeadline ?? "電気設備点検に伴う全館停電のお知らせ",
    noticeIntroText:
      seed?.noticeIntroText ??
      "平素より弊社サービスをご利用いただき誠にありがとうございます。\nこの度、以下日程にて停電を伴う法定点検を実施いたします。\nお客さまにはご不便をお掛け致しますが、ご理解とご協力のほどよろしくお願い申し上げます。",
    noticeMainWorkDate,
    noticeOutageDate: seed?.noticeOutageDate ?? seed?.outageDateStart ?? noticeMainWorkDate,
    noticeOutageTimeStart: seed?.noticeOutageTimeStart ?? seed?.outageTimeStart ?? "09:00",
    noticeOutageTimeEnd: seed?.noticeOutageTimeEnd ?? seed?.outageTimeEnd ?? "17:00",
    noticeScheduleRows: seed?.noticeScheduleRows ? cloneNoticeScheduleRows(seed.noticeScheduleRows) : createDefaultNoticeScheduleRows(noticeMainWorkDate),
    noticePrivateAreaText:
      seed?.noticePrivateAreaText ??
      "【専有部】家電製品（電気で作動するもの全て）、水道\n※専有部についてのご注意は裏面をご覧ください",
    noticeCommonAreaText:
      seed?.noticeCommonAreaText ??
      "【共用部】エレベーター、オートロック式ドア、インターホン、宅配ボックス、機械式駐車場など\n※上記設備は停電中ご利用いただけませんのでご注意ください",
    noticeCompensationText:
      seed?.noticeCompensationText ??
      "電気設備点検時に発生したお客さまの家電製品及び設備の故障は、弊社に過失がない（通常の点検を実施している）場合、補償いたしかねますので、あらかじめご了承ください。",
    noticeContactCompany: seed?.noticeContactCompany ?? seed?.pdfCompanyName ?? "レジル株式会社",
    noticeContactDepartment: seed?.noticeContactDepartment ?? "サポートセンター",
    noticeContactAddress: seed?.noticeContactAddress ?? "大阪府東大阪市瓜生堂1-2-18",
    noticeContactTel: seed?.noticeContactTel ?? "0120-45-2020",
    noticeContactHours: seed?.noticeContactHours ?? "9:00〜17:00（土日・祝日・年末年始を除く）",
    noticeAdviceItems: seed?.noticeAdviceItems ? cloneNoticeAdviceItems(seed.noticeAdviceItems) : createDefaultNoticeAdviceItems(),
  };
}

export function normalizeProject(project: ProjectNormalizationInput): Project {
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
    } as ScheduleRow;
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
            id: raw.id || nextId(`photo_${idx + 1}`),
            label: raw.label || fallbackLabels[idx] || `写真${idx + 1}`,
            dataUrl: raw.dataUrl || "",
            layoutAnnotations,
            layoutAnnotationsV2,
          } satisfies PhotoSlot;
        })
        .filter((item): item is PhotoSlot => item !== null);
      return normalized.length ? normalized : createPhotoSlots(fallbackLabels);
    }
    if (value && typeof value === "object") {
      const entries = Object.entries(value as Record<string, Partial<PhotoSlot>>);
      const normalized = entries.map(([key, raw], idx) => {
        const normalizedLegacy = normalizeLayoutAnnotations(raw.layoutAnnotations);
        const normalizedV2 = normalizeLayoutAnnotationsV2(raw.layoutAnnotationsV2);
        const layoutAnnotationsV2 = normalizedV2.length ? normalizedV2 : legacyLayoutAnnotationsToV2(normalizedLegacy);
        const layoutAnnotations = normalizedV2.length ? layoutAnnotationsV2ToLegacy(layoutAnnotationsV2) : normalizedLegacy;
        return {
          id: raw.id || key || nextId(`photo_${idx + 1}`),
          label: raw.label || fallbackLabels[idx] || `写真${idx + 1}`,
          dataUrl: raw.dataUrl || "",
          layoutAnnotations,
          layoutAnnotationsV2,
        } satisfies PhotoSlot;
      });
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
      pdfExportCount: Number.isFinite(project.pdfExportCount) ? Number(project.pdfExportCount) : 0,
      pdfLastExportedAt: project.pdfLastExportedAt,
      noticePropertyName: project.noticePropertyName,
      noticeRecipientName: project.noticeRecipientName,
      noticeSenderCompany: project.noticeSenderCompany,
      noticeHeadline: project.noticeHeadline,
      noticeIntroText: project.noticeIntroText,
      noticeMainWorkDate: project.noticeMainWorkDate,
      noticeOutageDate: project.noticeOutageDate,
      noticeOutageTimeStart: project.noticeOutageTimeStart,
      noticeOutageTimeEnd: project.noticeOutageTimeEnd,
      noticeScheduleRows: project.noticeScheduleRows,
      noticePrivateAreaText: project.noticePrivateAreaText,
      noticeCommonAreaText: project.noticeCommonAreaText,
      noticeCompensationText: project.noticeCompensationText,
      noticeContactCompany: project.noticeContactCompany,
      noticeContactDepartment: project.noticeContactDepartment,
      noticeContactAddress: project.noticeContactAddress,
      noticeContactTel: project.noticeContactTel,
      noticeContactHours: project.noticeContactHours,
      noticeAdviceItems: project.noticeAdviceItems,
    }),
    flags,
  };
}
