const SHEET_PROJECTS = '案件一覧';
const SHEET_WORK_MASTER = '工事マスタ';
const SHEET_TEXT_MASTER = '文章マスタ';
const SHEET_OUTPUT_LOG = '出力履歴';
const REQUIRED_SHEETS = [SHEET_PROJECTS, SHEET_WORK_MASTER, SHEET_TEXT_MASTER, SHEET_OUTPUT_LOG];

const FIXED_LOGO_FILE_ID = '1QqmQMMjDlJUEUVUWkSzbblhojJGnjx7A';

const HEADERS_PROJECTS = [
  'project_id',
  'property_name',
  'property_address',
  'title_subject',
  'planned_outage_start',
  'planned_outage_end',
  'work_date_main',
  'work_time_start',
  'work_time_end',
  'flag_kouatsu_cable',
  'flag_ugs',
  'flag_pas',
  'flag_ground_a',
  'flag_ground_b',
  'flag_ground_c',
  'note_special',
  'note_approval_extra',
  'photo_slot_a_label',
  'photo_slot_b_label',
  'photo_slot_c_label',
  'photo_slot_d_label',
  'generated_pdf_url',
  'generated_at',
  'generated_by'
];

const HEADERS_WORK_MASTER = [
  'work_code',
  'work_name',
  'detail_text',
  'approval_text',
  'default_photo_slots',
  'order_no',
  'enabled'
];

const HEADERS_TEXT_MASTER = ['key', 'value', 'category'];
const HEADERS_OUTPUT_LOG = ['output_id', 'project_id', 'output_type', 'file_url', 'created_at', 'created_by'];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('施工計画書')
    .addItem('初期セットアップ（シート作成）', 'setupTemplateSheets')
    .addItem('表示整形（列幅・書式）', 'formatTemplateSheets')
    .addItem('E2Eテスト実行（サンプル→PDF）', 'runE2ETestAndGeneratePdf')
    .addItem('プレビューを開く（選択行）', 'openPreviewFromActiveRow')
    .addItem('エディタを開く', 'openEditor')
    .addItem('選択行をPDF出力', 'generatePdfFromActiveRow')
    .addItem('日付ズレ診断（選択行）', 'diagnoseDateFieldsFromActiveRow')
    .addItem('PDF日付整形診断（選択行）', 'diagnosePdfDateFormattingFromActiveRow')
    .addItem('日付回帰チェック', 'runDateRegressionChecks')
    .addItem('日付健全性スキャン', 'scanProjectDateFieldTypes')
    .addToUi();
}

function setupTemplateSheets() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const answer = ui.alert(
    '初期セットアップ',
    '必要シートを作成/初期化します。既存データがある場合は上書きされます。続行しますか？',
    ui.ButtonSet.YES_NO
  );
  if (answer !== ui.Button.YES) return;

  ensureSheetWithHeaders_(ss, SHEET_PROJECTS, HEADERS_PROJECTS, true);
  ensureSheetWithHeaders_(ss, SHEET_WORK_MASTER, HEADERS_WORK_MASTER, true);
  ensureSheetWithHeaders_(ss, SHEET_TEXT_MASTER, HEADERS_TEXT_MASTER, true);
  ensureSheetWithHeaders_(ss, SHEET_OUTPUT_LOG, HEADERS_OUTPUT_LOG, true);

  seedWorkMaster_(ss.getSheetByName(SHEET_WORK_MASTER));
  seedTextMaster_(ss.getSheetByName(SHEET_TEXT_MASTER));
  seedProjectExample_(ss.getSheetByName(SHEET_PROJECTS));
  formatTemplateSheets();
  ui.alert('初期セットアップが完了しました。');
}

function formatTemplateSheets() {
  assertRequiredSheets_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  formatProjectsSheet_(ss.getSheetByName(SHEET_PROJECTS));
  formatWorkMasterSheet_(ss.getSheetByName(SHEET_WORK_MASTER));
  formatTextMasterSheet_(ss.getSheetByName(SHEET_TEXT_MASTER));
  formatOutputLogSheet_(ss.getSheetByName(SHEET_OUTPUT_LOG));
}

function runE2ETestAndGeneratePdf() {
  const ui = SpreadsheetApp.getUi();
  const yes = ui.alert(
    'E2Eテスト',
    'サンプル案件を作成し、PDF出力まで自動テストします。続行しますか？',
    ui.ButtonSet.YES_NO
  );
  if (yes !== ui.Button.YES) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheetWithHeaders_(ss, SHEET_PROJECTS, HEADERS_PROJECTS, false);
  ensureSheetWithHeaders_(ss, SHEET_WORK_MASTER, HEADERS_WORK_MASTER, false);
  ensureSheetWithHeaders_(ss, SHEET_TEXT_MASTER, HEADERS_TEXT_MASTER, false);
  ensureSheetWithHeaders_(ss, SHEET_OUTPUT_LOG, HEADERS_OUTPUT_LOG, false);
  if (ss.getSheetByName(SHEET_WORK_MASTER).getLastRow() <= 1) seedWorkMaster_(ss.getSheetByName(SHEET_WORK_MASTER));
  if (ss.getSheetByName(SHEET_TEXT_MASTER).getLastRow() <= 1) seedTextMaster_(ss.getSheetByName(SHEET_TEXT_MASTER));
  formatTemplateSheets();

  const sh = ss.getSheetByName(SHEET_PROJECTS);
  const map = getHeaderMap_(sh);
  const testId = `E2E-${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss')}`;
  const row = new Array(HEADERS_PROJECTS.length).fill('');
  row[map.project_id - 1] = testId;
  row[map.property_name - 1] = 'ザ・レジデンス横浜みなと';
  row[map.property_address - 1] = '神奈川県横浜市西区みなとみらい3-5-1';
  row[map.title_subject - 1] = '電気設備更新工事（高圧ケーブル・UGS）';
  row[map.planned_outage_start - 1] = '2026-05-23 10:00';
  row[map.planned_outage_end - 1] = '2026-05-23 14:30';
  row[map.work_date_main - 1] = '2026-05-23';
  row[map.work_time_start - 1] = '09:00';
  row[map.work_time_end - 1] = '17:00';
  row[map.flag_kouatsu_cable - 1] = true;
  row[map.flag_ugs - 1] = true;
  row[map.flag_pas - 1] = false;
  row[map.flag_ground_a - 1] = false;
  row[map.flag_ground_b - 1] = false;
  row[map.flag_ground_c - 1] = false;
  row[map.note_special - 1] = '住民向け掲示は5/10掲示開始。';
  row[map.note_approval_extra - 1] = '当日は搬入車両の動線確保を実施します。';
  row[map.photo_slot_a_label - 1] = '写真A（交換前）';
  row[map.photo_slot_b_label - 1] = '写真B（施工中）';
  row[map.photo_slot_c_label - 1] = '写真C（交換後）';
  row[map.photo_slot_d_label - 1] = '写真D（復電確認）';
  sh.appendRow(row);

  const project = getProjectById_(testId);
  const selectedWorkCodes = inferWorksFromFlags_(project, loadWorkMaster_()).map(function(w) { return w.work_code; });
  const payload = {
    projectId: testId,
    selectedWorkCodes: selectedWorkCodes,
    noteSpecial: project.note_special || '',
    noteApprovalExtra: project.note_approval_extra || '',
    photoA: project.photo_slot_a_label || '写真A',
    photoB: project.photo_slot_b_label || '写真B',
    photoC: project.photo_slot_c_label || '写真C',
    photoD: project.photo_slot_d_label || '写真D'
  };
  payload.scheduleRows = getDefaultScheduleForEditor(payload);
  const result = generatePdf(payload);

  ui.alert(
    'E2Eテスト完了',
    `案件ID: ${testId}\nPDF URL: ${result.fileUrl}\n\n案件一覧と出力履歴を確認してください。`,
    ui.ButtonSet.OK
  );
}

function openEditor() {
  const html = HtmlService.createTemplateFromFile('Editor').evaluate().setTitle('施工計画書エディタ');
  SpreadsheetApp.getUi().showSidebar(html);
}

function getInitData() {
  assertRequiredSheets_();
  return {
    projects: listProjects_(),
    workMaster: loadWorkMaster_()
  };
}

function getProjectForEditor(projectId) {
  const project = getProjectById_(projectId);
  if (!project) throw new Error(`project not found: ${projectId}`);
  const workMaster = loadWorkMaster_();
  const selectedWorks = inferWorksFromFlags_(project, workMaster);
  return { project, selectedWorks };
}

