/**
 * notifyTranscripts — 会話が静穏になったら、やり取り全文を運用者へメール送信
 *
 * 立ち上げ期の観察用。10分ごとに実行し、「最終メッセージから10分以上経過」かつ
 * 「未通知」のセッションを拾って1通ずつ送る（1メッセージごとに送ると大量になるため）。
 * 送信後に notifiedAt を立てて重複送信を防ぐ。
 *
 * ON/OFF は管理画面のトグル（chat_settings/notifications）で切替（デプロイ不要）。
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { chatDb } from "../db";
import { REGION } from "../config";
import { getNotifySettings } from "../utils/notifySettings";
import { buildTranscript } from "../utils/transcript";
import { sendOpsMail, SMTP_USER, SMTP_PASS } from "../utils/mailer";

/** 静穏とみなす時間 */
const QUIET_MS = 10 * 60 * 1000;
/** 1回の実行で送る上限（暴走防止） */
const MAX_PER_RUN = 20;

export const notifyTranscripts = onSchedule(
  {
    schedule: "*/10 * * * *",
    timeZone: "Asia/Tokyo",
    region: REGION,
    memory: "256MiB",
    timeoutSeconds: 300,
    secrets: [SMTP_USER, SMTP_PASS],
  },
  async () => {
    const settings = await getNotifySettings();
    if (!settings.enabled) return; // トグルOFF

    const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - QUIET_MS);

    // 通常: 最終メッセージから QUIET_MS 以上経過したセッション
    const byLast = await chatDb
      .collection("chat_sessions")
      .where("lastMessageAt", "<", cutoff)
      .orderBy("lastMessageAt", "desc")
      .limit(100)
      .get();

    // フォールバック: lastMessageAt を持たないセッション（この機能の導入前に開始したもの）。
    //   Firestore は「フィールドが存在しない」条件で引けないため、createdAt で拾って
    //   メモリ側で lastMessageAt 無しだけを対象にする。取りこぼし防止。
    const byCreated = await chatDb
      .collection("chat_sessions")
      .where("createdAt", "<", cutoff)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    const docs = [
      ...byLast.docs,
      ...byCreated.docs.filter((d) => !d.data().lastMessageAt),
    ];
    const seen = new Set<string>();

    let sent = 0;
    for (const doc of docs) {
      if (seen.has(doc.id)) continue;
      seen.add(doc.id);
      if (sent >= MAX_PER_RUN) break;
      const s = doc.data();
      if (s.notifiedAt) continue; // 送信済み

      try {
        const { subject, text, messageCount } = await buildTranscript(doc.id, s);
        if (messageCount === 0) continue;
        await sendOpsMail({ to: settings.recipient, subject, text });
        await doc.ref.update({
          notifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        sent++;
      } catch (e) {
        console.error(`会話通知メール失敗 (${doc.id}):`, e);
      }
    }
    if (sent > 0) console.log(`会話通知メール: ${sent}件送信`);
  }
);
