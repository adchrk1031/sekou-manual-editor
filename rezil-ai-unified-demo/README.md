# レジル業務改善デモ（社長説明用モック）

ツール乱立による業務分断と、AI＋自社開発ツールによる一元管理の必要性を説明するためのローカルデモサイトです。

## 技術構成

- Next.js（App Router）
- TypeScript
- Tailwind CSS

## 画面一覧

- `/` トップ導線ページ（プレゼン開始リンク）
- `/presentation` プレゼン本体（全11スライド）
- `/progress` 補足の進捗管理画面

## 起動手順

```bash
cd "/Users/adachih/Documents/New project/rezil-ai-unified-demo"
npm install
npm run dev
```

ブラウザで以下を開いてください。

- [http://localhost:4310](http://localhost:4310)
- [http://localhost:4310/presentation](http://localhost:4310/presentation)

## すぐ見せる用（ワンクリック起動）

- Finder から [Start_Presentation.command](/Users/adachih/Documents/New project/rezil-ai-unified-demo/Start_Presentation.command) をダブルクリック  
- サーバーが停止していても自動起動し、`/presentation` を開きます
- 停止したい場合は [Stop_Presentation.command](/Users/adachih/Documents/New project/rezil-ai-unified-demo/Stop_Presentation.command) を実行

CLIから実行する場合:

```bash
npm run open:presentation
npm run stop:presentation
```

## プレゼン操作方法（/presentation）

- 右下の `戻る` / `次へ` ボタンでスライド移動
- キーボードの `←` / `→` キーでも移動
- 右上に現在スライド番号を表示（例: `1 / 11`）

## 補足

- API / DB / 認証は未使用（説明用モック）
- データは `data/demoData.ts` のダミーデータを利用
