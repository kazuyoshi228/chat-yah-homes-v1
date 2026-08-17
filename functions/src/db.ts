/**
 * Firestore DB ハンドル（named DB 分離）
 *
 * - chatDb: chat 専用 named DB「chat」。chat の全読み書きはこちら。
 *
 * 🚨 yah-homes 本体の (default) DB へのハンドルは持たない（依存ゼロ設計）。
 *    予約データ連携を将来入れる場合も、必ず read-only ハンドルとして追加し、
 *    書き込み・削除・ルール変更は絶対にしない。
 */
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

if (!admin.apps.length) admin.initializeApp();

/** chat named DB の database ID（トリガーの database オプションにも使用） */
export const CHAT_DATABASE_ID = "chat";

/** chat 専用 DB（read/write） */
export const chatDb = getFirestore(CHAT_DATABASE_ID);
