"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { createBlankProject } from "../project-core/project-normalize";
import { CSV_PROJECT_FIELD_ALIASES, NOTICE_TEMPLATE_STORAGE_KEY } from "../../planner/constants";
import { deleteTemplateItem, saveTemplateItem } from "../../planner/itemPersistence";
import { formatDateWithWeekday } from "../../planner/utils/dateTime";
import { createCsvValueGetter } from "../../planner/utils/csv";
import { parseStorageJson, stringifyForStorage } from "../../planner/utils/storage";
import type { CsvRecord, NoticeAdviceItem, NoticeAdvicePhase, NoticeOutageState, NoticeScheduleRow, NoticeWorkType, Project, SimpleTemplate } from "../../planner/types";
import { UiIcon } from "../../planner/ui/UiIcon";

const NOTICE_PHASE_ORDER: NoticeAdvicePhase[] = ["before", "during", "after"];
const NOTICE_PHASE_LABELS: Record<NoticeAdvicePhase, string> = {
  before: "停電前のご準備",
  during: "停電中",
  after: "復旧後",
};
const NOTICE_WORK_TYPE_OPTIONS: NoticeWorkType[] = ["事前工事", "本工事", "事後工事"];
const NOTICE_OUTAGE_STATE_OPTIONS: NoticeOutageState[] = ["停電なし", "停電あり"];
const NOTICE_PROVIDER_OPTIONS = ["rezil", "nttae"] as const;
const NOTICE_SECOND_PAGE_NOTE =
  "停電時に発生したお客さまの家電製品及び設備の不具合についての原因方法等は、取扱説明書をご確認いただくか、お客さまからメーカーへ直接お問い合わせいただきますようお願いいたします。";
const NOTICE_PROVIDER_LABELS: Record<(typeof NOTICE_PROVIDER_OPTIONS)[number], string> = {
  rezil: "レジル物件",
  nttae: "NTTAE物件",
};

type NoticeProjectOption = {
  projectId: string;
  propertyName: string;
  propertyAddress: string;
};

type NoticeWorkspaceProps = {
  hasSelectedProject: boolean;
  selectedProject: Project;
  canEdit: boolean;
  canEditSelectedProject: boolean;
  projectOptions: NoticeProjectOption[];
  csvDraftRows: CsvRecord[];
  onSelectProject: (projectId: string) => void;
  onStartFromCsvRow: (record: CsvRecord) => void;
  updateSelectedProject: (updater: (project: Project) => Project) => void;
  onPrint: () => void;
};

type NoticePrintDocumentProps = {
  project: Project;
  preview?: boolean;
};

type NoticeScenarioProvider = (typeof NOTICE_PROVIDER_OPTIONS)[number];
type NoticeScenarioOptions = {
  provider: NoticeScenarioProvider;
  meterReplacement: boolean;
  unitInspectionEnabled: boolean;
};

type NoticePatternKey =
  | "rezil_basic"
  | "equipment_pas"
  | "equipment_ugs"
  | "rezil_meter"
  | "nttae_basic"
  | "nttae_meter";

type NoticeTemplatePayload = Pick<
  Project,
  | "noticeTemplateId"
  | "noticeSenderCompany"
  | "noticeHeadline"
  | "noticeIntroText"
  | "noticeMainWorkDate"
  | "noticeOutageDate"
  | "noticeOutageTimeStart"
  | "noticeOutageTimeEnd"
  | "noticeUnitInspectionEnabled"
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
>;

type MobileNoticeSection = "select" | "basic" | "schedule" | "advice" | "preview";

const MOBILE_NOTICE_SECTION_OPTIONS: Array<{ key: MobileNoticeSection; label: string }> = [
  { key: "select", label: "案件選択" },
  { key: "basic", label: "基本情報" },
  { key: "schedule", label: "工事日程" },
  { key: "advice", label: "注意文" },
  { key: "preview", label: "プレビュー" },
];

const NOTICE_PATTERN_OPTIONS: Array<{ key: NoticePatternKey; label: string }> = [
  { key: "rezil_basic", label: "レジル / 設備改修標準" },
  { key: "equipment_pas", label: "設備改修 PAS" },
  { key: "equipment_ugs", label: "設備改修 UGS" },
  { key: "rezil_meter", label: "レジル / メーター交換あり" },
  { key: "nttae_basic", label: "NTTAE / 設備改修標準" },
  { key: "nttae_meter", label: "NTTAE / メーター交換あり" },
];

function isMobileFieldViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;
}

function splitMultilineText(value: string): string[] {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function formatNoticeDate(value: string): string {
  return value ? formatDateWithWeekday(value) : "未設定";
}

function formatNoticeTime(value: string): string {
  if (!value) {
    return "--:--";
  }
  const [hourToken, minuteToken] = value.split(":");
  const hour = Number(hourToken);
  const minute = Number(minuteToken);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return value;
  }
  return `${hour}時${String(minute).padStart(2, "0")}分`;
}

function formatNoticeTimeRange(start: string, end: string): string {
  return `${formatNoticeTime(start)} 〜 ${formatNoticeTime(end)}`;
}

function normalizeNoticeRowsForPrint(rows: NoticeScheduleRow[]): NoticeScheduleRow[] {
  return [...rows]
    .filter((row) => row.date || row.note || row.workType || row.outageState)
    .sort((left, right) => left.date.localeCompare(right.date));
}

function groupAdviceItems(items: NoticeAdviceItem[]): Record<NoticeAdvicePhase, NoticeAdviceItem[]> {
  return NOTICE_PHASE_ORDER.reduce<Record<NoticeAdvicePhase, NoticeAdviceItem[]>>(
    (groups, phase) => ({
      ...groups,
      [phase]: items.filter((item) => item.phase === phase),
    }),
    { before: [], during: [], after: [] },
  );
}

function createNoticeRow(baseDate: string): NoticeScheduleRow {
  return {
    id: crypto.randomUUID(),
    date: baseDate,
    workType: "事前工事",
    outageState: "停電なし",
    note: "",
  };
}

function createAdviceItem(phase: NoticeAdvicePhase): NoticeAdviceItem {
  return {
    id: crypto.randomUUID(),
    phase,
    title: "",
    body: "",
  };
}

type NoticeCsvMatch = {
  record: CsvRecord;
  projectId: string;
  propertyName: string;
  propertyAddress: string;
  outageDate: string;
  outageTimeStart: string;
  outageTimeEnd: string;
};

function matchesNoticeSearch(values: string[], keyword: string): boolean {
  if (!keyword) {
    return true;
  }
  return values.some((value) => String(value ?? "").toLowerCase().includes(keyword));
}

function getNoticeCsvMatch(record: CsvRecord): NoticeCsvMatch | null {
  const getField = createCsvValueGetter(record);
  const projectId = getField(...CSV_PROJECT_FIELD_ALIASES.projectId).trim();
  if (!projectId) {
    return null;
  }
  return {
    record,
    projectId,
    propertyName: getField(...CSV_PROJECT_FIELD_ALIASES.propertyName).trim(),
    propertyAddress: getField(...CSV_PROJECT_FIELD_ALIASES.propertyAddress).trim(),
    outageDate: getField(...CSV_PROJECT_FIELD_ALIASES.outageDateStart).trim(),
    outageTimeStart: getField(...CSV_PROJECT_FIELD_ALIASES.outageTimeStart).trim(),
    outageTimeEnd: getField(...CSV_PROJECT_FIELD_ALIASES.outageTimeEnd).trim(),
  };
}

