const DAY_TOTAL_MINUTES = 24 * 60;
const JP_WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function toMinutes(value: string): number {
  const [h = "0", m = "0"] = value.split(":");
  return Number(h) * 60 + Number(m);
}

export function toHHMM(minutes: number): string {
  const clamped = clamp(minutes, 0, DAY_TOTAL_MINUTES - 1);
  const h = String(Math.floor(clamped / 60)).padStart(2, "0");
  const m = String(clamped % 60).padStart(2, "0");
  return `${h}:${m}`;
}

export function tickLabel(minutes: number): string {
  if (minutes >= DAY_TOTAL_MINUTES) {
    return "24:00";
  }
  return toHHMM(minutes);
}

export function isLeapYear(year: number): boolean {
  return year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
}

export function isValidDateParts(year: number, month: number, day: number): boolean {
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

export function normalizeDate(value: string): string {
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

export function normalizeTime(value: string, fallback: string): string {
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

export function toBoolean(value: string): boolean {
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

export function startOfDay(date: string): Date {
  const normalized = normalizeDate(date);
  if (!normalized) {
    return new Date(Number.NaN);
  }
  const [year, month, day] = normalized.split("-").map((part) => Number(part));
  return new Date(Date.UTC(year, month - 1, day));
}

export function diffDays(start: string, end: string): number {
  const s = startOfDay(start).getTime();
  const e = startOfDay(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) {
    return 0;
  }
  return Math.round((e - s) / (24 * 60 * 60 * 1000));
}

export function addDays(date: string, days: number): string {
  const d = startOfDay(date);
  d.setUTCDate(d.getUTCDate() + days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function toTimelineOffset(date: string, time: string, baseDate: string): number {
  const dayOffset = diffDays(baseDate, date) * DAY_TOTAL_MINUTES;
  return dayOffset + toMinutes(time);
}

export function fromTimelineOffset(offset: number, baseDate: string): { date: string; time: string } {
  const safe = Math.max(0, offset);
  const day = Math.floor(safe / DAY_TOTAL_MINUTES);
  const minute = safe % DAY_TOTAL_MINUTES;
  return {
    date: addDays(baseDate, day),
    time: toHHMM(minute),
  };
}

export function formatShortDate(value: string): string {
  const d = startOfDay(value);
  if (Number.isNaN(d.getTime())) {
    return value;
  }
  return `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function formatDateWithWeekday(value: string): string {
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

export function formatDateRange(start: string, end: string): string {
  if (!start && !end) {
    return "-";
  }
  if (!end || start === end) {
    return formatDateWithWeekday(start || end);
  }
  return `${formatDateWithWeekday(start)}〜${formatDateWithWeekday(end)}`;
}

export function formatDateTimeRange(startDate: string, startTime: string, endDate: string, endTime: string): string {
  const start = `${formatDateWithWeekday(startDate)} ${startTime}`;
  const end = `${formatDateWithWeekday(endDate)} ${endTime}`;
  if (startDate === endDate) {
    return `${formatDateWithWeekday(startDate)} ${startTime}〜${endTime}`;
  }
  return `${start}〜${end}`;
}

export function normalizeDateTimeValue(value: string, fallbackDate: string, fallbackTime: string): { date: string; time: string } {
  const [dateRaw, timeRaw] = value.split("T");
  const date = normalizeDate(dateRaw ?? "") || fallbackDate;
  const time = normalizeTime(timeRaw ?? "", fallbackTime);
  return { date, time };
}

export function chooseTimelineSteps(viewSpan: number): { lineStep: number; labelStep: number } {
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

function floorToStep(value: number, step: number): number {
  return Math.floor(value / step) * step;
}

export function buildTimelineTicks(viewStart: number, viewEnd: number): { lineTicks: number[]; labelTicks: number[] } {
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

export { DAY_TOTAL_MINUTES };
