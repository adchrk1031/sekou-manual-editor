import { PhotoType } from "@/types/domain";
import { normalizeRoom } from "@/lib/normalize/room";

export interface ParsedFilename {
  roomNormalized: string | null;
  candidates: string[];
  confidence: number;
  photoType: PhotoType;
  reason?: string;
}

const REMOVAL_HINT = /(old|remove|before|pre|torihazushi|取り外し|取外し|撤去|旧)/i;
const INSTALL_HINT = /(new|install|after|post|toritsuke|取付|取り付け|新)/i;

function detectPhotoType(baseName: string): PhotoType {
  const isRemoval = REMOVAL_HINT.test(baseName);
  const isInstall = INSTALL_HINT.test(baseName);

  if (isRemoval && !isInstall) {
    return "REMOVAL";
  }
  if (!isRemoval && isInstall) {
    return "INSTALL";
  }
  return "UNKNOWN";
}

export function parseFilename(fileName: string): ParsedFilename {
  const baseName = fileName.replace(/\.[^.]+$/, "");
  const photoType = detectPhotoType(baseName);

  const tokens = baseName
    .replace(/[()\[\]{}]/g, " ")
    .split(/[\s._-]+/)
    .filter(Boolean);

  const candidates = new Set<string>();

  for (const token of tokens) {
    const room = normalizeRoom(token);
    if (room) {
      candidates.add(room);
    }
    const roomFromFragment = normalizeRoom(token.replace(/[A-Za-z]/g, ""));
    if (roomFromFragment) {
      candidates.add(roomFromFragment);
    }
  }

  const wholeNameRoom = normalizeRoom(baseName);
  if (wholeNameRoom) {
    candidates.add(wholeNameRoom);
  }

  const candidateList = Array.from(candidates);

  if (candidateList.length === 1) {
    return {
      roomNormalized: candidateList[0],
      candidates: candidateList,
      confidence: 1,
      photoType,
      reason: photoType === "UNKNOWN" ? "写真タイプを推定できません" : undefined
    };
  }

  if (candidateList.length > 1) {
    return {
      roomNormalized: null,
      candidates: candidateList,
      confidence: 0,
      photoType,
      reason: "部屋番号候補が複数あります"
    };
  }

  return {
    roomNormalized: null,
    candidates: [],
    confidence: 0,
    photoType,
    reason: "ファイル名から部屋番号を抽出できません"
  };
}
