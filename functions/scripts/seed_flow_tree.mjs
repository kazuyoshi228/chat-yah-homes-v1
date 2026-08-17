/**
 * seed_flow_tree.mjs — 冒頭3分岐デシジョンツリーを chat_flow_nodes に投入（yah.homes 宿泊版）
 *
 * 方針: 入口で3分岐だけツリー化 → その先はAIに寄せる。
 *  - root（question）の options に3分岐のIDを列挙（widget はこの options で遷移）
 *  - 3分岐は redirect_ai（aiTrigger:1）。content = 選んだ意図（6言語）→ session.initialMessage 経由でAI文脈へ
 *  - フローツリーは全施設共通（施設差はRAG・施設マスタが吸収）
 *
 * 🚨 書き込むのは chat DB の chat_flow_nodes だけ。
 * 使い方（functions ディレクトリで）:
 *   下見:            node scripts/seed_flow_tree.mjs
 *   投入:            node scripts/seed_flow_tree.mjs --write
 *   投入＋旧掃除:     node scripts/seed_flow_tree.mjs --write --clean-legacy
 *
 * doc ID 固定（root / b_howto / b_checkin / b_other）→ 再実行は上書き（重複しない）。
 */
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const PROJECT_ID = "yah-homes";
const WRITE = process.argv.includes("--write");
const CLEAN_LEGACY = process.argv.includes("--clean-legacy");

const app = initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const chat = getFirestore(app, "chat");
const COL = "chat_flow_nodes";

/** 6言語 i18n を JSON 文字列で（widget/admin が JSON.parse する） */
const i18n = (ja, en, zh, ko, th, vi) => JSON.stringify({ ja, en, zh, ko, th, vi });

const NODES = [
  {
    id: "root",
    parentId: null,
    type: "question",
    label: i18n(
      "ご用件をお選びください",
      "How can we help you today?",
      "请选择您需要的帮助",
      "무엇을 도와드릴까요?",
      "เราช่วยอะไรคุณได้บ้าง?",
      "Chúng tôi có thể giúp gì cho bạn?"
    ),
    content: null,
    options: JSON.stringify(["b_howto", "b_checkin", "b_other"]),
    icon: "message",
    formTrigger: 0,
    aiTrigger: 0,
    sortOrder: 0,
    isActive: 1,
  },
  {
    id: "b_howto",
    parentId: "root",
    type: "redirect_ai",
    label: i18n(
      "お部屋・設備の使い方",
      "Room & Facilities",
      "房间与设备使用",
      "객실·설비 사용법",
      "ห้องพักและอุปกรณ์",
      "Phòng & Trang thiết bị"
    ),
    content: i18n(
      "お部屋や設備の使い方について相談したい（Wi-Fi・家電・アメニティ・ゴミ出しなど）",
      "I need help using the room or facilities (Wi-Fi, appliances, amenities, trash).",
      "我想咨询房间或设备的使用方法（Wi-Fi、家电、备品、垃圾分类等）。",
      "객실이나 설비 사용법을 문의하고 싶어요 (Wi-Fi, 가전, 어메니티, 쓰레기 배출 등).",
      "ต้องการสอบถามวิธีใช้ห้องพักหรืออุปกรณ์ (Wi-Fi เครื่องใช้ไฟฟ้า ของใช้ การทิ้งขยะ)",
      "Tôi cần trợ giúp về cách dùng phòng hoặc thiết bị (Wi-Fi, đồ điện, tiện nghi, đổ rác)."
    ),
    options: null,
    icon: "smartphone",
    formTrigger: 0,
    aiTrigger: 1,
    sortOrder: 10,
    isActive: 1,
  },
  {
    id: "b_checkin",
    parentId: "root",
    type: "redirect_ai",
    label: i18n(
      "チェックイン・チェックアウト",
      "Check-in / Check-out",
      "入住与退房",
      "체크인·체크아웃",
      "เช็คอิน / เช็คเอาท์",
      "Nhận phòng / Trả phòng"
    ),
    content: i18n(
      "チェックイン・チェックアウトについて相談したい（時間・手順・荷物など）",
      "I have a question about check-in or check-out (time, steps, luggage).",
      "我想咨询入住或退房（时间、流程、行李等）。",
      "체크인·체크아웃에 대해 문의하고 싶어요 (시간, 절차, 짐 보관 등).",
      "ต้องการสอบถามเรื่องเช็คอินหรือเช็คเอาท์ (เวลา ขั้นตอน สัมภาระ)",
      "Tôi có câu hỏi về nhận phòng hoặc trả phòng (giờ, thủ tục, hành lý)."
    ),
    options: null,
    icon: "cart",
    formTrigger: 0,
    aiTrigger: 1,
    sortOrder: 20,
    isActive: 1,
  },
  {
    id: "b_other",
    parentId: "root",
    type: "redirect_ai",
    label: i18n(
      "その他・AIに相談",
      "Something else — Ask AI",
      "其他 · 咨询 AI",
      "기타 · AI에게 문의",
      "อื่น ๆ · สอบถาม AI",
      "Khác — Hỏi AI"
    ),
    content: i18n(
      "その他について相談したい（周辺案内・トラブル・ご予約のことなど）",
      "I have another question (area guide, an issue, or my booking).",
      "我有其他问题想咨询（周边指南、故障、预订相关等）。",
      "기타 문의가 있어요 (주변 안내, 문제, 예약 관련 등).",
      "ฉันมีคำถามอื่น ๆ (แนะนำย่านใกล้เคียง ปัญหา หรือการจอง)",
      "Tôi có câu hỏi khác (hướng dẫn khu vực, sự cố, hoặc đặt phòng)."
    ),
    options: null,
    icon: "bot",
    formTrigger: 0,
    aiTrigger: 1,
    sortOrder: 30,
    isActive: 1,
  },
];

