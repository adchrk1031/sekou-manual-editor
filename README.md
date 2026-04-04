# sekou-manual-editor

## 概要
施工計画書自動作成ツール。Next.js ベースの Web アプリで、施工計画書編集、CSV 編集、ログイン管理、停電案内文作成を 1 つの業務ツールとして扱います。

## 再開前に読むもの
- 再開手順: `docs/restart/PROJECT_RESTART_GUIDE.md`
- 分割マップ: `docs/restart/PLANNER_SPLIT_MAP.md`
- GitHub / デプロイ安全運用: `docs/restart/DEPLOY_GITHUB_SAFETY_GUIDE.md`
- 最初の実装メモ: `docs/restart/IMPLEMENTATION_BRIEF_01_PLANNER_WORKSPACE.md`
- 実装メモ雛形: `docs/templates/IMPLEMENTATION_BRIEF.template.md`
- AGENTS 雛形: `docs/templates/AGENTS.template.md`
- スキル雛形: `docs/templates/SKILL_TEMPLATE/SKILL.md`

## 主な機能
- `/`
  - ログイン、新規登録、初期管理者登録
- `/menu`
  - 作業メニュー
- `/editor`
  - 施工計画書編集
  - PDF1-PDF7 相当
  - テンプレート管理
  - 配置図・写真・注釈
- `/editor-next`
  - 既存 `/editor` を壊さずに移行を始めるための read-only preview
- `/csv`
  - Salesforce 取込 CSV の編集支援
- `/tracking`
  - ログイン管理、承認、履歴、バックアップ、ユーザー管理
- `/notice`
  - 停電案内文作成
- データ保存
  - localStorage
  - JSON エクスポート/インポート
  - 共有状態同期 API

## 現在の構成
- フロントの主モノリス:
  - `app/components/PlannerApp.tsx`
- 主要型:
  - `app/components/planner/types.ts`
- 定数・保存キー:
  - `app/components/planner/constants.ts`
- 認証:
  - `app/components/auth.ts`
- 共有保存:
  - `app/components/sharedStorage.ts`
- 補助ドキュメント:
  - `docs/date-*.md`
  - `docs/layout-annotation-architecture.md`

## 技術スタック
- Next.js
- React
- TypeScript
- Prisma
- SQLite
- lz-string

## セットアップ（3コマンド）

```bash
git clone https://github.com/adchrk1031/sekou-manual-editor.git
cd sekou-manual-editor && npm install
npm run dev
```

## デモデータ投入（Import）
1. アプリを起動し、`ログイン管理` 画面を開く
2. `データをインポート` を押す
3. `DEMO_DATA/sekou-demo-import.json` を選択
4. 確認ダイアログでOK
5. 再読み込み後、デモ案件・テンプレートが反映

デモユーザー（個人情報なし）:
- 管理者: `admin.demo@example.com` / `demo1234`
- 編集者: `editor.demo@example.com` / `demo1234`

## デプロイと GitHub 運用
- 本番デプロイ workflow:
  - `.github/workflows/vercel-production.yml`
- 現在の挙動:
  - `main` への push で Vercel Production deploy が走る
- PR build workflow:
  - `.github/workflows/pr-build.yml`
- safety check script:
  - `npm run safety:check`
- deep safety check:
  - `npm run safety:check:deep`
- repository boundary check:
  - `npm run safety:scope`
- route smoke test:
  - `npm run smoke:routes`
- full local safety gate:
  - `npm run safety:full`
- 推奨運用:
  - `main` へ直接 push しない
  - feature branch で作業する
  - push 前に `npm run safety:full` を通す
  - PR 経由で `safety-full` check を通してから反映する
  - `safety:scope` は別案件ディレクトリの追加・編集を止め、削除 cleanup だけは許可する

## ローカル push ガード
- `.githooks/pre-push`
  - `npm run safety:full` を push 前に自動実行
- 有効化コマンド:
  - `npm run hooks:install`
- この環境では local git hook も使って二重で事故を止める
- `meter-ocr-ledger-tool` / `sales-ledger-gas` など sibling project の差分が branch に混ざると `safety:scope` で止まる
- sibling project はこの repo の外に独立 Git として置く

## 事故を減らすための重要ルール
- 業務日付は `YYYY-MM-DD` の文字列で保持する
- 業務時刻は `HH:mm` の文字列で保持する
- 業務日付を `Date` や `toISOString()` に流さない
- localStorage key を不用意に変えない
- `normalizeProject()` を通らない保存変更を入れない
- `layoutAnnotations` / `layoutAnnotationsV2` の互換を壊さない
- 大きな分割は `1 PR = 1責務` で進める
- 別案件ディレクトリの変更を同じ branch / PR に混ぜない

## 現在の安全対策ステータス
- あるもの:
  - `AGENTS.md`
  - 再開ガイド
  - 分割マップ
  - デプロイ安全ガイド
  - `CODEOWNERS`
  - PR template
  - PR build workflow
  - safety check script
  - deep safety check script
  - repository boundary check
  - route smoke test
  - local pre-push hook
  - 本番 deploy workflow
- GitHub 側で有効なもの:
  - `main` の branch protection
  - required check `safety-full`
  - conversation resolution
  - linear history
  - force push / deletion の禁止
  - merge 後 branch 自動削除
- まだ手動対応が必要なもの:
  - preview 環境での受け入れチェック
  - 実運用データでの smoke の定期見直し

## 説明会3分デモ手順
1. ログイン（管理者アカウント）
2. 施工計画書編集で案件を選択し、基本情報を1項目編集（自動保存の動作を確認）
3. 画像編集で注釈を1つ追加して保存
4. PDF出力を実行
5. ログイン管理で `データをエクスポート` を実行し、バックアップ運用を説明

## 詰まりやすいポイントと対処法
- インポート後に画面が古いまま:
  - ブラウザ再読み込み（`Cmd+R` / `Ctrl+R`）
- ログインできない:
  - メール/パスワードの誤入力を確認し、承認区分が「承認済み」か確認
- データが想定どおり出ない:
  - `ログイン管理 > データをインポート` でデモJSONを再投入
- CSVが文字化けする:
  - UTF-8対応で開く（Excelはインポート時に文字コードをUTF-8指定）
