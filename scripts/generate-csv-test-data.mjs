import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "..");
const outputDir = path.join(repoRoot, "public", "test-data");
const outputPath = path.join(outputDir, "sekou_csv_test_200.csv");

const headers = [
  "project_id",
  "property_name",
  "property_address",
  "title_subject",
  "work_date_start",
  "work_date_end",
  "outage_date_start",
  "outage_date_end",
  "outage_time_start",
  "outage_time_end",
  "outage_enabled",
  "flag_kouatsu_cable",
  "flag_ugs",
  "flag_pas",
  "flag_ground_a",
  "flag_ground_b",
  "flag_ground_c",
  "note_special",
  "note_approval_extra",
  "cover_recipient_suffix",
  "pdf_template_id",
  "pdf_company_name",
  "pdf_team",
  "pdf_contact_person",
  "pdf_address",
  "pdf_email",
  "pdf_tel",
  "pdf_fax",
  "photo_slot_a_label",
  "photo_slot_b_label",
  "photo_slot_c_label",
  "photo_slot_d_label",
  "layout_photo_slot_a_label",
  "layout_photo_slot_b_label",
  "layout_photo_slot_c_label",
  "layout_photo_slot_d_label",
];

const prefectures = [
  ["東京都", "港区港南"],
  ["東京都", "品川区西五反田"],
  ["神奈川県", "横浜市中区本町"],
  ["神奈川県", "川崎市川崎区砂子"],
  ["千葉県", "千葉市中央区新町"],
  ["埼玉県", "さいたま市大宮区桜木町"],
  ["大阪府", "大阪市中央区久太郎町"],
  ["大阪府", "大阪市北区梅田"],
  ["愛知県", "名古屋市中区栄"],
  ["福岡県", "福岡市博多区博多駅前"],
];

const teams = [
  { team: "東日本技術チーム", person: "鳥山 伸介", tel: "03-6846-0903", fax: "03-6846-0901", email: "s.toriyama@rezil.co.jp", address: "東京都千代田区丸の内1-8-1" },
  { team: "東日本技術チーム", person: "原田 健", tel: "03-6846-0912", fax: "03-6846-0913", email: "k.harada@rezil.co.jp", address: "東京都中央区日本橋2-5-1" },
  { team: "西日本技術チーム", person: "上野 大輔", tel: "06-6123-4100", fax: "06-6123-4101", email: "d.ueno@rezil.co.jp", address: "大阪府大阪市中央区久太郎町4-1-3" },
  { team: "設備保全チーム", person: "山田 太郎", tel: "052-211-3010", fax: "052-211-3011", email: "t.yamada@rezil.co.jp", address: "愛知県名古屋市中区栄3-1-1" },
];

const workSets = [
  { KOUATSU_CABLE: "1", UGS: "0", PAS: "1", GROUND_A: "0", GROUND_B: "0", GROUND_C: "0" },
  { KOUATSU_CABLE: "0", UGS: "1", PAS: "0", GROUND_A: "1", GROUND_B: "1", GROUND_C: "0" },
  { KOUATSU_CABLE: "1", UGS: "1", PAS: "0", GROUND_A: "0", GROUND_B: "0", GROUND_C: "1" },
  { KOUATSU_CABLE: "0", UGS: "0", PAS: "1", GROUND_A: "1", GROUND_B: "0", GROUND_C: "1" },
];

const templates = ["standard", "kansai", "night"];
const recipientSuffixes = ["管理組合御中", "管理会社御中", "ご担当者様"];

function formatDate(baseDay, offset) {
  const date = new Date(Date.UTC(2026, 3, baseDay + offset));
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(hour, minute = 0) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function escapeCsvCell(value) {
  const normalized = String(value ?? "");
  if (/[",\n\r]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

const rows = Array.from({ length: 200 }, (_, index) => {
  const no = index + 1;
  const buildingNo = String(no).padStart(4, "0");
  const [prefecture, city] = prefectures[index % prefectures.length];
  const contact = teams[index % teams.length];
  const workSet = workSets[index % workSets.length];
  const workDateStart = formatDate(10, index);
  const workDateEnd = index % 4 === 0 ? formatDate(11, index) : workDateStart;
  const outageDateStart = workDateEnd;
  const outageDateEnd = outageDateStart;
  const outageTimeStart = formatTime(9 + (index % 3) * 2);
  const outageTimeEnd = formatTime(12 + (index % 3) * 2);
  const outageEnabled = index % 5 === 0 ? "false" : "true";
  const templateId = templates[index % templates.length];
  const recipientSuffix = recipientSuffixes[index % recipientSuffixes.length];
  const propertyName = `テストマンション${buildingNo}`;
  const address = `${prefecture}${city}${Math.floor(index % 5) + 1}-${(index % 12) + 1}-${(index % 20) + 1}`;
  const subject = index % 2 === 0 ? "高圧設備更新工事" : "受変電設備点検工事";

  return {
    project_id: `PJ-LOAD-${buildingNo}`,
    property_name: propertyName,
    property_address: address,
    title_subject: subject,
    work_date_start: workDateStart,
    work_date_end: workDateEnd,
    outage_date_start: outageDateStart,
    outage_date_end: outageDateEnd,
    outage_time_start: outageTimeStart,
    outage_time_end: outageTimeEnd,
    outage_enabled: outageEnabled,
    flag_kouatsu_cable: workSet.KOUATSU_CABLE,
    flag_ugs: workSet.UGS,
    flag_pas: workSet.PAS,
    flag_ground_a: workSet.GROUND_A,
    flag_ground_b: workSet.GROUND_B,
    flag_ground_c: workSet.GROUND_C,
    note_special: `${propertyName} 共用部作業あり。掲示・養生・停電周知を実施。`,
    note_approval_extra: `${recipientSuffix === "管理会社御中" ? "管理会社経由で周知" : "居住者向け周知"}、当日朝に再周知。`,
    cover_recipient_suffix: recipientSuffix,
    pdf_template_id: templateId,
    pdf_company_name: "レジル株式会社",
    pdf_team: contact.team,
    pdf_contact_person: contact.person,
    pdf_address: contact.address,
    pdf_email: contact.email,
    pdf_tel: contact.tel,
    pdf_fax: contact.fax,
    photo_slot_a_label: "写真A（着工前）",
    photo_slot_b_label: "写真B（施工中）",
    photo_slot_c_label: "写真C（施工後）",
    photo_slot_d_label: "写真D（その他）",
    layout_photo_slot_a_label: "配置図写真A",
    layout_photo_slot_b_label: "配置図写真B",
    layout_photo_slot_c_label: "配置図写真C",
    layout_photo_slot_d_label: "配置図写真D",
  };
});

const csv = [
  headers.join(","),
  ...rows.map((row) => headers.map((header) => escapeCsvCell(row[header])).join(",")),
].join("\n");

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, csv, "utf8");
console.log(`Generated ${rows.length} rows at ${outputPath}`);
