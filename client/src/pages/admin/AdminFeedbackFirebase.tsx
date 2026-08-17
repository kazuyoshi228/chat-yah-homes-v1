/**
 * AdminFeedbackFirebase — フィードバック管理画面（Firestore版）
 * tRPC → Firestore SDK 直接
 */
import { useMemo } from "react";
import { orderBy, Timestamp } from "firebase/firestore";
import { useCollection } from "@/hooks/useFirestoreAdmin";
import DashboardLayout from "@/components/DashboardLayout";
import { YahLogo } from "@/components/YahLogo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, MessageSquare, CheckCircle, XCircle, Minus } from "lucide-react";

const LANG_LABEL: Record<string, string> = {
  ja: "日本語", en: "English", zh: "中文", ko: "한국어", th: "ภาษาไทย", vi: "Tiếng Việt",
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i < rating ? "fill-amber-400 text-amber-400" : "text-gray-200"}`}
        />
      ))}
      <span className="ml-1 text-xs text-muted-foreground">{rating}/5</span>
    </div>
  );
}

function ResolvedBadge({ resolved }: { resolved: string | null | undefined }) {
  if (resolved === "yes") return <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200 gap-1"><CheckCircle className="h-3 w-3" />Resolved</Badge>;
  if (resolved === "no") return <Badge variant="secondary" className="bg-red-50 text-red-700 border-red-200 gap-1"><XCircle className="h-3 w-3" />Unresolved</Badge>;
  return <Badge variant="secondary" className="gap-1"><Minus className="h-3 w-3" />N/A</Badge>;
}

// Stable constraints reference to avoid re-renders
const surveyConstraints = [orderBy("createdAt", "desc")];

/** chat_surveys ドキュメント（アンケート） */
interface SurveyDoc {
  id: string;
  sessionId?: string;
  rating: number;
  resolved?: "yes" | "no" | null;
  language?: string;
  operatorId?: string;
  comment?: string;
  freeComment?: string;
  visitorName?: string;
  createdAt?: Timestamp | number | null;
}

export default function AdminFeedbackFirebase() {
  const { docs: rawData, loading: isLoading } = useCollection("chat_surveys", surveyConstraints);

  const data = rawData as unknown as SurveyDoc[];

  const avgRating = useMemo(() => {
    if (!data || data.length === 0) return "—";
    return (data.reduce((s, d) => s + (d.rating ?? 0), 0) / data.length).toFixed(1);
  }, [data]);

  const resolvedCount = useMemo(
    () => data?.filter((d) => d.resolved === "yes").length ?? 0,
    [data]
  );

  const withComments = useMemo(
    () => data?.filter((d) => d.freeComment || d.comment).length ?? 0,
    [data]
  );

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <YahLogo height={32} className="text-black" />
          <h1 className="text-xl font-semibold">Feedback</h1>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Responses", value: isLoading ? "—" : String(data?.length ?? 0) },
            { label: "Avg. Rating", value: isLoading ? "—" : `★ ${avgRating}` },
            { label: "Resolved", value: isLoading ? "—" : String(resolvedCount) },
            { label: "With Comments", value: isLoading ? "—" : String(withComments) },
          ].map((item) => (
            <Card key={item.label} className="border border-gray-100 shadow-none">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-2xl font-semibold mt-1">{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Feedback list */}
        <Card className="border border-gray-100 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">All Responses</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))}
              </div>
            ) : !data || data.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <MessageSquare className="h-10 w-10 text-gray-200 mb-3" />
                <p className="text-sm text-muted-foreground">No feedback yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {data.map((item) => (
                  <div key={item.id} className="px-5 py-4 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StarRating rating={item.rating} />
                          <ResolvedBadge resolved={item.resolved} />
                          {item.language && (
                            <Badge variant="outline" className="text-xs">
                              {LANG_LABEL[item.language] ?? item.language}
                            </Badge>
                          )}
                          {item.operatorId ? (
                            <Badge variant="outline" className="text-xs text-blue-600 border-blue-200">Admin対応</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-purple-600 border-purple-200">AI</Badge>
                          )}
                        </div>
                        {item.comment && (
                          <p className="text-sm text-foreground leading-relaxed">{item.comment}</p>
                        )}
                        {item.freeComment && (
                          <div className="bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
                            <p className="text-xs text-amber-700 font-medium mb-0.5">Free comment</p>
                            <p className="text-sm text-amber-900 leading-relaxed">{item.freeComment}</p>
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">
                          {item.visitorName || "Anonymous"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Session #{item.sessionId}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.createdAt instanceof Timestamp
                            ? item.createdAt.toDate().toLocaleDateString()
                            : typeof item.createdAt === "number"
                              ? new Date(item.createdAt).toLocaleDateString()
                              : "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
