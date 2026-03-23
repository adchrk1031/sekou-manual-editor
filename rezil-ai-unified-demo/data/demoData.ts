import { AIAction, InsightCard, Project, Tool } from "@/types/demo";

export const tools: Tool[] = [
  { id: "tool-1", name: "Salesforce", category: "営業管理" },
  { id: "tool-9", name: "freee", category: "会計・原価管理" },
  { id: "tool-2", name: "Kickflow", category: "申請・承認" },
  { id: "tool-3", name: "ハブル", category: "契約・法務" },
  { id: "tool-4", name: "Kintone", category: "業務管理" },
  { id: "tool-5", name: "Notion", category: "情報共有" },
  { id: "tool-6", name: "Google Workspace", category: "文書・連携" },
  { id: "tool-7", name: "Slack", category: "コミュニケーション" },
  { id: "tool-8", name: "カオナビ", category: "現場運用" }
];

export const currentIssues: InsightCard[] = [
  {
    id: "issue-1",
    title: "出戻りが多い",
    description: "部門ごとに入力先が異なり、更新漏れで同じ確認が繰り返される。"
  },
  {
    id: "issue-2",
    title: "抜け漏れ・タスク漏れが起きる",
    description: "必要情報と依頼が分散し、確認タイミングや引き継ぎ時に漏れが発生しやすい。"
  },
  {
    id: "issue-3",
    title: "操作方法が分からず困る人が出る",
    description: "ツールが多く画面ごとの作法が異なるため、何をどう操作すべきか迷いやすい。"
  },
  {
    id: "issue-4",
    title: "進捗が見えにくい",
    description: "進行状況を横断で追えず、管理者が都度ヒアリングしている。"
  }
];

export const futureStateItems: InsightCard[] = [
  {
    id: "future-1",
    title: "一元管理",
    description: "案件・申請・タスクを一つの画面で統合して確認できる。"
  },
  {
    id: "future-2",
    title: "進捗の可視化",
    description: "各案件の現在地と次工程を共通フォーマットで表示する。"
  },
  {
    id: "future-3",
    title: "AIによる文章作成",
    description: "停電案内や周知文を定型化し、作成時間を短縮する。"
  },
  {
    id: "future-4",
    title: "AIによる資料検索",
    description: "過去資料や類似案件を即時検索し、判断材料を集約する。"
  },
  {
    id: "future-5",
    title: "AIによる次タスク提示",
    description: "案件状況をもとに次の行動候補を提示し、漏れを防ぐ。"
  }
];

export const projects: Project[] = [
  {
    id: "project-a",
    projectName: "案件A",
    progressCurrent: 5,
    progressTotal: 10,
    currentStep: "現地調査レポート確認",
    nextStep: "停電案内文の社内承認",
    owner: "高橋",
    dueDate: "2026-03-22",
    status: "進行中"
  },
  {
    id: "project-b",
    projectName: "案件B",
    progressCurrent: 2,
    progressTotal: 10,
    currentStep: "申請情報の収集",
    nextStep: "工程表ドラフト作成",
    owner: "田中",
    dueDate: "2026-04-05",
    status: "未着手"
  },
  {
    id: "project-c",
    projectName: "案件C",
    progressCurrent: 7,
    progressTotal: 10,
    currentStep: "社外説明資料の最終確認",
    nextStep: "完了報告とナレッジ登録",
    owner: "佐藤",
    dueDate: "2026-03-16",
    status: "確認待ち"
  }
];

export const aiActions: AIAction[] = [
  {
    id: "action-1",
    title: "停電案内文を作成",
    promptLabel: "案件A / 3月28日 / 10:00-12:00 / マンション共用部",
    resultTitle: "停電案内文（サンプル）",
    resultBody: [
      "平素より設備運用にご協力いただきありがとうございます。",
      "3月28日 10:00-12:00 に設備点検のため、共用部で一時停電が発生します。",
      "ご不便をおかけしますが、安全確保のためご理解のほどお願いいたします。"
    ]
  },
  {
    id: "action-2",
    title: "過去の工事資料を検索",
    promptLabel: "受変電設備 / 夜間工事 / 案内文テンプレート",
    resultTitle: "検索結果（サンプル）",
    resultBody: [
      "1. 2025/11 港区A棟 停電案内テンプレート",
      "2. 2025/08 渋谷区B棟 夜間工事チェックリスト",
      "3. 2025/04 中央区C棟 住民向け周知文フォーマット"
    ]
  },
  {
    id: "action-3",
    title: "次にやるべきタスクを表示",
    promptLabel: "案件B / 申請遅延あり / 期限4月5日",
    resultTitle: "次タスク候補（サンプル）",
    resultBody: [
      "1. Kickflow 未承認項目を本日中に確認",
      "2. Slack で法務レビュー担当へ期限共有",
      "3. 明日午前までに工程表ドラフトを更新"
    ]
  }
];
