/**
 * BigKPIsFirebase — KPI ダッシュボード（Firestore版）
 * tRPC → Firestore onSnapshot リアルタイム集計
 */
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { orderBy, limit } from "firebase/firestore";
import {
  useSessionStats, useChatSessions, useCollection, type ChatSessionDoc,
} from "@/hooks/useFirestoreAdmin";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Bot, Clock, Users, MessageCircle, CheckCircle,
  XCircle, Star, Target, Activity, AlertTriangle,
  MessageSquare, BookOpen, FilePlus2,
} from "lucide-react";

const LANG_LABELS: Record<string, string> = {
  ja: "日本語", en: "English", zh: "中文", ko: "한국어",
  th: "ไทย", vi: "Tiếng Việt", unknown: "Other",
};

export default function BigKPIsFirebase() {
  const { stats, loading } = useSessionStats();
  const { sessions } = useChatSessions();

  // 直近のエスカレーション
  const recentEscalations = useMemo(() => {
    return sessions
      .filter((s) => s.escalated)
      .slice(0, 5);
  }, [sessions]);

  if (loading || !stats) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <h1 className="text-2xl font-bold">KPI ダッシュボード</h1>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const kpis = [
    {
      title: "総セッション数",
      value: stats.total,
      icon: MessageCircle,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "アクティブ",
      value: stats.active,
      icon: Activity,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      title: "AI解決率",
      value: `${stats.resolvedRate.toFixed(1)}%`,
      icon: Target,
      color: stats.resolvedRate >= 99 ? "text-green-600" : "text-amber-600",
      bg: stats.resolvedRate >= 99 ? "bg-green-50" : "bg-amber-50",
      subtitle: "目標: 99.9%",
    },
    {
      title: "エスカレーション",
      value: stats.escalated,
      icon: AlertTriangle,
      color: stats.escalated > 0 ? "text-red-600" : "text-green-600",
      bg: stats.escalated > 0 ? "bg-red-50" : "bg-green-50",
    },
    {
      title: "平均評価",
      value: stats.avgRating > 0 ? `${stats.avgRating.toFixed(1)} ⭐` : "—",
      icon: Star,
      color: "text-yellow-600",
      bg: "bg-yellow-50",
    },
    {
      title: "終了済み",
      value: stats.ended,
      icon: CheckCircle,
      color: "text-gray-600",
      bg: "bg-gray-50",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* ヘッダー */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">KPI ダッシュボード</h1>
          <p className="text-sm text-muted-foreground mt-1">
            リアルタイム集計（Firestore onSnapshot）
          </p>
        </div>

        {/* KPI カード */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {kpis.map((kpi) => (
            <Card key={kpi.title} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {kpi.title}
                </CardTitle>
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", kpi.bg)}>
                  <kpi.icon className={cn("w-4 h-4", kpi.color)} />
                </div>
              </CardHeader>
              <CardContent>
                <div className={cn("text-2xl font-bold", kpi.color)}>
                  {kpi.value}
                </div>
                {kpi.subtitle && (
                  <p className="text-xs text-muted-foreground mt-1">{kpi.subtitle}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 言語分布 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">言語分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.byLanguage)
                .sort(([, a], [, b]) => b - a)
                .map(([lang, count]) => (
                  <Badge key={lang} variant="outline" className="text-xs">
                    {LANG_LABELS[lang] || lang}: {count}
                    <span className="ml-1 text-muted-foreground">
                      ({stats.total > 0 ? ((count / stats.total) * 100).toFixed(0) : 0}%)
                    </span>
                  </Badge>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* 最近のエスカレーション */}
        {recentEscalations.length > 0 && (
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                最近のエスカレーション
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentEscalations.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-red-50/50 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <span className="text-xs font-mono text-muted-foreground">
                        {s.id.slice(0, 8)}...
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {s.language}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {s.createdAt?.toDate
                        ? s.createdAt.toDate().toLocaleString("ja-JP")
                        : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 失敗分析（計測ループ・chat_agent_logs） */}
        <FailureAnalysisCard />
      </div>
    </DashboardLayout>
  );
}

// ── 失敗分析カード（ミニマル: 数値＋CSS横バー＋失敗一覧） ──

interface AgentLog {
  id: string;
  sessionId?: string;
  question?: string;
  resolved?: boolean;
  ragHitCount?: number;
  ragTopId?: string | null;
  failureBucket?: string;
}

const BUCKET_LABELS: Record<string, string> = {
  knowledge_gap: "知識欠落(RAG0)",
  account_or_emotional: "アカウント/感情",
  answer_quality: "回答品質",
};
const FAILURE_BUCKETS = ["knowledge_gap", "account_or_emotional", "answer_quality"];

function FailureAnalysisCard() {
  const { docs, loading } = useCollection("chat_agent_logs", [
    orderBy("createdAt", "desc"),
    limit(200),
  ]);
  const logs = docs as unknown as AgentLog[];

  const { total, resolvedRate, counts, maxCount, failures } = useMemo(() => {
    const total = logs.length;
    const resolvedCount = logs.filter((l) => l.resolved).length;
    const counts: Record<string, number> = {};
    for (const b of FAILURE_BUCKETS) counts[b] = 0;
    for (const l of logs) {
      if (l.resolved) continue;
      const b = l.failureBucket || "answer_quality";
      counts[b] = (counts[b] || 0) + 1;
    }
    const maxCount = Math.max(1, ...FAILURE_BUCKETS.map((b) => counts[b] || 0));
    const failures = logs.filter((l) => !l.resolved).slice(0, 12);
    return {
      total,
      resolvedRate: total > 0 ? (resolvedCount / total) * 100 : 0,
      counts,
      maxCount,
      failures,
    };
  }, [logs]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Target className="w-4 h-4 text-amber-500" />
          失敗分析
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            直近{total}件
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : total === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            まだログがありません（AI応答が記録され次第ここに表示されます）
          </p>
        ) : (
          <div className="space-y-5">
            {/* 数値 */}
            <div className="flex gap-6">
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {resolvedRate.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">解決率</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{total}</div>
                <div className="text-xs text-muted-foreground">対象件数</div>
              </div>
            </div>

            {/* 原因別（CSS横バー） */}
            <div className="space-y-1.5">
              {FAILURE_BUCKETS.map((b) => (
                <div key={b} className="flex items-center gap-2">
                  <span className="text-xs w-28 flex-shrink-0 text-muted-foreground">
                    {BUCKET_LABELS[b]}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded h-4 overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded",
                        b === "knowledge_gap" ? "bg-amber-400" : "bg-gray-400"
                      )}
                      style={{ width: `${((counts[b] || 0) / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs w-8 text-right tabular-nums">
                    {counts[b] || 0}
                  </span>
                </div>
              ))}
            </div>

            {/* 直近の失敗一覧 */}
            {failures.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-muted-foreground">
                  直近の失敗
                </div>
                {failures.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center gap-2 text-xs py-1.5 border-b last:border-0"
                  >
                    <span className="flex-1 truncate" title={l.question}>
                      {l.question || "（空）"}
                    </span>
                    <Badge variant="outline" className="text-[10px] flex-shrink-0">
                      {BUCKET_LABELS[l.failureBucket || "answer_quality"]}
                    </Badge>
                    {l.sessionId && (
                      <Link
                        href={`/admin/chats?session=${l.sessionId}`}
                        className="flex items-center gap-0.5 text-blue-600 hover:underline flex-shrink-0"
                      >
                        <MessageSquare className="w-3 h-3" />
                        会話
                      </Link>
                    )}
                    {(l.ragHitCount ?? 0) > 0 && l.ragTopId ? (
                      <Link
                        href={`/admin/rag?doc=${l.ragTopId}`}
                        className="flex items-center gap-0.5 text-blue-600 hover:underline flex-shrink-0"
                      >
                        <BookOpen className="w-3 h-3" />
                        RAG編集
                      </Link>
                    ) : (
                      <Link
                        href={`/admin/rag?draft=${encodeURIComponent(l.question || "")}`}
                        className="flex items-center gap-0.5 text-blue-600 hover:underline flex-shrink-0"
                      >
                        <FilePlus2 className="w-3 h-3" />
                        RAG新規
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
