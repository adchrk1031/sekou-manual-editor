# 施工計画書 自動作成セットアップ

## 1. 先に共有したい前提
- この環境からあなたの Google スプレッドシート URL を直接開いて編集・XLSX 出力はできません。
- ただし、以下をそのまま使えば、あなたの環境で同じ構成をすぐ作れます。

## 2. XLSX 出力手順（Google スプレッドシート側）
1. 対象スプレッドシートを開く
2. `ファイル` -> `ダウンロード` -> `Microsoft Excel (.xlsx)`
3. 保存した `.xlsx` をバックアップとして保管

## 3. シート構成（最小）
- `案件一覧` (Salesforce 連携の主データ)
- `工事マスタ` (工事項目ごとの説明文・テンプレ)
- `文章マスタ` (注意事項など固定文言)
- `体制マスタ` (連絡体制・体制表用)
- `出力履歴` (いつ誰が PDF を作成したか)

## 4. 列設計
- 詳細は `docs/sekou-plan-automation/column-design.md` を参照

## 5. GAS 実装ファイル
- `docs/sekou-plan-automation/gas/Code.gs`
- `docs/sekou-plan-automation/gas/Editor.html`

## 6. 導入手順
1. スプシで `拡張機能` -> `Apps Script` を開く
2. `Code.gs` の中身を `docs/sekou-plan-automation/gas/Code.gs` で置換
3. `Editor.html` を新規作成して `docs/sekou-plan-automation/gas/Editor.html` を貼り付け
4. GAS を保存して再読み込み
5. スプシメニューに `施工計画書` が出るので `初期セットアップ（シート作成）` を先に実行
6. 続けて `エディタを開く` を実行
7. 見た目調整は `表示整形（列幅・書式）` を実行
8. 表紙ロゴはコード内に固定表示（設定不要）

## 6.1 初心者向けガイド
- `docs/sekou-plan-automation/BEGINNER_SETUP_JA.md`

## 7. できること
- 案件選択
- 工事項目の自動判定 + 手動追加
- 特記事項入力
- 写真プレースホルダ付き PDF 作成
- PDF は Drive に保存し、URL を返却
