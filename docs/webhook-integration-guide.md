# yah.mobi/app → yah-chat Webhook 連携指示書

**バージョン**: 1.0.0  
**作成日**: 2026-06-27  
**対象**: yah.mobi/app 開発チーム

---

## 概要

yah.mobile チャットサポートシステム（yah-chat）は、yah.mobi/app の独自DBをSSOT（Single Source of Truth）として、以下のデータをWebhookで受信します。

| データ種別 | 用途 |
|-----------|------|
| 自社プラン一覧 | AIチャットの料金案内・プラン推薦に使用 |
| 競合他社プラン | 管理画面での価格比較に使用 |
| 顧客プロファイル | AIチャットの顧客識別・パーソナライズに使用 |
| 購入履歴 | クレーム対応・返金判断の高速化に使用 |
| eSIM状態 | 接続トラブル対応の精度向上に使用 |

---

## 認証

全エンドポイントに以下のヘッダーを必ず付与してください。

```
X-Webhook-Secret: {WEBHOOK_SECRET値}
```

> **注意**: WEBHOOK_SECRET の実際の値は yah-chat 管理者から別途お伝えします。環境変数として管理し、コードに直接記載しないでください。

---

## エンドポイント一覧

| エンドポイント | メソッド | 用途 |
|--------------|---------|------|
| `/api/webhooks/plans-updated` | POST | 自社プラン一括同期 |
| `/api/webhooks/competitor-plans-updated` | POST | 競合プラン一括同期 |
| `/api/webhooks/customer-profile` | POST | 顧客プロファイル作成・更新 |
| `/api/webhooks/purchase-created` | POST | 購入履歴の作成・更新 |
| `/api/webhooks/esim-status` | POST | eSIM状態の更新 |
| `/api/webhooks/health` | GET | 疎通確認 |

**ベースURL（本番）**: `https://chat.yah.mobi`  
**ベースURL（開発）**: `https://yahchatapp-wagyp22n.manus.space`

---

## 各エンドポイントの詳細

### 1. 自社プラン一括同期

**エンドポイント**: `POST /api/webhooks/plans-updated`

プランの追加・変更・廃止があった際に送信してください。受信側は全プランを**上書き同期**します（`externalId`をキーにUPSERT）。

```json
{
  "plans": [
    {
      "externalId": "plan_light_v2",
      "name": "Light",
      "dataGb": 3,
      "durationDays": 7,
      "priceYen": 1078,
      "bestFor": "3〜5日の短期旅行、地図・メッセージ程度の軽い利用",
      "isActive": true,
      "sortOrder": 1
    },
    {
      "externalId": "plan_standard_v2",
      "name": "Standard",
      "dataGb": 5,
      "durationDays": 15,
      "priceYen": 1848,
      "bestFor": "1〜2週間の旅行、SNS・動画視聴も含む中程度の利用",
      "isActive": true,
      "sortOrder": 2
    },
    {
      "externalId": "plan_value_v2",
      "name": "Value",
      "dataGb": 10,
      "durationDays": 30,
      "priceYen": 3278,
      "bestFor": "2〜4週間の旅行、SNS・ビデオ通話を含む通常利用",
      "isActive": true,
      "sortOrder": 3
    },
    {
      "externalId": "plan_premium_v2",
      "name": "Premium",
      "dataGb": 20,
      "durationDays": 30,
      "priceYen": 5478,
      "bestFor": "動画ストリーミング・リモートワーク等のヘビー利用",
      "isActive": true,
      "sortOrder": 4
    },
    {
      "externalId": "plan_ultra_v2",
      "name": "Ultra",
      "dataGb": 50,
      "durationDays": 30,
      "priceYen": 11000,
      "bestFor": "パワーユーザー・テザリングで複数端末利用",
      "isActive": true,
      "sortOrder": 5
    },
    {
      "externalId": "plan_unlimited_v2",
      "name": "Unlimited",
      "dataGb": 999,
      "durationDays": 30,
      "priceYen": 16500,
      "bestFor": "データ容量を気にせず使いたいビジネス渡航者",
      "isActive": true,
      "sortOrder": 6
    }
  ]
}
```

