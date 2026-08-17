# chat-yah-mobi — yah.mobi AI チャットサポート

yah.mobi（日本旅行者向け eSIM 販売サイト）の **AI チャットサポート**。
埋め込みウィジェット（`/widget-chat`）と管理画面（`/admin/*`）を提供する。

## 構成（BaaS-first・ミニマル）

- **フロント**: React 19 + Vite 7（SPA・静的 Hosting）
- **バックエンド**: Firebase のみ（自前サーバ/SQL なし）
  - Firestore **named DB「chat」**（チャットデータ）
  - Cloud Functions v2 **codebase「chat」**（4関数: AI応答 / セッション要約 / RAG埋め込み / データ保持削除）
  - Firebase Auth（訪問者=匿名／管理者=Google・ドメイン制限）
  - AI: Gemini 2.5 Flash ＋ Firestore Vector Search（RAG）
- 🚨 Firebase プロジェクトは販売サイト yah.mobi と**共有**。**ガードレールは [CLAUDE.md](./CLAUDE.md) を必読**（素の `firebase deploy` 禁止・(default) DB は read-only 等）。

## 開発

```bash
pnpm install          # 依存（ルート・pnpm）
pnpm dev              # vite dev server
pnpm check            # 型チェック
pnpm test             # vitest
pnpm build            # 出力 dist/public

cd functions && npm install && npm run build   # Functions（別プロジェクト・npm）
```

## デプロイ（スコープ付きのみ・ユーザー実行）

```bash
pnpm deploy:hosting     # Hosting（chat-yah-mobi-v2）のみ
pnpm deploy:functions   # Functions（codebase chat）のみ
pnpm deploy:rules       # Firestore rules/indexes（chat DB）のみ
```

## ドキュメント

- [CLAUDE.md](./CLAUDE.md) — 開発ガイド＋ガードレール（最重要）
- [docs/design_baas-first-minimal.md](./docs/design_baas-first-minimal.md) — 設計レポート（アーキテクチャ・遷移図・決定事項）
- [docs/ops_console_migration.md](./docs/ops_console_migration.md) — named DB 移行＋デプロイの運用手順（ユーザー実施）
