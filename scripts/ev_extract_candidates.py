#!/usr/bin/env python3
import argparse
import csv
import json
import re
import shutil
import subprocess
import tempfile
import unicodedata
from dataclasses import asdict, dataclass
from pathlib import Path


UNIT_PATTERN = re.compile(r"(?<!\d)(\d+(?:[.,]\d+)?)\s*(kva|KVA|kW|KW|kw)\b")
TRANSFORMER_HINTS = ("変圧器", "トランス", "電灯", "tr", "TR", "lt")
LOAD_HINTS = ("負荷", "容量", "盤", "照明", "コンセント", "動力", "幹線")


@dataclass
class CandidateLine:
    page: int
    kind: str
    line: str
    matches: list[str]


def run(cmd: list[str]) -> str:
    completed = subprocess.run(cmd, check=True, capture_output=True, text=True)
    return completed.stdout


def normalize_text(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)
    return text.replace("\u3000", " ")


def pdf_page_count(pdf_path: Path) -> int:
    output = run(["pdfinfo", str(pdf_path)])
    for line in output.splitlines():
        if line.startswith("Pages:"):
            return int(line.split(":", 1)[1].strip())
    raise RuntimeError(f"ページ数を取得できませんでした: {pdf_path}")


def extract_native_text(pdf_path: Path) -> str:
    return run(["pdftotext", "-layout", str(pdf_path), "-"])


def ocr_page(pdf_path: Path, page: int, temp_dir: Path, languages: str) -> str:
    stem = temp_dir / f"page-{page:03d}"
    subprocess.run(
        [
            "pdftoppm",
            "-png",
            "-r",
            "300",
            "-f",
            str(page),
            "-l",
            str(page),
            str(pdf_path),
            str(stem),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    image_path = stem.with_name(f"{stem.name}-1.png")
    completed = subprocess.run(
        [
            "tesseract",
            str(image_path),
            "stdout",
            "--psm",
            "11",
            "-l",
            languages,
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return completed.stdout


def extract_text(pdf_path: Path, languages: str) -> tuple[str, str]:
    native_text = extract_native_text(pdf_path)
    if native_text.strip():
        return native_text, "native"

    pages = pdf_page_count(pdf_path)
    texts: list[str] = []
    with tempfile.TemporaryDirectory(prefix="ev-capacity-") as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        for page in range(1, pages + 1):
            texts.append(f"\n===== PAGE {page} =====\n")
            texts.append(ocr_page(pdf_path, page, temp_dir, languages))
    return "\n".join(texts), "ocr"


def classify_line(line: str) -> str:
    lowered = line.lower()
    has_transformer_hint = any(h.lower() in lowered for h in TRANSFORMER_HINTS)
    has_load_hint = any(h.lower() in lowered for h in LOAD_HINTS)
    if has_transformer_hint and not has_load_hint:
        return "transformer"
    if has_load_hint and not has_transformer_hint:
        return "load"
    if has_transformer_hint and has_load_hint:
        return "mixed"
    return "unclassified"


def collect_candidate_lines(text: str) -> list[CandidateLine]:
    candidates: list[CandidateLine] = []
    page = 1
    for raw_line in normalize_text(text).splitlines():
        line = raw_line.strip()
        if not line:
            continue
        page_match = re.fullmatch(r"=+\s*PAGE\s+(\d+)\s*=+", line)
        if page_match:
            page = int(page_match.group(1))
            continue
        matches = UNIT_PATTERN.findall(line)
        if not matches:
            continue
        rendered = [f"{value}{unit}" for value, unit in matches]
        candidates.append(
            CandidateLine(
                page=page,
                kind=classify_line(line),
                line=line,
                matches=rendered,
            )
        )
    return candidates


def main() -> None:
    parser = argparse.ArgumentParser(description="EV検討用PDFからkVA/kW候補行を抽出します。")
    parser.add_argument("input_dir", type=Path)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("artifacts/ev-capacity"),
        help="抽出結果の保存先",
    )
    parser.add_argument(
        "--languages",
        default="eng",
        help="tesseract の言語指定。例: eng / eng+jpn",
    )
    args = parser.parse_args()

    if shutil.which("pdfinfo") is None or shutil.which("pdftotext") is None or shutil.which("pdftoppm") is None:
        raise SystemExit("poppler が見つかりません。`brew install poppler` を先に実行してください。")
    if shutil.which("tesseract") is None:
        raise SystemExit("tesseract が見つかりません。`brew install tesseract` を先に実行してください。")

    pdf_paths = sorted(args.input_dir.glob("*.pdf"))
    if not pdf_paths:
        raise SystemExit(f"PDF が見つかりません: {args.input_dir}")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    raw_dir = args.output_dir / "raw_text"
    raw_dir.mkdir(parents=True, exist_ok=True)

    summary_rows: list[dict[str, str]] = []

    for pdf_path in pdf_paths:
        text, source = extract_text(pdf_path, args.languages)
        candidates = collect_candidate_lines(text)

        raw_path = raw_dir / f"{pdf_path.stem}.txt"
        raw_path.write_text(text, encoding="utf-8")

        json_path = args.output_dir / f"{pdf_path.stem}.json"
        json_path.write_text(
            json.dumps(
                {
                    "pdf": str(pdf_path),
                    "text_source": source,
                    "candidate_count": len(candidates),
                    "candidates": [asdict(candidate) for candidate in candidates],
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

        for candidate in candidates:
            summary_rows.append(
                {
                    "pdf": pdf_path.name,
                    "page": str(candidate.page),
                    "kind": candidate.kind,
                    "matches": " | ".join(candidate.matches),
                    "line": candidate.line,
                    "text_source": source,
                }
            )

    csv_path = args.output_dir / "candidate_lines.csv"
    with csv_path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(
            fh,
            fieldnames=["pdf", "page", "kind", "matches", "line", "text_source"],
        )
        writer.writeheader()
        writer.writerows(summary_rows)

    print(f"抽出完了: {csv_path}")


if __name__ == "__main__":
    main()
