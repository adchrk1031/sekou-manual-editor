# 日付バリデーション仕様（Step 4）

## 目的
- 業務日付を `YYYY-MM-DD` 文字列で安全に運用するため、受け入れ条件と拒否条件を固定する。
- 画面入力、CSV取込、PDF出力前チェックで同じ判定基準を使う。

## 対象フィールド
- 日付:
  - `workDateStart`
  - `workDateEnd`
  - `outageDateStart`
  - `outageDateEnd`
  - `scheduleRows[].startDate`
  - `scheduleRows[].endDate`
- 時刻:
  - `outageTimeStart`
  - `outageTimeEnd`
  - `scheduleRows[].start`
  - `scheduleRows[].end`

## 形式ルール

### 日付（厳格形式）
- 正式形式: `YYYY-MM-DD`
- 正規表現: `^\d{4}-\d{2}-\d{2}$`
- カレンダー妥当性を必須にする（例: `2026-02-30` は不正）

### 時刻（厳格形式）
- 正式形式: `HH:mm`（24時間）
- 正規表現: `^([01]\d|2[0-3]):([0-5]\d)$`

## 入力経路ごとの受け入れ規則

### 1) 画面入力
- `type="date"`:
  - `YYYY-MM-DD` のみ受け入れる。
  - 不正値は保存しない（直前の有効値を維持）。
- `type="time"`:
  - `HH:mm` のみ受け入れる。
  - 不正値は保存しない（直前の有効値を維持）。
- `type="datetime-local"`:
  - 受信値を `date` と `time` に分離し、それぞれ上記ルールで検証する。

### 2) CSV取り込み
- 受け入れ:
  - `YYYY-MM-DD`
  - `YYYY/M/D`（取り込み時のみ許可し `YYYY-MM-DD` に正規化）
- 拒否:
  - ISO日時 (`YYYY-MM-DDTHH:mm:ss...`) を業務日付として保存すること
  - 空文字（必須項目の場合）

### 3) GAS/Sheet境界
- 受け入れ:
  - 文字列 `YYYY-MM-DD`
  - `Date` 実体は境界で一度だけ `YYYY-MM-DD` に正規化
- 拒否:
  - `Date` 実体のまま業務日付として保持・再保存

## 相関（業務）ルール
- `workDateStart <= workDateEnd`
- `outageDateStart <= outageDateEnd`
- `scheduleRows[].startDate <= scheduleRows[].endDate`
- 工程行の日時範囲は 60分以上（現行仕様）
- 停電期間が工事期間外になる場合:
  - 日付入力時は自動繰り上げしない
  - 必要時のみ明示操作（ドラッグ/日時編集）で調整

## エラー時動作
- 画面入力:
  - 不正値は破棄し、直前の有効値を維持
  - 対象フィールドにエラー表示（赤枠）を付与
- CSV取り込み:
  - 不正レコードはスキップせず、該当セルを空扱い＋取込結果に警告件数を表示
- PDF出力前:
  - 必須日付が不正または空なら出力停止
  - どの項目が不正かを明示

## PDF出力前の最終チェック
- 全日付が `YYYY-MM-DD` か
- 全時刻が `HH:mm` か
- 相関ルールを満たしているか
- 画面表示値と出力値が一致しているか

## 合格基準
- `4/24` 入力が保存時・再読込後・PDF表示で `4/24` のまま
- 停電終了日が意図せず `翌日` に変わらない
- 不正入力時に silently 変換せず、明示的に拒否/警告される
