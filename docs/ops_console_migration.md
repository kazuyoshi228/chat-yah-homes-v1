# 運用手順書 — named DB「chat」移行＋デプロイ（ユーザー実施）

🚨 本手順は**本番プロジェクト `yah-mobile-v1-3ed24` に反映される操作**のため、**すべてユーザーがコンソール/CLI で実施**する（AI は実行しない）。
🚨 **素の `firebase deploy` は絶対に打たない**（yah.mobi の関数を巻き込む）。使うのはスコープ付きコマンドのみ。

---

## 0. 前提

- コード側（dev ブランチ）は named DB「chat」前提に切替済み:
  - client: `getFirestore(app, "chat")`
  - Functions: 全トリガーが `database: "chat"` にバインド・書き込みは chat DB のみ
  - rules: `firestore.chat.rules` が chat DB にバインド（firebase.json）
- したがって **「chat DB の作成→データ移行」が済むまで、新コードは本番で動かない**（切替はデプロイのタイミングで発生）。

## 1. named DB「chat」を作成

GCP コンソール → Firestore → データベースを作成:
- **データベース ID: `chat`**（コードと完全一致・変更不可）
- ロケーション: `(default)` と同じ（asia-northeast1）
- モード: Native

CLI 代替: `gcloud firestore databases create --database=chat --location=asia-northeast1 --project=yah-mobile-v1-3ed24`

## 2. データ移行（copy → 照合 → 切替 → 後日削除）

`(default)` から chat DB へ **chat 自身のコレクションだけ** をコピーする:
- 対象: `chat_sessions`（＋サブ `chat_messages`）／`chat_surveys`／`chat_flow_nodes`／`chat_quick_replies`／`chat_rag_documents`／`hospitalityGuidelines`→`chat_hospitality_guidelines`（改名）／`chat_agent_logs`（あれば）
- **`plans`/`purchases`/`orders`/`users` など販売系はコピーしない**（chat は (default) を read-only 参照する設計）
- 方法: GCP の Firestore export/import（コレクション指定）か、Admin SDK の小さな copy スクリプト。**(default) への書き込みは一切しない（読むだけ）**
- 照合: 件数と代表ドキュメントの内容を chat DB 側で確認

> 💡 `chat_rag_documents` をコピーすると `onRagDocumentWritten` は「content 未変更」では発火しない。embedding フィールド（Vector）も一緒にコピーすること（export/import なら保持される）。

## 3. デプロイ（スコープ付きのみ・この順で）

```bash
# 1) ルール＋インデックス（chat DB のみ）
pnpm deploy:rules        # = firebase deploy --only firestore:chat

# 2) Functions（codebase chat のみ）
pnpm deploy:functions    # = firebase deploy --only functions:chat

# 3) Hosting（chat のサイトのみ）
pnpm deploy:hosting      # = build + firebase deploy --only hosting:chat-yah-mobi-v2
```

- Functions は codebase 名を `default`→`chat` に変えたため、**初回は「関数の移動（delete→再作成）」の確認が出ることがある**。対象が chat の4関数だけであることを確認して承認（**yah.mobi の関数が対象に含まれていたら中止**）。
- 認証切れ（invalid_rapt）が出たら `firebase login --reauth`。

## 4. 旧関数の片付け（急がない・二重発火の窓に注意）

- 順番: ①Hosting 切替で client の書き込み先が chat DB になる → ②`(default)` の chat コレクションに新規書き込みが来ないこと（＝旧トリガー休眠）を確認 → ③落ち着いてから **codebase `default` に残る旧 chat 関数だけ** をコンソールか `firebase functions:delete <関数名>` で削除。
- 🚨 **yah.mobi の関数（default codebase の残り）には絶対に触らない**。
- 旧 `(default)` 内の `chat_*` コレクションの削除も任意・後日で可（消すのは chat 自身のコレクションだけ）。

## 5. App Check（任意・推奨）

1. reCAPTCHA Enterprise の**許可ドメイン**に chat の Hosting ドメイン（`chat-yah-mobi-v2.web.app`＋カスタムドメイン）と**ウィジェットを埋め込む親サイトのドメイン**を追加。
2. Firebase コンソール → App Check → chat の Web アプリを登録（reCAPTCHA Enterprise プロバイダ・サイトキー）。
3. `.env` に `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY=<サイトキー>` を設定して再ビルド/デプロイ（未設定なら App Check は無効のまま動く）。
4. ⚠️ **enforcement（強制）の切替はプロジェクト/サービス単位で yah.mobi に影響しうる**。enforcement を触る前に、yah.mobi 側アプリが App Check トークンを送っているかを必ず確認（不明なら enforcement は OFF のまま「メトリクス観察」に留める）。

## 6. 動作確認

- `/widget-chat`: セッション作成→メッセージ送信→AI 応答が返る（chat DB に書かれている・(default) に新規書き込みが無い）。
- ログインユーザーで購入関連の質問→ 個別回答が出る（(default) read が機能）。※フィールド実キーの調整が必要な場合は `functions/src/triggers/onVisitorMessageCreated.ts` の `buildCustomerContext` を修正。
- `/admin`: Google ログイン→ KPI/チャット一覧/RAG/クイック返信/フィードバック/フローツリーが表示される。
