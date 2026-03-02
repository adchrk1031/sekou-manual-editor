# 列設計（案件一覧シート）

## 案件一覧
1行目はヘッダ固定。`project_id` を主キーにします。

| 列名 | 型 | 入力元 | 必須 | 用途 |
|---|---|---|---|---|
| project_id | string | Salesforce | yes | 案件キー |
| property_name | string | Salesforce | yes | 物件名 |
| property_address | string | Salesforce | yes | 工事場所 |
| title_subject | string | Salesforce | yes | 件名（例: 電気設備更新工事） |
| planned_outage_start | datetime | Salesforce | no | 停電開始 |
| planned_outage_end | datetime | Salesforce | no | 停電終了 |
| work_date_main | date | Salesforce | yes | 本工事日 |
| work_time_start | time | Salesforce | yes | 作業開始 |
| work_time_end | time | Salesforce | yes | 作業終了 |
| flag_kouatsu_cable | boolean | Salesforce | yes | 高圧ケーブル交換 |
| flag_ugs | boolean | Salesforce | yes | UGS交換 |
| flag_pas | boolean | Salesforce | yes | PAS交換 |
| flag_ground_a | boolean | Salesforce | yes | A種接地是正 |
| flag_ground_b | boolean | Salesforce | yes | B種接地是正 |
| flag_ground_c | boolean | Salesforce | yes | C種接地是正 |
| note_special | string | 手入力（GAS） | no | 特記事項 |
| note_approval_extra | string | 手入力（GAS） | no | ご承認事項 追加文 |
| photo_slot_a_label | string | 手入力（GAS） | no | 写真Aキャプション |
| photo_slot_b_label | string | 手入力（GAS） | no | 写真Bキャプション |
| photo_slot_c_label | string | 手入力（GAS） | no | 写真Cキャプション |
| photo_slot_d_label | string | 手入力（GAS） | no | 写真Dキャプション |
| generated_pdf_url | string | GAS | no | 出力PDF URL |
| generated_at | datetime | GAS | no | 最終出力日時 |
| generated_by | string | GAS | no | 出力者 |

## 工事マスタ

| 列名 | 型 | 必須 | 用途 |
|---|---|---|---|
| work_code | string | yes | `KOUATSU_CABLE` 等 |
| work_name | string | yes | 表示名 |
| detail_text | string | yes | 工事詳細説明テンプレ |
| approval_text | string | no | 承認事項テンプレ |
| default_photo_slots | number | no | 初期写真枠数 |
| order_no | number | yes | 出力順 |
| enabled | boolean | yes | 有効/無効 |

## 文章マスタ

| 列名 | 型 | 必須 | 用途 |
|---|---|---|---|
| key | string | yes | `CAUTION_COMMON_1` など |
| value | string | yes | 文章本体 |
| category | string | no | `caution` `footer` など |

## 体制マスタ

| 列名 | 型 | 必須 | 用途 |
|---|---|---|---|
| role_code | string | yes | `ORDERER` `CONTRACTOR` 等 |
| company_name | string | yes | 会社名 |
| contact_name | string | no | 担当者 |
| tel | string | no | 電話 |
| note | string | no | 備考 |
| sort_no | number | yes | 表示順 |

## 出力履歴

| 列名 | 型 | 用途 |
|---|---|---|
| output_id | string | UUID |
| project_id | string | 案件ID |
| output_type | string | `PDF` |
| file_url | string | Drive URL |
| created_at | datetime | 出力日時 |
| created_by | string | ユーザー |

