# CSV取り込みテストガイド（施工計画書編集）

## 1. テスト用CSV
- ファイル: `docs/sekou-plan-automation/csv-test-sample.csv`
- そのままアップロードして動作確認できます。

## 2. テスト手順
1. ログイン後、`CSV編集ワークスペース`へ移動
2. `CSV取込`で `csv-test-sample.csv` を選択
3. 取り込み後、上部ステータスが `2件をCSV取込しました` になることを確認
4. `編集データを案件へ反映` を押す
5. `施工計画書編集`へ移動し、案件セレクトで `PJ-TEST-0001` / `PJ-TEST-0002` を確認

## 3. どこに表示されるか（主要項目）
- 必須
  - `project_id`（または `案件ID`） → 案件ID
- 推奨（これを埋めると手編集がほぼ不要）
  - `property_name` / `物件名` / `案件名` / `建物名` → 物件名
  - `property_address` / `住所` / `所在地` / `工事場所` → 住所
  - `title_subject` / `件名` / `工事件名` / `工事名` → 件名（PDF1/3見出し）
  - `work_date_start`, `work_date_end`（または `工事開始日`, `工事終了日`）→ 工事期間
  - `outage_date_start`, `outage_date_end`, `outage_time_start`, `outage_time_end`（または `停電開始日`, `停電終了日`, `停電開始時間`, `停電終了時間`）→ 停電期間
  - `outage_enabled` / `停電あり` / `停電有無` → 停電バーON/OFF
  - 工事項目（どちらか）
    - `flag_kouatsu_cable`, `flag_ugs`, `flag_pas`, `flag_ground_a`, `flag_ground_b`, `flag_ground_c`
    - または `工事項目`（例: `高圧ケーブル交換,PAS交換`）
  - `note_special` → 特記事項
  - `note_approval_extra` → 承認事項追記
  - `cover_recipient_suffix` / `表紙宛名` → 表紙宛名末尾
  - `pdf_company_name`, `pdf_team`, `pdf_contact_person`, `pdf_address`, `pdf_email`, `pdf_tel`, `pdf_fax`
    - （日本語別名: `会社名`, `技術チーム`, `担当者`, `連絡先住所`, `連絡先メール`, `連絡先TEL`, `連絡先FAX`）
    - → PDF1/PDF6の連絡先情報
  - `photo_slot_*_label` → PDF4 参考写真ラベル
  - `layout_photo_slot_*_label` → PDF7 写真ラベル

## 4. 注意点
- CSV取り込み時、**同じ `project_id` は上書き**されます。
- 画像データ本体（写真ファイル）はCSVでは取り込まれません。ラベルのみ反映です。
- 工程表行は「工事項目フラグ」または `工事項目` の値から自動生成されるため、反映後に必要なら工程表で微調整してください。
- 文字コードはUTF-8推奨です（BOM付きでも取込可）。
