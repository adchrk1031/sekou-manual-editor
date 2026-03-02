# 日付レイヤー境界仕様（Step 3）

## 目的
- 業務日付を `YYYY-MM-DD` 文字列で一貫運用するため、レイヤー間の契約を固定する。
- 入力/保存/出力での「許可操作」と「禁止操作」を明確化する。

## 前提
- 業務日付の意味: **Asia/Tokyo の暦日**（時刻なし）。
- 正本フォーマット: `YYYY-MM-DD`
- 業務時刻フォーマット: `HH:mm`

## 契約（共通）
- 業務日付は `string` のみ許可する。
- 業務日付に `Date` を保存しない。
- 業務日付を `toISOString()` へ流さない。
- 表示専用の日時文字列は `date + time` を連結して作る。

## レイヤー別仕様

### 1) 入力レイヤー（UI）
- 許可:
  - `type="date"` の値をそのまま `YYYY-MM-DD` で保持する。
  - `type="datetime-local"` は `date` と `time` に分離して保持する。
- 禁止:
  - 入力値を `new Date(...)` に変換してから状態に保存すること。
  - 日付フィールド変更時に時刻都合で翌日に繰り上げる補正。

### 2) ドメイン/状態レイヤー（Front）
- 許可:
  - `Project` と `ScheduleRow` の日付フィールドは `string` 固定。
  - 比較は文字列比較（`YYYY-MM-DD`）または日数演算関数で行う。
- 禁止:
  - 業務日付を `Date` に変換して再代入すること。
  - タイムゾーン依存API（`toISOString`, `getUTC*`）を業務日付に使うこと。

### 3) 保存レイヤー（localStorage / CSV）
- 許可:
  - JSON/CSVに `YYYY-MM-DD` をそのまま保存する。
  - 取り込み時は `normalizeDate()` で `YYYY-MM-DD` に正規化する。
- 禁止:
  - 保存前に業務日付を日時へ変換すること。
  - `YYYY-MM-DDTHH:mm:ss...` 形式を業務日付として保存すること。

### 4) GAS/Sheet境界レイヤー
- 許可:
  - 受信時に値が `Date` なら、**境界で1回だけ** JST文字列へ正規化して以後は文字列運用。
  - 可能な限りシート保存も文字列列を正本にする。
- 禁止:
  - GAS内部で業務日付を `Date` のまま持ち回ること。
  - スクリプトTZとシートTZを混在させること。

### 5) 出力レイヤー（PDF）
- 許可:
  - 業務日付文字列をそのまま出力する。
  - 表示フォーマット変更は文字列整形のみで行う。
- 禁止:
  - PDF出力直前に業務日付を `Date` 化して整形すること。

## インターフェース定義（必須）
- `workDateStart`: `YYYY-MM-DD`
- `workDateEnd`: `YYYY-MM-DD`
- `outageDateStart`: `YYYY-MM-DD`
- `outageDateEnd`: `YYYY-MM-DD`
- `scheduleRows[].startDate`: `YYYY-MM-DD`
- `scheduleRows[].endDate`: `YYYY-MM-DD`
- `outageTimeStart` / `outageTimeEnd` / `scheduleRows[].start` / `scheduleRows[].end`: `HH:mm`

## 互換運用（移行期）
- 旧データに `Date` や ISO日時文字列が残っている場合:
  1. 読み込み境界で `YYYY-MM-DD` に正規化
  2. 正規化後の値で再保存
  3. 再保存完了後は旧形式を参照しない

## 判定ルール（設計合否）
- 合格:
  - どのレイヤーでも業務日付の型が `string` のみ。
  - 画面表示・保存値・PDF表示が同一日付。
- 不合格:
  - いずれかの境界で `Date` が業務日付として残る。
  - `4/24` 入力が `4/25` として保存または出力される。