function buildNoticeDefaultsFromProject(project: Project): Pick<
  Project,
  | "noticePropertyName"
  | "noticeRecipientName"
  | "noticeSenderCompany"
  | "noticeHeadline"
  | "noticeIntroText"
  | "noticeMainWorkDate"
  | "noticeOutageDate"
  | "noticeOutageTimeStart"
  | "noticeOutageTimeEnd"
  | "noticeUnitInspectionEnabled"
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
> {
  const seeded = createBlankProject({
    propertyName: project.propertyName,
    workDateStart: project.workDateStart,
    outageDateStart: project.outageDateStart,
    outageTimeStart: project.outageTimeStart,
    outageTimeEnd: project.outageTimeEnd,
    pdfCompanyName: project.pdfCompanyName,
    pdfTeam: project.pdfTeam,
    pdfAddress: project.pdfAddress,
    pdfTel: project.pdfTel,
  });

  return {
    noticePropertyName: project.propertyName || seeded.noticePropertyName,
    noticeRecipientName: seeded.noticeRecipientName,
    noticeSenderCompany: project.pdfCompanyName || seeded.noticeSenderCompany,
    noticeHeadline: seeded.noticeHeadline,
    noticeIntroText: seeded.noticeIntroText,
    noticeMainWorkDate: project.workDateStart || seeded.noticeMainWorkDate,
    noticeOutageDate: project.outageDateStart || seeded.noticeOutageDate,
    noticeOutageTimeStart: project.outageTimeStart || seeded.noticeOutageTimeStart,
    noticeOutageTimeEnd: project.outageTimeEnd || seeded.noticeOutageTimeEnd,
    noticeUnitInspectionEnabled: project.noticeUnitInspectionEnabled,
    noticeScheduleRows: seeded.noticeScheduleRows,
    noticePrivateAreaText: seeded.noticePrivateAreaText,
    noticeCommonAreaText: seeded.noticeCommonAreaText,
    noticeCompensationText: seeded.noticeCompensationText,
    noticeContactCompany: project.pdfCompanyName || seeded.noticeContactCompany,
    noticeContactDepartment: project.pdfTeam || seeded.noticeContactDepartment,
    noticeContactAddress: project.pdfAddress || seeded.noticeContactAddress,
    noticeContactTel: project.pdfTel || seeded.noticeContactTel,
    noticeContactHours: seeded.noticeContactHours,
    noticeAdviceItems: seeded.noticeAdviceItems,
  };
}

function inferNoticeScenarioProvider(project: Project): NoticeScenarioProvider {
  if (project.noticeTemplateId === "nttae_basic" || project.noticeTemplateId === "nttae_meter") {
    return "nttae";
  }
  const source = `${project.noticeSenderCompany} ${project.noticeContactCompany}`.toLowerCase();
  return source.includes("ntt") ? "nttae" : "rezil";
}

function buildNoticeScenarioPatch(project: Project, options: NoticeScenarioOptions): Partial<Project> {
  const defaults = buildNoticeDefaultsFromProject(project);
  const companyName = options.provider === "nttae" ? "NTTアノードエナジー株式会社" : "レジル株式会社";
  const workLabel = options.meterReplacement ? "メーター交換および電気設備点検" : "電気設備点検";
  const introLines = [
    "平素より弊社サービスをご利用いただき誠にありがとうございます。",
    `この度、以下日程にて${workLabel}を実施いたします。`,
    options.unitInspectionEnabled
      ? "停電当日に在宅をご希望される方を対象に、各戸の点検もあわせて実施いたします。"
      : "今回は共用部および設備点検のみの実施で、各戸点検はございません。",
    "お客さまにはご不便をお掛け致しますが、ご理解とご協力のほどよろしくお願い申し上げます。",
  ];

  const privateAreaText = options.meterReplacement
    ? "【専有部】家電製品（電気で作動するもの全て）、水道、電力量計まわり\n※専有部についてのご注意は裏面をご覧ください"
    : defaults.noticePrivateAreaText;

  const commonAreaText = options.meterReplacement
    ? "【共用部】エレベーター、オートロック式ドア、インターホン、宅配ボックス、機械式駐車場、共用計器類など\n※上記設備は停電中ご利用いただけませんのでご注意ください"
    : defaults.noticeCommonAreaText;

  const nextScheduleRows = defaults.noticeScheduleRows.map((row, index) => {
    if (index > 0 || !options.meterReplacement) {
      return row;
    }
    return {
      ...row,
      note: row.note ? `${row.note} / メーター交換あり` : "メーター交換あり",
    };
  });

  return {
    noticeTemplateId:
      options.provider === "nttae"
        ? (options.meterReplacement ? "nttae_meter" : "nttae_basic")
        : (options.meterReplacement ? "rezil_meter" : "rezil_basic"),
    noticeSenderCompany: companyName,
    noticeContactCompany: companyName,
    noticeHeadline: `${workLabel}に伴う全館停電のお知らせ`,
    noticeIntroText: introLines.join("\n"),
    noticePrivateAreaText: privateAreaText,
    noticeCommonAreaText: commonAreaText,
    noticeUnitInspectionEnabled: options.unitInspectionEnabled,
    noticeScheduleRows: nextScheduleRows,
  };
}

function cloneNoticeTemplatePayload(project: Project): NoticeTemplatePayload {
  return {
    noticeTemplateId: project.noticeTemplateId,
    noticeSenderCompany: project.noticeSenderCompany,
    noticeHeadline: project.noticeHeadline,
    noticeIntroText: project.noticeIntroText,
    noticeMainWorkDate: project.noticeMainWorkDate,
    noticeOutageDate: project.noticeOutageDate,
    noticeOutageTimeStart: project.noticeOutageTimeStart,
    noticeOutageTimeEnd: project.noticeOutageTimeEnd,
    noticeUnitInspectionEnabled: project.noticeUnitInspectionEnabled,
    noticeScheduleRows: project.noticeScheduleRows.map((row) => ({ ...row })),
    noticePrivateAreaText: project.noticePrivateAreaText,
    noticeCommonAreaText: project.noticeCommonAreaText,
    noticeCompensationText: project.noticeCompensationText,
    noticeContactCompany: project.noticeContactCompany,
    noticeContactDepartment: project.noticeContactDepartment,
    noticeContactAddress: project.noticeContactAddress,
    noticeContactTel: project.noticeContactTel,
    noticeContactHours: project.noticeContactHours,
    noticeAdviceItems: project.noticeAdviceItems.map((item) => ({ ...item })),
  };
}

