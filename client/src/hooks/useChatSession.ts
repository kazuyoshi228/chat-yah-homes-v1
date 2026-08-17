/**
 * useChatSession - Firestore チャットセッション管理フック
 * - createSession(): chat_sessions コレクションにドキュメントを作成
 * - endSession(): セッションのステータスを 'ended' に更新
 * - sessionId を返す
 */
import { useState, useCallback } from "react";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

interface UseChatSessionReturn {
  sessionId: string | null;
  creating: boolean;
  createSession: (params: {
    visitorId: string;
    language: string;
    facilityId: string;
    initialMessage?: string;
  }) => Promise<string>;
  endSession: () => Promise<void>;
  /** ローカル状態のみ破棄（サインアウト時など。サーバのセッションは残る） */
  resetSession: () => void;
}

export function useChatSession(): UseChatSessionReturn {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // セッションを作成
  const createSession = useCallback(
    async (params: {
      visitorId: string;
      language: string;
      facilityId: string;
      initialMessage?: string;
    }): Promise<string> => {
      setCreating(true);
      try {
        const sessionsRef = collection(db, "chat_sessions");
        const docRef = await addDoc(sessionsRef, {
          visitorId: params.visitorId,
          status: "active",
          language: params.language,
          facilityId: params.facilityId,
          initialMessage: params.initialMessage || null,
          createdAt: serverTimestamp(),
        });
        setSessionId(docRef.id);
        return docRef.id;
      } finally {
        setCreating(false);
      }
    },
    []
  );

  // セッションを終了
  const endSession = useCallback(async () => {
    if (!sessionId) return;
    const sessionRef = doc(db, "chat_sessions", sessionId);
    await updateDoc(sessionRef, {
      status: "ended",
      endedAt: serverTimestamp(),
    });
  }, [sessionId]);

  // ローカル状態のみ破棄（サインアウト時: 新しい匿名uidは旧セッションの権限を
  // 持たないため、参照し続けると読取/送信が全て拒否される。共有端末の閲覧防止も兼ねる）
  const resetSession = useCallback(() => {
    setSessionId(null);
  }, []);

  return {
    sessionId,
    creating,
    createSession,
    endSession,
    resetSession,
  };
}
