# sekou-manual-editor 再開ガイド

## 目的
施工計画書自動作成ツールを、既存仕様を保ったまま再開しやすい構造へ移すための実戦用ガイドです。壊れた大きなファイルを延命するのではなく、既存コードから仕様を抽出し、新しい受け皿へ段階移行します。

## 現状サマリー
- 認証、メニュー、編集、CSV、ログイン管理、停電案内文の導線はすでにある
- 現行の主実装は [PlannerApp.tsx](../../app/components/PlannerApp.tsx) に集中している
  - 約 10,293 行
- グローバル CSS も巨大化している
  - [app/globals.css](../../app/globals.css)
- localStorage を中心に運用しつつ、共有同期 API と Prisma API 群が同居している
- `normalizeProject()` に互換維持ロジックが多く集まっている

## このツールの実態

### 主要画面
- `/`
  - ログイン/初期管理者登録/一般ユーザー登録
- `/menu`
  - 作業メニュー
- `/editor`
  - 施工計画書編集
- `/csv`
  - CSV編集スペース
- `/tracking`
  - ログイン管理、承認、履歴、バックアップ、ユーザー管理
- `/notice`
  - 停電案内文作成

### 中核データ
- `Project`
  - 基本情報
  - 停電情報
  - 工事項目
  - PDF 出力関連
  - 写真
  - 配置図
  - 注釈
  - 施工体制表
  - 停電案内文
- `ProjectRevision`
  - スナップショット履歴
- `SimpleTemplate<T>`
  - 各種テンプレート

### テンプレートスコープ
- `schedule`
- `detailPhotos`
- `relatedParties`
- `layout`

### PDF テンプレート
- `standard`
- `kansai`
- `night`

### 認証と権限
- ロール
  - `system_admin`
  - `admin`
  - `editor`
  - `viewer`
- 承認状態
  - `approved`
  - `pending`
  - `rejected`

## 保存と同期の前提

### localStorage
- 主保存は localStorage
- 大きい値は `lz-string` で圧縮
- 主要キー:
  - `sekou-tool-projects-v5`
  - `sekou-project-data-v1:...`
  - `sekou-csv-editor-v1`
  - `sekou-tool-users-v1`
  - `sekou-tool-audit-v1`
  - `sekou-tool-revision-v1`

### 共有同期
- `/api/manual-editor/state`
- localStorage の一部キーを共有状態として pull/push
- 競合時は 409 を返してマージ前提

### JSON バックアップ
- `LocalStorageExportPayload`
- `app: "sekou-manual-editor"` を持つ

## 壊してはいけない仕様
- 業務日付は `YYYY-MM-DD` の文字列
- 業務時刻は `HH:mm`
- `Date` / `toISOString()` を業務日付に使わない
- 既存保存キーを不用意に変えない
- `normalizeProject()` を通した旧データ互換を守る
- `layoutAnnotations` と `layoutAnnotationsV2` の互換を守る
- テンプレートスコープの 4 種を維持する
- PDF テンプレート ID を変えない

## 参照元として使うべきファイル
- [app/components/PlannerApp.tsx](../../app/components/PlannerApp.tsx)
- [app/components/planner/types.ts](../../app/components/planner/types.ts)
- [app/components/planner/constants.ts](../../app/components/planner/constants.ts)
- [app/components/auth.ts](../../app/components/auth.ts)
- [app/components/sharedStorage.ts](../../app/components/sharedStorage.ts)
- [app/components/planner/utils/storage.ts](../../app/components/planner/utils/storage.ts)
- [docs/date-field-inventory.md](../date-field-inventory.md)
- [docs/date-layer-contract.md](../date-layer-contract.md)
- [docs/date-validation-spec.md](../date-validation-spec.md)
- [docs/layout-annotation-architecture.md](../layout-annotation-architecture.md)

## 結論
この案件は「新規でゼロから作り直す」より、「旧実装を仕様書として固定し、新しい受け皿へ責務ごとに移す」のが正解です。

## 推奨移行戦略

### Phase 0: 参照元固定
- 現行実装はそのまま残す
- 新規実装の主戦場を旧 `PlannerApp.tsx` に戻さない
- 仕様抽出は docs と types/constants に寄せる

### Phase 1: 新しい骨組み
- `PlannerWorkspace.tsx`
- `PlannerHeader.tsx`
- `PlannerSidebar.tsx`
- ここではまだ PDF7 や注釈エディタへ入らない

### Phase 2: Project Core
- 案件一覧
- 案件選択
- 基本情報編集
- 保存フック
- ここで localStorage 復元と再保存を安定化させる

### Phase 3: 既存で分割の芽がある UI
- `CsvEditorSection`
- `TrackingSection`
- `PdfCoverAndTocSection`
- `PdfWorkOverviewPreview`
- `CardPreview`
- `UiIcon`

### Phase 4: テンプレート、履歴、監査
- `ProjectRevision`
- 監査ログ
- 各種テンプレート保存/適用

### Phase 5: 最後に重い領域
- 配置図画像
- 写真
- トリミング
- 注釈エディタ
- PDF7

## 実装の順番
1. 新ブランチを切る
2. [AGENTS.md](../../AGENTS.md) とこのガイドを読む
3. 最初の実装メモを切る
4. `PlannerWorkspace` の骨組みを作る
5. 案件一覧だけを移す
6. 基本情報フォームだけを移す
7. 保存処理を移す
8. ここで一度 UI/保存確認する
9. その後にテンプレート、履歴、PDF へ進む
10. 配置図注釈は最後に回す

## 1回の作業単位
- 1セッション 1責務
- UI と state と保存を一気に大移動しない
- 追加ファイル数は少なく保つ
- 先に読んでから書く

## 毎回の確認項目
- 画面が開く
- 既存データを読める
- 保存できる
- 再読込で戻る
- 承認/権限導線が壊れていない
- 日付がズレない
- キーボード操作できる

## やってはいけないこと
- 開かなくなった巨大ファイルを主戦場に戻す
- 旧新両方へ同じ責務を長く持たせる
- 日付を `Date` へ戻す
- 配置図注釈から先に直し始める
- CSS 全面整理を先に始める

## 次にやるべき具体タスク
最初の一手は `PlannerWorkspace` 骨組みです。以後は [PLANNER_SPLIT_MAP.md](PLANNER_SPLIT_MAP.md) と [IMPLEMENTATION_BRIEF_01_PLANNER_WORKSPACE.md](IMPLEMENTATION_BRIEF_01_PLANNER_WORKSPACE.md) に従って進めます。
