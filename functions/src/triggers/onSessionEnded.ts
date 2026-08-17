/**
 * onSessionEnded — セッション終了時のサマリー生成
 *
 * トリガー: /chat_sessions/{sessionId} の更新
 * ガード: status が 'ended' に変更された場合のみ処理
 * 処理:
 *   1. サブコレクションから全メッセージ取得
 *   2. Gemini でサマリー生成
 *   3. セッションに summary + scheduledDeleteAt を書き込み
 * ※ Google Sheets 仕訳帳への記録は撤去済み（未使用・summary は session に保存され
 *   管理画面で閲覧できるため）。
 */

import {
  onDocumentUpdated,
  FirestoreEvent,
  Change,
  QueryDocumentSnapshot,
} from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { chatDb as db, CHAT_DATABASE_ID } from "../db";
import { generateSummary } from "../utils/ai";
import { REGION } from "../config";

export const onSessionEnded = onDocumentUpdated(
  {
    document: "chat_sessions/{sessionId}",
    database: CHAT_DATABASE_ID,
    region: REGION,
  },
  async (
    event: FirestoreEvent<
      Change<QueryDocumentSnapshot> | undefined,
      { sessionId: string }
    >
  ) => {
    if (!event.data) return;

    const before = event.data.before.data();
    const after = event.data.after.data();
    const { sessionId } = event.params;

    // ── ガード: status が 'ended' に変更された場合のみ ──
    if (before.status === "ended" || after.status !== "ended") return;

    try {
      // ── Step 1: 全メッセージ取得 ──
      const messagesSnap = await db
        .collection(`chat_sessions/${sessionId}/chat_messages`)
        .orderBy("createdAt", "asc")
        .get();

      const messages = messagesSnap.docs.map((doc) => ({
        role: doc.data().role as string,
        content: doc.data().content as string,
      }));

      // ── Step 2: Gemini でサマリー生成 ──
      const summary =
        messages.length > 0
          ? await generateSummary(messages)
          : "メッセージなし";

      // ── Step 3: セッション更新（summary + scheduledDeleteAt） ──
      const createdAt = after.createdAt as admin.firestore.Timestamp;
      const scheduledDeleteAt = new Date(
        createdAt.toDate().getTime() + 2 * 365 * 24 * 60 * 60 * 1000
      );

      const sessionRef = db.doc(`chat_sessions/${sessionId}`);
      await sessionRef.update({
        summary,
        scheduledDeleteAt: admin.firestore.Timestamp.fromDate(scheduledDeleteAt),
      });
    } catch (error) {
      console.error("セッション終了処理エラー:", error);
    }
  }
);