async function main() {
  console.log(`\n=== 3分岐デシジョンツリー seed [${WRITE ? "本番書き込み" : "DRY RUN"}] ===\n`);
  console.log(`投入予定: ${NODES.length} ノード（root + 3分岐）\n`);

  const existing = await chat.collection(COL).get();
  console.log(`既存ノード: ${existing.size} 件`);

  if (!WRITE) {
    if (existing.size > 0) {
      console.log("\n── 既存ノード（現状） ──");
      const seedIds = new Set(NODES.map((n) => n.id));
      for (const d of existing.docs) {
        const x = d.data();
        let l = "";
        try { l = JSON.parse(x.label).ja ?? ""; } catch { l = String(x.label ?? ""); }
        const mark = seedIds.has(d.id) ? "◎上書き対象" : "△別ノード(残存)";
        console.log(`  ${mark}  ${d.id}  p:${x.parentId ?? "(root)"}  "${l}"`);
      }
    }
    console.log("\n── 投入予定（このseed） ──");
    for (const n of NODES) {
      const label = JSON.parse(n.label);
      console.log(
        `  [${n.type}] ${n.id}  p:${n.parentId ?? "(root)"}  ai:${n.aiTrigger}  order:${n.sortOrder}  "${label.ja}"`
      );
    }
    console.log("\n--write で書き込みます。");
    process.exit(0);
  }

  const seedIds = new Set(NODES.map((n) => n.id));
  const batch = chat.batch();
  for (const n of NODES) {
    const { id, ...data } = n;
    batch.set(
      chat.collection(COL).doc(id),
      { ...data, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
  }

  let legacyDeleted = 0;
  if (CLEAN_LEGACY) {
    for (const d of existing.docs) {
      if (d.data().parentId === "root" && !seedIds.has(d.id)) {
        batch.delete(d.ref);
        legacyDeleted++;
      }
    }
  }

  await batch.commit();
  console.log(
    `✅ ${NODES.length} ノードを投入${
      CLEAN_LEGACY ? `＋旧ブランチ ${legacyDeleted} 件を削除` : ""
    }しました（root + 3分岐）。`
  );
  process.exit(0);
}

main().catch((e) => {
  console.error("seed エラー:", e);
  process.exit(1);
});
