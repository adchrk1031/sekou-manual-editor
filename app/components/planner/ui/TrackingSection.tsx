import type { ChangeEvent, Dispatch, MutableRefObject, SetStateAction } from "react";
import type { LoginAttemptLog } from "../../auth";
import { ROLE_LABELS, USER_LIST_VISIBLE_COUNT } from "../constants";
import { formatAuditAction, formatAuditDetail, formatAuditDetailForNonAdmin, formatAuditScreen, formatUserApprovedByLabel } from "../utils/audit";
import type { AuditLog, ProjectRevision, UserAccount, UserApprovalStatus, UserCreateNotice, UserRole } from "../types";
import { UiIcon } from "./UiIcon";

type UserStats = {
  total: number;
  activeUsers: number;
  approvedUsers: number;
  pendingUsers: number;
  admins: number;
  activeAdmins: number;
};

type UserOption = {
  id: string;
  label: string;
};

type TrackingSectionProps = {
  isTrackingMode: boolean;
  currentUser: UserAccount | null;
  loginEmail: string;
  setLoginEmail: Dispatch<SetStateAction<string>>;
  loginPassword: string;
  setLoginPassword: Dispatch<SetStateAction<string>>;
  login: () => void;
  loginError: string;
  canEdit: boolean;
  canEditSelectedProject: boolean;
  canAdmin: boolean;
  userStats: UserStats;
  newUserName: string;
  setNewUserName: Dispatch<SetStateAction<string>>;
  newUserEmail: string;
  setNewUserEmail: Dispatch<SetStateAction<string>>;
  newUserPassword: string;
  setNewUserPassword: Dispatch<SetStateAction<string>>;
  newUserRole: UserRole;
  setNewUserRole: Dispatch<SetStateAction<UserRole>>;
  createUser: () => void;
  userCreateNotice: UserCreateNotice | null;
  userManageNotice: UserCreateNotice | null;
  userListExpanded: boolean;
  setUserListExpanded: Dispatch<SetStateAction<boolean>>;
  users: UserAccount[];
  updateUserApprovalStatusByAdmin: (userId: string, status: UserApprovalStatus) => void;
  updateUserRoleByAdmin: (userId: string, role: UserRole) => void;
  deleteUserByAdmin: (userId: string) => void;
  accessLogExpanded: boolean;
  setAccessLogExpanded: Dispatch<SetStateAction<boolean>>;
  accessLogs: LoginAttemptLog[];
  operationLogUserFilter: string;
  setOperationLogUserFilter: Dispatch<SetStateAction<string>>;
  adminAuditUserOptions: UserOption[];
  saveManualRevision: () => void;
  exportLocalStorageData: () => void;
  importFileInputRef: MutableRefObject<HTMLInputElement | null>;
  importLocalStorageData: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  openImportFileDialog: () => void;
  selectedRevisionId: string;
  setSelectedRevisionId: Dispatch<SetStateAction<string>>;
  projectRevisions: ProjectRevision[];
  restoreRevision: () => void;
  selectedRevision: ProjectRevision | undefined;
  adminVisibleAuditLogs: AuditLog[];
  adminFilteredAuditLogs: AuditLog[];
  operationLogExpanded: boolean;
  setOperationLogExpanded: Dispatch<SetStateAction<boolean>>;
  userScopedProjectAuditLogs: AuditLog[];
  userScopedGlobalAuditLogs: AuditLog[];
};

