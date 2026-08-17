/**
 * Firebase クライアントSDK 初期化
 * - firebase/app, firebase/auth, firebase/firestore, firebase/app-check
 * - 環境変数から設定値を取得 (VITE_FIREBASE_*)
 * - 開発モード時はエミュレータに接続
 *
 * 🚨 client は named DB「chat」のみ。(default)（販売 yah.mobi）には接続しない。
 */
import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  GoogleAuthProvider,
  type Auth,
} from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  type Firestore,
} from "firebase/firestore";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "firebase/app-check";

// Firebase設定 - 環境変数から取得
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Firebase アプリ初期化
const app: FirebaseApp = initializeApp(firebaseConfig);

// ── App Check（reCAPTCHA Enterprise）──
// 訪問者の Firestore 直書き入口を保護（bot によるコスト濫用・スパム防止）。
// サイトキー未設定時は初期化しない（段階的ロールアウト可能・何も壊さない）。
const appCheckSiteKey = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY as
  | string
  | undefined;
if (import.meta.env.DEV) {
  // ローカル/エミュレータ・CI は debug token を使用
  (self as unknown as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN =
    true;
}
if (appCheckSiteKey) {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

// Firebase Auth（匿名認証 + Google認証対応）
const auth: Auth = getAuth(app);

// Google認証プロバイダ
const googleProvider = new GoogleAuthProvider();

// Firestore データベース — chat 専用 named DB「chat」
const db: Firestore = getFirestore(app, "chat");

// 開発モード時はエミュレータに接続
if (import.meta.env.DEV) {
  try {
    connectAuthEmulator(auth, "http://localhost:9099", {
      disableWarnings: true,
    });
    connectFirestoreEmulator(db, "localhost", 8080);
    console.log("[Firebase] エミュレータに接続しました");
  } catch (e) {
    // 既に接続済みの場合はスキップ
    console.warn("[Firebase] エミュレータ接続スキップ:", e);
  }
}

export { app, auth, db, googleProvider };
