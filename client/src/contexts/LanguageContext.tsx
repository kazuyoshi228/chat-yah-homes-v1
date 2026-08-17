import React, { createContext, useContext, useState, useEffect } from "react";
import { type Lang, t as translate } from "../../../shared/i18n";

// Re-export for convenience
export type { Lang };

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: Parameters<typeof translate>[1]) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: "en",
  setLang: () => {},
  t: (key) => key as string,
});

const STORAGE_KEY = "yah_chat_lang";

const SUPPORTED: Lang[] = ["en", "ja", "zh", "ko", "th", "vi"];

/**
 * 初期言語の決定。訪日外国人向けサービスのため **既定は英語**。
 * navigator.language には追従しない（日本語ロケールのブラウザでも英語で開始）。
 * 明示指定のみ尊重: ①URL ?lang=（埋め込み時の指定）②localStorage（ユーザーが選んだ言語）。
 */
function resolveInitialLang(): Lang {
  try {
    const p = new URLSearchParams(window.location.search).get("lang");
    if (p && SUPPORTED.includes(p as Lang)) return p as Lang;
  } catch {
    /* ignore */
  }
  const stored = localStorage.getItem(STORAGE_KEY) as Lang | null;
  if (stored && SUPPORTED.includes(stored)) return stored;
  return "en";
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    setLangState(resolveInitialLang());
  }, []);

  const setLang = (newLang: Lang) => {
    setLangState(newLang);
    localStorage.setItem(STORAGE_KEY, newLang);
  };

  const tFn = (key: Parameters<typeof translate>[1]) => translate(lang, key);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: tFn }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
