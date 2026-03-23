# ReziI AI事業部 資料サイト

丹治さん（CEO）向けの `AI事業部` 説明資料を、既存案件と分離して配置したローカル閲覧用プロジェクトです。

## 非競合運用ルール

- この資料は専用フォルダで管理: `rezil-ai-division-brief/`
- 依存パッケージなし（既存の `package.json` に影響なし）
- 固定ポート: `4280`（既存の `3000` 系と競合回避）

## 起動方法

```bash
cd "/Users/adachih/Documents/New project/rezil-ai-division-brief"
python3 -m http.server 4280
```

ブラウザで [http://localhost:4280](http://localhost:4280) を開いてください。
