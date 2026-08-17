/**
 * seed_site_sources.mjs — サイト同期ソースの登録＋初回同期の即時実行
 *
 * SSoT = 公開サイト。ここで登録したURLは毎日 syncSiteSources（scheduled）が
 * RAGへ自動同期する（長いページはチャンク分割）。同期ロジックはビルド済み
 * lib/scheduled/syncSiteSources.js を再利用（重複実装しない）。
 *
 * 使い方（functions ディレクトリで・要 npm run build 済み）:
 *   下見:  node scripts/seed_site_sources.mjs
 *   実行:  node scripts/seed_site_sources.mjs --write   （登録＋初回同期まで実行）
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);

process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "yah-homes";
const { chatDb } = require("../lib/db.js");
const { syncOneSource } = require("../lib/scheduled/syncSiteSources.js");
const { FieldValue } = require("firebase-admin/firestore");

const WRITE = process.argv.includes("--write");

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

async function main() {
  console.log(`\n=== サイト同期ソース seed [${WRITE ? "本番書き込み＋初回同期" : "DRY RUN"}] ===\n`);
  for (const s of SOURCES) {
    console.log(`ソース登録: ${s.id} → ${s.url} [${s.facilityId}]`);
    if (WRITE) {
      const { id, ...data } = s;
      await chatDb.collection("chat_site_sources").doc(id).set(
        { ...data, isActive: true, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
      const r = await syncOneSource(id, data);
      console.log(`  → 同期結果: ${r}`);
    }
  }
  console.log(WRITE ? "\n✅ 完了（Embeddingは自動生成・以後は毎日06:00 JSTに自動同期）" : "\n--write で実行します。");
  process.exit(0);
}

main().catch((e) => { console.error("seed エラー:", e); process.exit(1); });
