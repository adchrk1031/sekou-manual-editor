import { OCRCandidate, OcrExtract } from "@/types/domain";
import { normalizeMeterNo, normalizeRoom, toNumericReading } from "@/lib/normalize/room";

function toLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function uniqueByNormalized(items: OCRCandidate[]): OCRCandidate[] {
  const map = new Map<string, OCRCandidate>();
  for (const item of items) {
    const prev = map.get(item.normalized);
    if (!prev || prev.confidence < item.confidence) {
      map.set(item.normalized, item);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.confidence - a.confidence);
}

function bounded(confidence: number): number {
  return Math.max(0, Math.min(1, confidence));
}

function normalizeOcrDigits(raw: string): string {
  return raw
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[．。]/g, ".")
    .replace(/[,，]/g, "")
    .replace(/[OoＯ]/g, "0")
    .replace(/[Il|ｌＩ]/g, "1")
    .replace(/[SsＳ]/g, "5")
    .replace(/[BbＢ]/g, "8")
    .replace(/[ZzＺ]/g, "2");
}

function extractRoomCandidates(text: string, baseConfidence: number): OCRCandidate[] {
  const lines = toLines(text);
  const results: OCRCandidate[] = [];

  for (const line of lines) {
    const mseMatch = line.match(/MSE[-_\s]*\d[-_\s]*\d{2,5}[-_\s]*(\d{3,4})/i);
    if (mseMatch?.[1]) {
      const normalized = normalizeRoom(mseMatch[1]);
      if (normalized) {
        results.push({
          value: mseMatch[1],
          normalized,
          confidence: bounded(baseConfidence * 0.99)
        });
      }
    }

    const roomTag = line.match(/(?:部屋|号室|ROOM|R)\s*[:：-]?\s*0*([1-9]\d{2,4})/i);
    if (roomTag?.[1]) {
      const normalized = normalizeRoom(roomTag[1]);
      if (normalized) {
        results.push({
          value: roomTag[1],
          normalized,
          confidence: bounded(baseConfidence * 0.95)
        });
      }
    }

    const onlyDigits = line.match(/^\D*([1-9]\d{2,3})\D*$/);
    if (onlyDigits?.[1]) {
      const normalized = normalizeRoom(onlyDigits[1]);
      if (normalized) {
        results.push({
          value: onlyDigits[1],
          normalized,
          confidence: bounded(baseConfidence * 0.72)
        });
      }
    }
  }

  const whole = normalizeRoom(text);
  if (whole) {
    results.push({
      value: whole,
      normalized: whole,
      confidence: bounded(baseConfidence * 0.6)
    });
  }

  return uniqueByNormalized(results);
}

function extractMeterCandidates(text: string, baseConfidence: number): OCRCandidate[] {
  const lines = toLines(text);
  const results: OCRCandidate[] = [];

  for (const line of lines) {
    if (/\bNo\b|No\.|Ｎｏ/i.test(line)) {
      const noLineMatch = line.match(/(?:No\.?|Ｎｏ\.?)[\s:：-]*([A-Z0-9\s-]{5,24})/i);
      if (noLineMatch?.[1]) {
        const normalized = normalizeMeterNo(noLineMatch[1]);
        if (normalized.length >= 6 && normalized.length <= 16 && (normalized.match(/\d/g) ?? []).length >= 4) {
          results.push({
            value: noLineMatch[1].trim(),
            normalized,
            confidence: bounded(baseConfidence * 0.99)
          });
        }
      }
    }

    const meterShape = line.toUpperCase().match(/\b[A-Z]\d{1,3}\s*[A-Z0-9]{2,5}\s*\d{2,4}\b/g) ?? [];
    for (const candidate of meterShape) {
      const normalized = normalizeMeterNo(candidate);
      if (normalized.length >= 6 && normalized.length <= 16 && (normalized.match(/\d/g) ?? []).length >= 4) {
        results.push({
          value: candidate,
          normalized,
          confidence: bounded(baseConfidence * 0.95)
        });
      }
    }
  }

  const generic = text.toUpperCase().match(/\b[A-Z0-9-]{5,18}\b/g) ?? [];
  for (const token of generic) {
    const normalized = normalizeMeterNo(token);
    if (normalized.length < 6 || normalized.length > 18) {
      continue;
    }
    if (!/\d/.test(normalized)) {
      continue;
    }
    if ((normalized.match(/\d/g) ?? []).length < 4) {
      continue;
    }
    if (/^(100V|60A|50HZ|2503|2017|4006)$/.test(normalized)) {
      continue;
    }
    if (/^(MSE|MS)\d{5,}$/.test(normalized)) {
      continue;
    }
    results.push({
      value: token,
      normalized,
      confidence: bounded(baseConfidence * 0.72)
    });
  }

  return uniqueByNormalized(results);
}

