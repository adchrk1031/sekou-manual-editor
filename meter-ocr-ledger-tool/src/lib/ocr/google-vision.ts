import { buildOcrExtract } from "@/lib/ocr/extract";
import { OcrExtract } from "@/types/domain";

interface VisionApiResponse {
  responses?: Array<{
    error?: { message?: string };
    fullTextAnnotation?: {
      text?: string;
      pages?: Array<{
        blocks?: Array<{ confidence?: number }>;
      }>;
    };
    textAnnotations?: Array<{ description?: string }>;
  }>;
}

function calcConfidence(response: NonNullable<VisionApiResponse["responses"]>[number]): number {
  const pages = response.fullTextAnnotation?.pages ?? [];
  const blocks = pages.flatMap((page) => page.blocks ?? []);
  const scores = blocks.map((block) => block.confidence).filter((value): value is number => typeof value === "number");
  if (!scores.length) {
    return 0.6;
  }
  const avg = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  return Math.max(0, Math.min(1, avg));
}

export async function runGoogleVisionOCR(imageBuffer: Buffer): Promise<OcrExtract> {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  if (!apiKey) {
    return buildOcrExtract("", 0, "GOOGLE_CLOUD_VISION_API_KEY が未設定です");
  }

  const endpoint = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
  const body = {
    requests: [
      {
        image: {
          content: imageBuffer.toString("base64")
        },
        features: [{ type: "DOCUMENT_TEXT_DETECTION" }]
      }
    ]
  };

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errorText = await res.text();
      return buildOcrExtract("", 0, `Vision APIエラー: ${res.status} ${errorText}`);
    }

    const json = (await res.json()) as VisionApiResponse;
    const first = json.responses?.[0];
    if (!first) {
      return buildOcrExtract("", 0, "Vision APIレスポンスが空です");
    }

    if (first.error?.message) {
      return buildOcrExtract("", 0, `Vision APIエラー: ${first.error.message}`);
    }

    const fullText = first.fullTextAnnotation?.text ?? first.textAnnotations?.[0]?.description ?? "";
    const confidence = calcConfidence(first);
    return buildOcrExtract(fullText, confidence);
  } catch (error) {
    return buildOcrExtract("", 0, error instanceof Error ? error.message : "OCR実行に失敗しました");
  }
}
