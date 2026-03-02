# Googleログイン設定手順

## 1. Google CloudでOAuthクライアントを作成
- Google Cloud Consoleでプロジェクト作成
- 「OAuth同意画面」を設定
- 「認証情報」→「OAuthクライアントID」を作成（アプリ種別: ウェブ）

## 2. 承認済みリダイレクトURIを設定
- 本番: `https://<your-domain>/api/auth/google/callback`
- ローカル: `http://localhost:3000/api/auth/google/callback`

## 3. 環境変数を設定
`.env.local` へ以下を追加します。

```bash
GOOGLE_CLIENT_ID=xxxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxxxxxxxxxxxxx
# 任意: 未指定時は現在のホストから自動算出
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

## 4. 動作確認
- ログイン画面の「Googleで続行」をクリック
- Google認証後に `/menu` に遷移できれば成功

## 備考
- 本実装は「Googleメールアドレスが既存ユーザーに登録済み」であればログインします。
- 初回ユーザーが0件の場合のみ、Googleプロフィールで初期管理者を自動作成します。
