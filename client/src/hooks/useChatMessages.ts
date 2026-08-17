/**
 * useChatMessages - Firestoreリアルタイムメッセージ同期フック
 * - onSnapshot で chat_sessions/{sessionId}/messages をリアルタイム監視
 * - sendMessage(): messages サブコレクションにドキュメントを追加
 * - タイピングインジケーター: 最新メッセージが visitor の場合に表示
 * - アンマウント時にリスナーをクリーンアップ
 */
import { useState, useEffect, useCallback } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: "visitor" | "admin" | "ai";
  content: string;
  resolved?: boolean;
  /** 人間の連絡窓口（予約経路別）へ誘導した回答か。AIが設定 */
  directToContact?: boolean;
  /** 回答に添付する写真URL（登録済み写真のみ・サーバ側でホワイトリスト済み） */
  photoUrls?: string[];
  createdAt: Date | Timestamp | null;
}

interface UseChatMessagesReturn {
  messages: ChatMessage[];
  loading: boolean;
  typingIndicator: boolean;
  sendMessage: (content: string) => Promise<void>;
}

export function useChatMessages(
  sessionId: string | null,
  reloadKey = 0
): UseChatMessagesReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [typingIndicator, setTypingIndicator] = useState(false);

  // Firestore リアルタイムリスナー
  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // messages サブコレクションを createdAt 昇順で監視
    const messagesRef = collection(
      db,
      "chat_sessions",
      sessionId,
      "chat_messages"
    );
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const msgs: ChatMessage[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          sessionId: sessionId,
          role: doc.data().role,
          content: doc.data().content,
          resolved: doc.data().resolved,
          directToContact: doc.data().directToContact,
          photoUrls: doc.data().photoUrls ?? [],
          createdAt: doc.data().createdAt,
        }));
        setMessages(msgs);
        setLoading(false);

        // タイピングインジケーター検出:
        // 最新メッセージが visitor からの場合、AI/admin の返信待ち
        if (msgs.length > 0) {
          const latestMsg = msgs[msgs.length - 1];
          setTypingIndicator(latestMsg.role === "visitor");
        } else {
          setTypingIndicator(false);
        }
      },
      (error) => {
        console.error("[useChatMessages] onSnapshot エラー:", error);
        setLoading(false);
      }
    );

    // クリーンアップ: リスナーを解除
    return () => unsubscribe();
    // reloadKey: ログイン/所有者付け替え後に再購読する（uid変更で権限が変わるため）
  }, [sessionId, reloadKey]);

  // メッセージを送信
  const sendMessage = useCallback(
    async (content: string) => {
      if (!sessionId || !content.trim()) return;

      const messagesRef = collection(
        db,
        "chat_sessions",
        sessionId,
        "chat_messages"
      );
      await addDoc(messagesRef, {
        role: "visitor" as const,
        content: content.trim(),
        createdAt: serverTimestamp(),
      });
    },
    [sessionId]
  );

  return {
    messages,
    loading,
    typingIndicator,
    sendMessage,
  };
}
