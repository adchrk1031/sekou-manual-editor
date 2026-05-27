import { CSV_INTERNAL_ROW_ID_KEY } from "../constants";

export type CsvRecord = Record<string, string>;

type WorkCode = "KOUATSU_CABLE" | "UGS" | "PAS" | "GROUND_A" | "GROUND_B" | "GROUND_C";

export type CsvDecodeResult = {
  text: string;
  encoding: string;
  label: string;
  replacementCount: number;
  mojibakeScore: number;
};

export type CsvRepairStats = {
  repairedCount: number;
  unrecoverableCount: number;
};

const CSV_DECODE_CANDIDATES: Array<{ encoding: string; label: string }> = [
  { encoding: "utf-8", label: "UTF-8" },
  { encoding: "shift_jis", label: "Shift_JIS / CP932" },
  { encoding: "euc-jp", label: "EUC-JP" },
];

export function sanitizeCsvHeader(header: string): string {
  return String(header ?? "").replace(/^\uFEFF/, "").trim();
}

function countMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

function scoreDecodedCsvText(text: string): { replacementCount: number; mojibakeScore: number } {
  const replacementCount = countMatches(text, /\uFFFD/g);
  const mojibakeMarkerCount = countMatches(text, /[ÃÂ�]|縺|譁|荳|蜊|繧|邱|豈|髮/g);
  const japaneseCharCount = countMatches(text, /[\u3040-\u30ff\u3400-\u9fff]/g);
  const mojibakeScore = replacementCount * 100 + mojibakeMarkerCount * 20 - Math.min(japaneseCharCount, 80);
  return { replacementCount, mojibakeScore };
}

function decodeCsvCandidate(buffer: ArrayBufferLike, encoding: string): string | null {
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(buffer);
  } catch {
    try {
      return new TextDecoder(encoding).decode(buffer);
    } catch {
      return null;
    }
  }
}

function textToSingleByteBuffer(text: string): Uint8Array | null {
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code > 0xff) {
      return null;
    }
    bytes[index] = code;
  }
  return bytes;
}

export function containsLikelyMojibake(text: string): boolean {
  if (!text) {
    return false;
  }
  return /[\uFFFDÃÂ]|縺|譁|荳|蜊|繧|邱|豈|髮|�/.test(text);
}

export function repairPossiblyMojibakeText(text: string): { value: string; repaired: boolean; unrecoverable: boolean } {
  const source = String(text ?? "");
  if (!source) {
    return { value: source, repaired: false, unrecoverable: false };
  }

  const originalScore = scoreDecodedCsvText(source);
  const sourceBytes = textToSingleByteBuffer(source);
  let bestValue = source;
  let bestScore = originalScore.mojibakeScore;
  let repaired = false;

  if (sourceBytes) {
    CSV_DECODE_CANDIDATES.forEach((candidate) => {
      const decoded = decodeCsvCandidate(sourceBytes.buffer.slice(0), candidate.encoding);
      if (!decoded) {
        return;
      }
      const score = scoreDecodedCsvText(decoded).mojibakeScore;
      if (score + 20 < bestScore) {
        bestValue = decoded;
        bestScore = score;
        repaired = true;
      }
    });
  }

  return {
    value: bestValue,
    repaired,
    unrecoverable: !repaired && containsLikelyMojibake(source),
  };
}

function dedupeCsvHeaders(headers: string[]): string[] {
  const counts = new Map<string, number>();
  return headers.map((header, index) => {
    const base = sanitizeCsvHeader(header) || `column_${index + 1}`;
    const seen = counts.get(base) ?? 0;
    counts.set(base, seen + 1);
    return seen === 0 ? base : `${base}_${seen + 1}`;
  });
}

export function repairCsvSnapshot(headers: string[], records: CsvRecord[]): {
  headers: string[];
  records: CsvRecord[];
  stats: CsvRepairStats;
} {
  const repairedHeaderResults = headers.map((header) => repairPossiblyMojibakeText(sanitizeCsvHeader(header)));
  const repairedHeaders = dedupeCsvHeaders(repairedHeaderResults.map((result) => result.value));

  let repairedCount = repairedHeaderResults.filter((result) => result.repaired).length;
  let unrecoverableCount = repairedHeaderResults.filter((result) => result.unrecoverable).length;

  const repairedRecords = records.map((record) => {
    const nextRecord: CsvRecord = {};
    headers.forEach((header, index) => {
      const rawValue = String(record[header] ?? "");
      const repairedValue = repairPossiblyMojibakeText(rawValue);
      if (repairedValue.repaired) {
        repairedCount += 1;
      } else if (repairedValue.unrecoverable) {
        unrecoverableCount += 1;
      }
      nextRecord[repairedHeaders[index]] = repairedValue.value;
    });
    const currentRowId = String(record[CSV_INTERNAL_ROW_ID_KEY] ?? "").trim();
    if (currentRowId) {
      nextRecord[CSV_INTERNAL_ROW_ID_KEY] = currentRowId;
    }
    return nextRecord;
  });

  return {
    headers: repairedHeaders,
    records: repairedRecords,
    stats: {
      repairedCount,
      unrecoverableCount,
    },
  };
}

