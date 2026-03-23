import { buildOcrExtract } from "@/lib/ocr/extract";
import { OcrExtract } from "@/types/domain";
import path from "node:path";
import { imageSize } from "image-size";

type WorkerResult = { data?: { text?: string; confidence?: number } };
type TesseractWorker = {
  setParameters: (params: Record<string, string>) => Promise<unknown>;
  recognize: (
    image: Buffer,
    options?: { rectangle?: { left: number; top: number; width: number; height: number } }
  ) => Promise<WorkerResult>;
};

let generalWorkerPromise: Promise<TesseractWorker> | null = null;
let numericWorkerPromise: Promise<TesseractWorker> | null = null;

async function createWorker(kind: "general" | "numeric"): Promise<TesseractWorker> {
  const { createWorker, PSM } = await import("tesseract.js");
  const workerPath = path.join(process.cwd(), "node_modules", "tesseract.js", "src", "worker-script", "node", "index.js");
  const corePath = path.join(process.cwd(), "node_modules", "tesseract.js-core", "tesseract-core.wasm.js");
  const worker = (await createWorker("eng", undefined, {
    workerPath,
    corePath,
    logger: () => undefined
  })) as unknown as TesseractWorker;

  if (kind === "numeric") {
    await worker.setParameters({
      tessedit_pageseg_mode: String(PSM.SINGLE_LINE),
      preserve_interword_spaces: "1",
      user_defined_dpi: "300",
      tessedit_char_whitelist: "0123456789."
    });
  } else {
    await worker.setParameters({
      tessedit_pageseg_mode: String(PSM.SINGLE_BLOCK),
      preserve_interword_spaces: "1",
      user_defined_dpi: "300",
      tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.-:() /"
    });
  }

  return worker;
}

async function getGeneralWorker(): Promise<TesseractWorker> {
  if (!generalWorkerPromise) {
    generalWorkerPromise = createWorker("general");
  }
  return generalWorkerPromise;
}

async function getNumericWorker(): Promise<TesseractWorker> {
  if (!numericWorkerPromise) {
    numericWorkerPromise = createWorker("numeric");
  }
  return numericWorkerPromise;
}

function toBaseConfidence(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0.65;
  }
  const score = value / 100;
  return Math.max(0, Math.min(1, score));
}

function toRect(
  width: number,
  height: number,
  leftRate: number,
  topRate: number,
  widthRate: number,
  heightRate: number
): { left: number; top: number; width: number; height: number } {
  const left = Math.max(0, Math.floor(width * leftRate));
  const top = Math.max(0, Math.floor(height * topRate));
  const rectWidth = Math.max(20, Math.floor(width * widthRate));
  const rectHeight = Math.max(20, Math.floor(height * heightRate));

  return {
    left,
    top,
    width: Math.min(rectWidth, Math.max(20, width - left)),
    height: Math.min(rectHeight, Math.max(20, height - top))
  };
}

export async function runLocalTesseractOCR(imageBuffer: Buffer): Promise<OcrExtract> {
  try {
    const generalWorker = await getGeneralWorker();
    const numericWorker = await getNumericWorker();

    const full = await generalWorker.recognize(imageBuffer);
    const textParts = [full.data?.text ?? ""];
    const confidenceCandidates = [toBaseConfidence(full.data?.confidence)];

    const size = imageSize(imageBuffer);
    if (size.width && size.height) {
      const displayRect = toRect(size.width, size.height, 0.34, 0.05, 0.42, 0.2);
      const noRect = toRect(size.width, size.height, 0.3, 0.16, 0.5, 0.18);
      const roomStickerRect = toRect(size.width, size.height, 0.25, 0.46, 0.55, 0.28);

      const display = await numericWorker.recognize(imageBuffer, { rectangle: displayRect });
      const displayText = (display.data?.text ?? "").trim();
      if (displayText) {
        textParts.push(`kWh\n${displayText}`);
      }
      confidenceCandidates.push(toBaseConfidence(display.data?.confidence));

      const noLine = await generalWorker.recognize(imageBuffer, { rectangle: noRect });
      const noLineText = (noLine.data?.text ?? "").trim();
      if (noLineText) {
        textParts.push(`No. ${noLineText}`);
      }
      confidenceCandidates.push(toBaseConfidence(noLine.data?.confidence));

      const roomSticker = await generalWorker.recognize(imageBuffer, { rectangle: roomStickerRect });
      const roomStickerText = (roomSticker.data?.text ?? "").trim();
      if (roomStickerText) {
        textParts.push(roomStickerText);
      }
      confidenceCandidates.push(toBaseConfidence(roomSticker.data?.confidence));
    }

    const mergedText = textParts.filter(Boolean).join("\n");
    const confidence = Math.max(...confidenceCandidates, 0.4);

    return buildOcrExtract(mergedText, confidence, undefined, "local-tesseract");
  } catch (error) {
    return buildOcrExtract(
      "",
      0,
      error instanceof Error ? `ローカルOCRエラー: ${error.message}` : "ローカルOCR実行に失敗しました",
      "local-tesseract"
    );
  }
}
