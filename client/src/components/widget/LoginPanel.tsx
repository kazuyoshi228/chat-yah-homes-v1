/**
 * LoginPanel — お客様ログイン / 新規登録（Google ＋ メール/パスワード）
 *
 * - 新規: 匿名アカウントを昇格（uid継続 → 会話そのまま継続）
 * - 既存: 本人アカウントへサインイン → claimSession で会話を引き継ぎ
 * フォーム状態はこのパネル内に閉じる。成功時は onSuccess（親が購読を張り直す）。
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { AUTH_LABELS, pick } from "./labels";

interface LoginPanelProps {
  sessionId: string | null;
  signInWithGoogle: (sessionId?: string) => Promise<void>;
  registerWithEmail: (email: string, password: string) => Promise<void>;
  signInWithEmail: (
    email: string,
    password: string,
    sessionId?: string
  ) => Promise<void>;
  onSuccess: () => void;
  onClose: () => void;
}

export function LoginPanel({
  sessionId,
  signInWithGoogle,
  registerWithEmail,
  signInWithEmail,
  onSuccess,
  onClose,
}: LoginPanelProps) {
  const { lang: language } = useLanguage();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleGoogle = async () => {
    setBusy(true);
    setError("");
    try {
      await signInWithGoogle(sessionId ?? undefined);
      onSuccess();
    } catch (e) {
      console.error(e);
      setError(pick(AUTH_LABELS.error, language));
      setBusy(false);
    }
  };

  const handleEmail = async () => {
    if (!email.trim() || !password.trim()) return;
    setBusy(true);
    setError("");
    try {
      if (mode === "register") {
        await registerWithEmail(email.trim(), password);
      } else {
        await signInWithEmail(email.trim(), password, sessionId ?? undefined);
      }
      onSuccess();
    } catch (e) {
      console.error(e);
      setError(pick(AUTH_LABELS.error, language));
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 p-4 flex flex-col gap-3 overflow-y-auto">
      <p className="text-xs text-gray-600 leading-relaxed">
        {pick(AUTH_LABELS.hint, language)}
      </p>

      <Button
        onClick={handleGoogle}
        disabled={busy}
        variant="outline"
        className="w-full text-xs"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
        {pick(AUTH_LABELS.google, language)}
      </Button>

      <div className="flex items-center gap-2 my-1">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-[10px] text-gray-400">
          {pick(AUTH_LABELS.or, language)}
        </span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={pick(AUTH_LABELS.email, language)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-base focus:outline-none focus:border-black"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={pick(AUTH_LABELS.password, language)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-base focus:outline-none focus:border-black"
      />

      {error && <p className="text-[11px] text-red-500">{error}</p>}

      <Button
        onClick={handleEmail}
        disabled={busy || !email.trim() || !password.trim()}
        className="w-full bg-black hover:bg-gray-800 text-white text-xs"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
        {mode === "register"
          ? pick(AUTH_LABELS.register, language)
          : pick(AUTH_LABELS.signin, language)}
      </Button>

      <button
        onClick={() => setMode((m) => (m === "login" ? "register" : "login"))}
        className="text-[11px] text-gray-500 hover:text-gray-800 text-center"
      >
        {mode === "login"
          ? pick(AUTH_LABELS.toRegister, language)
          : pick(AUTH_LABELS.toLogin, language)}
      </button>

      <button
        onClick={onClose}
        className="text-[11px] text-gray-400 hover:text-gray-600 text-center mt-1"
      >
        ←
      </button>
    </div>
  );
}