function buildNoticePatternPatch(project: Project, patternKey: NoticePatternKey): Partial<Project> {
  const patternMap: Record<NoticePatternKey, NoticeScenarioOptions> = {
    rezil_basic: { provider: "rezil", meterReplacement: false, unitInspectionEnabled: false },
    equipment_pas: { provider: "rezil", meterReplacement: false, unitInspectionEnabled: false },
    equipment_ugs: { provider: "rezil", meterReplacement: false, unitInspectionEnabled: false },
    rezil_meter: { provider: "rezil", meterReplacement: true, unitInspectionEnabled: false },
    nttae_basic: { provider: "nttae", meterReplacement: false, unitInspectionEnabled: false },
    nttae_meter: { provider: "nttae", meterReplacement: true, unitInspectionEnabled: false },
  };
  const base = buildNoticeScenarioPatch(project, patternMap[patternKey]);
  if (patternKey !== "equipment_pas" && patternKey !== "equipment_ugs") {
    return base;
  }
  const workLabel = patternKey === "equipment_pas" ? "PAS交換工事" : "UGS交換工事";
  const introLines = [
    "平素より弊社サービスをご利用いただき誠にありがとうございます。",
    `この度、以下日程にて${workLabel}を実施いたします。`,
    "今回は共用部および設備点検のみの実施で、各戸点検はございません。",
    "お客さまにはご不便をお掛け致しますが、ご理解とご協力のほどよろしくお願い申し上げます。",
  ];
  return {
    ...base,
    noticeHeadline: `${workLabel}に伴う全館停電のお知らせ`,
    noticeIntroText: introLines.join("\n"),
  };
}

function getNoticeInspectionNote(project: Project): string {
  if (project.noticeUnitInspectionEnabled) {
    return "停電当日に、在宅をご希望される方を対象に、宅内分電盤の点検をいたします。";
  }
  return "今回は共用部および設備点検のみの実施で、宅内分電盤の各戸点検はございません。";
}

