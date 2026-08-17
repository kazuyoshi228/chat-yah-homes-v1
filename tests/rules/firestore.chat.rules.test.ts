/**
 * Firestore セキュリティルール回帰テスト（chat DB）
 *
 * 目的: 先日固めたセキュリティ境界を回帰で守る。
 *   - 匿名は「自分の」セッション/メッセージのみ、他人のは不可
 *   - chat_agent_logs に一般ユーザー（client）は書けない
 *   - 偽の @yah.mobi（メール/パス・未確認）は admin になれない（堅牢化の検証）
 *   - Google認証・確認済みの許可ドメインは admin
 *   - 未定義コレクションは default deny
 *
 * 実行: pnpm test:rules （firestore emulator を起動して vitest）
 */
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  getDoc,
  addDoc,
  updateDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { beforeAll, afterAll, beforeEach, describe, it } from "vitest";

let env: RulesTestEnvironment;

// ── 認証コンテキストのヘルパー ──
const anon = (uid: string) =>
  env
    .authenticatedContext(uid, {
      firebase: { sign_in_provider: "anonymous" },
    } as any)
    .firestore();

// Google認証・メール確認済み・許可ドメイン ＝ 正規の admin
const googleAdmin = (email: string) =>
  env
    .authenticatedContext("admin_" + email, {
      email,
      email_verified: true,
      firebase: { sign_in_provider: "google.com" },
    } as any)
    .firestore();

// メール/パスワードで未確認の“偽 @yah.mobi” ＝ admin になってはいけない
const fakeAdmin = (email: string) =>
  env
    .authenticatedContext("fake_" + email, {
      email,
      email_verified: false,
      firebase: { sign_in_provider: "password" },
    } as any)
    .firestore();

const sessionData = (uid: string) => ({
  visitorId: uid,
  status: "active",
  language: "en",
  facilityId: "kiyokawa",
  createdAt: serverTimestamp(),
});

async function seedSession(sid: string, uid: string) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `chat_sessions/${sid}`), {
      visitorId: uid,
      status: "active",
      language: "en",
      createdAt: new Date(),
    });
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "chat-rules-test",
    firestore: {
      rules: readFileSync("firestore.chat.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
});

describe("chat_sessions", () => {
  it("匿名は自分のvisitorIdでセッションを作成できる", async () => {
    const db = anon("u1");
    await assertSucceeds(addDoc(collection(db, "chat_sessions"), sessionData("u1")));
  });

  it("匿名は他人のvisitorIdでセッションを作成できない", async () => {
    const db = anon("u1");
    await assertFails(addDoc(collection(db, "chat_sessions"), sessionData("u2")));
  });

  it("余計なフィールドを注入したセッション作成は不可（hasOnly）", async () => {
    const db = anon("u1");
    await assertFails(
      addDoc(collection(db, "chat_sessions"), {
        ...sessionData("u1"),
        escalated: true, // 訪問者が付けてはいけない
      })
    );
  });

  it("facilityId なしのセッション作成は不可（hasAll）", async () => {
    const db = anon("u1");
    const { facilityId: _omit, ...noFacility } = sessionData("u1");
    await assertFails(addDoc(collection(db, "chat_sessions"), noFacility));
  });

  it("facilityId が不正形式（大文字/記号）のセッション作成は不可", async () => {
    const db = anon("u1");
    await assertFails(
      addDoc(collection(db, "chat_sessions"), {
        ...sessionData("u1"),
        facilityId: "Kiyokawa!",
      })
    );
  });

  it("オーナーは status→ended のみ更新できる", async () => {
    await seedSession("s1", "u1");
    const db = anon("u1");
    await assertSucceeds(
      updateDoc(doc(db, "chat_sessions/s1"), {
        status: "ended",
        endedAt: serverTimestamp(),
      })
    );
  });

  it("オーナーでも visitorId 等の改変はできない", async () => {
    await seedSession("s2", "u1");
    const db = anon("u1");
    await assertFails(updateDoc(doc(db, "chat_sessions/s2"), { visitorId: "hacker" }));
  });

  it("他人はセッションを読めない", async () => {
    await seedSession("s3", "u1");
    const other = anon("u2");
    await assertFails(getDoc(doc(other, "chat_sessions/s3")));
  });

  it("管理者はセッションを終了（status→ended）できる", async () => {
    await seedSession("s4", "u1");
    const db = googleAdmin("kazuyoshi@bonfire.co.jp");
    await assertSucceeds(
      updateDoc(doc(db, "chat_sessions/s4"), {
        status: "ended",
        endedAt: serverTimestamp(),
      })
    );
  });

  it("管理者でも visitorId 等の改変はできない（終了フィールド限定）", async () => {
    await seedSession("s5", "u1");
    const db = googleAdmin("kazuyoshi@bonfire.co.jp");
    await assertFails(
      updateDoc(doc(db, "chat_sessions/s5"), { visitorId: "hijack" })
    );
  });

  it("偽@yah.mobi（未確認/パスワード）はセッションを終了できない", async () => {
    await seedSession("s6", "u1");
    const db = fakeAdmin("attacker@yah.mobi");
    await assertFails(
      updateDoc(doc(db, "chat_sessions/s6"), {
        status: "ended",
        endedAt: serverTimestamp(),
      })
    );
  });
});

