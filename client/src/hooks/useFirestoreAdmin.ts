/**
 * Admin用 Firestore hooks
 * tRPC を排除し、Firestore SDK で直接データアクセス
 */
import { useState, useEffect, useCallback } from "react";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// ── 汎用 Firestore コレクション取得 ──

export interface FirestoreDoc {
  id: string;
  [key: string]: unknown;
}

/**
 * コレクションをリアルタイムで監視
 */
export function useCollection(
  collectionName: string,
  constraints: QueryConstraint[] = []
) {
  const [docs, setDocs] = useState<FirestoreDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ref = collection(db, collectionName);
    const q = query(ref, ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setDocs(data);
        setLoading(false);
      },
      (err) => {
        console.error(`[Firestore] ${collectionName} 読取エラー:`, err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [collectionName, JSON.stringify(constraints)]);

  return { docs, loading, error };
}

/**
 * ドキュメントを追加
 */
export function useAddDoc(collectionName: string) {
  const [loading, setLoading] = useState(false);

  const addDocument = useCallback(
    async (data: Record<string, unknown>) => {
      setLoading(true);
      try {
        const ref = collection(db, collectionName);
        const docRef = await addDoc(ref, {
          ...data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return docRef.id;
      } finally {
        setLoading(false);
      }
    },
    [collectionName]
  );

  return { addDocument, loading };
}

/**
 * ドキュメントを更新
 */
export function useUpdateDoc(collectionName: string) {
  const [loading, setLoading] = useState(false);

  const updateDocument = useCallback(
    async (docId: string, data: Record<string, unknown>) => {
      setLoading(true);
      try {
        const ref = doc(db, collectionName, docId);
        await updateDoc(ref, {
          ...data,
          updatedAt: serverTimestamp(),
        });
      } finally {
        setLoading(false);
      }
    },
    [collectionName]
  );

  return { updateDocument, loading };
}

/**
 * ドキュメントを削除
 */
export function useDeleteDoc(collectionName: string) {
  const [loading, setLoading] = useState(false);

  const deleteDocument = useCallback(
    async (docId: string) => {
      setLoading(true);
      try {
        const ref = doc(db, collectionName, docId);
        await deleteDoc(ref);
      } finally {
        setLoading(false);
      }
    },
    [collectionName]
  );

  return { deleteDocument, loading };
}

// ── チャットセッション統計 ──

export interface SessionStats {
  total: number;
  active: number;
  ended: number;
  escalated: number;
  avgRating: number;
  resolvedRate: number;
  byLanguage: Record<string, number>;
}

export function useSessionStats() {
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sessionsRef = collection(db, "chat_sessions");
    const chat_surveysRef = collection(db, "chat_surveys");

    const unsubscribe = onSnapshot(sessionsRef, async (sessionsSnap) => {
      const sessions = sessionsSnap.docs.map((d) => d.data());

      let active = 0;
      let ended = 0;
      let escalated = 0;
      const byLanguage: Record<string, number> = {};

      for (const s of sessions) {
        if (s.status === "active") active++;
        if (s.status === "ended") ended++;
        if (s.escalated) escalated++;
        const lang = (s.language as string) || "unknown";
        byLanguage[lang] = (byLanguage[lang] || 0) + 1;
      }

      // アンケート集計
      const chat_surveysSnap = await getDocs(chat_surveysRef);
      let totalRating = 0;
      let ratingCount = 0;
      for (const doc of chat_surveysSnap.docs) {
        const data = doc.data();
        if (data.rating) {
          totalRating += data.rating as number;
          ratingCount++;
        }
      }

      setStats({
        total: sessions.length,
        active,
        ended,
        escalated,
        avgRating: ratingCount > 0 ? totalRating / ratingCount : 0,
        resolvedRate:
          sessions.length > 0
            ? ((sessions.length - escalated) / sessions.length) * 100
            : 0,
        byLanguage,
      });
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { stats, loading };
}

// ── チャットセッション一覧 ──

export interface ChatSessionDoc {
  id: string;
  visitorId: string;
  status: string;
  language: string;
  facilityId?: string;
  escalated?: boolean;
  escalationType?: string;
  escalatedAt?: Timestamp;
  customerName?: string;
  summary?: string;
  createdAt: Timestamp;
}

export function useChatSessions(statusFilter?: string) {
  const [sessions, setSessions] = useState<ChatSessionDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = collection(db, "chat_sessions");
    const constraints: QueryConstraint[] = [
      orderBy("createdAt", "desc"),
      limit(100),
    ];

    if (statusFilter && statusFilter !== "all") {
      constraints.unshift(where("status", "==", statusFilter));
    }

    const q = query(ref, ...constraints);
    const unsubscribe = onSnapshot(q, (snap) => {
      setSessions(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatSessionDoc))
      );
      setLoading(false);
    });

    return () => unsubscribe();
  }, [statusFilter]);

  return { sessions, loading };
}

// ── エスカレーション一覧 ──

export function useEscalatedSessions() {
  return useChatSessions("escalated");
}
