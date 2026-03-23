# Excel台帳連携型 検針写真OCR照合ツール

請求業務向けの安全設計OCRツールです。  
取り外し前写真と取り付け後写真から値を抽出し、Excel台帳と照合して「自動反映候補」を作成します。  
曖昧ケースは自動確定せず、必ず人手確認を通します。

## 1. 実装済み範囲（MVP）
- Excelアップロード + 列マッピング設定
- 写真一括アップロード（ファイル名から部屋番号抽出）
- 写真2レーン一括アップロード（取り外し前 / 取り付け後）
- 部屋ごとの写真ペア確定（1部屋=取り外し前1枚+取り付け後1枚）
- OCR実行（ローカルTesseract / Google Cloud Vision API 切替対応）
- 写真のみOCR一覧作成（Excel未取込でも部屋別リストを確認可能）
- 部屋単位での照合判定（取り外し値 / 取付メーターNo / 取り付け値）
- ステータス分類: `OK_AUTO` / `NEED_REVIEW` / `NG` / `ERROR`
- 結果一覧 / 要確認一覧 / 個別確認（手動修正・承認）
- 出力:
  - CSV出力
  - Google Sheets出力（dry-run + 本番書込フラグ対応）
    - 毎回 `Spreadsheet ID` を入力して既存シート更新
    - または毎回 `DriveフォルダID` を入力して Excel から新規変換して更新
  - 更新済みExcelコピー出力（原本上書きなし）
- 監査ログ保存（JSONL）

## 2. ディレクトリ構成

```txt
meter-ocr-ledger-tool/
  app/
    api/
      excel/upload/route.ts
      photos/upload/route.ts
      run/execute/route.ts
      pairs/route.ts
      results/route.ts
      reviews/[recordId]/route.ts
      settings/route.ts
      export/csv/route.ts
      export/google-sheets/route.ts
      export/excel/route.ts
      logs/route.ts
    upload-excel/page.tsx
    upload-photos/page.tsx
    run/page.tsx
    results/page.tsx
    reviews/page.tsx
    reviews/[recordId]/page.tsx
    settings/page.tsx
    logs/page.tsx
  src/
    types/domain.ts
    constants/defaults.ts
    domains/judgement/evaluate.ts
    lib/
      excel/{reader.ts,writer.ts}
      filename/parse.ts
      normalize/room.ts
      ocr/{extract.ts,google-vision.ts,local-tesseract.ts,runner.ts}
      storage/fs-store.ts
      csv/export.ts
      validation/{schemas.ts,form.ts}
  tests/unit/
    filename.test.ts
    judgement.test.ts
  storage/
  .env.example
  README.md
```

## 3. データモデル（主要）
- `RunData`: 実行単位の状態（Excel、写真、設定、結果、サマリー）
- `LedgerRow`: Excel台帳1行
- `PhotoRecord`: 1画像のメタ情報（部屋推定、写真種別）
- `PhotoProcessingResult`: OCR結果
- `ProcessRecord`: 部屋単位の判定結果（候補値、理由、承認状態）
- `AuditLog`: 監査ログ

型定義は [src/types/domain.ts](/Users/adachih/Documents/New project/meter-ocr-ledger-tool/src/types/domain.ts) を参照。

## 4. 主要関数一覧
- Excel読込: `readLedgerRows()`
- OCR実行: `runOcr()`（`OCR_ENGINE` に応じて切替）
- OCR抽出: `buildOcrExtract()`
- 判定: `evaluateRoom()`
- 実行オーケストレーション: `executeRun()`
- CSV生成: `recordsToAllCsv()`, `recordsToUpdateCsv()`
- 更新Excelコピー: `writeUpdatedWorkbookCopy()`
- 永続化: `initRun()`, `getRun()`, `saveRun()`, `appendAuditLog()`

## 5. データフロー
1. Excelアップロード（マッピング設定）
2. 台帳読込（部屋番号キー正規化）
3. 写真アップロード（ファイル名解析: 部屋番号 + old/new推定）
4. 写真ペア確定（重複がある部屋は手動で1枚選択）
5. OCR実行（写真ごと / `OCR_ENGINE` で自動切替）
6. 判定ロジック適用
7. 結果一覧 / 要確認 / 個票で確認
8. 承認済みのみ出力（CSV/GSS/Excelコピー）
9. 全操作を監査ログへ保存

## 6. 判定ロジック（安全優先）
自動候補化は全条件成立時のみ。
- 部屋番号一意抽出
- 台帳該当部屋あり
- 取り外し検針値OCR取得
- 取付メーターNo OCR取得
- 取り付け検針値OCR取得
- OCR信頼度 >= 閾値
- 取り外し値 >= 前回値（前回値がある場合）
- 差分 <= 閾値
- 予定取付メーターNoがある場合は完全一致

不成立時:
- 明確不一致: `NG`
- 曖昧/不足/信頼度不足: `NEED_REVIEW`
- システム失敗: `ERROR`

## 7. 画面一覧
初心者向け導線:
1. `開始`（Excel取込任意 / 2レーン写真取込 / 写真ペア確定 / 写真OCR一覧 / 台帳照合）
2. `確認`（要確認データの承認）
3. `出力`（CSV / Excel / Google Sheets）

管理者向け詳細画面:
1. Excelアップロード
2. 写真アップロード
3. 処理実行 + 出力
4. 処理結果一覧
5. 要確認一覧
6. 個別確認
7. 設定
8. ログ閲覧

## 8. セットアップ手順
```bash
cd /Users/adachih/Documents/New\ project/meter-ocr-ledger-tool
cp .env.example .env.local
npm install
npm run dev
```

ブラウザで `http://localhost:3000` を開いてください。

## 9. 環境変数
- `OCR_ENGINE`: `auto` / `local-tesseract` / `google-vision`（既定: `auto`）
- `GOOGLE_CLOUD_VISION_API_KEY`: `OCR_ENGINE=google-vision` のとき必須
- `GOOGLE_API_ACCESS_TOKEN`: Drive + Sheets 本番書込時に推奨
- `GOOGLE_SHEETS_ACCESS_TOKEN`: 旧互換（Sheetsのみ）
- `DEFAULT_OPERATOR_ID` (任意)

## 10. テスト
```bash
npm test
```
- `tests/unit/filename.test.ts`
- `tests/unit/judgement.test.ts`

## 11. 安全設計
- 一括自動確定なし
- `dryRun` 初期値 `true`
- `productionWriteEnabled` 初期値 `false`
- 承認済みのみ出力対象
- 原本Excel上書き禁止（コピー出力）
- 1件ごとの判定理由保存
- 監査ログ保存

## 12. 今後の改善案
1. OCR前の画像前処理（台形補正、ノイズ除去、ROI切出し）
2. 旧メーター写真と新メーター写真の自動ペアリング精度向上
3. メーター機種別の抽出ルールテンプレート化
4. Google Sheets連携のサービスアカウントJWT対応
5. 権限管理（ユーザー認証、承認ワークフロー）
6. SQLite移行による検索性向上
7. E2Eテスト（Playwright）追加
