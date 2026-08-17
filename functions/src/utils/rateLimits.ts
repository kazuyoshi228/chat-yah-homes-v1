/**
 * rateLimits — AIコスト保護のレート制限（Firestore カウンタ・トランザクション加算）
 *
 * - バースト: 1分あたり AI_RATE_LIMIT_PER_MINUTE 回まで（連投・濫用の抑制）
 * - 日次:     1日あたり DAILY_AI_LIMIT_PER_VISITOR 回まで
 * カウンタは chat DB の chat_rate_limits（client からは default deny・Fn のみが書く）。
 * 古いカウンタは dataRetentionPurge が3日で掃除する。
 */
import * as admin from "firebase-admin";
import { chatDb } from "../db";
import {
  DAILY_AI_LIMIT_PER_VISITOR,
  AI_RATE_LIMIT_PER_MINUTE,
} from "../config";

/** カウンタを+1し、上限内なら true を返す共通トランザクション */
async function incrementWithinLimit(
  docId: string,
  limit: number
): Promise<boolean> {
  const ref = chatDb.doc(`chat_rate_limits/${docId}`);
  return chatDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = (snap.exists ? (snap.data()?.count as number) : 0) || 0;
    if (count >= limit) return false;
    tx.set(
      ref,
      {
        count: count + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  });
}

/** バースト制限 — chat_rate_limits/{visitorId}_min_{yyyymmddHHMM} */
export async function checkBurstRateLimit(visitorId: string): Promise<boolean> {
  const minuteKey = new Date()
    .toISOString()
    .slice(0, 16)
    .replace(/[-:T]/g, ""); // yyyymmddHHMM
  return incrementWithinLimit(
    `${visitorId}_min_${minuteKey}`,
    AI_RATE_LIMIT_PER_MINUTE
  );
}

/** 日次レート制限 — chat_rate_limits/{visitorId}_{yyyymmdd} */
export async function checkDailyRateLimit(visitorId: string): Promise<boolean> {
  const dateKey = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return incrementWithinLimit(
    `${visitorId}_${dateKey}`,
    DAILY_AI_LIMIT_PER_VISITOR
  );
}
