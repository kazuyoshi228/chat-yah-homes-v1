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

const FACILITIES = [
  {
    id: "kiyokawa",
    data: {
      // 表札サイン（公式掲示）より確定: docs/rag_sources/kiyokawa_signage.md
      name: { ja: "yah.kiyokawa", en: "yah.kiyokawa" },
      checkIn: "", // ヒアリング後に設定（例 "16:00"）
      checkOut: "", // ヒアリング後に設定（例 "10:00"）
      address:
        "〒810-0005 福岡県福岡市中央区清川3-3-1 / 3-3-1 Kiyokawa, Chuo-ku, Fukuoka 810-0005 Japan",
      mapUrl: "",
      contacts: {
        officialEmail: "", // ヒアリング後に設定
        officialPhone: "",
        bookingCom: "Please contact us via the message feature in the Booking.com app.",
        airbnb: "Please contact us via the message feature in the Airbnb app.",
        other: "",
      },
      // 規約（2026-08-14施行）の「緊急のご連絡先（ご宿泊中のお客様専用）」を採用（ユーザー確定 2026-08-17）
      // ※表札には 092-600-3490 の記載もあるが、チャットで案内するのはこちら
      emergencyPhone: "050-1721-4419",
      notes:
        "3-story building (rooms across 1F-3F). Emergency exit maps are posted on each floor. Wi-Fi details are posted on the acrylic sign in the room (never share credentials in chat).",
      isActive: true,
    },
  },
  {
    id: "test-facility",
    data: {
      name: { ja: "テスト施設（非公開）", en: "Test Facility (private)" },
      checkIn: "15:00",
      checkOut: "11:00",
      address: "TEST ONLY — not a real property",
      contacts: { officialEmail: "test@example.com" },
      notes:
        "SIM用のダミー施設。この施設のRAG/情報が kiyokawa の回答に出たら混線バグ。",
      isActive: false, // 非公開（ウィジェットの施設判定・案内画面に出さない）
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
