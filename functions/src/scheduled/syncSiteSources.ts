/**
 * syncSiteSources — 公開サイト（yah.homes）のページをRAGへ自動同期（SSoTファースト）
 *
 * SSoT = 公開サイト。規約・物件ページ等の内容をRAGに手書きコピーすると陳腐化するため、
 * chat DB の chat_site_sources に登録されたURLを毎日取得し、本文テキストを抽出して
 * chat_rag_documents/site-{id} を更新する（変更時のみ・onRagDocumentWritten が自動再Embedding）。
 *
 * 同期対象の追加＝chat_site_sources にドキュメントを1件足すだけ（コード変更不要）:
 *   { url, facilityId("common"可), category, title, isActive }
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { chatDb } from "../db";
import { REGION } from "../config";

/** 1チャンクの本文上限（Embedding入力上限8000の手前）。長いページは複数文書に分割 */
const CHUNK_SIZE = 7000;
/** 分割上限（暴走防止） */
const MAX_CHUNKS = 4;

/** 改行境界を優先して CHUNK_SIZE ごとに分割 */
export function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > 0 && chunks.length < MAX_CHUNKS) {
    if (rest.length <= CHUNK_SIZE) {
      chunks.push(rest);
      break;
    }
    let cut = rest.lastIndexOf("\n", CHUNK_SIZE);
    if (cut < CHUNK_SIZE * 0.5) cut = CHUNK_SIZE; // 改行が無ければ強制カット
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  return chunks;
}

/** HTMLから本文テキストを抽出（素朴・依存ゼロ） */
export function extractText(htmlStr: string): string {
  let t = htmlStr;
  t = t.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, "");
  t = t.replace(/<[^>]+>/g, "\n");
  t = t
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
  t = t.replace(/[ \t]+/g, " ");
  t = t.replace(/\n\s*\n+/g, "\n");
  return t.trim();
}

interface SiteSource {
  url?: string;
  facilityId?: string;
  category?: string;
  title?: string;
  isActive?: boolean;
}

/** 1ソースを同期。戻り値: "updated" | "unchanged" | "error" */
export async function syncOneSource(
  id: string,
  src: SiteSource
): Promise<"updated" | "unchanged" | "error"> {
  if (!src.url) return "error";
  try {
    const res = await fetch(src.url, {
      headers: { "User-Agent": "yah-homes-chat-sync/1.0" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = extractText(await res.text());
    if (text.length < 200) throw new Error("本文が短すぎる（抽出失敗の疑い）");

    // 全文ハッシュで変更検知（チャンク割りの前に判定）
    const hash = crypto.createHash("sha256").update(text).digest("hex");
    const headRef = chatDb.collection("chat_rag_documents").doc(`site-${id}`);
    const existing = await headRef.get();
    if (existing.exists && existing.data()?.contentHash === hash) {
      return "unchanged";
    }

    const chunks = chunkText(text);
    const col = chatDb.collection("chat_rag_documents");
    for (let i = 0; i < chunks.length; i++) {
      // 先頭チャンクは site-{id}（後方互換）、以降は site-{id}-p2, p3...
      const docId = i === 0 ? `site-${id}` : `site-${id}-p${i + 1}`;
      const part = chunks.length > 1 ? ` (part ${i + 1}/${chunks.length})` : "";
      await col.doc(docId).set(
        {
          title: `${src.title ?? `Site sync: ${src.url}`}${part}`,
          content: `[Auto-synced from ${src.url} — the live site is the source of truth${part}]\n\n${chunks[i]}`,
          category: src.category ?? "site",
          facilityId: src.facilityId ?? "common",
          isActive: true,
          source: "site_sync",
          sourceUrl: src.url,
          contentHash: i === 0 ? hash : null, // 変更検知は先頭チャンクのみ
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
    // ページが縮んだ場合の余剰チャンク掃除
    for (let i = chunks.length; i < MAX_CHUNKS; i++) {
      const stale = col.doc(`site-${id}-p${i + 1}`);
      const s = await stale.get();
      if (s.exists) await stale.delete();
    }
    console.log(`site_sync 更新: ${id} (${text.length}字 → ${chunks.length}チャンク)`);
    return "updated";
  } catch (e) {
    console.error(`site_sync 失敗: ${id} (${src.url}):`, e);
    return "error";
  }
}

/** 毎日 06:00 JST に全ソース同期 */
export const syncSiteSources = onSchedule(
  {
    schedule: "0 6 * * *",
    timeZone: "Asia/Tokyo",
    region: REGION,
    memory: "256MiB",
    timeoutSeconds: 300,
  },
  async () => {
    const snap = await chatDb.collection("chat_site_sources").get();
    let updated = 0,
      unchanged = 0,
      errors = 0;
    for (const d of snap.docs) {
      const src = d.data() as SiteSource;
      if (src.isActive === false) continue;
      const r = await syncOneSource(d.id, src);
      if (r === "updated") updated++;
      else if (r === "unchanged") unchanged++;
      else errors++;
    }
    console.log(
      `syncSiteSources 完了: 更新${updated} / 変更なし${unchanged} / 失敗${errors}`
    );
  }
);
