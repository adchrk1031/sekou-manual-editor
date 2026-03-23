import { OcrExtract } from "@/types/domain";
import { runGoogleVisionOCR } from "@/lib/ocr/google-vision";
import { runLocalTesseractOCR } from "@/lib/ocr/local-tesseract";

export type OcrEngineMode = "auto" | "google-vision" | "local-tesseract";

export interface OcrRuntimeStatus {
  available: boolean;
  engine: "google-vision" | "local-tesseract";
  message?: string;
}

export function getConfiguredOcrMode(): OcrEngineMode {
  const raw = (process.env.OCR_ENGINE ?? "auto").trim().toLowerCase();
  if (raw === "google-vision" || raw === "local-tesseract" || raw === "auto") {
    return raw;
  }
  return "auto";
}

export function resolveOcrEngine(): "google-vision" | "local-tesseract" {
  const mode = getConfiguredOcrMode();
  if (mode === "google-vision") {
    return "google-vision";
  }
  if (mode === "local-tesseract") {
    return "local-tesseract";
  }
  return process.env.GOOGLE_CLOUD_VISION_API_KEY ? "google-vision" : "local-tesseract";
}

export function getOcrRuntimeStatus(): OcrRuntimeStatus {
  const engine = resolveOcrEngine();
  if (engine === "google-vision" && !process.env.GOOGLE_CLOUD_VISION_API_KEY) {
    return {
      available: false,
      engine,
      message:
        "OCR_ENGINE=google-vision ですが GOOGLE_CLOUD_VISION_API_KEY が未設定です。OCR_ENGINE=local-tesseract へ切替えるか Vision APIキーを設定してください。"
    };
  }
  return { available: true, engine };
}

export async function runOcr(imageBuffer: Buffer): Promise<OcrExtract> {
  const engine = resolveOcrEngine();
  if (engine === "google-vision") {
    return runGoogleVisionOCR(imageBuffer);
  }
  return runLocalTesseractOCR(imageBuffer);
}
