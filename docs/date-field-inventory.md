# 日付項目棚卸し（Step 2）

## 目的
- 日付ズレ対策の前提として、現行コードの「業務日付」項目をレイヤー別に棚卸しする。
- 各項目の型と流通経路（入力/保存/出力）を明確化する。

## 現行モデル（As-Is）

| 区分 | 項目 | 現行型 | 主な利用レイヤー |
|---|---|---|---|
| プロジェクト日付 | `workDateStart` | `string` (`YYYY-MM-DD` 前提) | Front（入力/表示/保存） |
| プロジェクト日付 | `workDateEnd` | `string` (`YYYY-MM-DD` 前提) | Front（入力/表示/保存） |
| 停電日付 | `outageDateStart` | `string` (`YYYY-MM-DD` 前提) | Front（入力/表示/保存） |
| 停電日付 | `outageDateEnd` | `string` (`YYYY-MM-DD` 前提) | Front（入力/表示/保存） |
| 工程行日付 | `scheduleRows[].startDate` | `string` (`YYYY-MM-DD` 前提) | Front（入力/表示/保存） |
| 工程行日付 | `scheduleRows[].endDate` | `string` (`YYYY-MM-DD` 前提) | Front（入力/表示/保存） |

## レイヤー別棚卸し

### 1) Front（Next / PlannerApp）
- 日付入力UI:
  - `workDateStart`, `workDateEnd`, `outageDateStart`, `outageDateEnd` は `type="date"`。
  - 工程行は `type="datetime-local"` だが、内部保持は `startDate/endDate` と `start/end` に分離。
- 内部保持:
  - `Project` 型は業務日付を `string` として定義。
  - `localStorage` 保存時も JSON 文字列として保存。

### 2) CSV（取り込み/編集）
- 取り込み時の対応ヘッダ:
  - 工事日: `work_date_start`, `work_date_end`, `work_date_main` など。
  - 停電日: `outage_date_start`, `outage_date_end` など。
- 正規化:
  - `normalizeDate()` により `YYYY-MM-DD` へ寄せる。

### 3) GAS / Sheet
- シート列（案件一覧）:
  - `work_date_main`
  - `planned_outage_start`
  - `planned_outage_end`
- 現状の実体:
  - シートは `Date` 実体を保持し得る（日時列）。
  - PDF側は整形関数経由で表示文字列化。

### 4) PDF出力
- Front印刷経路:
  - 画面の `string` 日付をそのまま表示。
- GAS PDF経路:
  - シート値（`Date` の可能性あり）を `toDateStr_ / toDateTimeStr_` で文字列化して表示。

## 現状ギャップ（次ステップ対象）
1. Front は文字列正本だが、Sheet/GAS 側は `Date` 実体が混在する。
2. `work_date_main`（単日）と Front の `workDateStart/workDateEnd`（期間）で概念差がある。
3. 工程行は `datetime-local` 入力を使うため、入力経路の厳密ルールが必要。

## Step 2 結論（棚卸し結果）
- Front領域の業務日付は、すでに `string` モデルが中心。
- ズレ再発リスクの主戦場は `Sheet/GAS(Date実体)` と `境界変換`。
- 次は「レイヤー境界の取り扱い仕様固定（Step 3）」を行う。