**フィールド定義**:

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| `externalId` | string | ✅ | yah.mobi/app側のプランID（UPSERTキー） |
| `name` | string | ✅ | プラン表示名 |
| `dataGb` | number | ✅ | データ容量（GB）。無制限の場合は `999` |
| `durationDays` | number | ✅ | 有効期間（日数） |
| `priceYen` | number | ✅ | 税込価格（円） |
| `bestFor` | string | - | おすすめ用途の説明（AIが推薦時に使用） |
| `isActive` | boolean | ✅ | `false`にすると非表示・AI推薦から除外 |
| `sortOrder` | number | - | 表示順（小さいほど上位） |

---

### 2. 競合他社プラン一括同期

**エンドポイント**: `POST /api/webhooks/competitor-plans-updated`

```json
{
  "plans": [
    {
      "externalId": "competitor_airalo_jp_1gb_7d",
      "competitorName": "Airalo",
      "planName": "Japan 1GB 7days",
      "dataGb": 1,
      "durationDays": 7,
      "priceYen": 800,
      "sourceUrl": "https://www.airalo.com/japan-esim"
    },
    {
      "externalId": "competitor_ubigi_jp_3gb_30d",
      "competitorName": "Ubigi",
      "planName": "Japan 3GB 30days",
      "dataGb": 3,
      "durationDays": 30,
      "priceYen": 2200,
      "sourceUrl": "https://www.ubigi.com/plans"
    }
  ]
}
```

**フィールド定義**:

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| `externalId` | string | ✅ | UPSERTキー（一意のID） |
| `competitorName` | string | ✅ | 競合他社名 |
| `planName` | string | ✅ | プラン名 |
| `dataGb` | number | ✅ | データ容量（GB） |
| `durationDays` | number | ✅ | 有効期間（日数） |
| `priceYen` | number | ✅ | 税込価格（円） |
| `sourceUrl` | string | - | 参照URL |

---

### 3. 顧客プロファイル作成・更新

**エンドポイント**: `POST /api/webhooks/customer-profile`

ユーザーが新規登録またはプロファイルを更新した際に送信してください。

```json
{
  "externalUserId": "usr_abc123",
  "email": "tanaka@example.com",
  "name": "田中 太郎",
  "language": "ja",
  "registeredAt": "2026-01-15T09:00:00Z"
}
```

**フィールド定義**:

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| `externalUserId` | string | ✅ | yah.mobi/app側のユーザーID（UPSERTキー） |
| `email` | string | - | メールアドレス（AIチャットとの紐付けに使用） |
| `name` | string | - | 表示名 |
| `language` | string | - | 言語コード（`ja`/`en`/`zh`/`ko`/`th`/`vi`） |
| `registeredAt` | string | - | 登録日時（ISO 8601形式） |

> **重要**: `email` フィールドが、AIチャットでの顧客識別キーになります。チャット開始時にユーザーがGoogleログインした場合、そのメールアドレスで顧客プロファイルを照合し、購入履歴・eSIM状態をAIに自動注入します。

---

### 4. 購入履歴の作成・更新

**エンドポイント**: `POST /api/webhooks/purchase-created`

購入完了・ステータス変更（返金・キャンセル等）の際に送信してください。

```json
{
  "externalOrderId": "order_xyz789",
  "externalUserId": "usr_abc123",
  "planName": "Standard",
  "dataGb": 5,
  "durationDays": 15,
  "priceYen": 1848,
  "status": "active",
  "purchasedAt": "2026-06-20T14:30:00Z",
  "expiresAt": "2026-07-05T14:30:00Z"
}
```

**フィールド定義**:

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| `externalOrderId` | string | ✅ | 注文ID（UPSERTキー） |
| `externalUserId` | string | ✅ | ユーザーID（customer_profilesと紐付け） |
| `planName` | string | ✅ | 購入プラン名 |
| `dataGb` | number | - | データ容量（GB） |
| `durationDays` | number | - | 有効期間（日数） |
| `priceYen` | number | ✅ | 決済金額（円） |
| `status` | string | ✅ | `pending`/`active`/`expired`/`refunded`/`cancelled` |
| `purchasedAt` | string | ✅ | 購入日時（ISO 8601形式） |
| `expiresAt` | string | - | 有効期限（ISO 8601形式） |

