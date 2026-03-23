# Deploy / GitHub Safety Guide

## 目的
本番デプロイ時の事故を減らし、GitHub を基準に継続開発しやすい状態へ持っていくための運用ガイドです。

## 現在の GitHub / Deploy 状態
- remote:
  - `origin = https://github.com/adchrk1031/sekou-manual-editor.git`
- GitHub Actions:
  - `.github/workflows/pr-build.yml`
  - `.github/workflows/vercel-production.yml`
- 現在の挙動:
  - `pull_request -> main` で PR build check が走る
  - `main` への `push` で Vercel Production deploy が走る
  - `workflow_dispatch` でも手動実行可能

## 重要な前提
このリポジトリでは `main` への push がそのまま本番反映に近いため、設計ミスや互換破壊が即事故につながりやすいです。

## 基本方針
- `main` へ直接 push しない
- feature branch を切る
- PR で差分を小さく保つ
- `1 PR = 1責務` を守る
- 分割中は特に、UI 移植と保存契約変更を同じ PR に混ぜない

## 現在の対策状況
- 整っている:
  - top-level `AGENTS.md`
  - `CODEOWNERS`
  - PR template
  - PR build workflow
  - `npm run safety:check`
  - production deploy workflow
  - restart guide / split map / implementation brief
- まだ GitHub 管理画面で必要:
  - branch protection を `main` に設定
  - PR build workflow を required check に設定
  - 直接 push 制限を有効化

## PR で最低限見るべき項目

### 1. ルート単位の影響
- `/`
- `/menu`
- `/editor`
- `/csv`
- `/tracking`
- `/notice`

### 2. 保存互換
- localStorage key を変えていないか
- `normalizeProject()` を外していないか
- JSON バックアップの `app: "sekou-manual-editor"` を維持しているか

### 3. 日付契約
- 業務日付が `YYYY-MM-DD`
- 業務時刻が `HH:mm`
- `Date` や `toISOString()` を業務日付に使っていないか

### 4. 配置図・注釈
- `layoutAnnotations`
- `layoutAnnotationsV2`
- 互換読込
- 画像差し替え時の初期化

### 5. テンプレート・履歴
- `schedule`
- `detailPhotos`
- `relatedParties`
- `layout`
- 手動履歴保存
- 復元

## デプロイ前チェック
最低限、次を実施してから `main` へマージします。

1. `npm run build`
2. ログイン画面が開く
3. `/menu` へ遷移できる
4. `/editor` が開く
5. 既存案件を読める
6. 1項目編集して保存できる
7. 再読込で値が残る
8. 日付がズレない
9. `/tracking` のログイン管理画面が開く
10. JSON エクスポート/インポート契約を壊していない

## 分割中の推奨 PR 粒度
- PR 1: `PlannerWorkspace` 骨組み
- PR 2: 案件一覧
- PR 3: 基本情報フォーム
- PR 4: 保存処理
- PR 5: テンプレート/履歴
- PR 6: PDF
- PR 7: 配置図注釈

## GitHub 上で維持したいもの
- top-level `AGENTS.md`
- PR template
- deploy safety guide
- restart guide
- split map
- implementation briefs

## 将来追加したいもの
- smoke test workflow
- PR ごとの preview チェック手順
- route ごとの簡易受け入れテスト
