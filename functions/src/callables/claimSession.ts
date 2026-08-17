/**
 * claimSession — 匿名セッションを、ログイン後の本人アカウントに付け替える（会話継続）
 *
 * 背景: 訪問者は最初「匿名(uid_anon)」でチャット開始。既存顧客がログインすると
 *       uid が uid_real に変わり、進行中セッション（visitorId=uid_anon）のままだと
 *       個別参照（注文/eSIM）が効かない。本 Callable がセッションの所有者を
 *       安全に付け替え、同一 sessionId のまま会話を継続できるようにする。
 *
 * 🔒 セキュリティ:
 *   - anonIdToken を verifyIdToken して uid_anon を得る（＝匿名アカウントを保有していた証明）
 *   - セッションの現所有者が uid_anon であることを確認（他人のセッションは乗っ取れない=IDOR防止）
 *   - その上で visitorId を呼び出し元（uid_real）へ付け替える
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { chatDb } from "../db";
import { REGION } from "../config";

export const claimSession = onCall({ region: REGION }, async (request) => {
  const uidReal = request.auth?.uid;
  if (!uidReal) {
    throw new HttpsError("unauthenticated", "ログインが必要です。");
  }

  const sessionId = (request.data?.sessionId as string | undefined)?.trim();
  const anonIdToken = request.data?.anonIdToken as string | undefined;
  if (!sessionId || !anonIdToken) {
    throw new HttpsError(
      "invalid-argument",
      "sessionId と anonIdToken が必要です。"
    );
  }

  // 匿名トークン検証 → uid_anon
  let anonUid: string;
  try {
    const decoded = await admin.auth().verifyIdToken(anonIdToken);
    anonUid = decoded.uid;
  } catch {
    throw new HttpsError("permission-denied", "匿名トークンが無効です。");
  }

  // 既に同一 uid（新規昇格ケース等）なら付け替え不要
  if (anonUid === uidReal) {
    return { migrated: false };
  }

  const ref = chatDb.doc(`chat_sessions/${sessionId}`);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "セッションが見つかりません。");
  }
  if (snap.data()?.visitorId !== anonUid) {
    throw new HttpsError(
      "permission-denied",
      "このセッションの所有者ではありません。"
    );
  }

  await ref.update({ visitorId: uidReal });
  return { migrated: true };
});