function getDefaultScheduleForEditor(payload) {
  validatePayload_(payload);
  const project = getProjectById_(payload.projectId);
  if (!project) throw new Error(`project not found: ${payload.projectId}`);

  const workMaster = loadWorkMaster_();
  const selectedWorks = workMaster.filter(function(item) {
    return (payload.selectedWorkCodes || []).indexOf(item.work_code) >= 0;
  });

  return buildScheduleRows_(project, selectedWorks);
}

function saveProjectNotes(payload) {
  validatePayload_(payload);
  const sheet = getSheetByNameOrThrow_(SHEET_PROJECTS);
  const map = getHeaderMap_(sheet);
  const rowIndex = findRowByProjectId_(sheet, payload.projectId, map.project_id);
  if (!rowIndex) throw new Error(`row not found: ${payload.projectId}`);

  writeCellIfExists_(sheet, rowIndex, map.note_special, payload.noteSpecial || '');
  writeCellIfExists_(sheet, rowIndex, map.note_approval_extra, payload.noteApprovalExtra || '');
  writeCellIfExists_(sheet, rowIndex, map.photo_slot_a_label, payload.photoA || '写真A');
  writeCellIfExists_(sheet, rowIndex, map.photo_slot_b_label, payload.photoB || '写真B');
  writeCellIfExists_(sheet, rowIndex, map.photo_slot_c_label, payload.photoC || '写真C');
  writeCellIfExists_(sheet, rowIndex, map.photo_slot_d_label, payload.photoD || '写真D');
}

function generatePdf(payload) {
  validatePayload_(payload);
  const project = getProjectById_(payload.projectId);
  if (!project) throw new Error(`project not found: ${payload.projectId}`);

  const workMaster = loadWorkMaster_();
  const selectedWorks = workMaster.filter(function(item) {
    return (payload.selectedWorkCodes || []).indexOf(item.work_code) >= 0;
  });

  const textMaster = loadTextMaster_();
  const html = buildPlanHtml_(project, selectedWorks, payload, textMaster);
  // IMPORTANT: createHtmlOutput().getBlob() is HTML, not PDF.
  // Convert HTML blob to real PDF before saving to Drive.
  const htmlBlob = Utilities.newBlob(html, 'text/html', 'sekou_plan_temp.html');
  const blob = htmlBlob.getAs(MimeType.PDF).setName(buildPdfName_(project));
  const folder = getOrCreateOutputFolder_();
  const file = folder.createFile(blob);

  updateProjectOutputInfo_(project.project_id, file.getUrl());
  appendOutputLog_(project.project_id, file.getUrl());

  return { fileName: file.getName(), fileUrl: file.getUrl() };
}

function generatePdfFromActiveRow() {
  const sheet = SpreadsheetApp.getActiveSheet();
  if (sheet.getName() !== SHEET_PROJECTS) {
    SpreadsheetApp.getUi().alert('案件一覧シートで実行してください。');
    return;
  }

  const row = sheet.getActiveRange().getRow();
  if (row <= 1) {
    SpreadsheetApp.getUi().alert('データ行を選択してください。');
    return;
  }

  const map = getHeaderMap_(sheet);
  const projectId = sheet.getRange(row, map.project_id).getValue();
  if (!projectId) {
    SpreadsheetApp.getUi().alert('project_id が空です。');
    return;
  }

  const project = getProjectById_(projectId);
  const workMaster = loadWorkMaster_();
  const selectedWorks = inferWorksFromFlags_(project, workMaster).map(function(w) { return w.work_code; });

  const payload = {
    projectId,
    selectedWorkCodes: selectedWorks,
    noteSpecial: project.note_special || '',
    noteApprovalExtra: project.note_approval_extra || '',
    photoA: project.photo_slot_a_label || '写真A',
    photoB: project.photo_slot_b_label || '写真B',
    photoC: project.photo_slot_c_label || '写真C',
    photoD: project.photo_slot_d_label || '写真D'
  };
  payload.scheduleRows = getDefaultScheduleForEditor(payload);

  const result = generatePdf(payload);
  SpreadsheetApp.getUi().alert(`PDF作成完了\n${result.fileUrl}`);
}

