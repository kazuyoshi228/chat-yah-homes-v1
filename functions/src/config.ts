/**
 * 環境変数・定数定義
 *
 * 外部APIキー: ゼロ。
 * 全て GCP プロジェクト内のサービスアカウント認証。
 */

/** Gemini モデル設定 */
export const GEMINI_MODEL = "gemini-2.5-flash";
export const GEMINI_EMBEDDING_MODEL = "text-embedding-004";
export const EMBEDDING_DIMENSION = 768;

/** RAG 設定 */
export const RAG_TOP_K = 5; // Vector Search で取得する上位件数
export const RAG_DISTANCE_THRESHOLD = 0.3; // 類似度閾値

/** チャット制限 */
export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_MESSAGES_PER_SESSION = 100;

/** AI コスト保護: 訪問者ごとの 1 日あたり AI 応答上限（Firestore カウンタ） */
export const DAILY_AI_LIMIT_PER_VISITOR = 50;

/** AI コスト保護: 訪問者ごとの 1 分あたり AI 応答上限（連投抑制） */
export const AI_RATE_LIMIT_PER_MINUTE = 6;

/** データ保持期限 */
export const RETENTION_DAYS = 365 * 2; // 2年
// ※ メール通知（ADMIN_EMAIL / APPROVAL_EMAIL / ADMIN_BASE_URL）と
//   Google Sheets 連携（SHEETS_JOURNAL_ID）は廃止。
//   エスカレーション＝CONTACTフォーム誘導、L1承認待ち＝管理画面バッジ、
//   セッション要約＝session.summary（管理画面で閲覧）で代替。

/** Firebase リージョン */
export const REGION = "asia-northeast1"; // 東京

/** Vertex AI 設定（ADC＝サービスアカウント認証・外部APIキー不要） */
export const GCP_PROJECT_ID =
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  "yah-homes";
export const VERTEX_LOCATION = "asia-northeast1"; // 東京（データ residency）
