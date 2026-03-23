# Implementation Brief 01

## Feature Name
- `PlannerWorkspace` 骨組み + Project Core 入口分離

## Why
- 現行の [PlannerApp.tsx](/Users/adachih/Documents/New%20project/app/components/PlannerApp.tsx) は大きすぎて再開しにくい
- まず画面シェルと案件一覧の受け皿を作らないと、以後の分割で毎回同じ場所に戻ってしまう
- 注釈エディタより先に、通常編集の骨格を安定させる必要がある

## Goal
- `/editor-next` で新しい `PlannerWorkspace` を表示できる
- 既存 localStorage の案件一覧を読める
- 選択中案件の基本情報を新しい UI 側で表示できる
- まだ編集対象は基本情報までに限定する

## Non-Goal
- PDF 全体の移植
- テンプレート管理センターの移植
- 履歴/監査パネルの移植
- 配置図注釈エディタの移植
- CSV / Tracking / Notice の再構築

## Reference
- 参照元ファイル:
  - [PlannerApp.tsx](/Users/adachih/Documents/New%20project/app/components/PlannerApp.tsx)
  - [types.ts](/Users/adachih/Documents/New%20project/app/components/planner/types.ts)
  - [constants.ts](/Users/adachih/Documents/New%20project/app/components/planner/constants.ts)
  - [storage.ts](/Users/adachih/Documents/New%20project/app/components/planner/utils/storage.ts)
- 参照元画面:
  - `/editor`
  - `/editor-next`（今回追加する preview）
- 関連ドキュメント:
  - [PROJECT_RESTART_GUIDE.md](/Users/adachih/Documents/New%20project/docs/restart/PROJECT_RESTART_GUIDE.md)
  - [PLANNER_SPLIT_MAP.md](/Users/adachih/Documents/New%20project/docs/restart/PLANNER_SPLIT_MAP.md)
  - [date-layer-contract.md](/Users/adachih/Documents/New%20project/docs/date-layer-contract.md)

## Files To Touch
- 追加:
  - `app/components/planner-shell/PlannerWorkspace.tsx`
  - `app/components/features/project-core/ProjectListPanel.tsx`
  - `app/components/features/project-core/useProjectWorkspace.ts`
- 更新:
  - `app/(workspace)/editor/page.tsx`
- 触らない:
  - 旧 `PlannerApp.tsx`
  - 配置図注釈のロジック群

## Inputs / Outputs
- 入力:
  - localStorage の案件データ
  - セッション中の current user
- 保存先:
  - 当面は既存の localStorage 契約をそのまま使う
- 表示先:
  - `/editor-next`
- API:
  - 共有同期は既存の pull のみ必要に応じて利用

## Risks
- データ互換:
  - 圧縮保存や旧形式の互換を崩すと既存案件が読めなくなる
- UI 崩れ:
  - 新しい preview route が既存導線と混線する可能性がある
- 状態分断:
  - 旧 `PlannerApp` と新 `PlannerWorkspace` で二重管理になりやすい
- 日付仕様:
  - 基本情報の編集でも `workDateStart` などを `Date` に変えないこと

## Step Plan
1. `Project` 読み込みに必要な最小ロジックを切り出す
2. 新しい `PlannerWorkspace` を作る
3. 左側に案件一覧、右側に基本情報の要約を出す
4. `/editor-next` に preview route を追加する
5. 既存案件の読込と表示だけ確認する

## Done Check
- `/editor-next` が開く
- 案件一覧が見える
- 既存案件を読める
- 選択中案件の基本情報が表示される
- 画面再読込後も同じデータを読める
- 日付表示がズレない

## After This
- 次は `ProjectBasicsForm` の編集対応
- その次に `project-storage.ts` で保存処理を分離
