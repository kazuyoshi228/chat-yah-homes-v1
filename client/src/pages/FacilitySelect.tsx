/**
 * FacilitySelect — 施設案内（フォールバック画面）
 *
 * ルート（/）や未知スラッグでアクセスされた時に、公開中の施設一覧から選んでもらう。
 * 通常の入口は客室QRコード・メール記載の施設別URLのため、この画面は保険。
 */
import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useLocation } from "wouter";
import { db } from "@/lib/firebase";
import { useLanguage } from "@/contexts/LanguageContext";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { FACILITY_LABELS, pick } from "@/components/widget/labels";
import { resolveFacilityName } from "@/pages/FacilityChat";
import { YahLogo } from "@/components/YahLogo";


interface FacilityRow {
  id: string;
  name: string;
}

export default function FacilitySelect({
  showNotFound = false,
}: {
  showNotFound?: boolean;
}) {
  const { lang } = useLanguage();
  const [, navigate] = useLocation();
  // 施設一覧の読取もルール上「認証必須」→ 匿名認証の確立を待つ
  const { user, loading: authLoading } = useFirebaseAuth();
  const [facilities, setFacilities] = useState<FacilityRow[] | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "chat_facilities"), where("isActive", "==", true))
        );
        if (cancelled) return;
        setFacilities(
          snap.docs.map((d) => ({
            id: d.id,
            name: resolveFacilityName(d.data().name, lang) || d.id,
          }))
        );
      } catch (e) {
        console.error("[FacilitySelect] 施設一覧取得エラー:", e);
        if (!cancelled) setFacilities([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lang, authLoading, user]);

  return (
    <div className="w-full min-h-[100dvh] bg-white flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-1">
          <YahLogo className="text-black" height={34} />
          <p className="text-xs text-gray-500">24/7 AI chat support</p>
        </div>

        {showNotFound && (
          <p className="text-sm text-gray-500 text-center whitespace-pre-wrap">
            {pick(FACILITY_LABELS.notFound, lang)}
          </p>
        )}

        <p className="text-sm font-medium">
          {pick(FACILITY_LABELS.selectTitle, lang)}
        </p>

        {facilities === null ? (
          <p className="text-sm text-gray-400">
            {pick(FACILITY_LABELS.loading, lang)}
          </p>
        ) : (
          <div className="w-full flex flex-col gap-2">
            {facilities.map((f) => (
              <button
                key={f.id}
                onClick={() => navigate(`/${f.id}`)}
                className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 hover:border-black hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                {f.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
