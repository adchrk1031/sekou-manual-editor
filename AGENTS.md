# AGENTS.md

## Purpose
このリポジトリは、施工計画書自動作成ツールの Next.js アプリです。今後の作業では、既存挙動を壊さずにモノリスを段階分割し、再開しやすい構造へ移すことを最優先にします。

## 1) Product Scope
- ログイン/新規登録/承認待ち管理
- 作業メニュー
  - `/editor`: 施工計画書編集
  - `/csv`: CSV編集スペース
  - `/tracking`: ログイン管理、履歴、バックアップ、ユーザー管理
  - `/notice`: 停電案内文作成
- 施工計画書の PDF1-PDF7 相当の編集
- テンプレート管理
  - `schedule`
  - `detailPhotos`
  - `relatedParties`
  - `layout`
- 配置図画像 + 写真 + 注釈編集
- JSON バックアップ/復元
- 共有状態同期 API
- 別系統として Prisma ベースの案件/工程 API 群も同居

## 2) Current Architecture Snapshot
- App Router の各画面は `PlannerApp` を `mode` 切替で使っている
  - `editor`
  - `csv`
  - `tracking`
  - `notice`
- 認証は [app/components/auth.ts](/Users/adachih/Documents/New%20project/app/components/auth.ts)
- セッション保護は [app/components/ProtectedWorkspace.tsx](/Users/adachih/Documents/New%20project/app/components/ProtectedWorkspace.tsx)
- 共有保存は [app/components/sharedStorage.ts](/Users/adachih/Documents/New%20project/app/components/sharedStorage.ts) と `/api/manual-editor/state`
- メインの業務モノリスは [app/components/PlannerApp.tsx](/Users/adachih/Documents/New%20project/app/components/PlannerApp.tsx)
- 主要な型と保存契約は [app/components/planner/types.ts](/Users/adachih/Documents/New%20project/app/components/planner/types.ts) と [app/components/planner/constants.ts](/Users/adachih/Documents/New%20project/app/components/planner/constants.ts)
- localStorage は `lz-string` 圧縮を使う
  - 実装: [app/components/planner/utils/storage.ts](/Users/adachih/Documents/New%20project/app/components/planner/utils/storage.ts)

## 3) Non-Negotiables
- 業務日付は常に `YYYY-MM-DD` の文字列で扱う
- 業務時刻は常に `HH:mm` の文字列で扱う
- 業務日付を `Date` や `toISOString()` に流さない
- localStorage 既存キーを不用意に変えない
  - 例: `sekou-tool-projects-v5`, `sekou-project-data-v1:`, `sekou-tool-users-v1`
- `normalizeProject()` を通して旧データ互換を守る
- 配置図注釈は `layoutAnnotations` と `layoutAnnotationsV2` の互換を維持する
- テンプレートスコープは現行の 4 種を維持する
  - `schedule`
  - `detailPhotos`
  - `relatedParties`
  - `layout`
- PDF テンプレート ID は現行値を維持する
  - `standard`
  - `kansai`
  - `night`
- JSON バックアップの `app: "sekou-manual-editor"` 契約を壊さない

## 4) Domain Rules To Preserve
- 認証ロール:
  - `system_admin`
  - `admin`
  - `editor`
  - `viewer`
- 承認状態:
  - `approved`
  - `pending`
  - `rejected`
- 工事項目:
  - `KOUATSU_CABLE`
  - `UGS`
  - `PAS`
  - `GROUND_A`
  - `GROUND_B`
  - `GROUND_C`
- 工程行は `ScheduleRow[]`
- 注釈エディタは SVG ベースを維持する
- PDF7 は配置図画像、注釈、写真スロットのまとまりとして扱う
- 停電案内文は `Project` 内の `notice*` フィールド群で保持する

## 5) Refactor Strategy
- 旧 [PlannerApp.tsx](/Users/adachih/Documents/New%20project/app/components/PlannerApp.tsx) は参照専用として扱う
- 新規実装は旧巨大ファイルへ戻さない
- 新しい責務は新しいディレクトリへ作る
- 1回の作業で 1 責務だけ外す
- 推奨順:
  1. 画面シェル
  2. 案件一覧
  3. 基本情報フォーム
  4. 保存フック
  5. テンプレート/履歴
  6. PDF セクション
  7. 配置図注釈エディタ

## 6) Preferred Target Structure
```text
app/components/planner-shell/
app/components/features/project-core/
app/components/features/templates/
app/components/features/revisions/
app/components/features/pdf/
app/components/features/layout-editor/
app/components/features/csv/
app/components/features/tracking/
app/components/features/notice/
```

