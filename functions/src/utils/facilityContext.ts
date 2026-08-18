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
import { chatDb, defaultDb } from "../db";

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
  /** Wi-Fi 情報（2026-08-17 方針: パスワードはチャットで案内してよい） */
  wifi?: {
    ssid24?: string;
    ssid5?: string;
    password?: string;
    signLocation?: string; // 掲示場所（例: LDK中央のコンソールの上）
  };
  /** 自由記述の補足（機微でないもの） */
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
/** 施設の写真リスト（chat_photos・AIが添付してよいもの）。5分キャッシュ */
const photoCache = new Map<string, { list: { label: string; url: string }[]; at: number }>();

export async function getFacilityPhotos(
  facilityId: string
): Promise<{ label: string; url: string }[]> {
  const key = facilityId || "common";
  const hit = photoCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.list;
  try {
    const scope = facilityId ? [facilityId, "common"] : ["common"];
    const snap = await chatDb
      .collection("chat_photos")
      .where("facilityId", "in", scope)
      .get();
    const list = snap.docs
      .map((d) => ({
        label: String(d.data().label ?? ""),
        url: String(d.data().url ?? ""),
      }))
      .filter((p) => p.label && p.url);
    photoCache.set(key, { list, at: Date.now() });
    return list;
  } catch (e) {
    console.error("facilityPhotos 取得エラー:", e);
    return photoCache.get(key)?.list ?? [];
  }
}

export async function getFacilityContext(facilityId: string): Promise<string> {
  if (!facilityId) return "";
  const hit = cache.get(facilityId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.text;

  try {
    const snap = await chatDb.collection("chat_facilities").doc(facilityId).get();
    if (!snap.exists) return "";
    const f = snap.data() as FacilityDoc;
    if (f.isActive === false) return "";

    /* 時刻・住所・地図・緊急電話は yah.homes 側 property_facts（既定DB）が正本。
       chat_facilities に写しを持たない（2026-08-18 SSoT監査で二重化を解消）。 */
    const pfSnap = await defaultDb.collection("property_facts").doc(facilityId).get();
    const pf = (pfSnap.data() ?? {}) as Record<string, unknown>;
    const metaSnap = await defaultDb.collection("property_facts").doc("meta").get();
    const operatorPhone = String(metaSnap.data()?.operatorPhone ?? "");

    const lines: string[] = [
      `[Facility master data (single source of truth for this property)]`,
      `- Facility: ${fmtName(f.name)} (id: ${facilityId})`,
    ];
    if (pf.checkinTime) lines.push(`- Check-in from: ${pf.checkinTime}`);
    if (pf.checkoutTime) lines.push(`- Check-out by: ${pf.checkoutTime}`);
    if (pf.addressJa) lines.push(`- Address: 〒${pf.zip ?? ""} ${pf.addressJa}`);
    if (pf.mapUrl) lines.push(`- Map: ${pf.mapUrl}`);
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
    if (operatorPhone) {
      lines.push(`- Facility emergency phone: ${operatorPhone}`);
    }
    const w = f.wifi ?? {};
    if (w.ssid24 || w.ssid5 || w.password) {
      const parts: string[] = [];
      if (w.ssid24) parts.push(`SSID 2.4GHz: ${w.ssid24}`);
      if (w.ssid5) parts.push(`SSID 5GHz: ${w.ssid5}`);
      if (w.password) parts.push(`Password: ${w.password}`);
      if (w.signLocation) parts.push(`(also posted at: ${w.signLocation})`);
      lines.push(`- Wi-Fi (OK to share with guests in chat): ${parts.join(" / ")}`);
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
