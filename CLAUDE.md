# CLAUDE.md — chat.yah.homes 開発ガイド（AI/開発者向け）

yah.homes（宿泊施設ブランド）の宿泊者向けAIチャットサポート。**施設別の単独ページ**（`chat.yah.homes/{facilityId}`・QRコード起点）として提供。フロント React 19 + Vite、バックエンド Firebase（Cloud Functions v2 / Firestore named DB / Auth / Hosting）＋ Gemini 2.5 Flash（Vertex AI）。GitHub: `kazuyoshi228/chat-yah-homes-v1`。

## 🚨 最重要ガードレール

1. **Firebase プロジェクト `yah-homes` は yah.homes 本体と共有。** chat が使ってよいのは:
   - Firestore **named DB「chat」**（read/write）。
   - **(default) DB は read-only**。参照してよいのは **`property_facts` のみ**（= admin/properties の施設事実正本。utils/propertyFacts がライブ注入）。**`property_secrets`（鍵ボックス暗証番号）は絶対に読まない**。write/delete/ルール変更は一切しない。
   - Functions は **codebase「chat」のみ**。本体側の関数・ルール・Hosting 既存サイト（yah-homes）には一切触れない。
2. **素の `firebase deploy` は禁止**（`npm run deploy` はエラーで止まる）。必ずスコープ付き:
   - Functions: `pnpm deploy:functions`（= `--only functions:chat`）
   - ルール/インデックス: `pnpm deploy:rules`（= `--only firestore:chat`）
   - Hosting: `pnpm deploy:hosting`（= `--only hosting:chat-yah-homes`）
3. **本番デプロイはユーザーの明示指示があるときのみ**。AIは自発的にデプロイしない。
4. **匿名認証は chat が使用中＝プロジェクト設定で無効化厳禁**（訪問者の書込認可の土台）。
5. **コード実装前に設計図（`docs/design_*.md`）を作成しユーザー承認を得る**（小さな修正は簡潔で可。手順省略は不可）。
6. シークレットは扱わない・貼らない・コミットしない。`.env` は gitignore（Firebase クライアント設定値は公開値なので可）。

## アーキテクチャ

- **施設分離（マルチテナント lite）**: すべて `facilityId` で分離。スラッグをコードにハードコードしない（施設判定・案内画面・RAG検索は `chat_facilities` マスタ駆動）。**施設追加＝①マスタ登録 ②施設RAG投入 ③QR発行のみ（コード変更・再デプロイ不要）**。
  - 施設: `kiyokawa` / `takasago` / `ropponmatsu` / `ootemon-a` / `ootemon-b`（初期公開は kiyokawa のみ）＋共通文書用 `common`
- **AI応答フロー**（`functions/src/triggers/onVisitorMessageCreated.ts`）: レート制限 → ホスピタリティ基準 → RAG検索（**当該施設＋common のみ**＝混線防止・要複合ベクトルインデックス） → 施設マスタ注入（`utils/facilityContext`・5分キャッシュ） → Gemini 構造化出力 → 保存 → 監査ログ → エスカレーション判定。
- **プロンプトの正本は `functions/src/utils/prompt.ts`**。変更したら SIM で回帰確認。重要ルール:
  - 施設の基本情報は【施設情報】ブロック（facilityContext）のみが正。創作禁止。
  - **エスカレーション＝予約経路（Booking.com/Airbnb/公式）を1問確認 → 経路別窓口へ誘導**（窓口はマスタの contacts）。緊急時は 119/110 を最優先。
  - **暗証番号・鍵の詳細・Wi-Fiパスワードは本人確認不可のため絶対に回答しない**（RAGにも載せない）。
- **RAG文書は必ず `facilityId` を持つ**（`"common"` = 全施設共通）。L1自動ドラフトは `facilityId:"common"`・`isActive:false` で投入され、管理画面で承認。

## ビルド / 検証 / 環境

- Node 22（`~/node22/bin`）。ルートは pnpm（`pnpm@9.15.9` 固定）、`functions/` は独立 npm プロジェクト。
- 型チェック: `npx tsc --noEmit`（ルート）/ `npm run build`（functions・tsc）
- テスト: `pnpm test`（クライアント）/ `pnpm test:rules`（Rules・要 Java `~/jdk21`）
- SIM（本番パイプライン検証）: `node functions/scripts/simulate_chat.mjs`（要ADC。`--write` 系はなし・自動クリーンアップ）
- ADC 再認証: `~/google-cloud-sdk/bin/gcloud auth application-default login`
- コミットは日本語＋種別プレフィックス、末尾に `Co-Authored-By: Claude ...`。ブランチは `dev`（main へは本番リリース時のみマージ）。

## URL / デプロイ先

| URL | 用途 |
|---|---|
| `chat.yah.homes/{facilityId}` | 宿泊者チャット（QR・メール・OTAメッセージ記載。`?lang=en` 併用可） |
| `chat.yah.homes/` | 施設案内（フォールバック） |
| `chat.yah.homes/admin` | 管理画面（Google ログイン＋ @bonfire.co.jp 限定） |

Hosting サイト: `chat-yah-homes`。reCAPTCHA Enterprise / App Check の許可ドメインは chat.yah.homes。
