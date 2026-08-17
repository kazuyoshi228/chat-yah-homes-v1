/**
 * i18nJson — Firestore に保存された多言語JSON文字列のパース（共通）
 *
 * chat_flow_nodes.label / content 等は {ja,en,zh,ko,th,vi}（＋qr_resend等のフラグ）を
 * JSON 文字列で保持する。widget と管理画面（FlowTree）の両方で使う。
 */

export interface I18nJson {
  ja?: string;
  en?: string;
  zh?: string;
  ko?: string;
  th?: string;
  vi?: string;
  qr_resend?: boolean;
  [key: string]: string | boolean | undefined;
}

/** JSON文字列 → オブジェクト。壊れていたら {ja,en} に生文字列を入れてフォールバック */
export function parseI18nObject(json: string | null): I18nJson {
  if (!json) return {};
  try {
    return JSON.parse(json) as I18nJson;
  } catch {
    return { ja: json, en: json };
  }
}

/** 指定言語のテキストを返す（lang → en → 最初の文字列値 → ""） */
export function parseI18n(json: string | null, lang: string): string {
  const obj = parseI18nObject(json);
  const v = obj[lang] ?? obj.en;
  if (typeof v === "string" && v) return v;
  const first = Object.values(obj).find((x) => typeof x === "string" && x);
  return (first as string) || "";
}
