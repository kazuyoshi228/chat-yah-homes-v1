/**
 * dataRetentionPurge — データ保持期限に基づく自動削除
 *
 * スケジュール: 毎日 03:00 JST（UTC 18:00）
 * 処理:
 *   1. scheduledDeleteAt <= 現在時刻 のセッションを検索
 *   2. セッション配下の messages サブコレクションを一括削除
 *   3. 関連する chat_surveys ドキュメントを削除
 *   4. セッション本体を削除
 *   5. バッチ処理で効率的に削除
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { chatDb as db } from "../db";
import { REGION, RETENTION_DAYS } from "../config";

/** バッチ削除の上限（Firestore の制限: 500） */
const BATCH_SIZE = 450;

export const dataRetentionPurge = onSchedule(
  {
    schedule: "0 18 * * *", // UTC 18:00 = JST 03:00
    timeZone: "UTC",
    region: REGION,
    timeoutSeconds: 540, // 最大 9分
    memory: "512MiB",
  },
  async () => {
    const now = admin.firestore.Timestamp.now();
    let totalDeleted = 0;

    try {
      // ── 期限切れセッションを検索 ──
      const expiredSnap = await db
        .collection("chat_sessions")
        .where("scheduledDeleteAt", "<=", now)
        .limit(100) // 1回の実行で最大100セッション処理
        .get();

      if (expiredSnap.empty) {
        console.log("データ保持: 期限切れセッションなし");
        return;
      }

      console.log(`データ保持: ${expiredSnap.size} 件の期限切れセッションを検出`);

      // ── セッションごとに削除処理 ──
      for (const sessionDoc of expiredSnap.docs) {
        const sessionId = sessionDoc.id;

        try {
          // 1. messages サブコレクションを一括削除
          await deleteSubcollection(
            `chat_sessions/${sessionId}/chat_messages`
          );

          // 2. 関連する chat_surveys ドキュメントを削除
          await deleteSurveys(sessionId);

          // 3. セッション本体を削除
          await sessionDoc.ref.delete();

          totalDeleted++;
          console.log(`セッション削除完了: ${sessionId}`);
        } catch (error) {
          console.error(`セッション削除エラー (${sessionId}):`, error);
          // 個別エラーは無視して次のセッションへ
        }
      }

      console.log(`データ保持: 合計 ${totalDeleted} セッションを削除`);
    } catch (error) {
      console.error("データ保持ジョブエラー:", error);
    }

    // ── 監査ログ（chat_agent_logs）の保持期限削除 ──
    try {
      const purged = await purgeOldAgentLogs(now);
      if (purged > 0) console.log(`データ保持: chat_agent_logs ${purged} 件を削除`);
    } catch (error) {
      console.error("chat_agent_logs 保持削除エラー:", error);
    }

    // ── レート制限カウンタ（chat_rate_limits）の古いドキュメント削除（肥大防止） ──
    try {
      const purged = await purgeOldRateLimits(now);
      if (purged > 0) console.log(`データ保持: chat_rate_limits ${purged} 件を削除`);
    } catch (error) {
      console.error("chat_rate_limits 保持削除エラー:", error);
    }
  }
);

/**
 * chat_rate_limits（日次/分次カウンタ）の古いドキュメントを削除（3日より前）
 */
async function purgeOldRateLimits(
  now: admin.firestore.Timestamp
): Promise<number> {
  const cutoff = admin.firestore.Timestamp.fromMillis(
    now.toMillis() - 3 * 24 * 60 * 60 * 1000
  );
  const collRef = db.collection("chat_rate_limits");
  let deleted = 0;
  let snapshot = await collRef
    .where("updatedAt", "<=", cutoff)
    .limit(BATCH_SIZE)
    .get();

  while (!snapshot.empty) {
    const batch = db.batch();
    for (const doc of snapshot.docs) batch.delete(doc.ref);
    await batch.commit();
    deleted += snapshot.size;
    snapshot = await collRef
      .where("updatedAt", "<=", cutoff)
      .limit(BATCH_SIZE)
      .get();
  }
  return deleted;
}

/**
 * chat_agent_logs の保持期限（RETENTION_DAYS）を過ぎたログをバッチ削除
 */
async function purgeOldAgentLogs(
  now: admin.firestore.Timestamp
): Promise<number> {
  const cutoff = admin.firestore.Timestamp.fromMillis(
    now.toMillis() - RETENTION_DAYS * 24 * 60 * 60 * 1000
  );
  const collRef = db.collection("chat_agent_logs");
  let deleted = 0;
  let snapshot = await collRef
    .where("createdAt", "<=", cutoff)
    .limit(BATCH_SIZE)
    .get();

  while (!snapshot.empty) {
    const batch = db.batch();
    for (const doc of snapshot.docs) batch.delete(doc.ref);
    await batch.commit();
    deleted += snapshot.size;
    snapshot = await collRef
      .where("createdAt", "<=", cutoff)
      .limit(BATCH_SIZE)
      .get();
  }
  return deleted;
}

/**
 * サブコレクション内のドキュメントをバッチ削除
 */
async function deleteSubcollection(collectionPath: string): Promise<void> {
  const collRef = db.collection(collectionPath);

  // ページネーションで全件削除
  let query = collRef.limit(BATCH_SIZE);
  let snapshot = await query.get();

  while (!snapshot.empty) {
    const batch = db.batch();
    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();

    // 次のバッチを取得
    snapshot = await query.get();
  }
}

/**
 * セッションに関連する chat_surveys ドキュメントを削除
 */
async function deleteSurveys(sessionId: string): Promise<void> {
  const chat_surveysSnap = await db
    .collection("chat_surveys")
    .where("sessionId", "==", sessionId)
    .get();

  if (chat_surveysSnap.empty) return;

  const batch = db.batch();
  for (const doc of chat_surveysSnap.docs) {
    batch.delete(doc.ref);
  }
  await batch.commit();
}
