/**
 * LanguagePicker — ゲストが表示言語を切り替えるピッカー（ヘッダー内）
 *
 * 6言語対応なのに切替UIが無く、QRから来た日本人ゲストが英語画面のままになる
 * 問題への対処。選択は localStorage に保存され、次回訪問時も維持される。
 */
import { useLanguage, type Lang } from "@/contexts/LanguageContext";
import { Globe } from "lucide-react";

const LANGS: { code: Lang; short: string; label: string }[] = [
  { code: "en", short: "EN", label: "English" },
  { code: "ja", short: "日本語", label: "日本語" },
  { code: "ko", short: "한국어", label: "한국어" },
  { code: "zh", short: "中文", label: "中文" },
  { code: "th", short: "ไทย", label: "ไทย" },
  { code: "vi", short: "VI", label: "Tiếng Việt" },
];

export function LanguagePicker() {
  const { lang, setLang } = useLanguage();
  return (
    <div className="relative flex items-center">
      <Globe className="w-3.5 h-3.5 text-white/70 absolute left-2 pointer-events-none" />
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        aria-label="Language"
        className="appearance-none bg-transparent text-white/90 text-xs pl-7 pr-2 py-1 rounded-md border border-white/25 hover:border-white/50 focus:outline-none cursor-pointer"
      >
        {LANGS.map((l) => (
          <option key={l.code} value={l.code} className="text-black">
            {l.code === lang ? l.short : l.label}
          </option>
        ))}
      </select>
    </div>
  );
}