function diagnoseDateFieldsFromActiveRow() {
  const sheet = SpreadsheetApp.getActiveSheet();
  if (sheet.getName() !== SHEET_PROJECTS) {
    SpreadsheetApp.getUi().alert('案件一覧シートで実行してください。');
    return;
  }

  const row = sheet.getActiveRange().getRow();
  if (row <= 1) {
    SpreadsheetApp.getUi().alert('データ行を選択してください。');
    return;
  }

  const report = buildDateFieldDiagnosticReport_(sheet, row);
  Logger.log(JSON.stringify(report, null, 2));

  const summaryLines = [
    `project_id: ${report.projectId || '(空)'}`,
    `row: ${report.row}`,
    `spreadsheet_tz: ${report.spreadsheetTimeZone}`,
    `script_tz: ${report.scriptTimeZone}`,
    `work_date_main: ${report.fields.work_date_main.type || '-'}`,
    `planned_outage_start: ${report.fields.planned_outage_start.type || '-'}`,
    `planned_outage_end: ${report.fields.planned_outage_end.type || '-'}`,
    '',
    '詳細は実行ログ（Executions）を確認してください。'
  ];
  SpreadsheetApp.getUi().alert('日付ズレ診断', summaryLines.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
}

function diagnoseDateFieldsByProjectId(projectId) {
  if (!projectId) {
    throw new Error('projectId is required');
  }

  const sheet = getSheetByNameOrThrow_(SHEET_PROJECTS);
  const map = getHeaderMap_(sheet);
  const row = findRowByProjectId_(sheet, projectId, map.project_id);
  if (!row) {
    throw new Error(`project not found: ${projectId}`);
  }

  const report = buildDateFieldDiagnosticReport_(sheet, row);
  Logger.log(JSON.stringify(report, null, 2));
  return report;
}

function diagnosePdfDateFormattingFromActiveRow() {
  const sheet = SpreadsheetApp.getActiveSheet();
  if (sheet.getName() !== SHEET_PROJECTS) {
    SpreadsheetApp.getUi().alert('案件一覧シートで実行してください。');
    return;
  }

  const row = sheet.getActiveRange().getRow();
  if (row <= 1) {
    SpreadsheetApp.getUi().alert('データ行を選択してください。');
    return;
  }

  const map = getHeaderMap_(sheet);
  const projectId = sheet.getRange(row, map.project_id).getValue();
  if (!projectId) {
    SpreadsheetApp.getUi().alert('project_id が空です。');
    return;
  }

  const project = getProjectById_(projectId);
  if (!project) {
    SpreadsheetApp.getUi().alert(`project not found: ${projectId}`);
    return;
  }

  const report = buildPdfDateFormattingReport_(project, sheet, row, map);
  Logger.log(JSON.stringify(report, null, 2));

  const lines = [
    `project_id: ${report.projectId}`,
    `row: ${report.row}`,
    `spreadsheet_tz: ${report.spreadsheetTimeZone}`,
    `script_tz: ${report.scriptTimeZone}`,
    '',
    `work_date_main display: ${report.fields.work_date_main.displayValue}`,
    `work_date_main toDateStr_: ${report.fields.work_date_main.toDateStr}`,
    '',
    `planned_outage_start display: ${report.fields.planned_outage_start.displayValue}`,
    `planned_outage_start toDateTimeStr_: ${report.fields.planned_outage_start.toDateTimeStr}`,
    '',
    `planned_outage_end display: ${report.fields.planned_outage_end.displayValue}`,
    `planned_outage_end toDateTimeStr_: ${report.fields.planned_outage_end.toDateTimeStr}`,
    '',
    '詳細は実行ログ（Executions）を確認してください。'
  ];
  SpreadsheetApp.getUi().alert('PDF日付整形診断', lines.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
}

function runDateRegressionChecks() {
  const results = [];
  function check(name, actual, expected) {
    results.push({
      name: name,
      actual: String(actual),
      expected: String(expected),
      ok: String(actual) === String(expected)
    });
  }

  check('toDateStr: ymd', toDateStr_('2026-04-24'), '2026/04/24');
  check('toDateStr: ymd slash', toDateStr_('2026/4/5'), '2026/04/05');
  check('toDateStr: ymdhm', toDateStr_('2026-04-24 10:30'), '2026/04/24');
  check('toDateTimeStr: ymdhm', toDateTimeStr_('2026-04-24 10:30'), '2026/04/24 10:30');
  check('toDateTimeStr: iso-like', toDateTimeStr_('2026-04-24T10:30:00'), '2026/04/24 10:30');
  check('formatTimeValue: hm', formatTimeValue_('9:05'), '09:05');
  check('formatTimeValue: ymdhm', formatTimeValue_('2026-04-24 10:30'), '10:30');
  check('parseTimeToMinute: ymdhm', parseTimeToMinute_('2026-04-24 10:30', NaN), 630);

  const normalized = normalizeProjectDateFields_({
    work_date_main: '2026/4/24',
    planned_outage_start: '2026/4/24 9:00',
    planned_outage_end: '10:30'
  });
  check('normalize: work_date_main', normalized.work_date_main, '2026-04-24');
  check('normalize: planned_outage_start', normalized.planned_outage_start, '2026-04-24 09:00');
  check('normalize: planned_outage_end', normalized.planned_outage_end, '2026-04-24 10:30');

  const failures = results.filter(function(r) { return !r.ok; });
  const report = {
    checkedAt: new Date().toISOString(),
    total: results.length,
    failCount: failures.length,
    failures: failures,
    results: results
  };
  Logger.log(JSON.stringify(report, null, 2));

  const lines = [
    `実行結果: ${failures.length === 0 ? 'OK' : 'NG'}`,
    `チェック数: ${results.length}`,
    `失敗数: ${failures.length}`
  ];
  failures.slice(0, 5).forEach(function(f) {
    lines.push(`- ${f.name}: actual=${f.actual}, expected=${f.expected}`);
  });
  lines.push('');
  lines.push('詳細は実行ログ（Executions）を確認してください。');

  SpreadsheetApp.getUi().alert('日付回帰チェック', lines.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
  return report;
}

function scanProjectDateFieldTypes() {
  assertRequiredSheets_();
  const sheet = getSheetByNameOrThrow_(SHEET_PROJECTS);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    SpreadsheetApp.getUi().alert('案件一覧のデータ行がありません。');
    return {
      scannedRows: 0,
      issueCount: 0,
      issues: []
    };
  }

  const headers = values[0];
  const map = {};
  headers.forEach(function(h, i) { map[String(h)] = i + 1; });
  const targetFields = ['work_date_main', 'planned_outage_start', 'planned_outage_end', 'work_time_start', 'work_time_end'];
  const fieldStats = {};
  targetFields.forEach(function(field) {
    fieldStats[field] = { checked: 0, empty: 0, dateObject: 0, invalid: 0, warning: 0 };
  });

  const issues = [];
  for (let r = 1; r < values.length; r++) {
    const rowNo = r + 1;
    const row = values[r];
    const projectId = String(row[(map.project_id || 1) - 1] || '').trim();
    targetFields.forEach(function(field) {
      const col = map[field];
      if (!col) return;
      const inspected = inspectDateFieldForScan_(field, row[col - 1]);
      const stat = fieldStats[field];
      stat.checked += 1;
      if (inspected.empty) {
        stat.empty += 1;
        return;
      }
      if (inspected.dateObject) {
        stat.dateObject += 1;
        if (issues.length < 200) {
          issues.push({
            row: rowNo,
            project_id: projectId,
            field: field,
            kind: 'DATE_OBJECT',
            message: 'Date型が混在しています（文字列へ正規化推奨）',
            raw: inspected.raw
          });
        }
      }
      if (inspected.warning) {
        stat.warning += 1;
        if (issues.length < 200) {
          issues.push({
            row: rowNo,
            project_id: projectId,
            field: field,
            kind: 'WARNING',
            message: inspected.warning,
            raw: inspected.raw
          });
        }
      }
      if (inspected.invalid) {
        stat.invalid += 1;
        if (issues.length < 200) {
          issues.push({
            row: rowNo,
            project_id: projectId,
            field: field,
            kind: 'INVALID',
            message: inspected.invalid,
            raw: inspected.raw
          });
        }
      }
    });
  }

  const report = {
    scannedAt: new Date().toISOString(),
    spreadsheetTimeZone: getEffectiveTimeZone_(),
    scannedRows: values.length - 1,
    issueCount: issues.length,
    fieldStats: fieldStats,
    issues: issues
  };
  Logger.log(JSON.stringify(report, null, 2));

  const lines = [
    `スキャン行数: ${report.scannedRows}`,
    `検出件数: ${report.issueCount}`,
    `Date型混在: ${targetFields.reduce(function(sum, f) { return sum + fieldStats[f].dateObject; }, 0)}`,
    `不正フォーマット: ${targetFields.reduce(function(sum, f) { return sum + fieldStats[f].invalid; }, 0)}`,
    `警告: ${targetFields.reduce(function(sum, f) { return sum + fieldStats[f].warning; }, 0)}`,
    ''
  ];
  issues.slice(0, 5).forEach(function(issue) {
    const id = issue.project_id || `(row:${issue.row})`;
    lines.push(`- ${id} / ${issue.field} / ${issue.kind}: ${issue.message}`);
  });
  lines.push('');
  lines.push('詳細は実行ログ（Executions）を確認してください。');

  SpreadsheetApp.getUi().alert('日付健全性スキャン', lines.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
  return report;
}

function inspectDateFieldForScan_(field, value) {
  if (value === null || value === undefined || value === '') {
    return { empty: true, raw: '' };
  }
  if (Object.prototype.toString.call(value) === '[object Date]') {
    if (Number.isNaN(value.getTime())) {
      return { raw: String(value), invalid: '無効なDate値です' };
    }
    return { raw: value.toISOString(), dateObject: true };
  }

  const raw = String(value).trim();
  const parsed = parseDateTimeStringParts_(raw);
  if (!parsed) {
    return { raw: raw, invalid: '日付/時刻の形式を判定できません' };
  }

  if (field === 'work_date_main') {
    if (!parsed.hasDate) return { raw: raw, invalid: 'YYYY-MM-DD 形式の日付が必要です' };
    if (parsed.hasTime) return { raw: raw, invalid: 'work_date_main は日付のみ（時刻なし）で保存してください' };
    if (!isValidYmdParts_(parsed.year, parsed.month, parsed.day)) return { raw: raw, invalid: '日付値が不正です' };
    return { raw: raw };
  }

  if (field === 'planned_outage_start' || field === 'planned_outage_end') {
    if (!parsed.hasDate) return { raw: raw, invalid: 'YYYY-MM-DD HH:mm 形式が必要です' };
    if (!isValidYmdParts_(parsed.year, parsed.month, parsed.day)) return { raw: raw, invalid: '日付値が不正です' };
    if (!parsed.hasTime) return { raw: raw, warning: '時刻なしで保存されています（YYYY-MM-DD HH:mm 推奨）' };
    if (!isValidHmParts_(parsed.hour, parsed.minute)) return { raw: raw, invalid: '時刻値が不正です' };
    return { raw: raw };
  }

  if (field === 'work_time_start' || field === 'work_time_end') {
    if (!parsed.hasTime) return { raw: raw, invalid: 'HH:mm 形式の時刻が必要です' };
    if (!isValidHmParts_(parsed.hour, parsed.minute)) return { raw: raw, invalid: '時刻値が不正です' };
    return { raw: raw };
  }

  return { raw: raw };
}

function buildDateFieldDiagnosticReport_(sheet, row) {
  const map = getHeaderMap_(sheet);
  const ssTz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const scriptTz = Session.getScriptTimeZone();
  const report = {
    inspectedAt: new Date().toISOString(),
    row: row,
    spreadsheetTimeZone: ssTz,
    scriptTimeZone: scriptTz,
    projectId: '',
    fields: {}
  };

  report.projectId = inspectCellValue_(sheet, row, map.project_id, scriptTz, ssTz).displayValue || '';
  report.fields.work_date_main = inspectCellValue_(sheet, row, map.work_date_main, scriptTz, ssTz);
  report.fields.planned_outage_start = inspectCellValue_(sheet, row, map.planned_outage_start, scriptTz, ssTz);
  report.fields.planned_outage_end = inspectCellValue_(sheet, row, map.planned_outage_end, scriptTz, ssTz);

  return report;
}

function buildPdfDateFormattingReport_(project, sheet, row, map) {
  const ssTz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const scriptTz = Session.getScriptTimeZone();

  return {
    inspectedAt: new Date().toISOString(),
    projectId: String(project.project_id || ''),
    row: row,
    spreadsheetTimeZone: ssTz,
    scriptTimeZone: scriptTz,
    fields: {
      work_date_main: inspectPdfDateField_(project.work_date_main, sheet, row, map.work_date_main, scriptTz, ssTz),
      planned_outage_start: inspectPdfDateField_(project.planned_outage_start, sheet, row, map.planned_outage_start, scriptTz, ssTz),
      planned_outage_end: inspectPdfDateField_(project.planned_outage_end, sheet, row, map.planned_outage_end, scriptTz, ssTz),
    }
  };
}

function inspectCellValue_(sheet, row, col, scriptTz, ssTz) {
  if (!col) {
    return { exists: false };
  }

  const range = sheet.getRange(row, col);
  const value = range.getValue();
  const type = Object.prototype.toString.call(value);
  const result = {
    exists: true,
    column: col,
    type: type,
    displayValue: range.getDisplayValue(),
    numberFormat: range.getNumberFormat(),
    rawString: String(value == null ? '' : value)
  };

  if (type === '[object Date]' && !Number.isNaN(value.getTime())) {
    result.epochMs = value.getTime();
    result.isoUtc = value.toISOString();
    result.scriptTzValue = Utilities.formatDate(value, scriptTz, 'yyyy/MM/dd HH:mm:ss Z');
    result.sheetTzValue = Utilities.formatDate(value, ssTz, 'yyyy/MM/dd HH:mm:ss Z');
  }

  return result;
}

function inspectPdfDateField_(value, sheet, row, col, scriptTz, ssTz) {
  const base = inspectCellValue_(sheet, row, col, scriptTz, ssTz);
  const inspected = {
    column: base.column,
    type: base.type,
    displayValue: base.displayValue,
    numberFormat: base.numberFormat,
    rawString: base.rawString,
    toDateStr: toDateStr_(value),
    toDateTimeStr: toDateTimeStr_(value),
  };

  if (base.isoUtc) inspected.isoUtc = base.isoUtc;
  if (base.scriptTzValue) inspected.scriptTzValue = base.scriptTzValue;
  if (base.sheetTzValue) inspected.sheetTzValue = base.sheetTzValue;
  return inspected;
}

function openPreviewFromActiveRow() {
  const sheet = SpreadsheetApp.getActiveSheet();
  if (sheet.getName() !== SHEET_PROJECTS) {
    SpreadsheetApp.getUi().alert('案件一覧シートで実行してください。');
    return;
  }

  const row = sheet.getActiveRange().getRow();
  if (row <= 1) {
    SpreadsheetApp.getUi().alert('データ行を選択してください。');
    return;
  }

  const map = getHeaderMap_(sheet);
  const projectId = sheet.getRange(row, map.project_id).getValue();
  if (!projectId) {
    SpreadsheetApp.getUi().alert('project_id が空です。');
    return;
  }

  const project = getProjectById_(projectId);
  const workMaster = loadWorkMaster_();
  const selectedWorks = inferWorksFromFlags_(project, workMaster);

  const payload = {
    projectId,
    selectedWorkCodes: selectedWorks.map(function(w) { return w.work_code; }),
    noteSpecial: project.note_special || '',
    noteApprovalExtra: project.note_approval_extra || '',
    photoA: project.photo_slot_a_label || '写真A（着工前）',
    photoB: project.photo_slot_b_label || '写真B（施工中）',
    photoC: project.photo_slot_c_label || '写真C（施工後）',
    photoD: project.photo_slot_d_label || '写真D（その他）',
    scheduleRows: buildScheduleRows_(project, selectedWorks)
  };

  const html = buildPlanHtml_(project, selectedWorks, payload, loadTextMaster_());
  const dialog = HtmlService.createHtmlOutput(html).setWidth(980).setHeight(720);
  SpreadsheetApp.getUi().showModalDialog(dialog, `施工計画書プレビュー: ${projectId}`);
}

function openPreviewFromPayload(payload) {
  validatePayload_(payload);
  const project = getProjectById_(payload.projectId);
  if (!project) throw new Error(`project not found: ${payload.projectId}`);

  const workMaster = loadWorkMaster_();
  const selectedWorks = workMaster.filter(function(item) {
    return (payload.selectedWorkCodes || []).indexOf(item.work_code) >= 0;
  });

  const html = buildPlanHtml_(project, selectedWorks, payload, loadTextMaster_());
  const dialog = HtmlService.createHtmlOutput(html).setWidth(980).setHeight(720);
  SpreadsheetApp.getUi().showModalDialog(dialog, `施工計画書プレビュー: ${payload.projectId}`);
}

function buildPlanHtml_(project, selectedWorks, payload, textMaster) {
  const lines = [];
  const outage = formatOutage_(project.planned_outage_start, project.planned_outage_end);
  const caution = textMaster.filter(function(t) { return t.category === 'caution'; }).map(function(t) { return t.value; });
  const workNames = selectedWorks.map(function(w) { return w.work_name; });
  const detailRows = selectedWorks.map(function(w) {
    return `<tr><th>${h_(w.work_name)}</th><td>${h_(w.detail_text || '')}</td></tr>`;
  }).join('');
  const scheduleRows = normalizeScheduleRowsFromPayload_(payload, project, selectedWorks);
  const coverLogoDataUri = getFixedCoverLogoDataUri_();
  const samplePhotos = [
    { src: buildSamplePhotoDataUri_(payload.photoA || '写真A', '#cde5ff'), cap: payload.photoA || '写真A' },
    { src: buildSamplePhotoDataUri_(payload.photoB || '写真B', '#d7f7df'), cap: payload.photoB || '写真B' },
    { src: buildSamplePhotoDataUri_(payload.photoC || '写真C', '#ffe8cc'), cap: payload.photoC || '写真C' },
    { src: buildSamplePhotoDataUri_(payload.photoD || '写真D', '#f0e7ff'), cap: payload.photoD || '写真D' }
  ];

  lines.push('<html><head><meta charset="utf-8"><style>');
  lines.push('@page{size:A4 portrait;margin:14mm 14mm 16mm 14mm;}');
  lines.push('body{font-family:"Noto Sans JP",sans-serif;color:#111;margin:0;font-size:12px;line-height:1.6;}');
  lines.push('.page{min-height:257mm;position:relative;} .page-break{page-break-after:always;} .center{text-align:center;}');
  lines.push('.cover-logo-wrap{text-align:center;padding-top:18mm;} .cover-logo{max-width:140px;max-height:72px;object-fit:contain;}');
  lines.push('.title-xl{font-size:34px;font-weight:700;letter-spacing:1px;} .title-lg{font-size:26px;font-weight:700;}');
  lines.push('.sec-title{font-size:26px;font-weight:700;margin:0 0 12px 0;} .sub-title{font-size:16px;font-weight:700;margin:12px 0 8px 0;}');
  lines.push('.meta-card{border:1px solid #333;padding:12px 16px;width:72%;margin:0 auto;} .meta-card table{width:100%;border-collapse:collapse;}');
  lines.push('.meta-card th{width:30%;text-align:left;font-weight:700;padding:3px 0;} .meta-card td{padding:3px 0;}');
  lines.push('.toc{font-size:22px;line-height:2.0;margin-top:30mm;}');
  lines.push('.summary{border:1px solid #222;border-collapse:collapse;width:100%;} .summary th,.summary td{border:1px solid #222;padding:7px 9px;vertical-align:top;} .summary th{width:24%;background:#fafafa;}');
  lines.push('.small{font-size:11px;color:#333;}');
  lines.push('.schedule{border:1px solid #222;border-collapse:collapse;width:100%;table-layout:fixed;}');
  lines.push('.schedule th,.schedule td{border:1px solid #222;padding:4px 6px;vertical-align:middle;} .schedule th{background:#fafafa;}');
  lines.push('.timeline-header{position:relative;height:26px;background:#fff;background-image:repeating-linear-gradient(to right, rgba(0,0,0,.16) 0, rgba(0,0,0,.16) 1px, transparent 1px, transparent calc(100%/12));}');
  lines.push('.timeline-hours{position:absolute;inset:0;display:flex;justify-content:space-between;align-items:flex-start;padding:3px 4px;font-size:10px;color:#222;}');
  lines.push('.timeline-track{position:relative;height:34px;background:#ffffff;background-image:linear-gradient(to bottom,#f8fbff,#eef5ff),repeating-linear-gradient(to right, rgba(51,65,85,.22) 0, rgba(51,65,85,.22) 1px, transparent 1px, transparent calc(100%/24));}');
  lines.push('.bar{position:absolute;top:5px;height:24px;border-radius:4px;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;white-space:nowrap;overflow:hidden;padding:0 6px;box-shadow:inset 0 -1px 0 rgba(0,0,0,.2);}');
  lines.push('.bar.outage{background:#dc2626 !important;font-weight:700;}');
  lines.push('.outage{border:2px solid #222;padding:8px 12px;margin:10px 0;} .outage .red{color:#d10000;font-weight:700;font-size:18px;}');
  lines.push('.photo-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px;}');
  lines.push('.photo-card{border:1px solid #cfd6df;background:#fff;padding:6px;}');
  lines.push('.photo-image{width:100%;height:168px;object-fit:cover;border:1px solid #d6dce5;display:block;}');
  lines.push('.photo-cap{font-size:11px;color:#334155;text-align:center;margin-top:4px;}');
  lines.push('.approval{border:1px solid #222;border-collapse:collapse;width:100%;} .approval th,.approval td{border:1px solid #222;padding:8px 10px;vertical-align:top;} .approval .no{width:6%;text-align:center;} .approval .head{width:24%;font-weight:700;}');
  lines.push('.box-row{display:flex;gap:14px;margin-bottom:14px;} .box{border:1px solid #222;padding:10px;flex:1;min-height:88px;}');
  lines.push('.flow-wrap{position:relative;height:264px;margin-top:12px;}');
  lines.push('.flow-svg{position:absolute;inset:0;width:100%;height:264px;z-index:1;}');
  lines.push('.flow-box{position:absolute;border:1px solid #222;background:#fff;padding:7px 9px;z-index:2;font-size:11px;line-height:1.45;}');
  lines.push('.f-org{left:0;top:0;width:180px;height:56px;}');
  lines.push('.f-rezil-top{left:210px;top:0;width:220px;height:56px;}');
  lines.push('.f-resident{left:0;top:96px;width:180px;height:46px;}');
  lines.push('.f-rezil-main{left:210px;top:90px;width:220px;height:66px;}');
  lines.push('.f-tepco{left:460px;top:90px;width:190px;height:66px;}');
  lines.push('.f-contractor{left:210px;top:190px;width:220px;height:56px;}');
  lines.push('.footer-note{position:absolute;bottom:0;left:0;right:0;text-align:center;color:#666;font-size:10px;}');
  lines.push('</style></head><body>');

  lines.push('<div class="page page-break">');
  lines.push(`<div style="padding-top:8mm;text-align:right;">${h_(toDateStr_(project.work_date_main) || toDateStr_(new Date()))}</div>`);
  lines.push('<div class="cover-logo-wrap">');
  lines.push(`<img class="cover-logo" src="${coverLogoDataUri}" alt="REZILロゴ">`);
  lines.push('</div>');
  lines.push('<div class="center" style="padding-top:18mm;">');
  lines.push(`<div class="title-lg">${h_(project.property_name || '')}　管理組合御中</div>`);
  lines.push('<div style="height:40mm;"></div>');
  lines.push(`<div class="title-lg">${h_(project.title_subject || '電気設備更新工事')}</div>`);
  lines.push('<div style="height:10mm;"></div>');
  lines.push('<div class="title-xl">施工計画書</div></div>');
  lines.push('<div style="height:52mm;"></div>');
  lines.push('<div class="meta-card"><table>');
  lines.push('<tr><th>会社名</th><td>レジル株式会社</td></tr>');
  lines.push('<tr><th>担当部署</th><td>技術設計グループ 東日本技術チーム</td></tr>');
  lines.push('<tr><th>担当者</th><td>（案件一覧の担当者情報を連携可能）</td></tr>');
  lines.push('<tr><th>住所</th><td>東京都千代田区丸の内一丁目8-1</td></tr>');
  lines.push('<tr><th>TEL</th><td>03-6846-0903</td></tr>');
  lines.push('</table></div>');
  lines.push('</div>');

  lines.push('<div class="page page-break center">');
  lines.push('<div class="title-lg" style="padding-top:20mm;">目次</div>');
  lines.push('<div class="toc" style="display:inline-block;text-align:left;">');
  lines.push('1. 工事概要<br>2. 工事詳細説明<br>3. ご承認いただきたい事項<br>4. 施工体制表<br>5. 緊急連絡体制表');
  lines.push('</div></div>');

  lines.push('<div class="page page-break">');
  lines.push('<h1 class="sec-title">1. 工事概要</h1>');
  lines.push('<table class="summary">');
  lines.push(`<tr><th>工事件名</th><td>${h_(project.title_subject || '')}</td></tr>`);
  lines.push('<tr><th>工事目的</th><td>マンション一括受電サービスのために設置されている設備を交換し、適切な設備管理を行います。</td></tr>');
  lines.push(`<tr><th>工事場所</th><td>${h_(project.property_address || '')}</td></tr>`);
  lines.push(`<tr><th>工事項目</th><td>${h_(workNames.join(' / ') || '未選択')}</td></tr>`);
  lines.push(`<tr><th>工事日</th><td>${h_(toDateStr_(project.work_date_main))}</td></tr>`);
  lines.push(`<tr><th>作業時間</th><td>${h_(formatTimeValue_(project.work_time_start))} - ${h_(formatTimeValue_(project.work_time_end))}</td></tr>`);
  lines.push('</table>');
  lines.push('<div class="outage"><div class="sub-title" style="margin:0;color:#d10000;">停電時間</div>');
  lines.push(`<div class="red">${h_(outage)}</div><div class="small">※上記時間で全館停電いたします。</div></div>`);
  lines.push('<div class="sub-title">工程表（編集反映）</div>');
  lines.push('<table class="schedule"><tr><th style="width:24%;">項目</th><th>時間軸</th><th style="width:20%;">備考</th></tr>');
  lines.push('<tr><th></th><th><div class="timeline-header"><div class="timeline-hours">');
  for (let h = 7; h <= 19; h++) lines.push(`<span>${h}</span>`);
  lines.push('</div></div></th><th></th></tr>');
  scheduleRows.forEach(function(row, idx) {
    const range = calcBarRange_(row.startMin, row.endMin);
    lines.push('<tr>');
    lines.push(`<td>${h_(row.label)}</td>`);
    lines.push('<td><div class="timeline-track">');
    const color = row.outage ? '#dc2626' : pickScheduleColor_(row.label, idx);
    lines.push(`<div class="bar ${row.outage ? 'outage' : ''}" style="left:${range.left}%;width:${range.width}%;background:${color};">${h_(row.text || '')}</div>`);
    lines.push('</div></td>');
    lines.push(`<td>${h_(row.note || '')}</td>`);
    lines.push('</tr>');
  });
  lines.push('</table>');
  lines.push('<div class="footer-note">施工計画書</div>');
  lines.push('</div>');

  lines.push('<div class="page page-break">');
  lines.push('<h1 class="sec-title">2. 工事詳細説明</h1>');
  lines.push('<table class="summary"><tr><th>工事項目</th><th>詳細説明</th></tr>');
  lines.push(detailRows || '<tr><td colspan="2">工事項目が未選択です。</td></tr>');
  lines.push('</table>');
  lines.push('<div class="sub-title" style="margin-top:14px;">参考写真（後貼り）</div>');
  lines.push('<div class="photo-grid">');
  samplePhotos.forEach(function(p) {
    lines.push(`<div class="photo-card"><img class="photo-image" src="${p.src}" alt="${h_(p.cap)}"><div class="photo-cap">${h_(p.cap)}</div></div>`);
  });
  lines.push('</div>');
  lines.push('<div class="small" style="margin-top:8px;">※現在はサンプル画像を表示しています。必要に応じて実写真に差し替え可能です。</div>');
  lines.push('<div class="footer-note">施工計画書</div>');
  lines.push('</div>');

  lines.push('<div class="page page-break">');
  lines.push('<h1 class="sec-title">3. ご承認いただきたい事項</h1>');
  lines.push('<table class="approval">');
  lines.push('<tr><th class="no">No</th><th class="head">項目</th><th>内容</th></tr>');
  selectedWorks.forEach(function(w, i) {
    lines.push(`<tr><td class="no">${i + 1}</td><td class="head">${h_(w.work_name)}</td><td>${h_(w.approval_text || '作業計画をご確認ください。')}</td></tr>`);
  });
  if (payload.noteApprovalExtra) {
    lines.push(`<tr><td class="no">${selectedWorks.length + 1}</td><td class="head">追加事項</td><td>${h_(payload.noteApprovalExtra)}</td></tr>`);
  }
  lines.push('</table>');
  lines.push('<div class="sub-title">ご注意いただきたい事項</div><ul>');
  caution.forEach(function(c) { lines.push(`<li>${h_(c)}</li>`); });
  if (payload.noteSpecial) lines.push(`<li>${h_(payload.noteSpecial)}</li>`);
  lines.push('</ul>');
  lines.push('<div class="footer-note">施工計画書</div>');
  lines.push('</div>');

  lines.push('<div class="page">');
  lines.push('<h1 class="sec-title">4. 施工体制表</h1>');
  lines.push('<div class="box-row">');
  lines.push('<div class="box"><strong>発注者</strong><br>レジル株式会社<br>TEL: 03-6846-0903</div>');
  lines.push('<div class="box"><strong>電力会社</strong><br>東京電力パワーグリッド株式会社<br>TEL: 050-3093-5454</div>');
  lines.push('</div>');
  lines.push('<div class="box" style="width:56%;"><strong>施工会社</strong><br>（必要に応じて体制マスタ連携）<br>TEL: -</div>');
  lines.push('<h1 class="sec-title" style="margin-top:18px;">5. 緊急連絡体制表</h1>');
  lines.push('<div class="flow-wrap">');
  lines.push('<svg class="flow-svg" viewBox="0 0 660 264" preserveAspectRatio="none">');
  lines.push('<defs><marker id="arrowHead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#374151"/></marker></defs>');
  lines.push('<line x1="180" y1="28" x2="210" y2="28" stroke="#374151" stroke-width="2" marker-end="url(#arrowHead)"/>');
  lines.push('<line x1="320" y1="56" x2="320" y2="90" stroke="#374151" stroke-width="2" marker-end="url(#arrowHead)"/>');
  lines.push('<line x1="180" y1="119" x2="210" y2="119" stroke="#374151" stroke-width="2" marker-end="url(#arrowHead)"/>');
  lines.push('<line x1="430" y1="123" x2="460" y2="123" stroke="#374151" stroke-width="2" marker-end="url(#arrowHead)"/>');
  lines.push('<line x1="320" y1="156" x2="320" y2="190" stroke="#374151" stroke-width="2" marker-end="url(#arrowHead)"/>');
  lines.push('</svg>');
  lines.push('<div class="flow-box f-org"><strong>管理組合さま</strong><br>管理会社さま</div>');
  lines.push('<div class="flow-box f-rezil-top"><strong>レジル株式会社</strong><br>TEL: 03-6846-0903</div>');
  lines.push('<div class="flow-box f-resident"><strong>居住者さま</strong></div>');
  lines.push('<div class="flow-box f-rezil-main"><strong>レジル株式会社</strong><br>担当者: （案件担当）<br>TEL: 03-6846-0903</div>');
  lines.push('<div class="flow-box f-tepco"><strong>東京電力パワーグリッド株式会社</strong><br>平塚支社<br>TEL: 050-3093-5454</div>');
  lines.push('<div class="flow-box f-contractor"><strong>施工会社</strong><br>担当者: -<br>TEL: -</div>');
  lines.push('</div>');
  lines.push('<div class="footer-note">施工計画書</div>');
  lines.push('</div>');

  lines.push('</body></html>');
  return lines.join('');
}

function normalizeScheduleRowsFromPayload_(payload, project, selectedWorks) {
  const rows = (payload && Array.isArray(payload.scheduleRows)) ? payload.scheduleRows : [];
  const normalized = rows
    .map(function(r) {
      const s = parseTimeToMinute_(r.start, NaN);
      const e = parseTimeToMinute_(r.end, NaN);
      if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return null;
      return {
        label: String(r.label || '').trim() || '作業',
        startMin: clamp_(s, 7 * 60, 19 * 60),
        endMin: clamp_(e, 7 * 60, 19 * 60),
        outage: !!r.outage,
        note: String(r.note || ''),
        text: r.outage ? '全館停電' : String(r.text || '')
      };
    })
    .filter(function(r) { return !!r && r.endMin > r.startMin; });

  if (normalized.length) return normalized;
  return buildScheduleRows_(project, selectedWorks);
}

function listProjects_() {
  const sheet = getSheetByNameOrThrow_(SHEET_PROJECTS);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  const headers = values[0];
  return values.slice(1).map(function(row) {
    const obj = {};
    headers.forEach(function(h, i) { obj[String(h)] = row[i]; });
    const normalized = normalizeProjectDateFields_(obj);
    return {
      project_id: String(normalized.project_id || ''),
      property_name: String(normalized.property_name || ''),
      title_subject: String(normalized.title_subject || ''),
      work_date_main: normalized.work_date_main || ''
    };
  }).filter(function(x) { return x.project_id; });
}

function getProjectById_(projectId) {
  const sheet = getSheetByNameOrThrow_(SHEET_PROJECTS);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return null;
  const headers = values[0];
  for (let i = 1; i < values.length; i++) {
    const obj = {};
    headers.forEach(function(h, idx) { obj[String(h)] = values[i][idx]; });
    if (String(obj.project_id) === String(projectId)) return normalizeProjectDateFields_(obj);
  }
  return null;
}

function inferWorksFromFlags_(project, workMaster) {
  const map = {
    KOUATSU_CABLE: toBool_(project.flag_kouatsu_cable),
    UGS: toBool_(project.flag_ugs),
    PAS: toBool_(project.flag_pas),
    GROUND_A: toBool_(project.flag_ground_a),
    GROUND_B: toBool_(project.flag_ground_b),
    GROUND_C: toBool_(project.flag_ground_c)
  };
  return workMaster.filter(function(w) { return map[w.work_code] === true; });
}

function loadWorkMaster_() {
  const sheet = getSheetByNameOrThrow_(SHEET_WORK_MASTER);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  const headers = values[0];
  return values.slice(1).map(function(row) {
    const obj = {};
    headers.forEach(function(h, i) { obj[String(h)] = row[i]; });
    return {
      work_code: String(obj.work_code || ''),
      work_name: String(obj.work_name || ''),
      detail_text: String(obj.detail_text || ''),
      approval_text: String(obj.approval_text || ''),
      order_no: Number(obj.order_no || 999),
      enabled: toBool_(obj.enabled)
    };
  }).filter(function(r) {
    return r.work_code && r.enabled;
  }).sort(function(a, b) {
    return a.order_no - b.order_no;
  });
}

function loadTextMaster_() {
  const sheet = getSheetByNameOrThrow_(SHEET_TEXT_MASTER);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  const headers = values[0];
  return values.slice(1).map(function(row) {
    const obj = {};
    headers.forEach(function(h, i) { obj[String(h)] = row[i]; });
    return {
      key: String(obj.key || ''),
      value: String(obj.value || ''),
      category: String(obj.category || '')
    };
  }).filter(function(x) { return x.key && x.value; });
}

function updateProjectOutputInfo_(projectId, fileUrl) {
  const sheet = getSheetByNameOrThrow_(SHEET_PROJECTS);
  const map = getHeaderMap_(sheet);
  const rowIndex = findRowByProjectId_(sheet, projectId, map.project_id);
  if (!rowIndex) return;
  writeCellIfExists_(sheet, rowIndex, map.generated_pdf_url, fileUrl);
  writeCellIfExists_(sheet, rowIndex, map.generated_at, new Date());
  writeCellIfExists_(sheet, rowIndex, map.generated_by, Session.getActiveUser().getEmail());
}

function appendOutputLog_(projectId, fileUrl) {
  const sheet = getSheetByNameOrThrow_(SHEET_OUTPUT_LOG);
  sheet.appendRow([
    Utilities.getUuid(),
    projectId,
    'PDF',
    fileUrl,
    new Date(),
    Session.getActiveUser().getEmail()
  ]);
}

function getOrCreateOutputFolder_() {
  const props = PropertiesService.getScriptProperties();
  const key = 'SEKOU_OUTPUT_FOLDER_ID';
  const existingId = props.getProperty(key);
  if (existingId) {
    try {
      return DriveApp.getFolderById(existingId);
    } catch (e) {}
  }
  const folder = DriveApp.createFolder('施工計画書_PDF');
  props.setProperty(key, folder.getId());
  return folder;
}

function buildPdfName_(project) {
  const datePart = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmm');
  return `${project.project_id || 'PROJECT'}_施工計画書_${datePart}.pdf`;
}

function getFixedCoverLogoDataUri_() {
  const blob = DriveApp.getFileById(FIXED_LOGO_FILE_ID).getBlob();
  return `data:${blob.getContentType()};base64,${Utilities.base64Encode(blob.getBytes())}`;
}

function buildSamplePhotoDataUri_(label, bgColor) {
  const safe = String(label || 'SAMPLE').replace(/[&<>\"']/g, '');
  const color = bgColor || '#e2e8f0';
  const svg =
    '<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"640\" height=\"420\" viewBox=\"0 0 640 420\">' +
    `<rect width=\"640\" height=\"420\" fill=\"${color}\"/>` +
    '<rect x=\"24\" y=\"24\" width=\"592\" height=\"372\" fill=\"none\" stroke=\"#334155\" stroke-dasharray=\"8,6\" stroke-width=\"3\"/>' +
    '<circle cx=\"140\" cy=\"132\" r=\"34\" fill=\"#94a3b8\"/>' +
    '<path d=\"M56 332 L230 198 L318 272 L402 214 L584 332 Z\" fill=\"#94a3b8\" opacity=\"0.85\"/>' +
    `<text x=\"50%\" y=\"50%\" text-anchor=\"middle\" font-size=\"34\" font-family=\"Arial, sans-serif\" fill=\"#1e293b\">${safe}</text>` +
    '<text x=\"50%\" y=\"58%\" text-anchor=\"middle\" font-size=\"18\" font-family=\"Arial, sans-serif\" fill=\"#334155\">SAMPLE PHOTO</text>' +
    '</svg>';
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

function buildScheduleRows_(project, selectedWorks) {
  const start = parseTimeToMinute_(project.work_time_start, 9 * 60);
  const end = parseTimeToMinute_(project.work_time_end, 17 * 60);
  const safeEnd = Math.max(end, start + 120);
  const span = safeEnd - start;
  const unit = Math.max(35, Math.floor(span / Math.max(selectedWorks.length + 3, 4)));

  const rows = [];
  rows.push({ label: '準備作業', startMin: start, endMin: Math.min(start + unit, safeEnd), note: '資材確認', text: '' });

  let cursor = start + Math.floor(unit * 0.75);
  selectedWorks.forEach(function(w) {
    const s = cursor;
    const e = Math.min(s + unit, safeEnd - 40);
    rows.push({ label: w.work_name, startMin: s, endMin: Math.max(e, s + 20), note: '', text: '' });
    cursor += Math.floor(unit * 0.8);
  });

  const outageStart = parseDateOrTimeToMinute_(project.planned_outage_start, start + 60);
  const outageEnd = parseDateOrTimeToMinute_(project.planned_outage_end, outageStart + Math.max(30, Math.floor(unit * 1.2)));
  rows.unshift({
    label: '停電',
    startMin: outageStart,
    endMin: outageEnd,
    note: `${toHHMM_(outageStart)}-${toHHMM_(outageEnd)}`,
    text: '全館停電',
    outage: true
  });

  rows.push({ label: '復電確認', startMin: Math.max(safeEnd - 55, start + 30), endMin: Math.max(safeEnd - 25, start + 45), note: '', text: '' });
  rows.push({ label: '後片付け', startMin: Math.max(safeEnd - 25, start + 50), endMin: safeEnd, note: '予定', text: '' });

  return rows.map(function(r) {
    r.startMin = clamp_(r.startMin, 7 * 60, 19 * 60);
    r.endMin = clamp_(r.endMin, r.startMin + 10, 19 * 60);
    return r;
  });
}

function calcBarRange_(startMin, endMin) {
  const min = 7 * 60;
  const max = 19 * 60;
  const s = clamp_(startMin, min, max);
  const e = clamp_(endMin, s + 1, max);
  const total = max - min;
  return { left: ((s - min) / total) * 100, width: ((e - s) / total) * 100 };
}

function parseDateOrTimeToMinute_(v, fallback) {
  if (!v) return fallback;
  if (Object.prototype.toString.call(v) === '[object Date]') {
    if (Number.isNaN(v.getTime())) return fallback;
    const tz = getEffectiveTimeZone_();
    const hh = Number(Utilities.formatDate(v, tz, 'HH'));
    const mm = Number(Utilities.formatDate(v, tz, 'mm'));
    if (!isValidHmParts_(hh, mm)) return fallback;
    return hh * 60 + mm;
  }
  return parseTimeToMinute_(String(v), fallback);
}

function parseTimeToMinute_(v, fallback) {
  if (v === null || v === undefined || v === '') return fallback;
  if (Object.prototype.toString.call(v) === '[object Date]') {
    if (Number.isNaN(v.getTime())) return fallback;
    const tz = getEffectiveTimeZone_();
    const hh = Number(Utilities.formatDate(v, tz, 'HH'));
    const mm = Number(Utilities.formatDate(v, tz, 'mm'));
    if (!isValidHmParts_(hh, mm)) return fallback;
    return hh * 60 + mm;
  }
  const parsed = parseDateTimeStringParts_(v);
  if (!parsed || !parsed.hasTime) return fallback;
  if (!isValidHmParts_(parsed.hour, parsed.minute)) return fallback;
  return parsed.hour * 60 + parsed.minute;
}

function toHHMM_(minute) {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function clamp_(x, min, max) {
  return Math.min(max, Math.max(min, x));
}

function validatePayload_(payload) {
  if (!payload || !payload.projectId) throw new Error('projectId is required');
}

function toBool_(v) {
  return v === true || v === 'TRUE' || v === 1 || v === '1';
}

function h_(value) {
  const s = String(value == null ? '' : value);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatOutage_(start, end) {
  const s = start ? toDateTimeStr_(start) : '';
  const e = end ? toDateTimeStr_(end) : '';
  if (!s && !e) return '未設定';
  return `${s} - ${e}`;
}

function toDateStr_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    if (Number.isNaN(value.getTime())) return '';
    return Utilities.formatDate(value, getEffectiveTimeZone_(), 'yyyy/MM/dd');
  }
  const parsed = parseDateTimeStringParts_(value);
  if (parsed && parsed.hasDate && isValidYmdParts_(parsed.year, parsed.month, parsed.day)) {
    return formatYmdSlash_(parsed.year, parsed.month, parsed.day);
  }
  return String(value).trim();
}

function toDateTimeStr_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    if (Number.isNaN(value.getTime())) return '';
    return Utilities.formatDate(value, getEffectiveTimeZone_(), 'yyyy/MM/dd HH:mm');
  }
  const parsed = parseDateTimeStringParts_(value);
  if (!parsed) return String(value).trim();
  if (parsed.hasDate) {
    if (!isValidYmdParts_(parsed.year, parsed.month, parsed.day)) return String(value).trim();
    const ymd = formatYmdSlash_(parsed.year, parsed.month, parsed.day);
    if (!parsed.hasTime) return ymd;
    if (!isValidHmParts_(parsed.hour, parsed.minute)) return String(value).trim();
    return `${ymd} ${formatHm_(parsed.hour, parsed.minute)}`;
  }
  if (parsed.hasTime && isValidHmParts_(parsed.hour, parsed.minute)) {
    return formatHm_(parsed.hour, parsed.minute);
  }
  return String(value).trim();
}

function formatTimeValue_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    if (Number.isNaN(value.getTime())) return '';
    return Utilities.formatDate(value, getEffectiveTimeZone_(), 'HH:mm');
  }
  const parsed = parseDateTimeStringParts_(value);
  if (parsed && parsed.hasTime && isValidHmParts_(parsed.hour, parsed.minute)) {
    return formatHm_(parsed.hour, parsed.minute);
  }
  return String(value).trim();
}

function parseDateTimeStringParts_(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s) return null;

  const dt = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::\d{2})?)?$/);
  if (dt) {
    return {
      hasDate: true,
      hasTime: dt[4] !== undefined && dt[5] !== undefined,
      year: Number(dt[1]),
      month: Number(dt[2]),
      day: Number(dt[3]),
      hour: dt[4] !== undefined ? Number(dt[4]) : null,
      minute: dt[5] !== undefined ? Number(dt[5]) : null
    };
  }

  const hm = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (hm) {
    return {
      hasDate: false,
      hasTime: true,
      year: null,
      month: null,
      day: null,
      hour: Number(hm[1]),
      minute: Number(hm[2])
    };
  }
  return null;
}