function extractReadingCandidates(text: string, baseConfidence: number): OCRCandidate[] {
  const lines = toLines(text);
  const results: OCRCandidate[] = [];
  const readingPattern = /[0-9０-９OoＯIl|ｌＩSsＳBbＢZzＺ]{1,8}(?:[.,．。][0-9０-９OoＯIl|ｌＩSsＳBbＢZzＺ]{1,3})?/g;

  function scanLine(line: string, lineWeight: number, allowShortInteger: boolean): void {
    if (/MSE|部屋|号室|レジル|株式会社/i.test(line)) {
      return;
    }

    for (const match of line.matchAll(readingPattern)) {
      const raw = match[0];
      const normalizedRaw = normalizeOcrDigits(raw);
      const idx = match.index ?? 0;
      const around = line.slice(Math.max(0, idx - 4), Math.min(line.length, idx + raw.length + 4));

      if (/V|A|HZ|年|号|型|pulse/i.test(around.replace(raw, ""))) {
        continue;
      }

      const numeric = toNumericReading(normalizedRaw);
      if (numeric === null) {
        continue;
      }

      if (!normalizedRaw.includes(".") && numeric < 100) {
        continue;
      }
      if (!normalizedRaw.includes(".") && allowShortInteger && numeric < 1000) {
        continue;
      }
      if (!normalizedRaw.includes(".") && !allowShortInteger && numeric < 10000) {
        continue;
      }
      if (numeric > 9999999) {
        continue;
      }

      results.push({
        value: normalizedRaw,
        normalized: String(numeric),
        confidence: bounded(baseConfidence * lineWeight)
      });
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isNearDisplay = /kwh|検針|契約情報|普通電力量計|積算|有効電力量/i.test(line);
    const isMeterNoLine = /(?:No\.?|Ｎｏ\.?)/i.test(line);

    if (isMeterNoLine) {
      // "No. A17 G002 998" のようなメーター番号行は検針値候補から除外
      continue;
    }

    if (isNearDisplay) {
      scanLine(line, 1.0, true);
      if (lines[i - 1]) scanLine(lines[i - 1], 0.98, true);
      if (lines[i + 1]) scanLine(lines[i + 1], 0.98, true);
    } else {
      scanLine(line, 0.68, false);
    }
  }

  return uniqueByNormalized(results);
}

export function buildOcrExtract(
  fullText: string,
  baseConfidence: number,
  error?: string,
  engine: OcrExtract["engine"] = "google-vision"
): OcrExtract {
  const roomCandidates = extractRoomCandidates(fullText, baseConfidence);
  const meterCandidates = extractMeterCandidates(fullText, baseConfidence);
  const readingCandidates = extractReadingCandidates(fullText, baseConfidence);

  const bestRoom = roomCandidates[0] ?? null;
  const bestMeter = meterCandidates[0] ?? null;
  const bestReading = readingCandidates[0] ?? null;

  return {
    engine,
    fullText,
    roomNo: bestRoom?.normalized ?? null,
    roomConfidence: bestRoom?.confidence ?? 0,
    roomCandidates,
    meterNo: bestMeter?.normalized ?? null,
    meterNoConfidence: bestMeter?.confidence ?? 0,
    meterCandidates,
    reading: bestReading ? Number(bestReading.normalized) : null,
    readingRaw: bestReading?.value ?? null,
    readingConfidence: bestReading?.confidence ?? 0,
    readingCandidates,
    error
  };
}