export function TrackingSection({
  isTrackingMode,
  currentUser,
  loginEmail,
  setLoginEmail,
  loginPassword,
  setLoginPassword,
  login,
  loginError,
  canEdit,
  canEditSelectedProject,
  canAdmin,
  userStats,
  newUserName,
  setNewUserName,
  newUserEmail,
  setNewUserEmail,
  newUserPassword,
  setNewUserPassword,
  newUserRole,
  setNewUserRole,
  createUser,
  userCreateNotice,
  userManageNotice,
  userListExpanded,
  setUserListExpanded,
  users,
  updateUserApprovalStatusByAdmin,
  updateUserRoleByAdmin,
  deleteUserByAdmin,
  accessLogExpanded,
  setAccessLogExpanded,
  accessLogs,
  operationLogUserFilter,
  setOperationLogUserFilter,
  adminAuditUserOptions,
  saveManualRevision,
  exportLocalStorageData,
  importFileInputRef,
  importLocalStorageData,
  openImportFileDialog,
  selectedRevisionId,
  setSelectedRevisionId,
  projectRevisions,
  restoreRevision,
  selectedRevision,
  adminVisibleAuditLogs,
  adminFilteredAuditLogs,
  operationLogExpanded,
  setOperationLogExpanded,
  userScopedProjectAuditLogs,
  userScopedGlobalAuditLogs,
}: TrackingSectionProps) {
  if (!isTrackingMode) {
    return null;
  }

  return (
    <>
      <section className="panel security-panel">
        <div className="panel-head">
          <h3 className="section-title"><span className="section-icon"><UiIcon name="login" /></span>ログイン管理</h3>
          {currentUser ? <p className="status-chip ok">ログイン中: {currentUser.name} / {ROLE_LABELS[currentUser.role]}</p> : <p className="status-chip warn">未ログイン</p>}
        </div>
        {!currentUser ? (
          <div className="field-grid">
            <label className="field">
              <span>メールアドレス</span>
              <input className="control" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} placeholder="name@example.com" />
            </label>
            <label className="field">
              <span>パスワード</span>
              <input className="control" type="password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} placeholder="********" />
            </label>
            <div className="inline-row wrap">
              <button type="button" className="btn btn-accent" onClick={login}><span className="btn-icon"><UiIcon name="login" /></span>ログイン</button>
              <p className="mini">初期登録済みのメールアドレスでログインしてください</p>
            </div>
            {loginError ? <p className="mini error-text">{loginError}</p> : null}
          </div>
        ) : (
          <div className="inline-row wrap">
            <p className="mini">ログアウトは画面上部のボタンから実行できます。</p>
            {!canEdit ? <p className="mini">閲覧専用ユーザーです（編集不可）</p> : null}
          </div>
        )}
        {canAdmin ? <p className="mini">管理者/システム管理者はこの画面で、ユーザー管理・バックアップ保存・復元・操作履歴確認ができます。</p> : null}

        {canAdmin ? (
          <section className="sub-panel user-admin-panel">
            <h4 className="user-admin-title"><span className="section-icon"><UiIcon name="userPlus" /></span>管理者向け: ユーザー追加</h4>
            <h4>利用ユーザー登録一覧</h4>
            <p className="mini">登録ユーザーを一覧管理できます（承認・権限変更・有効/無効の切替）。承認操作は管理者/システム管理者のみ可能です。</p>
            <div className="user-stats-grid" aria-label="ユーザー集計">
              <article className="user-stat-card">
                <p className="user-stat-label">総ユーザー</p>
                <p className="user-stat-value">{userStats.total}名</p>
              </article>
              <article className="user-stat-card">
                <p className="user-stat-label">有効</p>
                <p className="user-stat-value">{userStats.activeUsers}名</p>
              </article>
              <article className="user-stat-card">
                <p className="user-stat-label">承認済み</p>
                <p className="user-stat-value">{userStats.approvedUsers}名</p>
              </article>
              <article className="user-stat-card">
                <p className="user-stat-label">承認待ち</p>
                <p className="user-stat-value">{userStats.pendingUsers}名</p>
              </article>
              <article className="user-stat-card">
                <p className="user-stat-label">管理者</p>
                <p className="user-stat-value">{userStats.admins}名</p>
                <p className="user-stat-meta">有効承認済み {userStats.activeAdmins}名</p>
              </article>
            </div>
            <div className="field-grid">
              <label className="field"><span>名前</span><input className="control" value={newUserName} placeholder="例: 山田 太郎" onChange={(event) => setNewUserName(event.target.value)} /></label>
              <label className="field"><span>メール</span><input className="control" value={newUserEmail} placeholder="例: name@gmail.com" onChange={(event) => setNewUserEmail(event.target.value)} /></label>
              <label className="field"><span>パスワード</span><input className="control" type="password" value={newUserPassword} placeholder="8文字以上推奨" onChange={(event) => setNewUserPassword(event.target.value)} /></label>
              <label className="field">
                <span>権限</span>
                <select className="control" value={newUserRole} onChange={(event) => setNewUserRole(event.target.value as UserRole)}>
                  {currentUser?.role === "system_admin" ? <option value="system_admin">システム管理者</option> : null}
                  <option value="admin">管理者</option>
                  <option value="editor">編集者</option>
                  <option value="viewer">閲覧者</option>
                </select>
              </label>
              <div className="inline-row wrap user-add-row">
                <button type="button" className="btn btn-accent" onClick={() => createUser()}><span className="btn-icon"><UiIcon name="userPlus" /></span>ユーザー追加</button>
              </div>
              {userCreateNotice ? <p className={`mini ${userCreateNotice.type === "error" ? "error-text" : "ok-text"}`}>{userCreateNotice.text}</p> : null}
              {userManageNotice ? <p className={`mini ${userManageNotice.type === "error" ? "error-text" : "ok-text"}`}>{userManageNotice.text}</p> : null}
            </div>
            <h4 className="user-admin-heading">登録済みユーザー</h4>
            <p className="mini user-admin-table-help">承認区分: 管理者の審査状態 / 利用状態: ログイン可否（有効・無効）</p>
            <div className="table-wrap user-table-wrap">
              <table className="schedule-table user-table">
                <thead>
                  <tr><th>名前</th><th>メール</th><th>承認区分</th><th>権限</th><th>利用状態</th><th>承認者</th><th>登録日時</th><th>最終ログイン</th><th className="user-op-col">操作</th></tr>
                </thead>
                <tbody>
                  {(userListExpanded ? users : users.slice(0, USER_LIST_VISIBLE_COUNT)).map((user) => (
                    <tr key={`user_table_${user.id}`}>
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td>
                        <select
                          className="control"
                          value={user.approvalStatus}
                          onChange={(event) => updateUserApprovalStatusByAdmin(user.id, event.target.value as UserApprovalStatus)}
                          disabled={user.role === "system_admin"}
                        >
                          <option value="pending">承認待ち</option>
                          <option value="approved">承認済み</option>
                          <option value="rejected">利用不可</option>
                        </select>
                      </td>
                      <td>
                        <select
                          className="control"
                          value={user.role}
                          onChange={(event) => updateUserRoleByAdmin(user.id, event.target.value as UserRole)}
                          disabled={user.role === "system_admin"}
                        >
                          {(currentUser?.role === "system_admin" || user.role === "system_admin")
                            ? <option value="system_admin">システム管理者</option>
                            : null}
                          <option value="admin">管理者</option>
                          <option value="editor">編集者</option>
                          <option value="viewer">閲覧者</option>
                        </select>
                      </td>
                      <td>{user.active && user.approvalStatus === "approved" ? <span className="status-chip ok">有効</span> : <span className="status-chip warn">無効</span>}</td>
                      <td><span className="user-meta-chip">{formatUserApprovedByLabel(user)}</span></td>
                      <td>{user.createdAt ? new Date(user.createdAt).toLocaleString("ja-JP") : "未記録"}</td>
                      <td>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("ja-JP") : "未ログイン"}</td>
                      <td className="user-op-cell">
                        <div className="user-actions">
                          {user.role === "system_admin" ? (
                            <span className="mini">固定</span>
                          ) : (
                            <button type="button" className="btn btn-danger" onClick={() => deleteUserByAdmin(user.id)}>
                              <span className="btn-icon"><UiIcon name="delete" /></span>削除
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!users.length ? <tr><td colSpan={9}>ユーザーが未登録です</td></tr> : null}
                  {users.length > USER_LIST_VISIBLE_COUNT ? (
                    <tr className="access-log-more-row">
                      <td className="access-log-more-cell" colSpan={9}>
                        <button
                          type="button"
                          className="access-log-more-link"
                          onClick={() => setUserListExpanded((prev) => !prev)}
                        >
                          {userListExpanded ? "登録済みユーザーをたたむ" : "登録済みユーザーをもっと表示する"}
                        </button>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <h4 className="user-admin-heading">アクセス試行履歴（成功/失敗）</h4>
            <div className="table-wrap">
              <table className="schedule-table access-log-table">
                <thead>
                  <tr><th>日時</th><th>メール</th><th>判定</th><th>ユーザー名</th><th>経路</th></tr>
                </thead>
                <tbody>
                  {(accessLogExpanded ? accessLogs : accessLogs.slice(0, 5)).map((log) => (
                    <tr key={`access_log_${log.id}`}>
                      <td>{new Date(log.at).toLocaleString("ja-JP")}</td>
                      <td>{log.email || "-"}</td>
                      <td>{log.result === "success" ? "成功" : "失敗"}</td>
                      <td>{log.userName || "-"}</td>
                      <td>{log.source === "login_page" ? "ログインページ" : "トラッキング画面"}</td>
                    </tr>
                  ))}
                  {!accessLogs.length ? <tr><td colSpan={5}>アクセス履歴はまだありません</td></tr> : null}
                  {accessLogs.length > 5 ? (
                    <tr className="access-log-more-row">
                      <td className="access-log-more-cell" colSpan={5}>
                        <button
                          type="button"
                          className="access-log-more-link"
                          onClick={() => setAccessLogExpanded((prev) => !prev)}
                        >
                          {accessLogExpanded ? "アクセス履歴をたたむ" : "アクセス履歴をもっと表示する"}
                        </button>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <h4 className="user-admin-heading">操作履歴（誰が / どこで / 何を）</h4>
            <p className="mini">この欄で「保存」と「復元」を行います。操作履歴は下の表で確認できます。</p>
            <div className="tracking-history-controls">
              <div className="tracking-history-row">
                <label className="field tracking-revision-select tracking-filter-select">
                  <span>ユーザーで絞り込み</span>
                  <select className="control" value={operationLogUserFilter} onChange={(event) => setOperationLogUserFilter(event.target.value)}>
                    <option value="all">全ユーザー</option>
                    {adminAuditUserOptions.map((option) => (
                      <option key={`operation_log_user_${option.id}`} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className="btn btn-subtle tracking-history-action-btn" onClick={saveManualRevision} disabled={!canEditSelectedProject}>
                  <span className="btn-icon"><UiIcon name="save" /></span>現在内容を履歴保存
                </button>
              </div>
              <div className="tracking-history-row">
                <div className="mini">この端末のlocalStorage全データをJSONでダウンロードします。</div>
                <button type="button" className="btn btn-subtle tracking-history-action-btn" onClick={exportLocalStorageData}>
                  <span className="btn-icon"><UiIcon name="save" /></span>データをエクスポート
                </button>
              </div>
              <div className="tracking-history-row">
                <div className="mini">エクスポート済みJSONを読み込み、localStorageへ上書き保存します。</div>
                <div>
                  <input
                    ref={importFileInputRef}
                    type="file"
                    accept="application/json,.json"
                    onChange={importLocalStorageData}
                    style={{ display: "none" }}
                  />
                  <button type="button" className="btn btn-subtle tracking-history-action-btn" onClick={openImportFileDialog}>
                    <span className="btn-icon"><UiIcon name="upload" /></span>データをインポート
                  </button>
                </div>
              </div>
              <div className="tracking-history-row">
                <label className="field tracking-revision-select">
                  <span>復元する履歴</span>
                  <select className="control" value={selectedRevisionId} onChange={(event) => setSelectedRevisionId(event.target.value)}>
                    <option value="">履歴を選択</option>
                    {projectRevisions.map((revision) => (
                      <option key={revision.id} value={revision.id}>
                        {new Date(revision.at).toLocaleString("ja-JP")} / {revision.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className="btn btn-subtle tracking-history-action-btn" onClick={restoreRevision} disabled={!canEditSelectedProject || !selectedRevision}>
                  <span className="btn-icon"><UiIcon name="history" /></span>この時点に戻す
                </button>
              </div>
            </div>
            <div className="table-wrap">
              <table className="schedule-table access-log-table">
                <thead>
                  <tr><th>日時</th><th>ユーザー</th><th>画面</th><th>案件ID</th><th>操作</th><th>詳細</th></tr>
                </thead>
                <tbody>
                  {adminVisibleAuditLogs.map((log) => (
                    <tr key={`admin_audit_${log.id}`}>
                      <td>{new Date(log.at).toLocaleString("ja-JP")}</td>
                      <td>{log.userName || "-"}</td>
                      <td>{formatAuditScreen(log.action)}</td>
                      <td>{log.projectId || "-"}</td>
                      <td>{formatAuditAction(log.action)}</td>
                      <td>{formatAuditDetail(log.detail || "-")}</td>
                    </tr>
                  ))}
                  {!adminVisibleAuditLogs.length ? <tr><td colSpan={6}>操作履歴はまだありません</td></tr> : null}
                  {adminFilteredAuditLogs.length > 5 ? (
                    <tr className="access-log-more-row">
                      <td className="access-log-more-cell" colSpan={6}>
                        <button
                          type="button"
                          className="access-log-more-link"
                          onClick={() => setOperationLogExpanded((prev) => !prev)}
                        >
                          {operationLogExpanded ? "操作履歴をたたむ" : "操作履歴をもっと表示する"}
                        </button>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </section>

      {!!currentUser && !canAdmin ? (
        <section className="panel history-panel">
          <div className="panel-head">
            <h3 className="section-title"><span className="section-icon"><UiIcon name="history" /></span>履歴管理</h3>
            <p className="mini">編集者/閲覧者向け: 履歴復元と変更ログ確認ができます。</p>
          </div>
          <p className="mini">登録済みユーザー一覧・ユーザー管理情報は管理者のみ確認できます。変更履歴はログイン中ユーザー本人の作業のみ表示します。</p>
          <article className="sub-panel">
            <h4>履歴保存・復元</h4>
            <p className="mini">「履歴を保存」を押すと今の状態を保存し、「この時点に戻す」で復元できます。</p>
            <div className="inline-row wrap">
              <button type="button" className="btn btn-subtle" onClick={saveManualRevision} disabled={!canEditSelectedProject}><span className="btn-icon"><UiIcon name="save" /></span>現在内容を履歴保存</button>
            </div>
            <label className="field">
              <span>復元する履歴</span>
              <select className="control" value={selectedRevisionId} onChange={(event) => setSelectedRevisionId(event.target.value)}>
                <option value="">履歴を選択</option>
                {projectRevisions.map((revision) => (
                  <option key={revision.id} value={revision.id}>
                    {new Date(revision.at).toLocaleString("ja-JP")} / {revision.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="inline-row wrap">
              <button type="button" className="btn btn-subtle" onClick={restoreRevision} disabled={!canEditSelectedProject || !selectedRevision}><span className="btn-icon"><UiIcon name="history" /></span>この時点に戻す</button>
            </div>
          </article>
          <article className="sub-panel">
            <h4>変更履歴（監査ログ）</h4>
            <div className="table-wrap">
              <table className="schedule-table">
                <thead>
                  <tr><th>日時</th><th>操作</th><th>詳細</th></tr>
                </thead>
                <tbody>
                  {userScopedProjectAuditLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{new Date(log.at).toLocaleString("ja-JP")}</td>
                      <td>{formatAuditAction(log.action)}</td>
                      <td>{formatAuditDetailForNonAdmin(log)}</td>
                    </tr>
                  ))}
                  {!userScopedProjectAuditLogs.length ? (
                    <tr><td colSpan={3}>履歴はまだありません</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </article>
          <article className="sub-panel">
            <h4>全案件の変更履歴</h4>
            <p className="mini">ログイン中ユーザー本人の全案件履歴を直近30件で表示します。</p>
            <div className="table-wrap">
              <table className="schedule-table">
                <thead>
                  <tr><th>日時</th><th>案件ID</th><th>操作</th><th>詳細</th></tr>
                </thead>
                <tbody>
                  {userScopedGlobalAuditLogs.map((log) => (
                    <tr key={`global_${log.id}`}>
                      <td>{new Date(log.at).toLocaleString("ja-JP")}</td>
                      <td>{log.projectId}</td>
                      <td>{formatAuditAction(log.action)}</td>
                      <td>{formatAuditDetailForNonAdmin(log)}</td>
                    </tr>
                  ))}
                  {!userScopedGlobalAuditLogs.length ? (
                    <tr><td colSpan={4}>履歴はまだありません</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      ) : null}
    </>
  );
}