function formatYmdSlash_(year, month, day) {
  return `${String(year).padStart(4, '0')}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
}

function formatYmdDash_(year, month, day) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatHm_(hour, minute) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function isValidHmParts_(hour, minute) {
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return false;
  if (hour < 0 || hour > 23) return false;
  if (minute < 0 || minute > 59) return false;
  return true;
}

function isValidYmdParts_(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 1900 || year > 2200) return false;
  if (month < 1 || month > 12) return false;
  const maxDay = [31, isLeapYear_(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day >= 1 && day <= maxDay;
}

function isLeapYear_(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function getEffectiveTimeZone_() {
  try {
    const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
    return tz || Session.getScriptTimeZone();
  } catch (e) {
    return Session.getScriptTimeZone();
  }
}

function pickScheduleColor_(label, index) {
  const key = String(label || '');
  if (key.indexOf('準備') >= 0) return '#64748b';
  if (key.indexOf('後片付') >= 0) return '#334155';
  if (key.indexOf('復電') >= 0) return '#0369a1';
  const palette = ['#1d4ed8', '#0f766e', '#7c3aed', '#b45309', '#15803d', '#9f1239'];
  return palette[index % palette.length];
}

function getSheetByNameOrThrow_(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error(`${name} シートが見つかりません`);
  return sheet;
}

function assertRequiredSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  REQUIRED_SHEETS.forEach(function(name) {
    if (!ss.getSheetByName(name)) {
      throw new Error(`${name} シートがありません。メニュー「施工計画書 > 初期セットアップ（シート作成）」を先に実行してください。`);
    }
  });
}

function ensureSheetWithHeaders_(ss, name, headers, clearData) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (clearData) sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
}

function seedWorkMaster_(sheet) {
  if (!sheet) return;
  const rows = [
    ['KOUATSU_CABLE', '高圧ケーブルの交換', '地上キャビネット〜電気室間の高圧ケーブルを交換します。', '工事中に通行制限が発生する場合があります。', 4, 10, true],
    ['UGS', 'UGS交換', '地中線用負荷開閉器（UGS）を交換します。', '停電時間帯は全館停電となります。', 2, 20, true],
    ['PAS', 'PAS交換', 'PAS機器を交換し、安全性を向上します。', '作業時間帯に一部立入制限を行います。', 2, 30, true],
    ['GROUND_A', 'A種接地是正', 'A種接地の測定・是正工事を行います。', '設備点検時に立会いをお願いする場合があります。', 1, 40, true],
    ['GROUND_B', 'B種接地是正', 'B種接地の測定・是正工事を行います。', '作業時に騒音が発生する場合があります。', 1, 50, true],
    ['GROUND_C', 'C種接地是正', 'C種接地の測定・是正工事を行います。', '一時的に設備周辺の動線変更があります。', 1, 60, true]
  ];
  sheet.getRange(2, 1, rows.length, HEADERS_WORK_MASTER.length).setValues(rows);
}

function seedTextMaster_(sheet) {
  if (!sheet) return;
  const rows = [
    ['CAUTION_COMMON_1', '停電に伴い長期間使用した機器で不具合が発生する場合があります。', 'caution'],
    ['CAUTION_COMMON_2', '工事エリアは立入制限を行うため、誘導員の案内に従ってください。', 'caution'],
    ['CAUTION_COMMON_3', '当日の天候等により作業時間が前後する場合があります。', 'caution']
  ];
  sheet.getRange(2, 1, rows.length, HEADERS_TEXT_MASTER.length).setValues(rows);
}

function seedProjectExample_(sheet) {
  if (!sheet) return;
  const row = [
    'PJT-0001',
    'サンプルマンション',
    '東京都千代田区サンプル1-2-3',
    '電気設備更新工事',
    '2026-04-06 10:00',
    '2026-04-06 14:30',
    '2026-04-06',
    '09:00',
    '17:00',
    true,
    true,
    false,
    false,
    false,
    false,
    '特記事項をここに記入します。',
    '',
    '写真A（着工前）',
    '写真B（施工中）',
    '写真C（施工後）',
    '写真D（その他）',
    '',
    '',
    ''
  ];
  sheet.getRange(2, 1, 1, HEADERS_PROJECTS.length).setValues([row]);
}

function formatProjectsSheet_(sheet) {
  if (!sheet) return;
  const widths = [120,200,280,200,170,170,130,100,100,130,100,100,110,110,110,260,260,180,180,180,180,280,170,180];
  applyCommonHeaderStyle_(sheet, widths.length);
  setColumnWidths_(sheet, widths);
  applyCheckboxesIfDataExists_(sheet, [10, 11, 12, 13, 14, 15]);
  if (sheet.getLastRow() >= 2) {
    sheet.getRange(2, 5, sheet.getLastRow() - 1, 3).setNumberFormat('@');
    sheet.getRange(2, 23, sheet.getLastRow() - 1, 1).setNumberFormat('yyyy/mm/dd hh:mm');
    sheet.getRange(2, 16, sheet.getLastRow() - 1, 2).setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
  }
}

function normalizeProjectDateFields_(project) {
  const cloned = {};
  Object.keys(project || {}).forEach(function(key) {
    cloned[key] = project[key];
  });

  const tz = getEffectiveTimeZone_();
  cloned.work_date_main = toYmdString_(cloned.work_date_main, tz);
  cloned.planned_outage_start = toYmdHmString_(cloned.planned_outage_start, tz, cloned.work_date_main);
  cloned.planned_outage_end = toYmdHmString_(cloned.planned_outage_end, tz, cloned.work_date_main);
  return cloned;
}

function toYmdString_(value, tz) {
  if (value === null || value === undefined || value === '') return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    if (Number.isNaN(value.getTime())) return '';
    return Utilities.formatDate(value, tz, 'yyyy-MM-dd');
  }
  const parsed = parseDateTimeStringParts_(value);
  if (parsed && parsed.hasDate && isValidYmdParts_(parsed.year, parsed.month, parsed.day)) {
    return formatYmdDash_(parsed.year, parsed.month, parsed.day);
  }
  return String(value).trim();
}

function toYmdHmString_(value, tz, fallbackDate) {
  if (value === null || value === undefined || value === '') return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    if (Number.isNaN(value.getTime())) return '';
    return Utilities.formatDate(value, tz, 'yyyy-MM-dd HH:mm');
  }

  const s = String(value).trim();
  const parsed = parseDateTimeStringParts_(s);
  if (!parsed) return s;

  if (parsed.hasDate) {
    if (!isValidYmdParts_(parsed.year, parsed.month, parsed.day)) return s;
    const ymd = formatYmdDash_(parsed.year, parsed.month, parsed.day);
    if (!parsed.hasTime) return ymd;
    if (!isValidHmParts_(parsed.hour, parsed.minute)) return s;
    return `${ymd} ${formatHm_(parsed.hour, parsed.minute)}`;
  }

  if (parsed.hasTime && isValidHmParts_(parsed.hour, parsed.minute)) {
    const hm = formatHm_(parsed.hour, parsed.minute);
    return fallbackDate ? `${fallbackDate} ${hm}` : hm;
  }
  return s;
}

function formatWorkMasterSheet_(sheet) {
  if (!sheet) return;
  const widths = [160, 180, 360, 360, 150, 90, 90];
  applyCommonHeaderStyle_(sheet, widths.length);
  setColumnWidths_(sheet, widths);
  applyCheckboxesIfDataExists_(sheet, [7]);
}

function formatTextMasterSheet_(sheet) {
  if (!sheet) return;
  const widths = [220, 640, 120];
  applyCommonHeaderStyle_(sheet, widths.length);
  setColumnWidths_(sheet, widths);
  if (sheet.getLastRow() >= 2) {
    sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
  }
}

function formatOutputLogSheet_(sheet) {
  if (!sheet) return;
  const widths = [180, 140, 110, 380, 170, 220];
  applyCommonHeaderStyle_(sheet, widths.length);
  setColumnWidths_(sheet, widths);
  if (sheet.getLastRow() >= 2) {
    sheet.getRange(2, 5, sheet.getLastRow() - 1, 1).setNumberFormat('yyyy/mm/dd hh:mm');
  }
}

function applyCommonHeaderStyle_(sheet, colCount) {
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 32);
  sheet.getRange(1, 1, 1, colCount)
    .setFontWeight('bold')
    .setBackground('#E8F0FE')
    .setHorizontalAlignment('left')
    .setVerticalAlignment('middle')
    .setWrap(false);
}

function setColumnWidths_(sheet, widths) {
  widths.forEach(function(width, i) { sheet.setColumnWidth(i + 1, width); });
}

function applyCheckboxesIfDataExists_(sheet, columns) {
  if (sheet.getLastRow() < 2) return;
  columns.forEach(function(col) { sheet.getRange(2, col, sheet.getLastRow() - 1, 1).insertCheckboxes(); });
}

function getHeaderMap_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {};
  headers.forEach(function(h, i) { map[String(h)] = i + 1; });
  return map;
}

function findRowByProjectId_(sheet, projectId, projectIdCol) {
  if (!projectIdCol) throw new Error('project_id 列がありません');
  const values = sheet.getRange(2, projectIdCol, Math.max(sheet.getLastRow() - 1, 1), 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(projectId)) return i + 2;
  }
  return 0;
}

function writeCellIfExists_(sheet, row, col, value) {
  if (!col) return;
  sheet.getRange(row, col).setValue(value);
}