export function decodeCsvArrayBuffer(buffer: ArrayBufferLike): CsvDecodeResult {
  const decoded = CSV_DECODE_CANDIDATES
    .map((candidate) => {
      const text = decodeCsvCandidate(buffer, candidate.encoding);
      if (text === null) {
        return null;
      }
      const score = scoreDecodedCsvText(text);
      return {
        text,
        encoding: candidate.encoding,
        label: candidate.label,
        ...score,
      };
    })
    .filter((item): item is CsvDecodeResult => item !== null)
    .sort((a, b) => a.mojibakeScore - b.mojibakeScore);

  if (decoded[0]) {
    return decoded[0];
  }

  const text = new TextDecoder().decode(buffer);
  return {
    text,
    encoding: "utf-8",
    label: "UTF-8",
    ...scoreDecodedCsvText(text),
  };
}

export async function decodeCsvFile(file: File): Promise<CsvDecodeResult> {
  return decodeCsvArrayBuffer(await file.arrayBuffer());
}

export function createCsvRowId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `csv_${crypto.randomUUID()}`;
  }
  return `csv_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function getCsvRowId(record: CsvRecord): string {
  const current = String(record[CSV_INTERNAL_ROW_ID_KEY] ?? "").trim();
  return current || createCsvRowId();
}

export function normalizeCsvLookupKey(value: string): string {
  return sanitizeCsvHeader(value)
    .toLowerCase()
    .replace(/[ \t　_\-\/]/g, "");
}

export function createCsvValueGetter(record: CsvRecord): (...keys: string[]) => string {
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

export function parseCsv(text: string): CsvRecord[] {
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

export function inferCsvHeaders(records: CsvRecord[]): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();
  records.forEach((record) => {
    Object.keys(record).forEach((key) => {
      if (key === CSV_INTERNAL_ROW_ID_KEY) {
        return;
      }
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

export function normalizeCsvRows(records: CsvRecord[], headers: string[]): CsvRecord[] {
  const usedRowIds = new Set<string>();
  return records.map((record) => {
    const normalized: CsvRecord = {};
    headers.forEach((header) => {
      normalized[header] = String(record[header] ?? "");
    });
    let rowId = getCsvRowId(record);
    while (usedRowIds.has(rowId)) {
      rowId = createCsvRowId();
    }
    usedRowIds.add(rowId);
    normalized[CSV_INTERNAL_ROW_ID_KEY] = rowId;
    return normalized;
  });
}

export function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function recordsToCsv(headers: string[], rows: CsvRecord[]): string {
  if (!headers.length) {
    return "";
  }
  const lines = [headers.map((h) => escapeCsvCell(h)).join(",")];
  rows.forEach((row) => {
    lines.push(headers.map((header) => escapeCsvCell(String(row[header] ?? ""))).join(","));
  });
  return lines.join("\n");
}

export function getCsvHeaderLabel(header: string, headerLabelMap: Record<string, string>): string {
  const key = sanitizeCsvHeader(header).toLowerCase();
  return headerLabelMap[key] || sanitizeCsvHeader(header);
}

export function normalizeWorkToken(value: string): string {
  return String(value ?? "").trim().toLowerCase().replace(/[ \t　_\-\/]/g, "");
}

export function parseSelectedWorkCodes(
  getField: (...keys: string[]) => string,
  workAliases: Record<WorkCode, string[]>,
  projectFieldAliases: { workList: string[] },
  toBoolean: (value: string) => boolean,
): WorkCode[] {
  const selected = new Set<WorkCode>();
  (Object.entries(workAliases) as [WorkCode, string[]][]).forEach(([code, aliases]) => {
    if (toBoolean(getField(...aliases))) {
      selected.add(code);
    }
  });

  const rawList = getField(...projectFieldAliases.workList);
  if (rawList) {
    const tokens = rawList
      .split(/[,、\/|;:\n\r]+/)
      .map((token) => normalizeWorkToken(token))
      .filter(Boolean);
    tokens.forEach((token) => {
      (Object.entries(workAliases) as [WorkCode, string[]][]).forEach(([code, aliases]) => {
        const matched = aliases.some((alias) => normalizeWorkToken(alias) === token);
        if (matched) {
          selected.add(code);
        }
      });
    });
  }
  return Array.from(selected);
}
