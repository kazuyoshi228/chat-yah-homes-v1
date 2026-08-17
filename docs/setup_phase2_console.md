# Phase 2 チェックリスト — yah-homes コンソール設定（ユーザー作業）

所要 1〜2時間＋DNS/SSL待ち。すべて Firebase/GCP コンソール（プロジェクト **yah-homes**）での作業です。
完了したら各項目の結果（スクショや「done」）を貼ってください。次の Phase 3（デプロイ＆seed）に進みます。

## 1. Blaze プラン確認（必須）
- Firebase Console → ⚙️ 使用量と請求 → 「Blaze（従量制）」になっているか。
- Spark のままなら Blaze にアップグレード（Functions/Vertex AI に必須）。

## 2. Vertex AI API 有効化（必須）
- https://console.cloud.google.com/apis/library/aiplatform.googleapis.com?project=yah-homes
- 「有効にする」を押すだけ。

## 3. Firestore「chat」named DB 作成（必須）
- https://console.cloud.google.com/firestore/databases?project=yah-homes
- 「データベースを作成」→ データベースID: **chat** ／ ロケーション: **asia-northeast1（東京）** ／ Native モード。
- ※ 既存の (default) はそのまま。触りません。

## 4. Authentication プロバイダ有効化（必須）
- Firebase Console → Authentication → Sign-in method で以下を有効化:
  - **匿名**（訪問者用。🚨以後、無効化厳禁）
  - **Google**（管理者ログイン＋将来のゲストログイン）
  - **メール/パスワード**（将来のゲストログイン）

## 5. ウェブアプリ登録（必須）
- Firebase Console → ⚙️ プロジェクトの設定 → 全般 → 「アプリを追加」→ ウェブ（</>）
- ニックネーム例: `chat-yah-homes`（Hosting のセットアップはスキップでOK）
- 表示された `firebaseConfig` の **apiKey / messagingSenderId / appId** をこちらに貼ってください（公開値なのでチャットに貼ってOK）。→ 私が `.env` を作成します。

## 6. Hosting サイト追加 + カスタムドメイン（必須）
- Firebase Console → Hosting → 「別のサイトを追加」→ サイトID: **chat-yah-homes**
- 追加したサイトの「カスタムドメインを接続」→ `chat.yah.homes`
- 表示される DNS レコード（CNAME または A）を、yah.homes のDNS管理画面に追加。
- SSL証明書の発行完了（ステータス「接続済み」）まで数時間〜1日かかることがあります。

## 7. reCAPTCHA Enterprise + App Check（推奨・初回は後回しでも可）
- https://console.cloud.google.com/security/recaptcha?project=yah-homes
- 「キーを作成」→ ウェブサイト型 ／ ドメイン: `chat.yah.homes`（＋確認用に `chat-yah-homes.web.app`）
- 発行された**サイトキー**（公開値）をこちらに貼ってください → `.env` に設定します。
- Firebase Console → App Check → アプリ登録（enforcement は最初は「監視」のまま。締めるのは運用が安定してから）。

## 8. 予算アラート（推奨）
- https://console.cloud.google.com/billing → 予算とアラート → 例: 月 ¥5,000 で 50/90/100% 通知。

---

## Phase 3 の予告（上記完了後・デプロイはあなたが実行）

```
cd ~/Downloads/chat-yah-homes-v1
pnpm deploy:rules       # ルール＋インデックス（ベクトルインデックス含む）
pnpm deploy:functions   # Functions（codebase: chat のみ）
pnpm deploy:hosting     # Hosting（chat-yah-homes サイトのみ）
```

seed（施設マスタ・フローツリー・ホスピタリティ）は私がドライラン→あなたの承認→書き込みの順で実行します。
