# Implementation Brief Template For sekou-manual-editor

## 1. Feature Name
- 例: `PlannerWorkspace 骨組み`
- 例: `ProjectListPanel 抽出`
- 例: `PDF7 注釈エディタ分離`

## 2. Why
- なぜ今これを直すか:
  - `PlannerApp.tsx` が巨大で再開しにくいため
- 今回の詰まり:
  - 開かない
  - 依存が多すぎる
  - 仕様が埋もれている

## 3. Goal
- この作業が終わった時にできること:
  - 既存案件データを保ったまま、対象責務を新ファイル側で扱える

## 4. Non-Goal
- 今回やらないこと:
  - 全画面の同時分割
  - CSS 全面刷新
  - 配置図注釈を先に直すこと

## 5. Default References
- 参照元ファイル:
  - `app/components/PlannerApp.tsx`
  - `app/components/planner/types.ts`
  - `app/components/planner/constants.ts`
  - `app/components/planner/utils/storage.ts`
- 参照元画面:
  - `/editor`
  - `/csv`
  - `/tracking`
  - `/notice`
- 関連ドキュメント:
  - `docs/date-layer-contract.md`
  - `docs/date-validation-spec.md`
  - `docs/layout-annotation-architecture.md`

## 6. Files To Touch
- 追加:
  - 新しい責務ファイルだけを書く
- 更新:
  - 入口ページ、または薄い接続ファイルのみ
- 触らない:
  - 旧巨大ファイルを主戦場にしない

## 7. Inputs / Outputs
- 入力:
  - `Project`
  - `ProjectRevision`
  - `SimpleTemplate<T>`
- 保存先:
  - localStorage
- 同期先:
  - `/api/manual-editor/state`
- 補助:
  - `stringifyForStorage()`
  - `parseStorageJson()`
  - `normalizeProject()`

## 8. Risks
- データ互換:
  - 既存キーや日付契約を壊すと復元不能になりやすい
- UI 崩れ:
  - mode 切替やカード導線が崩れやすい
- パフォーマンス:
  - 画像と注釈まわりは重い
- アクセシビリティ:
  - dialog, focus, keyboard 操作を落としやすい

## 9. Step Plan
1. 対象責務を 1 つに絞る
2. 参照元の型と保存契約を読む
3. 新ファイルに受け皿を作る
4. 最小限の接続だけする
5. 保存/再読込/表示を確認する

## 10. Done Check
- 画面が開く
- 既存データで壊れない
- 保存できる
- 再読込で戻る
- 日付がズレない
- キーボード操作できる
- 既存の権限制御が壊れない

## 11. Notes After Work
- 実際にやったこと:
- 次にやるべきこと:
- 残課題:
