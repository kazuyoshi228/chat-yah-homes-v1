/**
 * facilityContext — 施設マスタ（chat DB: chat_facilities）を AI コンテキストに注入
 *
 * 施設の基本情報（名称・チェックイン/アウト・住所・連絡窓口）は RAG ではなく
 * このマスタが正本。毎ターン注入することで、RAG検索の当たり外れに依存せず
 * 事実を安定して答えられるようにする（yah.mobile の planCatalog 注入と同パターン）。
 *
 * 🚨 施設追加はこのマスタへの登録＋施設RAG投入だけで完了する（コード変更不要）。
 *    スラッグをコードにハードコードしない。
 */
import { chatDb } from "../db";

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { text: string; at: number }>();

/** chat_facilities/{facilityId} のドキュメント形 */
export interface FacilityDoc {
  /** 表示名（多言語 {ja,en,...} または文字列） */
  name?: Record<string, string> | string;
  checkIn?: string; // 例 "16:00"
  checkOut?: string; // 例 "10:00"
  address?: string;
  mapUrl?: string;
  /** 予約経路別の連絡窓口（エスカレーション誘導の正本） */
  contacts?: {
    officialEmail?: string;
    officialPhone?: string;
    bookingCom?: string; // 案内文（例: Booking.comアプリのメッセージ機能から）
    airbnb?: string;
    other?: string;
  };
  /** 緊急連絡先（設備の重大トラブル等。火事・救急は 119/110 が先） */
  emergencyPhone?: string;
  /** 自由記述の補足（Wi-Fi名の場所案内など機微でないもの） */
  notes?: string;
  /** 公開フラグ（false = 準備中・テスト用。ウィジェットの施設判定にも使用） */
  isActive?: boolean;
}

function fmtName(name: FacilityDoc["name"]): string {
  if (!name) return "unknown";
  if (typeof name === "string") return name;
  const ja = name.ja ?? "";
  const en = name.en ?? "";
  return ja && en && ja !== en ? `${ja} (${en})` : ja || en || "unknown";
}

/**
 * 施設情報をプロンプト注入用テキストに整形して返す。
 * 施設が存在しない/非公開なら空文字（プロンプト側で「施設不明」挙動になる）。
 * 参照情報のラベルは英語（回答言語への引きずられ防止・customerContext と同方針）。
 */
export async function getFacilityContext(facilityId: string): Promise<string> {
  if (!facilityId) return "";
  const hit = cache.get(facilityId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.text;

  try {
    const snap = await chatDb.collection("chat_facilities").doc(facilityId).get();
    if (!snap.exists) return "";
    const f = snap.data() as FacilityDoc;
    if (f.isActive === false) return "";

    const lines: string[] = [
      `[Facility master data (single source of truth for this property)]`,
      `- Facility: ${fmtName(f.name)} (id: ${facilityId})`,
    ];
    if (f.checkIn) lines.push(`- Check-in from: ${f.checkIn}`);
    if (f.checkOut) lines.push(`- Check-out by: ${f.checkOut}`);
    if (f.address) lines.push(`- Address: ${f.address}`);
    if (f.mapUrl) lines.push(`- Map: ${f.mapUrl}`);
    const c = f.contacts ?? {};
    const contactLines: string[] = [];
    if (c.bookingCom) contactLines.push(`  - Booked via Booking.com: ${c.bookingCom}`);
    if (c.airbnb) contactLines.push(`  - Booked via Airbnb: ${c.airbnb}`);
    if (c.officialEmail || c.officialPhone) {
      contactLines.push(
        `  - Booked via official site: ${[c.officialEmail, c.officialPhone]
          .filter(Boolean)
          .join(" / ")}`
      );
    }
    if (c.other) contactLines.push(`  - Other booking channels: ${c.other}`);
    if (contactLines.length > 0) {
      lines.push(`- Human contact channels (by booking channel):`, ...contactLines);
    }
    if (f.emergencyPhone) {
      lines.push(`- Facility emergency phone: ${f.emergencyPhone}`);
    }
    if (f.notes) lines.push(`- Notes: ${f.notes}`);

    const text = lines.join("\n");
    cache.set(facilityId, { text, at: Date.now() });
    return text;
  } catch (e) {
    console.error("facilityContext 取得エラー:", e);
    return cache.get(facilityId)?.text ?? "";
  }
}
