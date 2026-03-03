# sekou-manual-editor

## 概要
施工計画書自動作成ツール。Next.jsベースのWebアプリ。

## 主な機能
- 施工計画書作成
- データ保存（localStorage）
- データエクスポート/インポート（JSONバックアップ）

## 技術スタック
- Next.js
- React
- TypeScript

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
