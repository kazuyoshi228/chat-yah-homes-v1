/**
 * SurveyView — チャット終了後のアンケート（星評価・解決有無・低評価時の自由記述）
 *
 * フォーム状態はこのビュー内に閉じる。送信処理（Firestore書込）は親の onSubmit。
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface SurveyViewProps {
  onSubmit: (survey: {
    rating: number;
    resolved: "yes" | "no" | null;
    freeComment: string;
  }) => Promise<void>;
}

export function SurveyView({ onSubmit }: SurveyViewProps) {
  const { t } = useLanguage();
  const [rating, setRating] = useState(0);
  const [resolved, setResolved] = useState<"yes" | "no" | null>(null);
  const [freeComment, setFreeComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      await onSubmit({ rating, resolved, freeComment });
      setSubmitted(true);
    } catch (error) {
      console.error("[SurveyView] サーベイ送信エラー:", error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 p-4 flex flex-col items-center justify-center gap-3 overflow-y-auto">
      {!submitted ? (
        <>
          <p className="text-sm font-medium text-gray-900 text-center">
            {t("widget_survey_title")}
          </p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <button key={s} onClick={() => setRating(s)}>
                <Star
                  className={cn(
                    "w-7 h-7 transition-colors",
                    s <= rating
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300"
                  )}
                />
              </button>
            ))}
          </div>
          <div className="w-full">
            <p className="text-xs text-gray-500 mb-1.5 text-center">
              {t("survey_resolved_question")}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setResolved("yes")}
                className={cn(
                  "flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                  resolved === "yes"
                    ? "bg-black text-white border-black"
                    : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                )}
              >
                ✔ {t("widget_survey_yes")}
              </button>
              <button
                onClick={() => setResolved("no")}
                className={cn(
                  "flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                  resolved === "no"
                    ? "bg-black text-white border-black"
                    : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                )}
              >
                ✖ {t("widget_survey_no")}
              </button>
            </div>
          </div>
          {rating > 0 && rating <= 3 && (
            <div className="w-full">
              <p className="text-xs text-gray-500 mb-1">{t("survey_improve")}</p>
              <textarea
                value={freeComment}
                onChange={(e) => setFreeComment(e.target.value)}
                placeholder={t("survey_improve_placeholder")}
                rows={2}
                className="w-full text-base border border-gray-200 rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-black/20"
              />
            </div>
          )}
          <Button
            onClick={handleSubmit}
            disabled={rating === 0 || submitting}
            className="w-full bg-black text-white hover:bg-gray-800 text-sm"
          >
            {t("widget_survey_submit")}
          </Button>
        </>
      ) : (
        <>
          <CheckCircle className="w-10 h-10 text-green-500" />
          <p className="text-sm text-gray-600 text-center">
            {t("widget_survey_thanks")}
          </p>
        </>
      )}
    </div>
  );
}
