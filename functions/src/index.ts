/**
 * chat.yah.homes（宿泊施設ゲストサポート）— Cloud Functions エントリポイント（codebase: chat）
 *
 * 設計思想: シンプル・モダン・ミニマル・堅牢・安全
 * Cloud Functions: 6関数（トリガー3 ＋ スケジュール2 ＋ Callable1）
 * 外部APIキー: ゼロ / Google サービス依存: Gemini・Firestore Vector Search のみ
 * yah-homes 本体の (default) DB には一切アクセスしない（依存ゼロ）。
 */

import * as admin from "firebase-admin";
admin.initializeApp();

// ── Firestore トリガー (3関数) ──
export { onVisitorMessageCreated } from "./triggers/onVisitorMessageCreated";
export { onSessionEnded } from "./triggers/onSessionEnded";
export { onRagDocumentWritten } from "./triggers/onRagDocumentWritten";

// ── Scheduled 関数 (3関数) ──
export { dataRetentionPurge } from "./scheduled/dataRetention";
export { generateRagDrafts } from "./scheduled/generateRagDrafts";
export { syncSiteSources } from "./scheduled/syncSiteSources"; // 公開サイト→RAG自動同期（SSoT）

// ── Callable 関数 (3関数) ──
export { claimSession } from "./callables/claimSession";
export { uploadChatPhoto, deleteChatPhoto } from "./callables/chatPhotos"; // 管理者限定・チャット用写真
