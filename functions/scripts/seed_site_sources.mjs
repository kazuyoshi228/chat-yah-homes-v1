/**
 * seed_site_sources.mjs — サイト同期ソースの登録＋初回同期の即時実行
 *
 * SSoT = 公開サイト。ここで登録したURLは毎日 syncSiteSources（scheduled）が
 * RAGへ自動同期する。ソース追加はこのコレクションに1件足すだけ。
 *
 * 使い方（functions ディレクトリで）:
 *   下見:  node scripts/seed_site_sources.mjs
 *   実行:  node scripts/seed_site_sources.mjs --write   （登録＋初回同期まで実行）
 */
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import crypto from "crypto";

const PROJECT_ID = "yah-homes";
const WRITE = process.argv.includes("--write");
const app = initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const chat = getFirestore(app, "chat");

const SOURCES = [
  {
    id: "terms",
    url: "https://yah.homes/legal/terms/",
    facilityId: "common",
    category: "rules-source",
    title: "利用規約・ハウスルール（公式サイト自動同期）",
  },
  {
    id: "property-kiyokawa",
    url: "https://yah.homes/properties/kiyokawa/",
    facilityId: "kiyokawa",
    category: "property-page",
    title: "kiyokawa 物件ページ（公式サイト自動同期・設備/駐車場/ベッド構成）",
  },
];

const CONTENT_CAP = 7500;
function extractText(htmlStr) {
  let t = htmlStr;
  t = t.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, "");
  t = t.replace(/<[^>]+>/g, "\n");
  t = t.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ");
  t = t.replace(/[ \t]+/g, " ");
  t = t.replace(/\n\s*\n+/g, "\n");
  return t.trim();
}

async function main() {
  console.log(`\n=== サイト同期ソース seed [${WRITE ? "本番書き込み＋初回同期" : "DRY RUN"}] ===\n`);
  for (const s of SOURCES) {
    console.log(`ソース登録: ${s.id} → ${s.url} [${s.facilityId}]`);
    if (WRITE) {
      const { id, ...data } = s;
      await chat.collection("chat_site_sources").doc(id).set(
        { ...data, isActive: true, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
      // 初回同期を即時実行（scheduled は毎日06:00 JST）
      const res = await fetch(s.url, { headers: { "User-Agent": "yah-homes-chat-sync/1.0" } });
      const text = extractText(await res.text()).slice(0, CONTENT_CAP);
      const hash = crypto.createHash("sha256").update(text).digest("hex");
      await chat.collection("chat_rag_documents").doc(`site-${id}`).set(
        {
          title: s.title,
          content: `[Auto-synced from ${s.url} — the live site is the source of truth]\n\n${text}`,
          category: s.category,
          facilityId: s.facilityId,
          isActive: true,
          source: "site_sync",
          sourceUrl: s.url,
          contentHash: hash,
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      console.log(`  → 初回同期完了（${text.length}字）`);
    }
  }
  console.log(WRITE ? "\n✅ 完了（Embeddingは自動生成・以後は毎日06:00 JSTに自動同期）" : "\n--write で実行します。");
  process.exit(0);
}

main().catch((e) => { console.error("seed エラー:", e); process.exit(1); });