## 7) Implementation Guardrails
- `PlannerApp` のロジックを丸ごと複製しない
- 型、定数、保存、UI を同時に大移動しない
- 追加ファイルは少数に絞る
- デザイン調整より、まず互換性と再開しやすさを優先する
- CSS の全面刷新は最後までやらない
- 配置図注釈まわりは最後に分離する
- `meter-ocr-ledger-tool/` など別案件ディレクトリの変更をこの branch に混ぜない

## 8) Review Guidelines
- 認証や承認状態を迂回する変更は厳しく見る
- localStorage key や JSON バックアップ契約の変更は高リスクとして扱う
- `normalizeProject()` を通らない保存ロジック追加は要注意
- 業務日付を `Date` 化する変更は原則 NG
- `layoutAnnotations` / `layoutAnnotationsV2` の互換を崩す変更は要注意
- 別案件ディレクトリの差分が PR に含まれていたら高リスクとして止める
- `/editor` の変更では次を最低限確認する
  - 既存案件読込
  - 保存
  - 再読込復元
  - PDF 影響
- `/tracking` の変更では次を最低限確認する
  - ログイン承認導線
  - バックアップ/復元
  - 監査ログ
- `/notice` の変更では次を最低限確認する
  - `notice*` フィールドの保持
  - PDF/印刷表示の破綻有無

## 9) GitHub And Deploy Rules
- GitHub の `main` への push は本番 Vercel デプロイを発火する
- feature branch への push と `pull_request -> main` では safety gate workflow を通す
- そのため原則として `main` へ直接 push しない
- 作業は feature branch で行い、PR 経由で反映する
- branch protection と required check を前提に運用する
- ローカルでも pre-push hook と `npm run safety:full` で二重に止める
- `safety:scope` により別案件ディレクトリ混入を止める
- PR には必ず変更範囲とリスクを明記する
- デプロイ前に最低限次を確認する
  - `npm run safety:full`
  - ログイン画面表示
  - `/menu` 遷移
  - `/editor` 読込
  - 既存案件データ読込
  - 保存と再読込
- 事故を避けるため、モノリス分割中は「1 PR = 1責務」を基本にする
- 大きな refactor と deploy-sensitive な変更を同じ PR に混ぜない

## 10) Release Guardrails
- 認証
  - 初期管理者登録、通常ログイン、承認待ち表示を確認する
- 保存
  - localStorage 既存データを読み込めること
  - JSON エクスポート/インポート契約を壊していないこと
- 日付
  - `YYYY-MM-DD` のまま保存されること
  - 表示と PDF で日付ズレがないこと
- 配置図
  - 画像と注釈が読めること
  - 注釈クリアや画像差し替えでクラッシュしないこと
- テンプレート
  - 4 スコープが壊れていないこと
- 履歴
  - 手動履歴保存と復元が壊れていないこと

## 11) Definition of Done

### Functional
- 画面が開く
- 既存データを読める
- 保存できる
- 再読込で復元できる
- 必要な権限制御が維持される

### Data Integrity
- `Project` の主要フィールドが欠落しない
- 日付/時刻契約を破らない
- テンプレート、履歴、監査ログが壊れない
- 共有保存 API との整合が取れる

### UX
- キーボード操作できる
- モバイルでも最低限破綻しない
- 主要ボタンの状態が揃っている

## 12) Required References Before Major Edits
- [app/components/PlannerApp.tsx](/Users/adachih/Documents/New%20project/app/components/PlannerApp.tsx)
- [app/components/planner/types.ts](/Users/adachih/Documents/New%20project/app/components/planner/types.ts)
- [app/components/planner/constants.ts](/Users/adachih/Documents/New%20project/app/components/planner/constants.ts)
- [app/components/planner/utils/storage.ts](/Users/adachih/Documents/New%20project/app/components/planner/utils/storage.ts)
- [docs/date-field-inventory.md](/Users/adachih/Documents/New%20project/docs/date-field-inventory.md)
- [docs/date-layer-contract.md](/Users/adachih/Documents/New%20project/docs/date-layer-contract.md)
- [docs/date-validation-spec.md](/Users/adachih/Documents/New%20project/docs/date-validation-spec.md)
- [docs/layout-annotation-architecture.md](/Users/adachih/Documents/New%20project/docs/layout-annotation-architecture.md)
- [docs/restart/DEPLOY_GITHUB_SAFETY_GUIDE.md](/Users/adachih/Documents/New%20project/docs/restart/DEPLOY_GITHUB_SAFETY_GUIDE.md)