---

### 5. eSIM状態の更新

**エンドポイント**: `POST /api/webhooks/esim-status`

eSIMのインストール状態・データ使用量が変化した際に送信してください。

```json
{
  "externalOrderId": "order_xyz789",
  "externalUserId": "usr_abc123",
  "iccid": "89860000000000000001",
  "status": "active",
  "activatedAt": "2026-06-21T08:00:00Z",
  "expiresAt": "2026-07-05T14:30:00Z",
  "dataUsedMb": 1024,
  "dataTotalMb": 5120
}
```

**フィールド定義**:

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| `externalOrderId` | string | ✅ | 注文ID（UPSERTキー） |
| `externalUserId` | string | ✅ | ユーザーID |
| `iccid` | string | - | ICCID番号 |
| `status` | string | ✅ | `not_installed`/`installed`/`active`/`expired`/`error` |
| `activatedAt` | string | - | アクティベート日時（ISO 8601形式） |
| `expiresAt` | string | - | 有効期限（ISO 8601形式） |
| `dataUsedMb` | number | - | 使用済みデータ量（MB） |
| `dataTotalMb` | number | - | 合計データ量（MB） |

---

### 6. 疎通確認

**エンドポイント**: `GET /api/webhooks/health`

認証ヘッダー不要。HTTP 200が返れば正常です。

```bash
curl https://chat.yah.mobi/api/webhooks/health
# → {"ok":true,"timestamp":"2026-06-27T00:00:00.000Z"}
```

---

## レスポンス仕様

全エンドポイント共通のレスポンス形式です。

**成功時（HTTP 200）**:
```json
{
  "ok": true,
  "upserted": 6,
  "timestamp": "2026-06-27T00:00:00.000Z"
}
```

**認証エラー（HTTP 401）**:
```json
{
  "error": "Unauthorized"
}
```

**バリデーションエラー（HTTP 400）**:
```json
{
  "error": "Invalid payload",
  "details": "plans must be a non-empty array"
}
```

**サーバーエラー（HTTP 500）**:
```json
{
  "error": "Internal server error"
}
```

---

## 送信タイミングの推奨

| イベント | 推奨タイミング |
|---------|--------------|
| プラン変更 | 価格・内容変更時に即時送信 |
| 競合価格更新 | 週次バッチ処理での一括送信 |
| 顧客登録 | 新規登録完了後に即時送信 |
| 顧客情報変更 | メール・名前・言語変更時に即時送信 |
| 購入完了 | 決済確認後に即時送信 |
| 返金・キャンセル | ステータス変更後に即時送信 |
| eSIMインストール | インストール確認後に即時送信 |
| データ使用量更新 | 1時間ごとのバッチ処理での送信（推奨） |

---

## 将来のFirebase移行について

Webhookの送信先URLを変更するだけで移行できます。

```
# 現在（Manus）
https://chat.yah.mobi/api/webhooks/

# Firebase移行後（例）
https://us-central1-yah-mobile.cloudfunctions.net/webhooks/
```

ペイロード形式・認証方式は変更不要です。

---

## サンプルコード（Node.js）

```javascript
const WEBHOOK_BASE = "https://chat.yah.mobi";
const WEBHOOK_SECRET = process.env.YAH_CHAT_WEBHOOK_SECRET;

async function sendWebhook(endpoint, payload) {
  const res = await fetch(`${WEBHOOK_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Webhook-Secret": WEBHOOK_SECRET,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Webhook failed: ${res.status} ${JSON.stringify(err)}`);
  }
  return res.json();
}

// 例: 購入完了時
await sendWebhook("/api/webhooks/purchase-created", {
  externalOrderId: "order_xyz789",
  externalUserId: "usr_abc123",
  planName: "Standard",
  priceYen: 1848,
  status: "active",
  purchasedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
});
```

---

## お問い合わせ

Webhook連携に関するご質問は、yah-chat 管理者（Yoshi）までご連絡ください。
