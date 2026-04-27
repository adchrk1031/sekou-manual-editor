import { sanitizeCsvHeader } from "./utils/csv";
import type {
  PartyCompanyTemplatePreset,
  PdfTemplateId,
  PdfTemplatePreset,
  Project,
  RelatedPartyKey,
  ScheduleProcedureTemplate,
  TemplateScope,
  UserApprovalStatus,
  UserRole,
  WorkCode,
  WorkMaster,
} from "./types";

export const STORAGE_KEY = "sekou-tool-projects-v5";
export const PROJECT_INDEX_STORAGE_KEY = "sekou-project-index-v1";
export const PROJECT_DATA_STORAGE_PREFIX = "sekou-project-data-v1:";
export const CSV_EDITOR_STORAGE_KEY = "sekou-csv-editor-v1";
export const USERS_STORAGE_KEY = "sekou-tool-users-v1";
export const TEST_EDITOR_SEED_STORAGE_KEY = "sekou-tool-test-editors-seeded-v2";
export const AUDIT_STORAGE_KEY = "sekou-tool-audit-v1";
export const REVISION_STORAGE_KEY = "sekou-tool-revision-v1";
export const APPROVAL_NOTE_TEMPLATE_STORAGE_KEY = "sekou-tool-template-approval-note-v1";
export const SCHEDULE_TEMPLATE_STORAGE_KEY = "sekou-tool-template-schedule-v1";
export const SCHEDULE_PROCEDURE_TEMPLATE_STORAGE_KEY = "sekou-tool-template-schedule-procedures-v1";
export const DETAIL_PHOTO_TEMPLATE_STORAGE_KEY = "sekou-tool-template-detail-photos-v1";
export const PARTY_TEMPLATE_STORAGE_KEY = "sekou-tool-template-parties-v1";
export const PARTY_COMPANY_TEMPLATE_STORAGE_KEY = "sekou-tool-template-party-companies-v1";
export const LAYOUT_TEMPLATE_STORAGE_KEY = "sekou-tool-template-layout-v1";
export const OUTAGE_TRACE_DEBUG_KEY = "sekou-debug-outage-trace";
export const LEGACY_DATE_TRACE_DEBUG_KEY = "sekou-debug-legacy-date";
export const MIN_BLOCK_MINUTES = 60;
export const DRAG_SNAP_MINUTES = 5;
export const HEADER_LOGO_SRC = "/header-logo.svg";
export const PDF_LOGO_SRC = "/logo.png";
export const PDF_LOGO_FALLBACK_SRC = "/rezil-fixed-logo.svg";
export const MAX_AUDIT_LOGS = 500;
export const MAX_REVISIONS = 200;
export const CSV_PAGE_SIZE_OPTIONS = [20, 50, 100, 200, 300];
export const PROJECT_SAVE_DEBOUNCE_MS = 350;
export const CSV_SAVE_DEBOUNCE_MS = 700;
export const DEFAULT_PHOTO_MAX_SIZE = 1280;
export const DEFAULT_LAYOUT_MAX_SIZE = 1600;
export const MAX_UPLOAD_FILE_BYTES = 10 * 1024 * 1024;
export const TARGET_PHOTO_DATA_URL_BYTES = 850_000;
export const TARGET_LAYOUT_DATA_URL_BYTES = 1_100_000;
export const LAYOUT_CANVAS_SIZE = 1000;
export const MAX_ANNOTATION_HISTORY = 150;
export const DEFAULT_ANNOTATION_COLOR = "#d92d20";
export const DEFAULT_ANNOTATION_STROKE_WIDTH = 1;
export const DEFAULT_ANNOTATION_FILL_COLOR = "#f59e0b";
export const DEFAULT_ANNOTATION_FILL_OPACITY = 0.22;
export const DEFAULT_TEXT_FONT_FAMILY = "\"Noto Sans JP\", \"Hiragino Kaku Gothic ProN\", \"Yu Gothic\", sans-serif";
export const DEFAULT_TEXT_STROKE_COLOR = "#ffffff";
export const DEFAULT_TEXT_STROKE_WIDTH = 3;
export const LAYOUT_SNAP_THRESHOLD = 10;
export const USER_LIST_VISIBLE_COUNT = 5;

export const LAYOUT_TEXT_FONT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: DEFAULT_TEXT_FONT_FAMILY, label: "ゴシック（標準）" },
  { value: "\"Yu Mincho\", \"Hiragino Mincho ProN\", serif", label: "明朝" },
  { value: "\"Meiryo\", \"Yu Gothic\", sans-serif", label: "メイリオ" },
  { value: "\"Arial\", sans-serif", label: "Arial" },
  { value: "\"Courier New\", monospace", label: "等幅（Monospace）" },
];

