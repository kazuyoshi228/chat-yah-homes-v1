/**
 * AdminChatListFirebase — チャット履歴一覧（Firestore版）
 * セッション一覧 + メッセージ詳細表示
 */
import { useState, useEffect } from "react";
import {
  collection, query, orderBy, onSnapshot, limit, doc, updateDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useChatSessions, type ChatSessionDoc } from "@/hooks/useFirestoreAdmin";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  MessageCircle, Bot, User, AlertTriangle, ChevronRight,
  X, Clock, Loader2,
} from "lucide-react";

interface ChatMessage {
  id: string;
  role: string;
  content: string;
  resolved?: boolean;
  directToContact?: boolean;
  createdAt: unknown;
}

export default function AdminChatListFirebase() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { sessions: allSessions, loading } = useChatSessions(statusFilter);
  // 施設フィルタ（施設一覧はセッションの facilityId から動的に集計＝マスタ非依存）
  const [facilityFilter, setFacilityFilter] = useState<string>("all");
  const facilityIds = Array.from(
    new Set(allSessions.map((s) => s.facilityId).filter(Boolean))
  ) as string[];
  const sessions =
    facilityFilter === "all"
      ? allSessions
      : allSessions.filter((s) => s.facilityId === facilityFilter);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [customerName, setCustomerName] = useState<string>("");
  const [endingSession, setEndingSession] = useState(false);

  // アクティブなセッションを管理者が手動終了（status→ended。ルールで許可済みの
  // 限定更新。onSessionEnded トリガーが発火してサマリーも自動生成される）
  const handleEndSession = async () => {
    if (!selectedId) return;
    if (!confirm("このセッションを終了しますか？（訪問者は送信できなくなります）"))
      return;
    setEndingSession(true);
    try {
      await updateDoc(doc(db, "chat_sessions", selectedId), {
        status: "ended",
        endedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("セッション終了エラー:", e);
      alert("終了に失敗しました");
    } finally {
      setEndingSession(false);
    }
  };

  // ディープリンク（失敗分析の「会話を見る」→ ?session=<id>）
  useEffect(() => {
    const sid = new URLSearchParams(window.location.search).get("session");
    if (sid) setSelectedId(sid);
  }, []);

  // 選択セッションのメッセージをリアルタイム監視
  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    setMessagesLoading(true);

    const ref = collection(db, `chat_sessions/${selectedId}/chat_messages`);
    const q = query(ref, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(q, (snap) => {
      setMessages(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatMessage))
      );
      // ↑ resolved も d.data() から取り込まれる（ChatMessage に resolved を追加済み）
      setMessagesLoading(false);
    });

    return () => unsubscribe();
  }, [selectedId]);

  // 選択セッションの顧客名（onVisitorMessageCreated が session.customerName に保存）
  useEffect(() => {
    if (!selectedId) {
      setCustomerName("");
      return;
    }
    const session = sessions.find((s) => s.id === selectedId);
    setCustomerName(session?.customerName || "匿名ユーザー（未ログイン）");
  }, [selectedId, sessions]);

  const selectedSession = sessions.find((s) => s.id === selectedId);

  const filters = [
    { key: "all", label: "全て" },
    { key: "active", label: "アクティブ" },
    { key: "ended", label: "終了" },
  ];

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-120px)]">
        {/* 左: セッション一覧 */}
        <div className="w-80 border-r flex flex-col">
          <div className="p-3 border-b">
            <h2 className="text-sm font-bold mb-2">チャット履歴</h2>
            <div className="flex gap-1">
              {filters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                    statusFilter === f.key
                      ? "bg-black text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {facilityIds.length > 0 && (
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {["all", ...facilityIds].map((fid) => (
                  <button
                    key={fid}
                    onClick={() => setFacilityFilter(fid)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors",
                      facilityFilter === fid
                        ? "bg-gray-800 text-white"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    )}
                  >
                    {fid === "all" ? "全施設" : fid}
                  </button>
                ))}
              </div>
            )}
          </div>

          <ScrollArea className="flex-1">
            {loading ? (
              <div className="p-3 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                セッションがありません
              </div>
            ) : (
              <div className="p-1">
                {sessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedId(s.id)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg mb-1 transition-colors",
                      selectedId === s.id
                        ? "bg-black text-white"
                        : "hover:bg-gray-50"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium truncate max-w-[150px]">
                        {s.customerName || `匿名 · ${s.id.slice(0, 6)}`}
                      </span>
                      <div className="flex gap-1">
                        {s.escalated && (
                          <AlertTriangle className={cn(
                            "w-3 h-3",
                            selectedId === s.id ? "text-red-300" : "text-red-500"
                          )} />
                        )}
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            selectedId === s.id && "border-white/30 text-white/80"
                          )}
                        >
                          {s.language}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        s.status === "active" ? "bg-green-500" : "bg-gray-400"
                      )} />
                      <span className={cn(
                        "text-xs",
                        selectedId === s.id ? "text-white/60" : "text-muted-foreground"
                      )}>
                        {s.status === "active" ? "アクティブ" : "終了"}
                      </span>
                      {s.facilityId && (
                        <span
                          className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-full ml-1 flex-shrink-0",
                            selectedId === s.id
                              ? "bg-white/20 text-white/90"
                              : "bg-gray-100 text-gray-600"
                          )}
                        >
                          {s.facilityId}
                        </span>
                      )}
                      {s.escalated && (
                        <span
                          className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-full ml-1 flex-shrink-0",
                            selectedId === s.id
                              ? "bg-white/20 text-white/90"
                              : "bg-red-50 text-red-600"
                          )}
                        >
                          📮 窓口誘導
                        </span>
                      )}
                      {s.summary && (
                        <span className={cn(
                          "text-xs truncate ml-1",
                          selectedId === s.id ? "text-white/50" : "text-muted-foreground"
                        )}>
                          — {s.summary}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* 右: メッセージ詳細 */}
        <div className="flex-1 flex flex-col">
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">セッションを選択してください</p>
              </div>
            </div>
          ) : (
            <>
              {/* ヘッダー */}
              <div className="border-b p-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold">{customerName}</h3>
                  <div className="flex gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground font-mono">
                      {selectedId}
                    </span>
                    {selectedSession?.escalated && (
                      <Badge variant="destructive" className="text-[10px]">
                        エスカレーション
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedSession?.status === "active" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleEndSession}
                      disabled={endingSession}
                      className="text-xs text-red-600 border-red-200 hover:bg-red-50"
                    >
                      {endingSession ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        "セッションを終了"
                      )}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedId(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* メッセージ */}
              <ScrollArea className="flex-1 p-4">
                {messagesLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg) => {
                      const isVisitor = msg.role === "visitor";
                      const directedToContact =
                        msg.role === "ai" &&
                        (msg.directToContact === true ||
                          msg.resolved === false);
                      return (
                        <div key={msg.id}>
                          <div
                            className={cn(
                              "flex items-end gap-2",
                              isVisitor ? "flex-row-reverse" : "flex-row"
                            )}
                          >
                            {!isVisitor && (
                              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                                <Bot className="w-3 h-3 text-gray-500" />
                              </div>
                            )}
                            {isVisitor && (
                              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                <User className="w-3 h-3 text-blue-600" />
                              </div>
                            )}
                            <div
                              className={cn(
                                "max-w-[70%] rounded-xl px-3 py-2 text-xs",
                                isVisitor
                                  ? "bg-blue-600 text-white rounded-br-sm"
                                  : "bg-gray-100 text-gray-800 rounded-bl-sm"
                              )}
                            >
                              <p className="whitespace-pre-wrap leading-relaxed">
                                {msg.content}
                              </p>
                            </div>
                          </div>
                          {/* エスカレーション: このAI回答で問い合わせフォームへ誘導した印 */}
                          {directedToContact && (
                            <div className="flex items-center gap-2 my-2">
                              <div className="flex-1 h-px bg-red-200" />
                              <span className="text-[10px] text-red-600 whitespace-nowrap">
                                📮 お問い合わせフォームへ誘導（エスカレーション）
                              </span>
                              <div className="flex-1 h-px bg-red-200" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
