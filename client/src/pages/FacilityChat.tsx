/**
 * FacilityChat — 施設別チャットページ（chat.yah.homes/{facilityId}）
 *
 * 施設の有効判定は chat_facilities マスタ参照（スラッグをコードに持たない＝
 * 施設追加はマスタ登録だけで開通）。未知スラッグ・非公開施設は施設案内へフォールバック。
 */
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useLanguage } from "@/contexts/LanguageContext";
import ChatWidgetFirebase from "@/components/ChatWidgetFirebase";
import FacilitySelect from "@/pages/FacilitySelect";
import { FACILITY_LABELS, pick } from "@/components/widget/labels";

/** マスタの name（多言語オブジェクト or 文字列）を表示名に解決 */
export function resolveFacilityName(
  name: unknown,
  lang: string
): string {
  if (typeof name === "string") return name;
  if (name && typeof name === "object") {
    const m = name as Record<string, string>;
    return m[lang] ?? m.en ?? m.ja ?? Object.values(m)[0] ?? "";
  }
  return "";
}

type State =
  | { phase: "loading" }
  | { phase: "notFound" }
  | { phase: "ok"; name: string };

export default function FacilityChat({ facilityId }: { facilityId: string }) {
  const { lang } = useLanguage();
  const [state, setState] = useState<State>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "chat_facilities", facilityId));
        if (cancelled) return;
        const data = snap.exists() ? snap.data() : null;
        if (!data || data.isActive === false) {
          setState({ phase: "notFound" });
        } else {
          setState({
            phase: "ok",
            name: resolveFacilityName(data.name, lang) || facilityId,
          });
        }
      } catch (e) {
        console.error("[FacilityChat] 施設マスタ取得エラー:", e);
        if (!cancelled) setState({ phase: "notFound" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [facilityId, lang]);

  if (state.phase === "loading") {
    return (
      <div className="w-full h-[100dvh] flex items-center justify-center bg-white">
        <p className="text-sm text-gray-400">
          {pick(FACILITY_LABELS.loading, lang)}
        </p>
      </div>
    );
  }

  if (state.phase === "notFound") {
    return <FacilitySelect showNotFound />;
  }

  return <ChatWidgetFirebase facilityId={facilityId} facilityName={state.name} />;
}