describe("chat_messages", () => {
  it("セッションオーナーは visitor メッセージを作成できる", async () => {
    await seedSession("s1", "u1");
    const db = anon("u1");
    await assertSucceeds(
      addDoc(collection(db, "chat_sessions/s1/chat_messages"), {
        role: "visitor",
        content: "hi",
        createdAt: serverTimestamp(),
      })
    );
  });

  it("非オーナーはメッセージを作成できない", async () => {
    await seedSession("s1", "u1");
    const db = anon("u2");
    await assertFails(
      addDoc(collection(db, "chat_sessions/s1/chat_messages"), {
        role: "visitor",
        content: "hi",
        createdAt: serverTimestamp(),
      })
    );
  });

  it("role が visitor 以外（ai等）は作成できない", async () => {
    await seedSession("s1", "u1");
    const db = anon("u1");
    await assertFails(
      addDoc(collection(db, "chat_sessions/s1/chat_messages"), {
        role: "ai",
        content: "x",
        createdAt: serverTimestamp(),
      })
    );
  });
});

describe("admin 判定の堅牢化", () => {
  it("未確認メール/パスワードの偽@yah.mobiは admin になれない（RAG読取不可）", async () => {
    const db = fakeAdmin("attacker@yah.mobi");
    await assertFails(getDoc(doc(db, "chat_rag_documents/x")));
  });

  it("Google認証・確認済みの@bonfire.co.jpは admin（RAG読取可）", async () => {
    const db = googleAdmin("kazuyoshi@bonfire.co.jp");
    await assertSucceeds(getDoc(doc(db, "chat_rag_documents/x")));
  });

  it("匿名ユーザーは chat_agent_logs に書けない", async () => {
    const db = anon("u1");
    await assertFails(setDoc(doc(db, "chat_agent_logs/x"), { foo: "bar" }));
  });

  it("匿名ユーザーは RAG を読めない", async () => {
    const db = anon("u1");
    await assertFails(getDoc(doc(db, "chat_rag_documents/x")));
  });
});

describe("chat_facilities（施設マスタ）", () => {
  it("匿名（訪問者）は施設マスタを読める（施設判定・案内画面）", async () => {
    const db = anon("u1");
    await assertSucceeds(getDoc(doc(db, "chat_facilities/kiyokawa")));
  });

  it("匿名は施設マスタに書けない", async () => {
    const db = anon("u1");
    await assertFails(setDoc(doc(db, "chat_facilities/evil"), { isActive: true }));
  });

  it("管理者は施設マスタに書ける", async () => {
    const db = googleAdmin("kazuyoshi@bonfire.co.jp");
    await assertSucceeds(
      setDoc(doc(db, "chat_facilities/kiyokawa"), { isActive: true })
    );
  });
});

describe("default deny", () => {
  it("未定義コレクションには書けない", async () => {
    const db = anon("u1");
    await assertFails(setDoc(doc(db, "random_collection/x"), { a: 1 }));
  });
});
