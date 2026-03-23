# AGENTS.md Starter For This Repo

## Purpose
このテンプレートは、`sekou-manual-editor` 系の案件でそのまま流用できる AGENTS のスターターです。施工計画書編集、CSV、ログイン管理、停電案内文、配置図注釈を含む業務ツール前提で書かれています。

## 1) Project Intent
- 目的:
  - 施工計画書自動作成ツールを安全に改修・分割・拡張する
- 最優先のユーザー価値:
  - 既存案件データを壊さず、保存と PDF 出力を安定させる
- 前提:
  - Next.js App Router
  - React
  - TypeScript
  - localStorage 中心
  - 必要に応じて共有同期 API / Prisma API を併用

## 2) Existing Core Flows
- `/` ログイン
- `/menu` 作業メニュー
- `/editor` 施工計画書編集
- `/csv` CSV編集
- `/tracking` 承認/履歴/バックアップ/ユーザー管理
- `/notice` 停電案内文

## 3) Non-Negotiables
- 業務日付は `YYYY-MM-DD` 文字列
- 業務時刻は `HH:mm` 文字列
- 業務日付を `Date` / `toISOString()` に変換しない
- 既存 storage key を変えない
- `normalizeProject()` を通した互換維持を守る
- `layoutAnnotations` と `layoutAnnotationsV2` の両対応を維持する
- テンプレートスコープの 4 種を維持する
- JSON バックアップの `app` 識別子を維持する

## 4) Known Storage And Contracts
- 認証:
  - `sekou-tool-users-v1`
  - `sekou-tool-session-v1`
- 案件:
  - `sekou-tool-projects-v5`
  - `sekou-project-data-v1:...`
- 補助:
  - `sekou-tool-audit-v1`
  - `sekou-tool-revision-v1`
  - `sekou-csv-editor-v1`
- 共有同期:
  - `/api/manual-editor/state`

## 5) Engineering Rules
- 旧巨大ファイルを主戦場に戻さない
- 新規実装は責務ごとに分ける
- 型、定数、保存、UI を分離する
- 1回の変更対象は小さく保つ
- 重い領域は最後に分離する
  - 配置図注釈
  - トリミング
  - PDF7

## 6) Recommended References
- `app/components/PlannerApp.tsx`
- `app/components/planner/types.ts`
- `app/components/planner/constants.ts`
- `app/components/auth.ts`
- `app/components/sharedStorage.ts`
- `docs/date-layer-contract.md`
- `docs/date-validation-spec.md`
- `docs/layout-annotation-architecture.md`

## 7) Workflow
1. 今回触る責務を 1 文で定義する
2. 参照元ファイルを読む
3. 影響範囲を 1 から 3 ファイル単位に絞る
4. 実装する
5. 保存/復元/表示を確認する
6. 次の責務へ進む

## 8) Definition of Done
- 画面が開く
- 既存データを読める
- 保存できる
- 再読込で戻る
- 日付がズレない
- キーボード操作できる
- 既存権限制御が壊れない

## 9) Notes For Copying
- 新案件で流用する場合も、業務日付契約と保存キー契約が変わるまではこの内容を基準にする
- デザイン方針より、まず保存互換と業務フロー維持を優先する
