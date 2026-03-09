# レジル業務改善デモ（社長説明用モック）

ツール乱立による業務分断と、AI＋自社開発ツールによる一元管理の必要性を説明するためのローカルデモサイトです。

## 技術構成

- Next.js（App Router）
- TypeScript
- Tailwind CSS

## 画面一覧

- `/` トップ画面（現状課題と改善後の対比）
- `/progress` 進捗管理画面（3案件の可視化）
- `/assistant` AI業務アシスタント画面（ボタン押下でダミー結果表示）

## 起動手順

```bash
cd "/Users/adachih/Documents/New project/rezil-ai-unified-demo"
npm install
npm run dev
```

ブラウザで以下を開いてください。

- [http://localhost:4310](http://localhost:4310)

## 補足

- API / DB / 認証は未使用（説明用モック）
- データは `data/demoData.ts` のダミーデータを利用
