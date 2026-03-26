---
name: sekou-manual-editor-migration
description: Use this skill when working on the sekou-manual-editor codebase to refactor or extend the construction plan editor while preserving storage compatibility, business date rules, templates, revisions, and the layout annotation workflow.
---

# Skill Overview

このスキルは、施工計画書自動作成ツールの改修や段階移行で使います。

使う場面:
- `PlannerApp.tsx` を分割したい
- `/editor`, `/csv`, `/tracking`, `/notice` のどれかを新構成へ移したい
- localStorage 互換を保ったまま UI を移植したい
- PDF7 配置図/写真/注釈を扱う
- 日付ズレや保存契約を壊さずに変更したい

成功条件:
- 既存データが読める
- 保存できる
- 日付仕様が維持される
- 注釈やテンプレート互換を壊さない

## Project Facts
- 主要 routes:
  - `/`
  - `/menu`
  - `/editor`
  - `/csv`
  - `/tracking`
  - `/notice`
- 主モノリス:
  - `app/components/PlannerApp.tsx`
- 中核型:
  - `Project`
  - `ProjectRevision`
  - `SimpleTemplate<T>`
- テンプレートスコープ:
  - `schedule`
  - `detailPhotos`
  - `relatedParties`
  - `layout`
- PDF テンプレート:
  - `standard`
  - `kansai`
  - `night`

## Quick Start
1. まず参照元を読む
2. 型、定数、保存契約を確認する
3. 今回触る責務を 1 つに絞る
4. 新しいファイルへ受け皿を作る
5. 保存/復元/表示を確認する

## Required References
- `app/components/PlannerApp.tsx`
- `app/components/planner/types.ts`
- `app/components/planner/constants.ts`
- `app/components/planner/utils/storage.ts`
- `app/components/auth.ts`
- `app/components/sharedStorage.ts`
- `docs/date-layer-contract.md`
- `docs/date-validation-spec.md`
- `docs/layout-annotation-architecture.md`

## Workflow

### 1. Understand
- 依頼を 1 文で要約する
- 対象 route と mode を特定する
- 影響する保存単位を特定する
  - 認証
  - project
  - revision
  - template
  - layout annotation

### 2. Plan
- 追加ファイルを先に決める
- 旧巨大ファイルを参照元にする
- 1回の変更を小さく切る

### 3. Implement
- 新規実装は `planner-shell` / `features/*` 配下へ置く
- 型や定数は既存を流用する
- `normalizeProject()` を基準に互換を維持する
- 保存は `stringifyForStorage()` / `parseStorageJson()` 前提で扱う

### 4. Verify
- 画面が開く
- 既存保存データを読める
- 保存できる
- 再読込で戻る
- キーボード操作できる
- 日付がズレない

## Guardrails
- 業務日付を `Date` に変換しない
- storage key を変えない
- `layoutAnnotations` と `layoutAnnotationsV2` の互換を落とさない
- 旧 `PlannerApp.tsx` に新規ロジックを戻さない
- 配置図注釈は最後に分離する
- `main` 直 push が本番 deploy を起こしうる前提で考える
- deploy-sensitive な変更は PR 粒度を小さくする

## GitHub / Deploy
- この系統のリポジトリでは `AGENTS.md` の review guidelines が GitHub 上の Codex review に効く前提で整備する
- PR では build、保存互換、日付契約、注釈互換を最優先で確認する
- `main` に直接入ると本番反映につながる場合は、feature branch と PR を前提に進める
- `pr-build.yml` のような PR build workflow がある場合は、その通過を前提に進める
- ただし branch protection や required checks は GitHub 側設定が必要なので、設定済みか毎回確認する

## Suggested Directory Layout
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

## Output Expectations
- 変更対象を短く説明する
- 保存/復元/日付仕様の確認結果を残す
- 未確認事項があれば最後に明記する
