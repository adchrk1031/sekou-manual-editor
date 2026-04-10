const AUDIT_ACTION_LABELS: Record<string, string> = {
  login: "ログイン",
  logout: "ログアウト",
  user_create: "ユーザー作成",
  backup_save: "履歴保存",
  backup_restore: "履歴復元",
  approval_update: "状態更新",
  schedule_regenerate: "工程再生成",
  schedule_add_row: "工程行追加",
  schedule_remove_row: "工程行削除",
  schedule_reorder: "工程順序変更",
  timeline_drag: "工程バー調整",
  photo_add: "写真枠追加",
  photo_remove: "写真枠削除",
  layout_image_replace: "配置図アップロード",
  layout_image_crop: "配置図トリミング",
  layout_annotation_save: "配置図注釈保存",
  photo_crop: "写真トリミング",
  pdf_export: "PDF出力",
  notice_print: "案内文出力",
  project_create: "案件作成",
  project_delete: "案件削除",
  copy_from_project: "他案件引用",
  template_apply: "テンプレート適用",
  csv_apply: "CSV反映",
  login_failed: "ログイン失敗",
  user_update_email: "管理者メール変更",
  user_approval_update: "利用承認更新",
  user_delete: "ユーザー削除",
};

type AuditLogLike = {
  action: string;
  detail: string;
};

type UserLike = {
  role: string;
  approvalStatus: string;
  createdByName?: string;
  createdById?: string;
  approvedByName?: string;
};

export function isAdminLikeRole(role: string): boolean {
  return role === "system_admin" || role === "admin";
}

export function formatAuditAction(action: string): string {
  return AUDIT_ACTION_LABELS[action] || "その他操作";
}

export function formatAuditScreen(action: string): string {
  if (action.startsWith("csv_")) {
    return "CSV編集スペース";
  }
  if (action === "notice_print") {
    return "停電案内文";
  }
  if (["login", "logout", "login_failed", "user_create", "user_update_email", "user_approval_update", "user_delete", "user_role_update"].includes(action)) {
    return "ログイン管理";
  }
  if (["backup_save", "backup_restore", "pdf_export", "approval_update", "schedule_regenerate", "schedule_add_row", "schedule_remove_row", "schedule_reorder", "timeline_drag", "photo_add", "photo_remove", "photo_crop", "layout_image_replace", "layout_image_crop", "layout_annotation_save", "project_create", "project_delete", "copy_from_project", "template_apply"].includes(action)) {
    return "施工計画書編集";
  }
  return "その他";
}

export function formatAuditDetail(detail: string): string {
  return detail
    .replaceAll("draft", "編集中")
    .replaceAll("submitted", "確認依頼中")
    .replaceAll("approved", "確定")
    .replaceAll("rejected", "修正依頼");
}

export function formatAuditDetailForNonAdmin(log: AuditLogLike): string {
  if (["user_create", "user_update_email", "login", "login_failed"].includes(log.action)) {
    return "管理者のみ表示";
  }
  return formatAuditDetail(log.detail || "-");
}

export function formatUserCreatedByLabel(user: UserLike): string {
  const label = (user.createdByName || "").trim();
  if (user.createdById === "self_signup" || label.includes("セルフ登録")) {
    return "本人申請（セルフ登録）";
  }
  if (user.createdById === "self" || label === "初期登録") {
    return "初期管理者登録";
  }
  if (!label || label === "システム") {
    return "システム登録";
  }
  return label;
}

export function formatUserApprovedByLabel(user: UserLike): string {
  const label = (user.approvedByName || "").trim();
  if (label) {
    return label;
  }
  if (user.approvalStatus === "pending") {
    return "承認待ち";
  }
  if (user.approvalStatus === "rejected") {
    return "未承認";
  }
  if (user.approvalStatus === "approved") {
    if (user.role === "system_admin") {
      return "システム管理者";
    }
    if (user.role === "admin") {
      return "管理者";
    }
    return formatUserCreatedByLabel(user);
  }
  return "-";
}
