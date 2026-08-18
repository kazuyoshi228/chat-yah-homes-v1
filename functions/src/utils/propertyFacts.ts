/**
 * propertyFacts — 施設事実の正本（(default)/property_facts = admin/properties）をAIコンテキストに注入
 *
 * yah.mobile の planCatalog と同パターン: admin 画面で更新 → 最大5分でチャットに反映。
 * 既知フィールドは読みやすい英語ラベルに整形し、未知フィールド（今後 admin に増える
 * chat用情報など）も汎用的に注入する＝本体側の項目追加にコード変更なしで追従。
 *
 * 🚨 (default) は read-only。property_secrets（鍵ボックス暗証番号）は絶対に読まない。
 */
import { defaultDb } from "../db";

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { text: string; at: number }>();

/** 既知フィールドの整形定義（label + 値の変換）。ここに無いフィールドは汎用出力 */
const KNOWN: Record<string, { label: string; fmt?: (v: unknown) => string }> = {
  checkinTime: { label: "Check-in from" },
  checkoutTime: { label: "Check-out by" },
  capacity: { label: "Max guests" },
  bedrooms: { label: "Bedrooms" },
  bedDouble: { label: "Double beds" },
  bedSingle: { label: "Single beds" },
  toilet: { label: "Toilets" },
  bath: { label: "Bathtub", fmt: yesNo },
  shower: { label: "Separate shower", fmt: yesNo },
  washer: { label: "Washing machine", fmt: yesNo },
  dryer: { label: "Clothes dryer", fmt: yesNo },
  parking: { label: "Parking", fmt: yesNo },
  tvInch: { label: "TV size (inches)" },
  audio: { label: "Audio system", fmt: yesNo },
  theater: { label: "Theater/projector", fmt: yesNo },
  studyDesk: { label: "Work desk", fmt: yesNo },
  sink: { label: "Kitchen sink", fmt: yesNo },
  nearestStation: { label: "Nearest station" },
  fromStationWalkMin: { label: "Walk from nearest station (min)" },
  toTenjinWalkMin: { label: "Walk to Tenjin (min)" },
  toHakataWalkMin: { label: "Walk to Hakata (min)" },
  fromAirportCarMin: { label: "From Fukuoka Airport by car (min)" },
  spotMarketM: { label: "Yanagibashi Market (m)" },
  spotMarketMin: { label: "Yanagibashi Market walk (min)" },
  spotSumiyoshiM: { label: "Sumiyoshi Shrine (m)" },
  spotSumiyoshiMin: { label: "Sumiyoshi Shrine walk (min)" },
  spotCanalM: { label: "Canal City (m)" },
  spotCanalMin: { label: "Canal City walk (min)" },
  spotNakasuWalkMin: { label: "Nakasu walk (min)" },
  spotNakasuTaxiMin: { label: "Nakasu by taxi (min)" },
  spotOhoriM: { label: "Ohori Park (m)" },
  spotOhoriCarMin: { label: "Ohori Park by car (min)" },
  freeCancelDays: {
    label: "Free cancellation (official-site bookings)",
    fmt: (v) => `until ${v} days before check-in, 23:59 JST`,
  },
  bookingMaxMonths: { label: "Bookings open (months ahead)" },
  bookingCutoffDays: { label: "Booking cutoff (days before)" },
  bookingCutoffTime: { label: "Booking cutoff time" },
  rating: { label: "Guest rating" },
  reviewCount: { label: "Review count" },
};

/** 注入しない内部フィールド */
const SKIP = new Set(["updatedAt", "updatedBy", "createdAt"]);

function yesNo(v: unknown): string {
  return v === 1 || v === true ? "yes" : "no";
}

function fmtValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/**
 * property_facts/{facilityId} をプロンプト注入用テキストに整形。
 * 文書が無い施設は空文字（プロンプト側は施設マスタ＋RAGのみで応答）。
 */
export async function getPropertyFacts(facilityId: string): Promise<string> {
  if (!facilityId) return "";
  const hit = cache.get(facilityId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.text;

  try {
    const snap = await defaultDb
      .collection("property_facts")
      .doc(facilityId)
      .get();
    if (!snap.exists) return "";
    const data = snap.data() as Record<string, unknown>;

    const known: string[] = [];
    const extra: string[] = [];
    // chat用情報（admin/properties の #chat セクション）: {q, a} 行の配列を専用整形
    const chatInfoLines: string[] = [];
    const rawChatInfo = data.chatInfo;
    if (Array.isArray(rawChatInfo)) {
      for (const row of rawChatInfo) {
        const q = typeof row?.q === "string" ? row.q.trim() : "";
        const a = typeof row?.a === "string" ? row.a.trim() : "";
        if (q && a) chatInfoLines.push(`- ${q}: ${a}`);
      }
    }

    for (const [k, v] of Object.entries(data)) {
      if (SKIP.has(k) || k === "chatInfo") continue;
      const def = KNOWN[k];
      if (def) {
        known.push(`- ${def.label}: ${def.fmt ? def.fmt(v) : fmtValue(v)}`);
      } else {
        // 未知フィールド（admin側で追加されたものなど）は汎用注入
        const s = fmtValue(v);
        if (s) extra.push(`- ${k}: ${s}`);
      }
    }

    const lines = [
      "[Live from the property master data (admin/properties, single source of truth). Numbers are facts — do not invent others.]",
      ...known,
      ...extra,
      ...(chatInfoLines.length > 0
        ? [
            "[Owner-curated chat info (admin/properties #chat, single source of truth — Q&A format)]",
            ...chatInfoLines,
          ]
        : []),
    ];
    const text = lines.join("\n");
    cache.set(facilityId, { text, at: Date.now() });
    return text;
  } catch (e) {
    console.error("propertyFacts 取得エラー:", e);
    return cache.get(facilityId)?.text ?? "";
  }
}
