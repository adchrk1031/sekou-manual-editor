export type Tool = {
  id: string;
  name: string;
  category: string;
};

export type ProjectStatus = "未着手" | "進行中" | "確認待ち" | "完了";

export type Project = {
  id: string;
  projectName: string;
  progressCurrent: number;
  progressTotal: number;
  currentStep: string;
  nextStep: string;
  owner: string;
  dueDate: string;
  status: ProjectStatus;
};

export type AIAction = {
  id: string;
  title: string;
  promptLabel: string;
  resultTitle: string;
  resultBody: string[];
};

export type InsightCard = {
  id: string;
  title: string;
  description: string;
};
