export type CsvRecord = Record<string, string>;

type WorkCode = "KOUATSU_CABLE" | "UGS" | "PAS" | "GROUND_A" | "GROUND_B" | "GROUND_C";

export function sanitizeCsvHeader(header: string): string {
  return String(header ?? "").replace(/^\uFEFF/, "").trim();
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
  return records.map((record) => {
    const normalized: CsvRecord = {};
    headers.forEach((header) => {
      normalized[header] = String(record[header] ?? "");
    });
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
