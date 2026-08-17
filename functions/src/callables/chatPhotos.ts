/**
 * chatPhotos — チャット用写真のアップロード/削除（管理者限定 callable）
 *
 * 保存先: Cloud Storage（yah-homes 既存バケット）chat-photos/{facilityId}/ 配下。
 * Admin SDK 経由のため共有バケットの Storage ルールには依存しない・触らない。
 * ダウンロードは Firebase のトークン付きURL（ルール非依存・推測不能）。
 * メタデータは chat DB の chat_photos（クライアントは read のみ・書き込みは本 callable だけ）。
 *
 * 🚨 写真は「AIがゲストに見せてよいもの」だけを登録する運用
 *   （鍵・暗証番号が写ったものは登録しない）。
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { chatDb } from "../db";
import { REGION } from "../config";

const BUCKET = "yah-homes.firebasestorage.app";
/** base64での最大サイズ（≒5MB画像。クライアントは長辺1600pxに縮小してから送る） */
const MAX_BASE64_LENGTH = 7_000_000;
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** 管理者判定（firestore.chat.rules の isAdmin と同条件） */
function assertAdmin(auth: { token?: Record<string, unknown> } | undefined): void {
  const t = auth?.token as
    | { email?: string; email_verified?: boolean; firebase?: { sign_in_provider?: string } }
    | undefined;
  const ok =
    !!t &&
    t.email_verified === true &&
    t.firebase?.sign_in_provider === "google.com" &&
    /@bonfire\.co\.jp$/.test(t.email ?? "");
  if (!ok) throw new HttpsError("permission-denied", "管理者のみ実行できます");
}

export const uploadChatPhoto = onCall(
  { region: REGION, memory: "512MiB", timeoutSeconds: 120 },
  async (request) => {
    assertAdmin(request.auth);
    const { facilityId, label, imageBase64, contentType } = (request.data ?? {}) as {
      facilityId?: string;
      label?: string;
      imageBase64?: string;
      contentType?: string;
    };

    if (!facilityId || !/^[a-z0-9-]{1,40}$/.test(facilityId)) {
      throw new HttpsError("invalid-argument", "facilityId が不正です");
    }
    if (!label || label.trim().length === 0 || label.length > 100) {
      throw new HttpsError("invalid-argument", "ラベルは1〜100文字で入力してください");
    }
    const ext = ALLOWED_TYPES[contentType ?? ""];
    if (!ext) {
      throw new HttpsError("invalid-argument", "対応形式は JPEG / PNG / WebP です");
    }
    if (!imageBase64 || imageBase64.length > MAX_BASE64_LENGTH) {
      throw new HttpsError("invalid-argument", "画像が空か大きすぎます（5MBまで）");
    }

    const buffer = Buffer.from(imageBase64, "base64");
    const id = crypto.randomUUID();
    const token = crypto.randomUUID();
    const path = `chat-photos/${facilityId}/${id}.${ext}`;

    await admin
      .storage()
      .bucket(BUCKET)
      .file(path)
      .save(buffer, {
        contentType,
        metadata: {
          cacheControl: "public, max-age=31536000",
          metadata: { firebaseStorageDownloadTokens: token },
        },
      });

    const url = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(
      path
    )}?alt=media&token=${token}`;

    await chatDb.collection("chat_photos").doc(id).set({
      facilityId,
      label: label.trim(),
      url,
      storagePath: path,
      contentType,
      sizeBytes: buffer.length,
      uploadedBy: (request.auth?.token as { email?: string } | undefined)?.email ?? null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { id, url };
  }
);

export const deleteChatPhoto = onCall(
  { region: REGION, memory: "256MiB", timeoutSeconds: 60 },
  async (request) => {
    assertAdmin(request.auth);
    const { photoId } = (request.data ?? {}) as { photoId?: string };
    if (!photoId) throw new HttpsError("invalid-argument", "photoId が必要です");

    const ref = chatDb.collection("chat_photos").doc(photoId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "写真が見つかりません");

    const storagePath = snap.data()?.storagePath as string | undefined;
    if (storagePath && storagePath.startsWith("chat-photos/")) {
      try {
        await admin.storage().bucket(BUCKET).file(storagePath).delete();
      } catch (e) {
        console.warn("Storage削除に失敗（メタデータは削除継続）:", e);
      }
    }
    await ref.delete();
    return { ok: true };
  }
);
