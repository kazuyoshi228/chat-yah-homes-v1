/**
 * generateRagDrafts — L1: 知識欠落の修正ドラフトを自動生成（週次）
 *
 * スケジュール: 毎週月曜 00:00 UTC（= JST 09:00）
 * 処理:
 *   1. 直近の chat_agent_logs（failureBucket == "knowledge_gap"）を収集
 *   2. 質問を簡易クラスタリング（単語Jaccard・ベストエフォート）
 *   3. クラスタごとに Gemini で6言語ドラフトを生成
 *   4. chat_rag_documents に isActive:false（＝承認待ち下書き）で投入
 *      → 承認待ちは管理画面サイドバー「RAG Documents」バッジで可視化（メール通知は廃止）
 *
 * 🚨 生成物は必ず isActive:false。公開（本番反映）は人が /admin/rag で承認する。
 *    下書きは searchRAG 側で本番検索から除外される（isActive !== false）。
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { chatDb as db } from "../db";
import { REGION } from "../config";
import { generateRagDraft } from "../utils/ai";

const LOOKBACK_DAYS = 7;
const MAX_CLUSTERS = 5; // 1回の実行で作る下書きの上限
const MAX_SAMPLES_PER_CLUSTER = 8;
const SIMILARITY_THRESHOLD = 0.5;

export const generateRagDrafts = onSchedule(
  {
    schedule: "0 0 * * 1", // 毎週月曜 00:00 UTC = JST 09:00
    timeZone: "UTC",
    region: REGION,
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async () => {
    const now = admin.firestore.Timestamp.now();
    const since = admin.firestore.Timestamp.fromMillis(
      now.toMillis() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000
    );

    // 1. 直近の knowledge_gap を収集（composite index: failureBucket + createdAt）
    const snap = await db
      .collection("chat_agent_logs")
      .where("failureBucket", "==", "knowledge_gap")
      .where("createdAt", ">=", since)
      .get();

    const questions = snap.docs
      .map((d) => ((d.data().question as string | undefined) ?? "").trim())
      .filter((q) => q.length >= 3);

    if (questions.length === 0) {
      console.log("generateRagDrafts: 対象の knowledge_gap なし");
      return;
    }

    // 2. 簡易クラスタリング（頻出＝大きいクラスタ優先）→ 上限まで
    const clusters = clusterQuestions(questions).slice(0, MAX_CLUSTERS);

    // 3. クラスタごとに下書き生成 → isActive:false で投入
    const created: { title: string; count: number; sample: string }[] = [];
    for (const cluster of clusters) {
      const samples = cluster.slice(0, MAX_SAMPLES_PER_CLUSTER);
      const draft = await generateRagDraft(samples);
      if (!draft) continue;

      await db.collection("chat_rag_documents").add({
        title: draft.title,
        category: draft.category || "general",
        content: draft.content,
        // 下書きは共通扱いで投入。施設固有の内容なら承認時に管理画面で施設を選び直す
        facilityId: "common",
        isActive: false, // 承認待ち下書き（本番検索・公開は人の承認後）
        source: "auto_draft",
        sampleQuestions: samples,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      created.push({
        title: draft.title,
        count: cluster.length,
        sample: samples[0],
      });
    }

    if (created.length === 0) {
      console.log("generateRagDrafts: 下書きは作成されませんでした");
      return;
    }

    // 4. 承認待ちの可視化は管理画面サイドバー「RAG Documents」のバッジで行う
    //    （メール通知は廃止＝Gmailのドメイン委任が無く送信不可のため。バッジで代替）。
    console.log(
      `generateRagDrafts: 下書き ${created.length} 件を作成（/admin/rag の承認待ちに表示）`
    );
  }
);

/**
 * 単語 Jaccard 類似度による貪欲クラスタリング（ベストエフォート）
 * ※ CJK は空白分かち書きされないため単文＝1トークン寄りになり、
 *   多くは単独クラスタになる。上限 MAX_CLUSTERS で件数を抑制する。
 */
function clusterQuestions(questions: string[]): string[][] {
  const tokens = questions.map(tokenize);
  const used = new Array(questions.length).fill(false);
  const clusters: string[][] = [];

  for (let i = 0; i < questions.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    const cluster = [questions[i]];
    for (let j = i + 1; j < questions.length; j++) {
      if (used[j]) continue;
      if (jaccard(tokens[i], tokens[j]) >= SIMILARITY_THRESHOLD) {
        used[j] = true;
        cluster.push(questions[j]);
      }
    }
    clusters.push(cluster);
  }
  return clusters.sort((a, b) => b.length - a.length);
}

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 2)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}
