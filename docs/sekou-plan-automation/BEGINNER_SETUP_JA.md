# Googleスプレッドシート版 施工計画書 自動作成 手順書（初心者向け）

この手順書どおりに進めると、`Googleスプレッドシート + GAS` だけで  
「案件を選んで5分でPDF作成」まで実行できます。

## 事前に準備するもの
1. Googleアカウント
2. 施工計画書用のGoogleスプレッドシート（新規でも既存でも可）
3. この2ファイル
`/Users/adachih/Documents/New project/docs/sekou-plan-automation/gas/Code.gs`
`/Users/adachih/Documents/New project/docs/sekou-plan-automation/gas/Editor.html`

## 全体像（まず理解）
1. `案件一覧` に案件データ（Salesforce連携先）
2. `工事マスタ` に工種の定型文
3. `文章マスタ` に注意事項の定型文
4. GASサイドバーで案件を選ぶ
5. PDFを自動生成（写真は後貼りの枠のみ出力）

## Step 1. バックアップ
1. 対象スプシを開く
2. `ファイル > ダウンロード > Microsoft Excel (.xlsx)`
3. バックアップとして保存

## Step 2. Apps Script を開く
1. スプシ上部メニュー `拡張機能 > Apps Script`
2. 既存の `Code.gs` を開く

## Step 3. Code.gs を貼る
1. `Code.gs` の中身を全削除
2. 下記ファイルの中身を全部貼り付け
`/Users/adachih/Documents/New project/docs/sekou-plan-automation/gas/Code.gs`
3. 保存（Ctrl+S or Cmd+S）

## Step 4. Editor.html を作る
1. Apps Script 左の `+` ボタン > `HTML`
2. ファイル名を `Editor` にする（拡張子は自動で `.html`）
3. 下記ファイルを貼り付け
`/Users/adachih/Documents/New project/docs/sekou-plan-automation/gas/Editor.html`
4. 保存

## Step 5. 権限を許可
1. Apps Script上で `onOpen` か `setupTemplateSheets` を実行
2. Googleの権限許可画面が出たら許可
3. スプレッドシートに戻って再読み込み

## Step 6. 初期セットアップを実行
1. スプシ上部に `施工計画書` メニューが出る
2. `施工計画書 > 初期セットアップ（シート作成）` をクリック
3. ダイアログで `はい`
4. 列幅や見た目が崩れた場合は `施工計画書 > 表示整形（列幅・書式）` を実行
5. 表紙ロゴはコード内に固定表示されます（設定不要）

これで以下が自動作成されます。
1. `案件一覧`（ヘッダ + サンプル1件）
2. `工事マスタ`（6工種の初期データ）
3. `文章マスタ`（注意事項の初期データ）
4. `出力履歴`

## Step 7. 実データを入れる
1. `案件一覧` にSalesforce案件を投入
2. true/falseフラグで工種を設定
3. 必要なら `工事マスタ` / `文章マスタ` を編集

## Step 8. PDFを作る
1. `施工計画書 > エディタを開く`
2. 案件を選択
3. 特記事項や承認事項追記を必要に応じて入力
4. `プレビュー` で見た目確認
5. `PDF作成` ボタン
6. 生成されたリンクを開いてPDF確認

## Step 9. 日常運用
1. Salesforce連携で `案件一覧` を更新
2. 担当者はエディタで案件選択してPDF作成
3. `出力履歴` でトレース

## よくあるエラーと対処
1. `案件一覧シートが見つかりません`
`初期セットアップ（シート作成）` を先に実行
2. `project not found`
`案件一覧` の `project_id` が空、または重複
3. PDF作成失敗
権限不足の可能性。Apps Scriptの権限を再許可

## ここまで終わったら
1. まず1案件で本番と同じ手順でPDF出力
2. 問題なければ5案件程度で連続運用テスト
3. その後、Salesforce自動同期を本番化
