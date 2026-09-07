# chat-yah-homes — yah.homes 宿泊ゲスト向け AI チャットサポート

宿泊ゲストの「宿の使い方・滞在中の困りごと」に24時間・6言語で答えるAIチャット。
客室のQRコードから **`chat.yah.homes/{施設ID}`** を開くと、その施設専用のチャットが始まる。

- 稼働中: **kiyokawa** / **takasago**（管理画面「施設」で公開ON/OFF）
- 管理画面: `chat.yah.homes/admin`（Google認証＋ @bonfire.co.jp 限定）

## 構成（BaaS-first・ミニマル）

- **フロント**: React 19 + Vite 7（SPA・静的 Hosting）
- **バックエンド**: Firebase のみ（自前サーバ/SQL なし）
  - Firestore **named DB「chat」**（会話・RAG・写真・設定）
  - Cloud Functions v2 **codebase「chat」**（AI応答／セッション要約／RAG埋め込み／サイト自動同期／会話通知／データ保持削除／写真アップロード等）
  - Firebase Auth（ゲスト=匿名／管理者=Google・ドメイン制限）
  - AI: Gemini 2.5 Flash ＋ Firestore Vector Search（RAG）
- 🚨 Firebase プロジェクト `yah-homes` は**宿泊サイト本体と共有**。
  **ガードレールは [CLAUDE.md](./CLAUDE.md) を必読**（素の `firebase deploy` 禁止・`(default)` DB は read-only 等）。

## 情報の正本（SSoT）

チャットの回答を変えたいときは**正本を編集する**（チャット側に書き写さない）。
一覧は管理画面の **SSoTマップ**（`/admin/ssot-map`）が常に最新。

| 情報 | 正本 |
|---|---|
| 施設スペック・chat用情報（Q&A） | `yah.homes/admin/properties/{施設}/#chat` |
| 規約・物件ページ・How-to・Local Guide | 各公開ページ（毎日06:00 JST に自動同期） |
| チャット用写真 | 管理画面「写真」 |
| 鍵・入室暗証番号 | `property_secrets`（🚫 チャットは読まない） |

## 開発

```bash
pnpm install          # 依存（ルート・pnpm）
pnpm dev              # vite dev server
pnpm check            # 型チェック
pnpm test:rules       # Firestore ルールのテスト（要 Java）
pnpm build            # 出力 dist/public

cd functions && npm install && npm run build   # Functions（別プロジェクト・npm）

node functions/scripts/simulate_chat.mjs       # SIM: 本番パイプラインに55ケース（要ADC）
```

## デプロイ（スコープ付きのみ・ユーザー実行）

```bash
pnpm deploy:hosting     # Hosting（chat-yah-homes）のみ
pnpm deploy:functions   # Functions（codebase chat）のみ
pnpm deploy:rules       # Firestore rules/indexes（chat DB）のみ
```

## ドキュメント

- [CLAUDE.md](./CLAUDE.md) — 開発ガイド＋ガードレール（最重要）
- [docs/PROJECT_HISTORY.md](./docs/PROJECT_HISTORY.md) — **開発経緯**（なぜそう作ったか・不具合と学び・施設の増やし方・運用・未了事項）
- [docs/spec_admin_properties_chat_fields.md](./docs/spec_admin_properties_chat_fields.md) — chat用情報セクションの仕様（本体側実装用）
- [docs/setup_phase2_console.md](./docs/setup_phase2_console.md) — Firebaseコンソール設定手順
- [docs/hearing_kiyokawa.md](./docs/hearing_kiyokawa.md) — 施設ヒアリングシート（新規施設の情報収集用）
- [docs/rag_sources/](./docs/rag_sources/) — 掲示物・問い合わせログから抽出した一次情報