function NoticePrintMarkup({ project, preview = false }: NoticePrintDocumentProps) {
  const propertyName = project.noticePropertyName.trim() || project.propertyName.trim() || "（物件名未設定）";
  const recipientName = project.noticeRecipientName.trim() || "（宛名未設定）";
  const senderCompany = project.noticeSenderCompany.trim() || project.noticeContactCompany.trim() || "（差出人未設定）";
  const introLines = splitMultilineText(project.noticeIntroText);
  const privateAreaLines = splitMultilineText(project.noticePrivateAreaText);
  const commonAreaLines = splitMultilineText(project.noticeCommonAreaText);
  const compensationLines = splitMultilineText(project.noticeCompensationText);
  const scheduleRows = normalizeNoticeRowsForPrint(project.noticeScheduleRows);
  const adviceGroups = groupAdviceItems(project.noticeAdviceItems);
  const pageClassName = `print-page notice-print-page${preview ? " notice-preview-page" : ""}`;

  return (
    <>
      <article className={pageClassName}>
        <header className="notice-print-header">
          <div>
            <p className="notice-print-property">{propertyName}</p>
            <p className="notice-print-recipient">{recipientName}</p>
          </div>
          <p className="notice-print-sender">{senderCompany}</p>
        </header>

        <section className="notice-print-banner">
          <h1>{project.noticeHeadline.trim() || "電気設備点検に伴う全館停電のお知らせ"}</h1>
        </section>

        <section className="notice-print-intro">
          {introLines.map((line, index) => (
            <p key={`notice_intro_${index}`}>{line}</p>
          ))}
        </section>

        <section className="notice-print-outage-box">
          <div className="notice-print-outage-row">
            <span>停電日</span>
            <strong>{formatNoticeDate(project.noticeOutageDate)}</strong>
          </div>
          <div className="notice-print-outage-row">
            <span>停電時間</span>
            <strong>{formatNoticeTimeRange(project.noticeOutageTimeStart, project.noticeOutageTimeEnd)}</strong>
          </div>
          <p className="notice-print-outage-note">
            {getNoticeInspectionNote(project)}
          </p>
        </section>

        {scheduleRows.length ? (
          <section className="notice-print-schedule">
            <h3>《工事日程》</h3>
            <table className="notice-compact-table">
              <thead>
                <tr>
                  <th>日付</th>
                  <th>区分</th>
                  <th>停電</th>
                  <th>備考</th>
                </tr>
              </thead>
              <tbody>
                {scheduleRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.date ? formatNoticeDate(row.date) : "-"}</td>
                    <td>{row.workType}</td>
                    <td>{row.outageState}</td>
                    <td>{row.note || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        <section className="notice-print-unavailable">
          <h3>《停電中ご利用できない設備》</h3>
          <div className="notice-print-highlight-block">
            {privateAreaLines.map((line, index) => (
              <p key={`notice_private_${index}`}>{line}</p>
            ))}
          </div>
          <div className="notice-print-highlight-block">
            {commonAreaLines.map((line, index) => (
              <p key={`notice_common_${index}`}>{line}</p>
            ))}
          </div>
        </section>

        <section className="notice-print-compensation">
          {compensationLines.map((line, index) => (
            <p key={`notice_compensation_${index}`}>{line}</p>
          ))}
        </section>

        <section className="notice-print-contact">
          <h3>電気設備点検に関するお問い合わせ先</h3>
          <p>{project.noticeContactCompany || "レジル株式会社"} {project.noticeContactDepartment || ""}</p>
          <p>{project.noticeContactAddress || "-"}</p>
          <p>TEL　{project.noticeContactTel || "-"}</p>
          <p>（受付時間　{project.noticeContactHours || "-"}）</p>
        </section>
      </article>

      <article className={pageClassName}>
        <h2 className="notice-guidance-main-title">＜停電についてのご注意点＞</h2>
        {NOTICE_PHASE_ORDER.map((phase) => (
          adviceGroups[phase].length ? (
            <section className="notice-guidance-group" key={`notice_phase_${phase}`}>
              <h3>【{NOTICE_PHASE_LABELS[phase]}】</h3>
              <div className="notice-guidance-list">
                {adviceGroups[phase].map((item) => (
                  <div className="notice-guidance-row" key={item.id}>
                    <div className="notice-guidance-label">{item.title || "項目名を入力"}</div>
                    <div className="notice-guidance-body">{item.body || "説明を入力"}</div>
                  </div>
                ))}
              </div>
            </section>
          ) : null
        ))}

        <section className="notice-print-compensation notice-second-page-note">
          <p>{NOTICE_SECOND_PAGE_NOTE}</p>
        </section>
        <p className="notice-print-finish">以上</p>
      </article>
    </>
  );
}

export function NoticePrintDocument({ project, preview = false }: NoticePrintDocumentProps) {
  return (
    <div className={preview ? "notice-preview-stack" : "print-doc"}>
      <NoticePrintMarkup project={project} preview={preview} />
    </div>
  );
}

export function NoticeWorkspace({
  hasSelectedProject,
  selectedProject,
  canEdit,
  canEditSelectedProject,
  projectOptions,
  csvDraftRows,
  onSelectProject,
  onStartFromCsvRow,
  updateSelectedProject,
  onPrint,
}: NoticeWorkspaceProps) {
  const previewProject = useDeferredValue(selectedProject);
  const [mobileNoticeSection, setMobileNoticeSection] = useState<MobileNoticeSection>("select");
  const [noticeSearchText, setNoticeSearchText] = useState("");
  const deferredNoticeSearchText = useDeferredValue(noticeSearchText);
  const [printErrorMessage, setPrintErrorMessage] = useState("");
  const [noticeScenarioProvider, setNoticeScenarioProvider] = useState<NoticeScenarioProvider>(() => inferNoticeScenarioProvider(selectedProject));
  const [noticeScenarioMeterReplacement, setNoticeScenarioMeterReplacement] = useState(false);
  const [noticeScenarioUnitInspection, setNoticeScenarioUnitInspection] = useState<boolean>(selectedProject.noticeUnitInspectionEnabled);
  const [noticePatternKey, setNoticePatternKey] = useState<NoticePatternKey>("rezil_basic");
  const [noticeTemplates, setNoticeTemplates] = useState<Array<SimpleTemplate<NoticeTemplatePayload>>>([]);
  const [selectedNoticeTemplateId, setSelectedNoticeTemplateId] = useState("");
  const [noticeTemplateSyncMessage, setNoticeTemplateSyncMessage] = useState("");
  const noticeTemplateUpdatedAtRef = useRef<Record<string, string>>({});
  const noticeMissingFields = useMemo(
    () => [
      { key: "noticePropertyName", label: "物件名", missing: !selectedProject.noticePropertyName.trim() },
      { key: "noticeRecipientName", label: "宛名", missing: !selectedProject.noticeRecipientName.trim() },
      { key: "noticeHeadline", label: "見出し", missing: !selectedProject.noticeHeadline.trim() },
      { key: "noticeOutageDate", label: "停電日", missing: !selectedProject.noticeOutageDate },
      { key: "noticeOutageTimeStart", label: "停電開始時間", missing: !selectedProject.noticeOutageTimeStart },
      { key: "noticeOutageTimeEnd", label: "停電終了時間", missing: !selectedProject.noticeOutageTimeEnd },
    ].filter((field) => field.missing),
    [
      selectedProject.noticeHeadline,
      selectedProject.noticeOutageDate,
      selectedProject.noticeOutageTimeEnd,
      selectedProject.noticeOutageTimeStart,
      selectedProject.noticePropertyName,
      selectedProject.noticeRecipientName,
    ],
  );

  const adviceGroups = useMemo(
    () => groupAdviceItems(selectedProject.noticeAdviceItems),
    [selectedProject.noticeAdviceItems],
  );
  const noticeSearchKeyword = deferredNoticeSearchText.trim().toLowerCase();
  const projectOptionIds = useMemo(
    () => new Set(projectOptions.map((project) => project.projectId)),
    [projectOptions],
  );
  const filteredProjectOptions = useMemo(
    () => projectOptions
      .filter((project) => matchesNoticeSearch(
        [project.projectId, project.propertyName, project.propertyAddress],
        noticeSearchKeyword,
      ))
      .slice(0, 8),
    [noticeSearchKeyword, projectOptions],
  );
  const filteredCsvMatches = useMemo(
    () => csvDraftRows
      .map((record) => getNoticeCsvMatch(record))
      .filter((item): item is NoticeCsvMatch => item !== null)
      .filter((item) => matchesNoticeSearch(
        [item.projectId, item.propertyName, item.propertyAddress, item.outageDate, item.outageTimeStart, item.outageTimeEnd],
        noticeSearchKeyword,
      ))
      .slice(0, 8),
    [csvDraftRows, noticeSearchKeyword],
  );

  const readOnly = hasSelectedProject && !canEditSelectedProject;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(NOTICE_TEMPLATE_STORAGE_KEY);
      const parsed = parseStorageJson<Array<SimpleTemplate<NoticeTemplatePayload>>>(raw) ?? [];
      const normalized = parsed.filter(
        (template): template is SimpleTemplate<NoticeTemplatePayload> =>
          Boolean(template)
          && typeof template.id === "string"
          && typeof template.name === "string"
          && typeof template.createdAt === "string"
          && Boolean(template.payload),
      );
      setNoticeTemplates(normalized);
      setSelectedNoticeTemplateId(normalized[0]?.id ?? "");
    } catch {
      // ignore invalid template cache
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(NOTICE_TEMPLATE_STORAGE_KEY, stringifyForStorage(noticeTemplates));
  }, [noticeTemplates]);

  useEffect(() => {
    if (!noticeMissingFields.length) {
      setPrintErrorMessage("");
      return;
    }
    if (printErrorMessage) {
      setPrintErrorMessage(`未入力があるため出力できません。${noticeMissingFields.map((field) => field.label).join(" / ")} を入力してください。`);
    }
  }, [noticeMissingFields, printErrorMessage]);

  useEffect(() => {
    setNoticeScenarioProvider(inferNoticeScenarioProvider(selectedProject));
    setNoticeScenarioMeterReplacement(
      selectedProject.noticeTemplateId === "rezil_meter"
      || selectedProject.noticeTemplateId === "nttae_meter"
      || selectedProject.noticeHeadline.includes("メーター交換"),
    );
    setNoticeScenarioUnitInspection(false);
  }, [
    selectedProject.noticeContactCompany,
    selectedProject.noticeHeadline,
    selectedProject.noticeSenderCompany,
    selectedProject.noticeTemplateId,
    selectedProject.noticeUnitInspectionEnabled,
  ]);

  useEffect(() => {
    if (noticePatternKey === "rezil_meter" || noticePatternKey === "nttae_meter") {
      setNoticeScenarioMeterReplacement(true);
    } else {
      setNoticeScenarioMeterReplacement(false);
    }
    if (noticePatternKey === "nttae_basic" || noticePatternKey === "nttae_meter") {
      setNoticeScenarioProvider("nttae");
    } else {
      setNoticeScenarioProvider("rezil");
    }
    setNoticeScenarioUnitInspection(false);
  }, [noticePatternKey]);

  useEffect(() => {
    setMobileNoticeSection(hasSelectedProject ? "basic" : "select");
  }, [hasSelectedProject, selectedProject.projectId]);

  function updateNoticeField<K extends keyof Project>(field: K, value: Project[K]) {
    updateSelectedProject((project) => ({ ...project, [field]: value }));
  }

  function scrollToNoticeFieldTarget(selector: string, reveal?: () => void) {
    const performScroll = () => {
      const target = document.querySelector(selector) as HTMLElement | null;
      if (!target) {
        return;
      }
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.focus({ preventScroll: true });
    };

    if (reveal) {
      reveal();
      window.setTimeout(performScroll, 120);
      return;
    }
    performScroll();
  }

  function updateManagementCompany(value: string) {
    updateSelectedProject((project) => ({
      ...project,
      relatedParties: {
        ...project.relatedParties,
        management: {
          ...project.relatedParties.management,
          company: value,
        },
      },
    }));
  }

  function updateNoticeScheduleRow(rowId: string, patch: Partial<NoticeScheduleRow>) {
    updateSelectedProject((project) => ({
      ...project,
      noticeScheduleRows: project.noticeScheduleRows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
    }));
  }

  function addNoticeScheduleRow() {
    updateSelectedProject((project) => ({
      ...project,
      noticeScheduleRows: [
        ...project.noticeScheduleRows,
        createNoticeRow(project.noticeOutageDate || project.noticeMainWorkDate || project.workDateStart),
      ],
    }));
  }

  function removeNoticeScheduleRow(rowId: string) {
    updateSelectedProject((project) => ({
      ...project,
      noticeScheduleRows: project.noticeScheduleRows.filter((row) => row.id !== rowId),
    }));
  }

  function updateAdviceItem(itemId: string, patch: Partial<NoticeAdviceItem>) {
    updateSelectedProject((project) => ({
      ...project,
      noticeAdviceItems: project.noticeAdviceItems.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    }));
  }

  function addAdviceItem(phase: NoticeAdvicePhase) {
    updateSelectedProject((project) => ({
      ...project,
      noticeAdviceItems: [...project.noticeAdviceItems, createAdviceItem(phase)],
    }));
  }

  function removeAdviceItem(itemId: string) {
    updateSelectedProject((project) => ({
      ...project,
      noticeAdviceItems: project.noticeAdviceItems.filter((item) => item.id !== itemId),
    }));
  }

  function scrollToMissingNoticeField() {
    scrollToNoticeFieldTarget(
      "[data-notice-required-key]",
      isMobileFieldViewport() ? () => setMobileNoticeSection("basic") : undefined,
    );
  }

  function handlePrint() {
    if (noticeMissingFields.length) {
      setPrintErrorMessage(`未入力があるため出力できません。${noticeMissingFields.map((field) => field.label).join(" / ")} を入力してください。`);
      scrollToMissingNoticeField();
      return;
    }
    setPrintErrorMessage("");
    onPrint();
  }

  function syncFromProject() {
    if (!window.confirm("案件情報と CSV 取込済みの内容をもとに、停電案内文を初期化します。現在の案内文入力は上書きされます。よろしいですか？")) {
      return;
    }
    updateSelectedProject((project) => ({
      ...project,
      ...buildNoticeDefaultsFromProject(project),
    }));
  }

  function resetAdviceItems() {
    if (!window.confirm("注意事項と案内文テンプレートを初期状態へ戻します。よろしいですか？")) {
      return;
    }
    updateSelectedProject((project) => ({
      ...project,
      ...buildNoticeDefaultsFromProject(project),
    }));
  }

  function applyNoticePattern() {
    updateSelectedProject((project) => ({
      ...project,
      ...buildNoticePatternPatch(project, noticePatternKey),
    }));
  }

  function saveNoticeTemplate() {
    if (!canEditSelectedProject) {
      return;
    }
    const defaultName = selectedProject.noticeHeadline.trim() || `${selectedProject.propertyName || "案内文"}テンプレート`;
    const name = window.prompt("保存する案内文テンプレート名を入力してください。", defaultName)?.trim();
    if (!name) {
      return;
    }
    const item: SimpleTemplate<NoticeTemplatePayload> = {
      id: crypto.randomUUID(),
      name,
      createdAt: new Date().toISOString(),
      payload: cloneNoticeTemplatePayload(selectedProject),
    };
    setNoticeTemplates((prev) => [item, ...prev]);
    setSelectedNoticeTemplateId(item.id);
    setNoticeTemplateSyncMessage("案内文テンプレートを保存しています...");
    void (async () => {
      const response = await saveTemplateItem({
        storageKey: NOTICE_TEMPLATE_STORAGE_KEY,
        itemId: item.id,
        itemName: item.name,
        itemScope: "",
        itemCategory: "notice",
        itemOrder: 0,
        rawJson: JSON.stringify(item),
      }, noticeTemplateUpdatedAtRef.current[item.id] ?? null);
      if (response.ok && response.updatedAt) {
        noticeTemplateUpdatedAtRef.current[item.id] = response.updatedAt;
        setNoticeTemplateSyncMessage(
          response.resolvedConflict
            ? "案内文テンプレートを保存し、他端末の変更を自動マージしました。"
            : "案内文テンプレートを保存しました。",
        );
        return;
      }
      setNoticeTemplateSyncMessage("案内文テンプレートのサーバー保存に失敗しました。端末保存は継続しています。");
    })();
  }

  function applySavedNoticeTemplate() {
    const template = noticeTemplates.find((item) => item.id === selectedNoticeTemplateId);
    if (!template) {
      return;
    }
    updateSelectedProject((project) => ({
      ...project,
      ...template.payload,
      noticeScheduleRows: template.payload.noticeScheduleRows.map((row) => ({ ...row })),
      noticeAdviceItems: template.payload.noticeAdviceItems.map((item) => ({ ...item })),
    }));
  }

  function deleteSavedNoticeTemplate() {
    if (!canEdit || !selectedNoticeTemplateId) {
      return;
    }
    const template = noticeTemplates.find((item) => item.id === selectedNoticeTemplateId);
    if (!template) {
      return;
    }
    if (!window.confirm(`案内文テンプレート「${template.name}」を削除します。よろしいですか？`)) {
      return;
    }
    const next = noticeTemplates.filter((item) => item.id !== selectedNoticeTemplateId);
    setNoticeTemplates(next);
    setSelectedNoticeTemplateId(next[0]?.id ?? "");
    setNoticeTemplateSyncMessage("案内文テンプレートを削除しています...");
    void (async () => {
      const response = await deleteTemplateItem(
        NOTICE_TEMPLATE_STORAGE_KEY,
        template.id,
        noticeTemplateUpdatedAtRef.current[template.id] ?? null,
      );
      if (response.ok) {
        delete noticeTemplateUpdatedAtRef.current[template.id];
        setNoticeTemplateSyncMessage("案内文テンプレートを削除しました。");
        return;
      }
      setNoticeTemplateSyncMessage("案内文テンプレートのサーバー削除に失敗しました。次回同期で再試行します。");
    })();
  }

  function getMobileNoticeSectionClass(section: MobileNoticeSection): string {
    return `mobile-workflow-section${mobileNoticeSection === section ? " is-active" : ""}`;
  }

  return (
    <section className="panel notice-panel">
      <div className="panel-head notice-panel-head">
        <div>
          <h3 className="section-title">
            <span className="section-icon" aria-hidden="true">
              <UiIcon name="template" />
            </span>
            停電案内文
          </h3>
          <p className="mini">
            CSV で取り込んだ案件情報や編集済みの案件情報をもとに、専用案内文を整えてそのまま印刷 / PDF 出力できます。
          </p>
        </div>
        <div className="inline-row wrap notice-actions">
          {noticeMissingFields.length ? (
            <button type="button" className="btn btn-subtle" onClick={scrollToMissingNoticeField}>
              <span className="btn-icon"><UiIcon name="down" /></span>未入力へ移動
            </button>
          ) : null}
          <button type="button" className="btn btn-accent" onClick={handlePrint} disabled={!hasSelectedProject}>
            <span className="btn-icon"><UiIcon name="pdf" /></span>案内文を印刷 / PDF出力
          </button>
          <details className="secondary-action-details notice-secondary-actions">
            <summary>
              <span className="btn-icon"><UiIcon name="menu" /></span>その他
            </summary>
            <div className="secondary-action-content">
              <button type="button" className="btn btn-subtle" onClick={syncFromProject} disabled={!canEdit || !canEditSelectedProject}>
                <span className="btn-icon"><UiIcon name="refresh" /></span>案件情報から初期化
              </button>
              <button type="button" className="btn btn-subtle" onClick={resetAdviceItems} disabled={!canEdit || !canEditSelectedProject}>
                <span className="btn-icon"><UiIcon name="undo" /></span>テンプレートへ戻す
              </button>
            </div>
          </details>
        </div>
      </div>

      <section className="mobile-workflow-switcher" aria-label="停電案内文の現場モード">
        <div className="mobile-workflow-tabs" role="tablist" aria-label="停電案内文の入力セクション">
          {MOBILE_NOTICE_SECTION_OPTIONS.map((option) => (
            <button
              key={`mobile_notice_section_${option.key}`}
              type="button"
              className={`mobile-workflow-tab ${mobileNoticeSection === option.key ? "is-active" : ""}`}
              onClick={() => setMobileNoticeSection(option.key)}
              role="tab"
              aria-selected={mobileNoticeSection === option.key}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <div className={getMobileNoticeSectionClass("select")}>
      <section className="sub-panel notice-search-panel">
        <div className="panel-head">
          <div>
            <h4>案件 / CSV から案内文を開始</h4>
            <p className="mini">
              ここで案件を検索して選ぶと、そのまま停電案内文を編集できます。CSV 行はここから直接案内文用に反映できます。
            </p>
          </div>
          {hasSelectedProject ? (
            <span className="status-chip ok">
              選択中: {selectedProject.propertyName || "（物件名未設定）"} / {selectedProject.projectId}
            </span>
          ) : (
            <span className="status-chip warn">案件未選択</span>
          )}
        </div>
        <label className="field notice-search-input">
          <span>検索</span>
          <input
            className="control"
            value={noticeSearchText}
            placeholder="案件ID・物件名・住所・停電日で検索"
            onChange={(event) => setNoticeSearchText(event.target.value)}
          />
        </label>
        <div className="notice-search-grid notice-pattern-grid">
          <section className="notice-search-column">
            <div className="notice-search-column-head">
              <div>
                <h5>既存案件</h5>
                <p className="mini">すでに案件化されているデータを開きます。</p>
              </div>
              <span className="status-chip">{filteredProjectOptions.length}件</span>
            </div>
            <div className="notice-search-list">
              {filteredProjectOptions.length ? (
                filteredProjectOptions.map((project) => (
                  <button
                    key={`notice_project_option_${project.projectId}`}
                    type="button"
                    className={`notice-search-item ${hasSelectedProject && project.projectId === selectedProject.projectId ? "is-active" : ""}`}
                    onClick={() => onSelectProject(project.projectId)}
                  >
                    <span className="notice-search-item-head">
                      <strong>{project.propertyName || "（物件名未設定）"}</strong>
                      <span className="notice-search-item-action">この案件で作る</span>
                    </span>
                    <span className="notice-search-item-meta">案件ID: {project.projectId}</span>
                    <span className="notice-search-item-meta">{project.propertyAddress || "住所未設定"}</span>
                  </button>
                ))
              ) : (
                <p className="mini notice-search-empty">一致する案件がありません。</p>
              )}
            </div>
          </section>

          <section className="notice-search-column">
            <div className="notice-search-column-head">
              <div>
                <h5>CSV 取込データ</h5>
                <p className="mini">CSV 編集スペースの行から案内文を開始します。事前工事 / 事後工事はあとで手入力調整できます。</p>
              </div>
              <span className="status-chip">{filteredCsvMatches.length}件</span>
            </div>
            <div className="notice-search-list">
              {filteredCsvMatches.length ? (
                filteredCsvMatches.map((item, index) => (
                  <button
                    key={`notice_csv_option_${item.projectId}_${index}`}
                    type="button"
                    className="notice-search-item"
                    onClick={() => onStartFromCsvRow(item.record)}
                    disabled={!canEdit}
                  >
                    <span className="notice-search-item-head">
                      <strong>{item.propertyName || "（物件名未設定）"}</strong>
                      <span className="notice-search-item-action">
                        {projectOptionIds.has(item.projectId) ? "CSVから更新して開始" : "CSVから開始"}
                      </span>
                    </span>
                    <span className="notice-search-item-meta">案件ID: {item.projectId}</span>
                    <span className="notice-search-item-meta">
                      {item.propertyAddress || "住所未設定"}
                      {item.outageDate ? ` / 停電日 ${item.outageDate}` : ""}
                      {item.outageTimeStart || item.outageTimeEnd ? ` / ${item.outageTimeStart || "--:--"}〜${item.outageTimeEnd || "--:--"}` : ""}
                    </span>
                  </button>
                ))
              ) : (
                <p className="mini notice-search-empty">
                  {csvDraftRows.length
                    ? "一致する CSV 行がありません。"
                    : "CSV 編集スペースに取込済みの行がまだありません。"}
                </p>
              )}
            </div>
          </section>
        </div>
      </section>
      </div>

      <div className={getMobileNoticeSectionClass("basic")}>
      <section className="sub-panel notice-search-panel">
        <div className="panel-head">
          <div>
            <h4>案内文パターン</h4>
            <p className="mini">設備改修 PAS / UGS、メーター交換あり、レジル / NTTAE 物件などのパターンをプルダウンから選べます。</p>
          </div>
          <button type="button" className="btn btn-subtle" onClick={applyNoticePattern} disabled={!canEditSelectedProject}>
            <span className="btn-icon"><UiIcon name="apply" /></span>この条件を反映
          </button>
        </div>
        <div className="notice-search-grid">
          <label className="field">
            <span>案内文パターン</span>
            <select
              className="control"
              value={noticePatternKey}
              onChange={(event) => setNoticePatternKey(event.target.value as NoticePatternKey)}
              disabled={!canEditSelectedProject}
            >
              {NOTICE_PATTERN_OPTIONS.map((option) => (
                <option key={`notice_pattern_${option.key}`} value={option.key}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="check-pill notice-pattern-pill">
            <input
              type="checkbox"
              checked={noticeScenarioMeterReplacement}
              onChange={(event) => setNoticeScenarioMeterReplacement(event.target.checked)}
              disabled
            />
            <span>メーター交換ありバージョン</span>
          </label>
          <label className="check-pill notice-pattern-pill">
            <input
              type="checkbox"
              checked={noticeScenarioUnitInspection}
              onChange={(event) => setNoticeScenarioUnitInspection(event.target.checked)}
              disabled
            />
            <span>各戸点検は一旦なし</span>
          </label>
        </div>
        <div className="notice-search-grid">
          <label className="field">
            <span>保存済み案内文テンプレート</span>
            <select
              className="control"
              value={selectedNoticeTemplateId}
              onChange={(event) => setSelectedNoticeTemplateId(event.target.value)}
              disabled={!noticeTemplates.length}
            >
              {!noticeTemplates.length ? <option value="">テンプレート未登録</option> : null}
              {noticeTemplates.map((template) => (
                <option key={`saved_notice_template_${template.id}`} value={template.id}>{template.name}</option>
              ))}
            </select>
          </label>
          <div className="inline-row wrap notice-actions">
            <button type="button" className="btn btn-subtle" onClick={applySavedNoticeTemplate} disabled={!selectedNoticeTemplateId}>
              <span className="btn-icon"><UiIcon name="apply" /></span>保存済みを反映
            </button>
            <details className="secondary-action-details notice-secondary-actions">
              <summary>
                <span className="btn-icon"><UiIcon name="menu" /></span>保存管理
              </summary>
              <div className="secondary-action-content">
                <button type="button" className="btn btn-subtle" onClick={saveNoticeTemplate} disabled={!canEditSelectedProject}>
                  <span className="btn-icon"><UiIcon name="save" /></span>今の案内文をテンプレ保存
                </button>
                <button type="button" className="btn btn-danger" onClick={deleteSavedNoticeTemplate} disabled={!canEdit || !selectedNoticeTemplateId}>
                  <span className="btn-icon"><UiIcon name="delete" /></span>削除
                </button>
              </div>
            </details>
          </div>
        </div>
        {noticeTemplateSyncMessage ? (
          <p className="mini">{noticeTemplateSyncMessage}</p>
        ) : null}
      </section>
      </div>

      {!hasSelectedProject ? (
        <div className={getMobileNoticeSectionClass("select")}>
        <section className="sub-panel project-empty-panel">
          <h4>案件を選択してください</h4>
          <p className="mini">
            上の検索から既存案件を開くか、CSV 取込データを選んで案内文用の案件を開始してください。
          </p>
        </section>
        </div>
      ) : null}

      {readOnly ? (
        <div className={getMobileNoticeSectionClass("basic")}>
        <section className="sub-panel required-summary-panel">
          <p className="mini error-text">
            この案件は現在ほかのユーザーが編集中のため、案内文は読み取り専用です。印刷 / PDF 出力のみ利用できます。
          </p>
        </section>
        </div>
      ) : null}

      {printErrorMessage ? (
        <div className={getMobileNoticeSectionClass("basic")}>
        <section className="sub-panel required-summary-panel">
          <h4>案内文を出力できない理由</h4>
          <p className="mini error-text">{printErrorMessage}</p>
        </section>
        </div>
      ) : null}

      {noticeMissingFields.length ? (
        <div className={getMobileNoticeSectionClass("basic")}>
        <section className="sub-panel required-summary-panel">
          <h4>印刷前に入力したい項目</h4>
          <p className="mini notice-toolbar-meta">{noticeMissingFields.map((field) => field.label).join(" / ")}</p>
        </section>
        </div>
      ) : null}

      {!hasSelectedProject ? null : (
        <>

      <div className={getMobileNoticeSectionClass("basic")}>
      <section className="sub-panel">
        <h4>ヘッダー・停電情報</h4>
        <div className="field-grid">
          <label className="field">
            <span>物件名</span>
            <input
              data-notice-required-key={!selectedProject.noticePropertyName.trim() ? "noticePropertyName" : undefined}
              className={`control ${!selectedProject.noticePropertyName.trim() ? "control-missing" : ""}`}
              value={selectedProject.noticePropertyName}
              onChange={(event) => updateNoticeField("noticePropertyName", event.target.value)}
              disabled={!canEditSelectedProject}
            />
          </label>
          <label className="field">
            <span>宛名</span>
            <input
              data-notice-required-key={!selectedProject.noticeRecipientName.trim() ? "noticeRecipientName" : undefined}
              className={`control ${!selectedProject.noticeRecipientName.trim() ? "control-missing" : ""}`}
              value={selectedProject.noticeRecipientName}
              onChange={(event) => updateNoticeField("noticeRecipientName", event.target.value)}
              disabled={!canEditSelectedProject}
            />
          </label>
          <label className="field">
            <span>差出人</span>
            <input
              className="control"
              value={selectedProject.noticeSenderCompany}
              onChange={(event) => updateNoticeField("noticeSenderCompany", event.target.value)}
              disabled={!canEditSelectedProject}
            />
          </label>
          <label className="field span-2">
            <span>見出し</span>
            <input
              data-notice-required-key={!selectedProject.noticeHeadline.trim() ? "noticeHeadline" : undefined}
              className={`control ${!selectedProject.noticeHeadline.trim() ? "control-missing" : ""}`}
              value={selectedProject.noticeHeadline}
              onChange={(event) => updateNoticeField("noticeHeadline", event.target.value)}
              disabled={!canEditSelectedProject}
            />
          </label>
          <label className="field span-2">
            <span>導入文</span>
            <textarea
              className="control textarea"
              value={selectedProject.noticeIntroText}
              onChange={(event) => updateNoticeField("noticeIntroText", event.target.value)}
              disabled={!canEditSelectedProject}
            />
          </label>
          <label className="field">
            <span>本工事日</span>
            <input
              className="control"
              type="date"
              value={selectedProject.noticeMainWorkDate}
              onChange={(event) => updateNoticeField("noticeMainWorkDate", event.target.value)}
              disabled={!canEditSelectedProject}
            />
          </label>
          <label className="field">
            <span>停電日</span>
            <input
              data-notice-required-key={!selectedProject.noticeOutageDate ? "noticeOutageDate" : undefined}
              className={`control ${!selectedProject.noticeOutageDate ? "control-missing" : ""}`}
              type="date"
              value={selectedProject.noticeOutageDate}
              onChange={(event) => updateNoticeField("noticeOutageDate", event.target.value)}
              disabled={!canEditSelectedProject}
            />
          </label>
          <label className="field">
            <span>停電開始時間</span>
            <input
              data-notice-required-key={!selectedProject.noticeOutageTimeStart ? "noticeOutageTimeStart" : undefined}
              className={`control ${!selectedProject.noticeOutageTimeStart ? "control-missing" : ""}`}
              type="time"
              value={selectedProject.noticeOutageTimeStart}
              onChange={(event) => updateNoticeField("noticeOutageTimeStart", event.target.value)}
              disabled={!canEditSelectedProject}
            />
          </label>
          <label className="field">
            <span>停電終了時間</span>
            <input
              data-notice-required-key={!selectedProject.noticeOutageTimeEnd ? "noticeOutageTimeEnd" : undefined}
              className={`control ${!selectedProject.noticeOutageTimeEnd ? "control-missing" : ""}`}
              type="time"
              value={selectedProject.noticeOutageTimeEnd}
              onChange={(event) => updateNoticeField("noticeOutageTimeEnd", event.target.value)}
              disabled={!canEditSelectedProject}
            />
          </label>
        </div>
      </section>
      </div>

      <div className={getMobileNoticeSectionClass("schedule")}>
      <section className="sub-panel">
        <div className="panel-head">
          <div>
            <h4>工事日程</h4>
            <p className="mini">事前工事 / 本工事 / 事後工事をこのまま印刷ページへ反映します。CSV で足りない分はここで手入力できます。</p>
          </div>
          <button type="button" className="btn btn-subtle" onClick={addNoticeScheduleRow} disabled={!canEdit || !canEditSelectedProject}>
            <span className="btn-icon"><UiIcon name="plus" /></span>行追加
          </button>
        </div>
        <div className="table-wrap">
          <table className="schedule-table">
            <thead>
              <tr>
                <th>日付</th>
                <th>区分</th>
                <th>停電</th>
                <th>備考</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {selectedProject.noticeScheduleRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input className="control" type="date" value={row.date} onChange={(event) => updateNoticeScheduleRow(row.id, { date: event.target.value })} disabled={!canEditSelectedProject} />
                  </td>
                  <td>
                    <select className="control" value={row.workType} onChange={(event) => updateNoticeScheduleRow(row.id, { workType: event.target.value as NoticeWorkType })} disabled={!canEditSelectedProject}>
                      {NOTICE_WORK_TYPE_OPTIONS.map((option) => (
                        <option key={`notice_work_${option}`} value={option}>{option}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select className="control" value={row.outageState} onChange={(event) => updateNoticeScheduleRow(row.id, { outageState: event.target.value as NoticeOutageState })} disabled={!canEditSelectedProject}>
                      {NOTICE_OUTAGE_STATE_OPTIONS.map((option) => (
                        <option key={`notice_outage_${option}`} value={option}>{option}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input className="control" value={row.note} onChange={(event) => updateNoticeScheduleRow(row.id, { note: event.target.value })} disabled={!canEditSelectedProject} />
                  </td>
                  <td>
                    <button type="button" className="btn btn-danger" onClick={() => removeNoticeScheduleRow(row.id)} disabled={!canEdit || !canEditSelectedProject || selectedProject.noticeScheduleRows.length <= 1}>
                      <span className="btn-icon"><UiIcon name="delete" /></span>削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      </div>

      <div className={getMobileNoticeSectionClass("basic")}>
      <section className="sub-panel">
        <h4>停電設備・問い合わせ先</h4>
        <div className="field-grid">
          <label className="field span-2">
            <span>専有部の案内</span>
            <textarea className="control textarea" value={selectedProject.noticePrivateAreaText} onChange={(event) => updateNoticeField("noticePrivateAreaText", event.target.value)} disabled={!canEditSelectedProject} />
          </label>
          <label className="field span-2">
            <span>共用部の案内</span>
            <textarea className="control textarea" value={selectedProject.noticeCommonAreaText} onChange={(event) => updateNoticeField("noticeCommonAreaText", event.target.value)} disabled={!canEditSelectedProject} />
          </label>
          <label className="field span-2">
            <span>補償・注意書き</span>
            <textarea className="control textarea" value={selectedProject.noticeCompensationText} onChange={(event) => updateNoticeField("noticeCompensationText", event.target.value)} disabled={!canEditSelectedProject} />
          </label>
          <label className="field">
            <span>問い合わせ会社</span>
            <input className="control" value={selectedProject.noticeContactCompany} onChange={(event) => updateNoticeField("noticeContactCompany", event.target.value)} disabled={!canEditSelectedProject} />
          </label>
          <label className="field">
            <span>管理会社名（ログ用）</span>
            <input
              className="control"
              value={selectedProject.relatedParties.management.company}
              onChange={(event) => updateManagementCompany(event.target.value)}
              disabled={!canEditSelectedProject}
              placeholder="管理会社名"
            />
          </label>
          <label className="field">
            <span>部署名</span>
            <input className="control" value={selectedProject.noticeContactDepartment} onChange={(event) => updateNoticeField("noticeContactDepartment", event.target.value)} disabled={!canEditSelectedProject} />
          </label>
          <label className="field span-2">
            <span>住所</span>
            <input className="control" value={selectedProject.noticeContactAddress} onChange={(event) => updateNoticeField("noticeContactAddress", event.target.value)} disabled={!canEditSelectedProject} />
          </label>
          <label className="field">
            <span>電話番号</span>
            <input className="control" value={selectedProject.noticeContactTel} onChange={(event) => updateNoticeField("noticeContactTel", event.target.value)} disabled={!canEditSelectedProject} />
          </label>
          <label className="field">
            <span>受付時間</span>
            <input className="control" value={selectedProject.noticeContactHours} onChange={(event) => updateNoticeField("noticeContactHours", event.target.value)} disabled={!canEditSelectedProject} />
          </label>
        </div>
      </section>
      </div>

      <div className={getMobileNoticeSectionClass("advice")}>
      <section className="sub-panel">
        <h4>停電時のご注意</h4>
        <p className="mini notice-toolbar-meta">各区分ごとに行追加できます。出力時は 2 ページ目へ整列して反映します。</p>
        {NOTICE_PHASE_ORDER.map((phase) => (
          <section className="notice-advice-phase" key={`notice_advice_phase_${phase}`}>
            <div className="panel-head">
              <div>
                <h4>{NOTICE_PHASE_LABELS[phase]}</h4>
              </div>
              <button type="button" className="btn btn-subtle" onClick={() => addAdviceItem(phase)} disabled={!canEdit || !canEditSelectedProject}>
                <span className="btn-icon"><UiIcon name="plus" /></span>{NOTICE_PHASE_LABELS[phase]}を追加
              </button>
            </div>
            <div className="notice-advice-list">
              {adviceGroups[phase].map((item) => (
                <div className="notice-advice-card" key={item.id}>
                  <div className="field-grid">
                    <label className="field">
                      <span>見出し</span>
                      <input className="control" value={item.title} onChange={(event) => updateAdviceItem(item.id, { title: event.target.value })} disabled={!canEditSelectedProject} />
                    </label>
                    <label className="field">
                      <span>区分</span>
                      <select className="control" value={item.phase} onChange={(event) => updateAdviceItem(item.id, { phase: event.target.value as NoticeAdvicePhase })} disabled={!canEditSelectedProject}>
                        {NOTICE_PHASE_ORDER.map((option) => (
                          <option key={`notice_phase_option_${option}`} value={option}>{NOTICE_PHASE_LABELS[option]}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field span-2">
                      <span>本文</span>
                      <textarea className="control textarea" value={item.body} onChange={(event) => updateAdviceItem(item.id, { body: event.target.value })} disabled={!canEditSelectedProject} />
                    </label>
                  </div>
                  <div className="inline-row wrap">
                    <button type="button" className="btn btn-danger" onClick={() => removeAdviceItem(item.id)} disabled={!canEdit || !canEditSelectedProject}>
                      <span className="btn-icon"><UiIcon name="delete" /></span>削除
                    </button>
                  </div>
                </div>
              ))}
              {!adviceGroups[phase].length ? (
                <p className="mini">まだ項目がありません。</p>
              ) : null}
            </div>
          </section>
        ))}
      </section>
      </div>

      <div className={getMobileNoticeSectionClass("preview")}>
      <section className="sub-panel">
        <div className="panel-head">
          <div>
            <h4>出力プレビュー</h4>
            <p className="mini">見本 PDF に近い 2 ページ構成で確認できます。</p>
          </div>
        </div>
        <div className="notice-preview-shell">
          <NoticePrintDocument project={previewProject} preview />
        </div>
      </section>
      </div>
        </>
      )}
    </section>
  );
}
