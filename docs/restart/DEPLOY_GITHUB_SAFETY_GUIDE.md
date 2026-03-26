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
  - feature branch への `push` で safety gate が走る
  - `pull_request -> main` で safety gate が走る
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
  - push / PR safety workflow
  - `npm run safety:check`
  - `npm run safety:check:deep`
  - `npm run safety:scope`
  - `npm run smoke:routes` による route smoke test
  - `npm run safety:full`
  - local pre-push hook
  - production deploy workflow
  - restart guide / split map / implementation brief
- GitHub 側ですでに有効:
  - branch protection を `main` に設定済み
  - required check `safety-full`
  - 直接 push 制限
  - conversation resolution
  - linear history
  - force push / deletion の禁止
  - merge 後 branch 自動削除
- まだ手動で継続確認が必要:
  - preview 環境での受け入れチェック
  - 実運用データでの smoke の定期見直し

## PR で最低限見るべき項目

### 1. ルート単位の影響
- `/`
- `/menu`
- `/editor`
- `/csv`
- `/tracking`
- `/notice`
- 別案件ディレクトリ差分が含まれていないか
  - `slack-mention-todo-tool/`
  - `rezil-ai-unified-demo/`
  - `rezil-ai-division-brief/`
  - `meter-ocr-ledger-tool/` を再導入していないか

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

1. `npm run safety:scope`
2. `npm run build`
3. `npm run smoke:routes`
4. ログイン画面が開く
5. `/menu` へ遷移できる
6. `/editor` が開く
7. 既存案件を読める
8. 1項目編集して保存できる
9. 再読込で値が残る
10. 日付がズレない
11. `/tracking` のログイン管理画面が開く
12. JSON エクスポート/インポート契約を壊していない

## Repository Boundary Check の扱い
- `safety:scope` は別案件ディレクトリの追加・編集を失敗させる
- 既存の別案件ディレクトリを repo から削除する cleanup は許可する
- つまり、施工計画書ツールを単独 repo に近づける方向の整理は安全側として通せる

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
- PR ごとの preview チェック手順
- route ごとの簡易受け入れテスト
