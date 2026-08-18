/**
 * useFirebaseAuth - Firebase認証カスタムフック
 * - 未ログイン時は匿名認証で自動サインイン
 * - お客様ログイン/新規登録（Google ＋ メール/パスワード）を提供
 *   - 新規: 匿名アカウントを昇格（uid継続 → 会話そのまま継続）
 *   - 既存: 本人アカウントへサインイン → claimSession でセッション所有者を付け替え（会話継続）
 */
import { useState, useEffect, useCallback } from "react";
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  linkWithPopup,
  linkWithCredential,
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  EmailAuthProvider,
  signOut,
  type User,
  type AuthError,
} from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { REGION, auth, googleProvider, app } from "@/lib/firebase";

const claimSessionFn = httpsCallable(
  getFunctions(app, REGION),
  "claimSession"
);
/** 既存アカウントへ切替時: 匿名セッションの所有者を本人uidへ付け替え（会話継続） */
async function claimIfNeeded(sessionId?: string, anonToken?: string | null) {
  if (!sessionId || !anonToken) return;
  try {
    await claimSessionFn({ sessionId, anonIdToken: anonToken });
  } catch (e) {
    console.error("[useFirebaseAuth] claimSession 失敗:", e);
  }
}

interface UseFirebaseAuthReturn {
  user: User | null;
  loading: boolean;
  isAnonymous: boolean;
  signInWithGoogle: (sessionId?: string) => Promise<void>;
  registerWithEmail: (email: string, password: string) => Promise<void>;
  signInWithEmail: (
    email: string,
    password: string,
    sessionId?: string
  ) => Promise<void>;
  signOutUser: () => Promise<void>;
}

export function useFirebaseAuth(): UseFirebaseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setLoading(false);
      } else {
        // 未ログイン → 匿名認証で自動サインイン
        try {
          await signInAnonymously(auth);
        } catch (error) {
          console.error("[useFirebaseAuth] 匿名認証に失敗:", error);
          setLoading(false);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Google: 新規は匿名昇格（uid継続）、既存はサインイン＋claim
  const signInWithGoogle = useCallback(async (sessionId?: string) => {
    const anon = auth.currentUser;
    const anonToken = anon?.isAnonymous ? await anon.getIdToken() : null;
    try {
      if (anon?.isAnonymous) {
        await linkWithPopup(anon, googleProvider);
      } else {
        await signInWithPopup(auth, googleProvider);
      }
    } catch (e) {
      const err = e as AuthError;
      if (err.code === "auth/credential-already-in-use") {
        const cred = GoogleAuthProvider.credentialFromError(err);
        if (!cred) throw e;
        await signInWithCredential(auth, cred);
        await claimIfNeeded(sessionId, anonToken);
      } else {
        throw e;
      }
    }
  }, []);

  // メール新規登録: 匿名昇格（uid継続 → 会話継続）
  const registerWithEmail = useCallback(
    async (email: string, password: string) => {
      const anon = auth.currentUser;
      if (anon?.isAnonymous) {
        const cred = EmailAuthProvider.credential(email, password);
        await linkWithCredential(anon, cred);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    },
    []
  );

  // メールログイン: 既存アカウントへサインイン＋claim（会話継続）
  const signInWithEmail = useCallback(
    async (email: string, password: string, sessionId?: string) => {
      const anon = auth.currentUser;
      const anonToken = anon?.isAnonymous ? await anon.getIdToken() : null;
      await signInWithEmailAndPassword(auth, email, password);
      await claimIfNeeded(sessionId, anonToken);
    },
    []
  );

  const signOutUser = useCallback(async () => {
    await signOut(auth);
    // onAuthStateChanged が null を検知 → 匿名で再サインイン（上の effect）
  }, []);

  return {
    user,
    loading,
    isAnonymous: user?.isAnonymous ?? true,
    signInWithGoogle,
    registerWithEmail,
    signInWithEmail,
    signOutUser,
  };
}
