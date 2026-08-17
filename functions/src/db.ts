/**
 * Firestore DB ハンドル（named DB 分離）
 *
 * - chatDb    : chat 専用 named DB「chat」。chat の全読み書きはこちら。
 * - defaultDb : yah-homes 本体 (default) DB。🚨 read-only。
 *               参照してよいのは property_facts のみ（施設事実の正本＝admin/properties）。
 *               property_secrets（鍵ボックス暗証番号）は絶対に読まない。
 *               書き込み・削除・ルール変更は絶対にしない（本体保護）。
 */
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

if (!admin.apps.length) admin.initializeApp();

/** chat named DB の database ID（トリガーの database オプションにも使用） */
export const CHAT_DATABASE_ID = "chat";

/** chat 専用 DB（read/write） */
export const chatDb = getFirestore(CHAT_DATABASE_ID);

/** yah-homes 本体 (default) DB — read-only。property_facts の参照のみ */
export const defaultDb = getFirestore();