export const TEST_EDITOR_USER_PRESETS: Array<{ id: string; name: string; email: string; password: string }> = [
  { id: "user_test_editor_01", name: "テスト編集者1", email: "test.editor01@example.com", password: "testpass01" },
  { id: "user_test_editor_02", name: "テスト編集者2", email: "test.editor02@example.com", password: "testpass02" },
  { id: "user_test_editor_03", name: "テスト編集者3", email: "test.editor03@example.com", password: "testpass03" },
  { id: "user_test_editor_04", name: "テスト編集者4", email: "test.editor04@example.com", password: "testpass04" },
  { id: "user_test_editor_05", name: "テスト編集者5", email: "test.editor05@example.com", password: "testpass05" },
  { id: "user_test_editor_06", name: "テスト編集者6", email: "test.editor06@example.com", password: "testpass06" },
];

export const ROLE_LABELS: Record<UserRole, string> = {
  system_admin: "システム管理者",
  admin: "管理者",
  editor: "編集者",
  viewer: "閲覧者",
};

export const USER_APPROVAL_LABELS: Record<UserApprovalStatus, string> = {
  approved: "承認済み",
  pending: "承認待ち",
  rejected: "利用不可",
};

export const APPROVAL_STATUS_LABELS: Record<Project["approvalStatus"], string> = {
  draft: "編集中",
  submitted: "確認依頼中",
  approved: "確定",
  rejected: "修正依頼",
};

export const WORK_MASTER: WorkMaster[] = [
  { code: "KOUATSU_CABLE", name: "高圧ケーブル交換", detailText: "既設高圧ケーブル撤去、新規ケーブルへ切替を実施", defaultText: "高圧ケーブル切替" },
  { code: "UGS", name: "UGS交換", detailText: "UGS本体の更新・端末処理・絶縁確認を実施", defaultText: "UGS交換" },
  { code: "PAS", name: "PAS交換", detailText: "PAS撤去・新設・動作確認を実施", defaultText: "PAS交換" },
  { code: "GROUND_A", name: "A種接地是正", detailText: "A種接地抵抗値測定と是正工事を実施", defaultText: "A種接地是正" },
  { code: "GROUND_B", name: "B種接地是正", detailText: "B種接地抵抗値測定と是正工事を実施", defaultText: "B種接地是正" },
  { code: "GROUND_C", name: "C種接地是正", detailText: "C種接地抵抗値測定と是正工事を実施", defaultText: "C種接地是正" },
];

export const DEFAULT_SCHEDULE_PROCEDURE_TEMPLATES: ScheduleProcedureTemplate[] = [
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

export const CSV_WORK_COLUMN_ALIASES: Record<WorkCode, string[]> = {
  KOUATSU_CABLE: ["flag_kouatsu_cable", "高圧ケーブル交換", "高圧ケーブル切替", "高圧ケーブル", "kouatsu_cable"],
  UGS: ["flag_ugs", "UGS交換", "ugs"],
  PAS: ["flag_pas", "PAS交換", "pas"],
  GROUND_A: ["flag_ground_a", "A種接地是正", "ground_a", "a種接地是正"],
  GROUND_B: ["flag_ground_b", "B種接地是正", "ground_b", "b種接地是正"],
  GROUND_C: ["flag_ground_c", "C種接地是正", "ground_c", "c種接地是正"],
};

export const CSV_PROJECT_FIELD_ALIASES = {
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
  pdfExportCount: ["pdf_export_count", "pdf_count", "PDF出力回数", "出力回数"],
  pdfLastExportedAt: ["pdf_last_exported_at", "last_pdf_exported_at", "PDF最終出力日時", "最終出力日時"],
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

export const CSV_HEADER_JA_LABELS: Record<string, string> = {
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
  pdf_export_count: "PDF出力回数",
  pdf_last_exported_at: "PDF最終出力日時",
  photo_slot_a_label: "写真Aラベル",
  photo_slot_b_label: "写真Bラベル",
  photo_slot_c_label: "写真Cラベル",
  photo_slot_d_label: "写真Dラベル",
  layout_photo_slot_a_label: "配置図写真Aラベル",
  layout_photo_slot_b_label: "配置図写真Bラベル",
  layout_photo_slot_c_label: "配置図写真Cラベル",
  layout_photo_slot_d_label: "配置図写真Dラベル",
};

export function getCsvHeaderLabel(header: string): string {
  const key = sanitizeCsvHeader(header).toLowerCase();
  return CSV_HEADER_JA_LABELS[key] || sanitizeCsvHeader(header);
}

export const TEMPLATE_SCOPE_META: Record<
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

export const PDF_TEMPLATE_PRESETS: PdfTemplatePreset[] = [
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

export const PDF_TEMPLATE_PRESET_MAP: Record<PdfTemplateId, PdfTemplatePreset> = {
  standard: PDF_TEMPLATE_PRESETS[0],
  kansai: PDF_TEMPLATE_PRESETS[1],
  night: PDF_TEMPLATE_PRESETS[2],
};

export const PARTY_COMPANY_TEMPLATE_PRESETS: Record<RelatedPartyKey, PartyCompanyTemplatePreset[]> = {
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

export const EMPTY_PARTY_TEMPLATE_SELECTIONS: Record<RelatedPartyKey, string> = {
  owner: "",
  utility: "",
  contractor: "",
  management: "",
  residents: "",
};
