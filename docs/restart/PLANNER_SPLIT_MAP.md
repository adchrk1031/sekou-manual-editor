# PlannerApp 分割マップ

## 目的
[PlannerApp.tsx](/Users/adachih/Documents/New%20project/app/components/PlannerApp.tsx) の責務を、事故が少ない順番で新構成へ移すための案件専用マップです。

## 現在の実態
- `PlannerApp` は `mode="editor" | "csv" | "tracking" | "notice"` を切り替える多機能モノリス
- 画面、state、保存、監査、テンプレート、PDF、注釈エディタが 1 ファイルに集約されている
- 一部 UI はすでに分割済み
  - `CsvEditorSection`
  - `TrackingSection`
  - `PdfCoverAndTocSection`
  - `PdfWorkOverviewPreview`
  - `CardPreview`
  - `UiIcon`

## 分割の基本ルール
- 旧 `PlannerApp.tsx` は参照専用として残す
- 新実装は新ディレクトリにだけ追加する
- 1回の作業で 1 責務だけ移す
- 旧ファイルからの削除は、新側が動いてから

## 責務ごとの分離先

### 1. Shell / Route Layer
現在:
- `PlannerApp` の mode 切替
- ページごとの見た目の入口

移行先:
```text
app/components/planner-shell/
  PlannerWorkspace.tsx
  PlannerHeader.tsx
  PlannerSidebar.tsx
  PlannerModeTabs.tsx
```

### 2. Project Core
現在:
- 案件一覧
- 案件選択
- 基本情報
- 工事項目
- 承認状態

移行先:
```text
app/components/features/project-core/
  ProjectListPanel.tsx
  ProjectBasicsForm.tsx
  ProjectMetaPanel.tsx
  useProjectWorkspace.ts
  project-normalize.ts
  project-storage.ts
```

### 3. Templates / Revisions / Audit
現在:
- テンプレート管理センター
- 手動履歴保存
- 監査ログ

移行先:
```text
app/components/features/templates/
  TemplateCenter.tsx
  TemplatePicker.tsx
  template-apply.ts

app/components/features/revisions/
  RevisionPanel.tsx
  revision-utils.ts

app/components/features/audit/
  AuditPanel.tsx
  audit-log.ts
```

### 4. PDF Sections
現在:
- PDF1-PDF7 相当の編集とプレビュー

移行先:
```text
app/components/features/pdf/
  PdfSections.tsx
  PdfOverviewSection.tsx
  PdfDetailPhotoSection.tsx
  PdfApprovalSection.tsx
  PdfOrganizationSection.tsx
  PdfLayoutSection.tsx
```

### 5. Notice Workspace
現在:
- 停電案内文用の `notice*` フィールド群

移行先:
```text
app/components/features/notice/
  NoticeWorkspace.tsx
  NoticeForm.tsx
  NoticePreview.tsx
```

### 6. CSV / Tracking
現在:
- 既存の分割済み UI あり

移行先:
```text
app/components/features/csv/
  CsvWorkspace.tsx

app/components/features/tracking/
  TrackingWorkspace.tsx
```

### 7. Layout Editor
現在:
- 画像アップロード
- トリミング
- 注釈編集
- V1/V2 互換

移行先:
```text
app/components/features/layout-editor/
  LayoutEditorDialog.tsx
  LayoutCanvas.tsx
  LayoutToolbar.tsx
  layout-editor.types.ts
  layout-editor.utils.ts
  layout-annotation-compat.ts
```

## 優先順位

### Phase 1
- `PlannerWorkspace.tsx`
- `ProjectListPanel.tsx`
- `ProjectBasicsForm.tsx`
- `useProjectWorkspace.ts`

理由:
- 既存仕様の読み替えをしやすい
- 保存と画面の境目を切りやすい

### Phase 2
- `project-storage.ts`
- `project-normalize.ts`
- `RevisionPanel.tsx`
- `TemplateCenter.tsx`

理由:
- 再開後の運用安定性に直結する

### Phase 3
- `PdfSections.tsx`
- `CsvWorkspace.tsx`
- `TrackingWorkspace.tsx`
- `NoticeWorkspace.tsx`

理由:
- mode ごとの責務が見えやすくなる

### Phase 4
- `LayoutEditorDialog.tsx`
- `LayoutCanvas.tsx`
- 注釈互換ユーティリティ

理由:
- 最も重く、最後に独立させるほうが安全

## 最初の具体順
1. `PlannerWorkspace.tsx`
2. `ProjectListPanel.tsx`
3. `useProjectWorkspace.ts`
4. `ProjectBasicsForm.tsx`
5. `project-storage.ts`
6. `TemplateCenter.tsx`
7. `RevisionPanel.tsx`
8. `PdfSections.tsx`
9. `NoticeWorkspace.tsx`
10. `LayoutEditorDialog.tsx`

## 取り出す時に必ず見る参照元
- [app/components/PlannerApp.tsx](/Users/adachih/Documents/New%20project/app/components/PlannerApp.tsx)
- [app/components/planner/types.ts](/Users/adachih/Documents/New%20project/app/components/planner/types.ts)
- [app/components/planner/constants.ts](/Users/adachih/Documents/New%20project/app/components/planner/constants.ts)
- [app/components/planner/utils/storage.ts](/Users/adachih/Documents/New%20project/app/components/planner/utils/storage.ts)
- [docs/layout-annotation-architecture.md](/Users/adachih/Documents/New%20project/docs/layout-annotation-architecture.md)

## 完了の目安
- `/editor` が新しい `PlannerWorkspace` を使って動く
- 既存保存データを新構成で読める
- 新規ロジックが旧巨大ファイルへ入らない
- 配置図注釈を含めて主要導線が新構成へ寄る
