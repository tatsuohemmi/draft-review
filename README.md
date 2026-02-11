# draft-review

Obsidian Vault 内の学術翻訳ドラフトを GitHub Pages で公開し、段落単位のコメント（→ GitHub Issue 自動生成）を実現するシステム。

## セットアップ

```bash
cd _web
npm install
```

## 使い方

### ドラフトのコピーとビルド

```bash
# Vault からドラフトをコピー
npm run copy-drafts

# 開発サーバー起動
npm run dev

# プロダクションビルド
npm run build
```

### 新規プロジェクトの追加

1. `drafts.config.json` の `projects` 配列にフォルダ名を追加:
   ```json
   {
     "projects": [
       "2026-02_tr_ÉQUITÉ",
       "2026-02_tr_DRAGONADE",
       "2026-02_tr_NEW_PROJECT"
     ]
   }
   ```

2. ドラフトに段落 ID を付与（各段落末尾に `^p0001` 形式）

3. `npm run copy-drafts` を実行

4. `npm run dev` で確認

### デプロイ

`main` ブランチに push すると GitHub Actions が自動デプロイ。

## ファイル構成

- `scripts/copy-drafts.mjs` — Vault ドラフト → Astro content collection コピー
- `scripts/slug-utils.mjs` — フォルダ名 → URL slug 変換
- `src/plugins/remark-obsidian-cleanup.mjs` — Obsidian 記法のクリーンアップ
- `src/plugins/remark-paragraph-ids.mjs` — 段落 ID の抽出と HTML 属性化
- `src/plugins/rehype-paragraph-wrapper.mjs` — コメント UI の挿入

## ワークフロー

1. Obsidian で `draft.md` を編集
2. `npm run copy-drafts` でコピー
3. コミット & push → GitHub Pages にデプロイ
4. レビュアーが段落の Comment ボタンをクリック → GitHub Issue 作成
5. Issue に基づきドラフトを修正
