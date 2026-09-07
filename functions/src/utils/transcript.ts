/**
 * transcript — 会話全文を運用者向けテキストに整形（通知メール用）
 */
import { chatDb } from "../db";

const ADMIN_URL = "https://chat.yah.homes/admin/chats?session=";

interface SessionLike {
  facilityId?: string;
  language?: string;
  customerName?: string;
  escalated?: boolean;
  status?: string;
  createdAt?: { toDate?: () => Date };
}

/** 会話1件をメール本文に整形（メッセージは時系列） */
export async function buildTranscript(
  sessionId: string,
  session: SessionLike
): Promise<{ subject: string; text: string; messageCount: number }> {
  const snap = await chatDb
    .collection(`chat_sessions/${sessionId}/chat_messages`)
    .orderBy("createdAt", "asc")
    .limit(200)
    .get();

  const lines: string[] = [];
  for (const d of snap.docs) {
    const m = d.data();
    const who = m.role === "visitor" ? "ゲスト" : m.role === "ai" ? "AI" : "管理者";
    const ts = m.createdAt?.toDate?.();
    const time = ts
      ? ts.toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" })
      : "--:--";
    lines.push(`[${time}] ${who}: ${m.content ?? ""}`);
    const photos = (m.photoUrls ?? []) as string[];
    if (photos.length) lines.push(`         （写真${photos.length}枚を添付）`);
  }

  const started = session.createdAt?.toDate?.();
  const startedStr = started
    ? started.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
    : "-";

  const facility = session.facilityId ?? "-";
  const header = [
    `施設: ${facility}`,
    `言語: ${session.language ?? "-"}`,
    `ゲスト: ${session.customerName ?? "匿名（未ログイン）"}`,
    `開始: ${startedStr}`,
    `状態: ${session.status === "ended" ? "終了" : "アクティブ"}${session.escalated ? " / ⚠ 窓口誘導あり" : ""}`,
    `メッセージ数: ${snap.size}`,
    "",
    `管理画面: ${ADMIN_URL}${sessionId}`,
    "",
    "──────── 会話 ────────",
  ].join("\n");

  const flag = session.escalated ? "⚠ " : "";
  return {
    subject: `${flag}[chat/${facility}] ${session.language ?? ""} ${snap.size}件のやり取り`,
    text: `${header}\n${lines.join("\n")}\n`,
    messageCount: snap.size,
  };
}
