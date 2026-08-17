/**
 * backfill_rag_embeddings.mjs — chat DB の chat_rag_documents で
 * embedding が欠けているドキュメントを「touch」してトリガーを発火させる。
 *
 * 仕組み: onRagDocumentWritten（自己修復版）は embedding が無いと content 未変更でも
 *         再生成する。ここでは touch フィールドを更新して write イベントを起こすだけ。
 *
 * 🚨 前提: 先に `pnpm deploy:functions` で onRagDocumentWritten を chat DB にデプロイ済みであること。
 *          （デプロイ前に実行しても trigger が発火せず embedding は生成されない）
 * 🚨 書き込むのは chat DB の chat_rag_documents だけ。
 *
 * 使い方（functions ディレクトリで）:
 *   下見:  node scripts/backfill_rag_embeddings.mjs
 *   実行:  node scripts/backfill_rag_embeddings.mjs --write
 */
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const PROJECT_ID = "yah-homes";
const CHAT_DATABASE_ID = "chat";
const WRITE = process.argv.includes("--write");

const app = initializeApp({
  credential: applicationDefault(),
  projectId: PROJECT_ID,
});
const chat = getFirestore(app, CHAT_DATABASE_ID);

async function main() {
  console.log(
    `\n=== RAG embedding backfill（chat DB）[${WRITE ? "本番 touch" : "DRY RUN"}] ===\n`
  );
  const snap = await chat.collection("chat_rag_documents").get();

  const missing = snap.docs.filter((d) => d.data().embedding == null);
  const have = snap.size - missing.length;
  console.log(
    `chat_rag_documents: 合計 ${snap.size} 件 / embedding 済み ${have} 件 / 欠落 ${missing.length} 件`
  );

  if (missing.length === 0) {
    console.log("欠落なし。backfill 不要です。");
    process.exit(0);
  }

  if (!WRITE) {
    console.log(
      `\n--write を付けて実行すると、欠落 ${missing.length} 件を touch してトリガーを発火させます。`
    );
    console.log(
      "※ 先に pnpm deploy:functions で onRagDocumentWritten をデプロイ済みであること。"
    );
    process.exit(0);
  }

  let n = 0;
  let batch = chat.batch();
  let inBatch = 0;
  for (const doc of missing) {
    batch.set(
      doc.ref,
      { embeddingBackfillRequestedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    inBatch++;
    n++;
    if (inBatch >= 400) {
      await batch.commit();
      batch = chat.batch();
      inBatch = 0;
    }
  }
  if (inBatch > 0) await batch.commit();

  console.log(
    `\n${n} 件を touch しました。onRagDocumentWritten が順次 Gemini で embedding を生成します（数分かかることがあります）。`
  );
  console.log(
    "数分後に diag（下見）を再実行し、embedding 済みが増えていることを確認してください。"
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("backfill エラー:", err);
  process.exit(1);
});
