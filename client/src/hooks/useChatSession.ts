/**
 * useChatSession - Firestore チャットセッション管理フック
 * - createSession(): chat_sessions コレクションにドキュメントを作成
 * - endSession(): セッションのステータスを 'ended' に更新
 * - sessionId を返す
 *
 * 🔑 会話の継続性: sessionId は localStorage に施設別で保存し、リロードや
 *    アプリ切替で会話が消えないようにする（宿泊者は滞在中に何度も開くため）。
 *    有効期限は24時間（別の滞在の会話が混ざらないよう自動失効）。
 */
import { useState, useCallback, useEffect } from "react";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/** 保存キー（施設別）と有効期限 */
const STORE_PREFIX = "yah_chat_session_";
const TTL_MS = 24 * 60 * 60 * 1000;

function loadStored(facilityId: string): string | null {
  try {
    const raw = localStorage.getItem(STORE_PREFIX + facilityId);
    if (!raw) return null;
    const { id, at } = JSON.parse(raw) as { id: string; at: number };
    if (!id || !at || Date.now() - at > TTL_MS) {
      localStorage.removeItem(STORE_PREFIX + facilityId);
      return null;
    }
    return id;
  } catch {
    return null;
  }
}

function saveStored(facilityId: string, id: string | null) {
  try {
    const key = STORE_PREFIX + facilityId;
    if (id) localStorage.setItem(key, JSON.stringify({ id, at: Date.now() }));
    else localStorage.removeItem(key);
  } catch {
    /* プライベートブラウズ等で失敗しても動作は継続 */
  }
}

interface UseChatSessionReturn {
  sessionId: string | null;
  /** 復元したセッションがあるか（UIが最初からチャット画面を出すため） */
  restored: boolean;
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

export function useChatSession(facilityId: string): UseChatSessionReturn {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [creating, setCreating] = useState(false);

  // 初回マウント時に保存済みセッションを復元（施設が一致するもののみ）
  useEffect(() => {
    if (!facilityId) return;
    const stored = loadStored(facilityId);
    if (stored) {
      setSessionId(stored);
      setRestored(true);
    }
  }, [facilityId]);

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
        saveStored(params.facilityId, docRef.id);
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
    saveStored(facilityId, null); // 終了した会話は復元しない
  }, [sessionId, facilityId]);

  // ローカル状態のみ破棄（サインアウト時: 新しい匿名uidは旧セッションの権限を
  // 持たないため、参照し続けると読取/送信が全て拒否される。共有端末の閲覧防止も兼ねる）
  const resetSession = useCallback(() => {
    setSessionId(null);
    setRestored(false);
    saveStored(facilityId, null);
  }, [facilityId]);

  return {
    sessionId,
    restored,
    creating,
    createSession,
    endSession,
    resetSession,
  };
}
