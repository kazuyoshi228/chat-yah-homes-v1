/**
 * seed_facilities.mjs — 施設マスタ（chat_facilities）を投入
 *
 * 施設追加はこのマスタ登録＋施設RAG投入＋QR発行のみ（コード変更・再デプロイ不要）。
 * kiyokawa の詳細値（チェックイン時刻・住所・窓口）はヒアリング後に更新する。
 * 「要確認」のままの値はプロンプトに注入されてもAIが断定しない運用
 * （プロンプト側で創作禁止・不明は窓口誘導）。
 *
 * test-facility は施設混線テスト用（isActive:false = 非公開。ウィジェットからは
 * 見えないが、SIMがセッションに直接指定して分離を検証する）。
 *
 * 使い方（functions ディレクトリで）:
 *   下見:  node scripts/seed_facilities.mjs
 *   投入:  node scripts/seed_facilities.mjs --write
 */
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const PROJECT_ID = "yah-homes";
const WRITE = process.argv.includes("--write");

const app = initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const chat = getFirestore(app, "chat");
const COL = "chat_facilities";

// 🚨 2026-08-18 縮小: 施設コンテンツ（Wi-Fi・窓口・住所・緊急連絡先等）の正本は
//    admin/properties の chat用情報（property_facts.chatInfo）に一本化した。
//    chat_facilities は「公開フラグ＋表示名」だけの最小マスタ（チャットの動作制御専用）。
const FACILITIES = [
  {
    id: "kiyokawa",
    data: {
      name: { ja: "yah.kiyokawa", en: "yah.kiyokawa" },
      isActive: true,
    },
  },
];

async function main() {
  console.log(`\n=== 施設マスタ seed [${WRITE ? "本番書き込み" : "DRY RUN"}] ===\n`);
  for (const f of FACILITIES) {
    console.log(`upsert: ${f.id} | ${f.data.name.ja} | isActive=${f.data.isActive}`);
    if (WRITE) {
      await chat.collection(COL).doc(f.id).set(
        { ...f.data, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    }
  }
  console.log(WRITE ? "\n✅ 完了" : "\n--write で書き込みます。");
  process.exit(0);
}

main().catch((e) => {
  console.error("seed エラー:", e);
  process.exit(1);
});
