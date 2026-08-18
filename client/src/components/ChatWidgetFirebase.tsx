/**
 * ChatWidgetFirebase - 施設別スタンドアロンチャット（本体・全画面）
 *
 * chat.yah.homes/{facilityId} で開く単独ページ。埋め込みモードは持たない。
 * ここは「状態と配線」のみ。各ビューは components/widget/ 配下:
 *   FlowView（冒頭分岐ツリー） / ChatView（AIチャット） /
 *   LoginPanel（ログイン/新規登録） / SurveyView（終了アンケート） / labels（多言語辞書）
 */
import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, LogIn, LogOut } from "lucide-react";
import { YahLogo } from "@/components/YahLogo";
import { useLanguage } from "@/contexts/LanguageContext";
import { collection, getDocs, addDoc, setDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { parseI18n } from "@/lib/i18nJson";

// カスタムフック
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { useChatSession } from "@/hooks/useChatSession";
import { useChatMessages } from "@/hooks/useChatMessages";

// ウィジェットの各ビュー
import { FlowView } from "@/components/widget/FlowView";
import { ChatView } from "@/components/widget/ChatView";
import { LoginPanel } from "@/components/widget/LoginPanel";
import { SurveyView } from "@/components/widget/SurveyView";
import { AUTH_LABELS, pick } from "@/components/widget/labels";
import type { FlowNode } from "@/components/widget/types";

type WidgetState = "flow" | "chat" | "ended";

interface ChatWidgetFirebaseProps {
  /** 施設スラッグ（URLパス。セッションとRAG検索の施設分離キー） */
  facilityId: string;
  /** 施設表示名（chat_facilities マスタから解決済み） */
  facilityName: string;
}

export default function ChatWidgetFirebase({
  facilityId,
  facilityName,
}: ChatWidgetFirebaseProps) {
  const { lang: language } = useLanguage();

  // Firebase認証（匿名自動サインイン＋ゲストログイン/新規登録）
  const {
    user,
    loading: authLoading,
    isAnonymous,
    signInWithGoogle,
    registerWithEmail,
    signInWithEmail,
    signOutUser,
  } = useFirebaseAuth();

  // チャットセッション管理
  const {
    sessionId,
    creating: sessionCreating,
    createSession,
    endSession,
    resetSession,
  } = useChatSession();

  // ログイン/所有者付け替え後にメッセージ購読を張り直すためのキー
  const [authReloadKey, setAuthReloadKey] = useState(0);

  // リアルタイムメッセージ同期
  const { messages, typingIndicator, sendMessage } = useChatMessages(
    sessionId,
    authReloadKey
  );

  // ── ページ状態（単独ページ＝最初からフロー表示） ──
  const [widgetState, setWidgetState] = useState<WidgetState>("flow");
  const [showLogin, setShowLogin] = useState(false);

  // デシジョンツリー状態
  const [flowNodes, setFlowNodes] = useState<FlowNode[]>([]);
  const [currentNodeId, setCurrentNodeId] = useState<string>("root");
  const [breadcrumb, setBreadcrumb] = useState<string[]>([]);

  // ── Firestoreからフローノードを取得 ──
  useEffect(() => {
    const fetchFlowNodes = async () => {
      try {
        const snapshot = await getDocs(collection(db, "chat_flow_nodes"));
        setFlowNodes(
          snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as FlowNode[]
        );
      } catch (error) {
        console.error("[ChatWidgetFirebase] フローノード取得エラー:", error);
      }
    };
    fetchFlowNodes();
  }, []);

  // ── デシジョンツリー ヘルパー ──
  const currentNode = flowNodes.find((n) => n.id === currentNodeId);
  const childIds: string[] = currentNode?.options
    ? JSON.parse(currentNode.options)
    : [];
  const childNodes = childIds
    .map((id) => flowNodes.find((n) => n.id === id))
    .filter(Boolean) as FlowNode[];

  const navigateBack = () => {
    if (breadcrumb.length === 0) return;
    const prev = [...breadcrumb];
    const last = prev.pop()!;
    setBreadcrumb(prev);
    setCurrentNodeId(last);
  };

  // ── AIチャットセッション開始 ──
  //   分岐で選んだ意図を「最初の訪問者メッセージ」として自動送信する。
  //   これが onVisitorMessageCreated を発火させ、AIが即座に最初の応答を返す
  //   （送らないと入力があるまで無反応＝分岐を押しても何も起きないように見える）。
  const handleStartAiChat = useCallback(
    async (greeting: string) => {
      if (!user || sessionCreating) return;
      try {
        const sid = await createSession({
          visitorId: user.uid,
          language,
          facilityId,
          initialMessage: greeting || "Hello",
        });
        await addDoc(collection(db, "chat_sessions", sid, "chat_messages"), {
          role: "visitor",
          content: greeting || "Hello",
          createdAt: serverTimestamp(),
        });
        setWidgetState("chat");
      } catch (error) {
        console.error("[ChatWidgetFirebase] セッション作成エラー:", error);
      }
    },
    [user, sessionCreating, createSession, language, facilityId]
  );

  // ── ノード選択（aiTrigger の遷移判定） ──
  const handleNodeSelect = (node: FlowNode) => {
    if (node.aiTrigger) {
      handleStartAiChat(parseI18n(node.content, language));
      return;
    }
    setBreadcrumb((prev) => [...prev, currentNodeId]);
    setCurrentNodeId(node.id);
  };

  // ── サインアウト ──
  //   サインアウトすると新しい匿名uidに切り替わり、進行中セッションへの権限を失う
  //   （送信が全て拒否される）。共有端末での前アカウント会話の閲覧防止も兼ねて、
  //   会話をリセットして最初の分岐へ戻す。
  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (error) {
      console.error("[ChatWidgetFirebase] サインアウトエラー:", error);
    }
    resetSession();
    setWidgetState("flow");
    setCurrentNodeId("root");
    setBreadcrumb([]);
    setShowLogin(false);
  };

  // ── セッション終了 ──
  const handleEndSession = async () => {
    if (!sessionId) return;
    try {
      await endSession();
      setWidgetState("ended");
    } catch (error) {
      console.error("[ChatWidgetFirebase] セッション終了エラー:", error);
    }
  };

  // ── サーベイ送信（Firestoreに直接書き込み） ──
  const handleSurveySubmit = async (survey: {
    rating: number;
    resolved: "yes" | "no" | null;
    freeComment: string;
  }) => {
    if (!sessionId || !user) return;
    await setDoc(doc(db, "chat_surveys", sessionId), {
      sessionId,
      visitorId: user.uid,
      facilityId,
      rating: survey.rating,
      resolved: survey.resolved ?? null,
      freeComment: survey.freeComment || null,
      createdAt: serverTimestamp(),
    });
  };

  // 認証ロード中は何も表示しない
  if (authLoading) return null;

  return (
    <div className="w-full h-[100dvh] bg-white flex flex-col overflow-hidden">
      {/* ヘッダー */}
      <div className="bg-black px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          {breadcrumb.length > 0 && widgetState === "flow" && (
            <button
              onClick={navigateBack}
              className="p-1 text-white/60 hover:text-white transition-colors mr-1"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          {/* yah.homes 横型ロゴ（白） */}
          <YahLogo className="text-white" height={24} />
          <div>
            <p className="text-sm font-medium text-white">{facilityName}</p>
            <p className="text-xs text-white/60">
              yah.homes · 24/7 AI chat support
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isAnonymous ? (
            <button
              onClick={() => setShowLogin(true)}
              className="text-xs text-white/80 hover:text-white px-2 py-1 rounded-md border border-white/25 transition-colors flex items-center gap-1"
            >
              <LogIn className="w-3.5 h-3.5" />
              {pick(AUTH_LABELS.signin, language)}
            </button>
          ) : (
            <button
              onClick={handleSignOut}
              title={user?.email ?? undefined}
              className="text-xs text-white/70 hover:text-white px-2 py-1 rounded-md transition-colors flex items-center gap-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              {pick(AUTH_LABELS.signout, language)}
            </button>
          )}
        </div>
      </div>

      {/* ── ログイン / 新規登録パネル ── */}
      {showLogin && (
        <LoginPanel
          sessionId={sessionId}
          signInWithGoogle={signInWithGoogle}
          registerWithEmail={registerWithEmail}
          signInWithEmail={signInWithEmail}
          onSuccess={() => {
            setShowLogin(false);
            // 付け替え後は権限が変わるのでメッセージ購読を張り直す
            setAuthReloadKey((k) => k + 1);
          }}
          onClose={() => setShowLogin(false)}
        />
      )}

      {/* ── デシジョンツリーフロー ── */}
      {widgetState === "flow" && !showLogin && (
        <FlowView
          currentNode={currentNode}
          childNodes={childNodes}
          hasNodes={flowNodes.length > 0}
          sessionCreating={sessionCreating}
          onSelectNode={handleNodeSelect}
          onStartAiChat={handleStartAiChat}
        />
      )}

      {/* ── AIチャット ── */}
      {widgetState === "chat" && !showLogin && (
        <ChatView
          messages={messages}
          typing={typingIndicator}
          onSend={sendMessage}
          onEndSession={handleEndSession}
        />
      )}

      {/* ── 終了 + サーベイ ── */}
      {widgetState === "ended" && !showLogin && (
        <SurveyView onSubmit={handleSurveySubmit} />
      )}
    </div>
  );
}
