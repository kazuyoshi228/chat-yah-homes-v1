/**
 * AI ユーティリティ — Gemini（Vertex AI）/ RAG / Embedding
 *
 * 🔑 認証は ADC（Cloud Functions のサービスアカウント）。外部 API キーは持たない。
 *    → Vertex AI モード（@google/genai の vertexai:true）を使用。
 *    前提: Vertex AI API 有効化 ＋ 実行 SA に roles/aiplatform.user。
 *
 * Google サービスのみ使用:
 * - Gemini 2.5 Flash（LLM回答 + 翻訳）
 * - text-embedding-004（ベクトル生成・768次元）
 * - Firestore Vector Search（RAG検索）
 */

import { GoogleGenAI, Type } from "@google/genai";
import { chatDb as db } from "../db";
import { buildSupportSystemPrompt } from "./prompt";
import {
  GEMINI_MODEL,
  GEMINI_EMBEDDING_MODEL,
  EMBEDDING_DIMENSION,
  RAG_TOP_K,
  RAG_DISTANCE_THRESHOLD,
  GCP_PROJECT_ID,
  VERTEX_LOCATION,
} from "../config";

/** Gen AI クライアント（Vertex AI・ADC 認証） */
let genAI: GoogleGenAI | undefined;

function getGenAI(): GoogleGenAI {
  if (!genAI) {
    genAI = new GoogleGenAI({
      vertexai: true,
      project: GCP_PROJECT_ID,
      location: VERTEX_LOCATION,
    });
  }
  return genAI;
}

/** AI応答の構造化出力スキーマ */
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    answer: { type: Type.STRING, description: "AI回答テキスト" },
    resolved: { type: Type.BOOLEAN, description: "問題が解決したか" },
    escalationReason: {
      type: Type.STRING,
      description: "未解決の場合の理由（resolved=true なら空文字）",
    },
    language: {
      type: Type.STRING,
      description: "回答の言語コード (ja, en, zh, ko, th, vi)",
    },
    directToContact: {
      type: Type.BOOLEAN,
      description:
        "人間の連絡窓口（予約経路のメッセージ・施設連絡先）へ誘導したか（予約変更/返金の実行希望・人間対応の希望・本人確認が必要・緊急時・解決不能など）。",
    },
    photoUrls: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "回答に添付する写真URL（最大2枚）。【施設情報】の Available photos に列挙されたURLのみ使用可。関連する写真が無ければ空配列。本文にはURLを書かない（画面がカード表示する）。",
    },
  },
  required: [
    "answer",
    "resolved",
    "escalationReason",
    "language",
    "directToContact",
    "photoUrls",
  ],
};

export interface AIResponse {
  answer: string;
  resolved: boolean;
  escalationReason: string;
  language: string;
  directToContact: boolean;
  photoUrls: string[];
}

/** カテゴリの表示名（プロンプト内の見出し） */
const HOSPITALITY_CATEGORY_LABEL: Record<string, string> = {
  credo: "クレド",
  steps: "サービスの3ステップ",
  tone: "トーン・言葉遣い",
  emotion: "感情マネジメント",
  oonas: "おもてなし5原則(OONAS)",
  wow: "WOW体験",
  judgment: "良い判断",
  scenario: "状況別プロトコル",
};

/** 常時注入ブロックの文字数ソフト上限（トークン肥大の抑制） */
const HOSPITALITY_ALWAYS_CHAR_CAP = 4000;

/**
 * ホスピタリティ基準を Firestore から読み込み、system prompt 用に整形。
 * - scope="always"（既定）: 常時注入（category ごとに見出し・priority 昇順）
 * - scope="situational": trigger.keywords が visitorMessage に一致した時のみ注入
 * @param visitorMessage 状況別トリガー判定に使う（省略時は状況別を出さない）
 */
export async function loadHospitalityGuidelines(
  visitorMessage?: string
): Promise<string> {
  const snap = await db
    .collection("chat_hospitality_guidelines")
    .where("isActive", "==", true)
    .get();

  if (snap.empty) return "";

  type G = {
    title?: string;
    content?: string;
    category?: string;
    priority?: number;
    scope?: string;
    trigger?: { keywords?: string[] } | null;
  };
  const docs: G[] = snap.docs.map((d) => d.data() as G);
  const sortByPriority = (a: G, b: G) => (a.priority ?? 999) - (b.priority ?? 999);

  // ── 常時（scope 未設定は always 扱い＝後方互換） ──
  const always = docs
    .filter((g) => (g.scope ?? "always") === "always")
    .sort(sortByPriority);

  // category ごとに見出し付きで整形（未知カテゴリはそのまま列挙）
  const sections: string[] = [];
  const seenCat: string[] = [];
  for (const g of always) {
    const cat = g.category ?? "";
    if (!seenCat.includes(cat)) seenCat.push(cat);
  }
  for (const cat of seenCat) {
    const items = always
      .filter((g) => (g.category ?? "") === cat)
      .map((g) => `- ${g.title}: ${g.content}`);
    const label = HOSPITALITY_CATEGORY_LABEL[cat];
    sections.push(label ? `■ ${label}\n${items.join("\n")}` : items.join("\n"));
  }
  let alwaysBlock = sections.join("\n");
  if (alwaysBlock.length > HOSPITALITY_ALWAYS_CHAR_CAP) {
    alwaysBlock = alwaysBlock.slice(0, HOSPITALITY_ALWAYS_CHAR_CAP);
  }

  // ── 状況別（キーワード一致時のみ） ──
  let situationalBlock = "";
  if (visitorMessage) {
    const msg = visitorMessage.toLowerCase();
    const matched = docs
      .filter((g) => g.scope === "situational")
      .filter((g) => {
        const kws = g.trigger?.keywords ?? [];
        return kws.some((k) => k && msg.includes(String(k).toLowerCase()));
      })
      .sort(sortByPriority)
      .map((g) => `- ${g.title}: ${g.content}`);
    if (matched.length > 0) {
      situationalBlock = `\n\n【状況別ガイド（今回の状況に該当）】\n${matched.join("\n")}`;
    }
  }

  if (!alwaysBlock && !situationalBlock) return "";
  return `\n\n【ホスピタリティ基準 — 全ての応答に適用】\n${alwaysBlock}${situationalBlock}`;
}

/**
 * RAG ハイブリッド検索: Vector Search（findNearest）＋施設フィルタ
 *
 * 施設分離の要: 検索対象は「当該施設の文書＋全施設共通（facilityId="common"）」のみ。
 * 他施設の文書は事前フィルタで除外する（A施設の案内がB施設に出る混線を構造的に防ぐ）。
 * 承認待ちの下書き（isActive===false）は本番検索から除外する。
 * ※ 施設が特定できないセッションは common のみで検索する。
 */
export async function searchRAG(
  query: string,
  facilityId: string
): Promise<{ id: string; content: string; score: number }[]> {
  // 1. クエリの Embedding 生成
  const queryEmbedding = await generateEmbedding(query);

  // 2. Firestore Vector Search (findNearest)＋施設事前フィルタ（要複合ベクトルインデックス）
  //    下書き除外で件数が目減りしても TOP_K を満たせるよう少し多めに取得
  const facilityScope = facilityId ? [facilityId, "common"] : ["common"];
  const ragRef = db
    .collection("chat_rag_documents")
    .where("facilityId", "in", facilityScope);
  const vectorResults = await ragRef
    .findNearest("embedding", queryEmbedding, {
      limit: RAG_TOP_K + 5,
      distanceMeasure: "COSINE",
    })
    .get();

  // 下書き除外 → 距離しきい値 → TOP_K に整形
  return vectorResults.docs
    .filter((doc) => doc.data().isActive !== false)
    .map((doc) => ({
      id: doc.id,
      content: doc.data().content as string,
      score: (doc.data().distance as number) ?? 0,
    }))
    .filter((r) => r.score <= RAG_DISTANCE_THRESHOLD)
    .slice(0, RAG_TOP_K);
}

/**
 * Gemini でAI回答を生成（翻訳も兼用）
 */
export async function generateAIResponse(params: {
  visitorMessage: string;
  visitorLanguage: string;
  ragContext: string;
  /** 施設マスタの注入ブロック（utils/facilityContext・リアルタイム） */
  facilityContext: string;
  hospitalityPrompt: string;
  conversationHistory: { role: string; content: string }[];
}): Promise<AIResponse> {
  const systemPrompt = buildSupportSystemPrompt(params);

  const contents = [
    ...params.conversationHistory.map((msg) => ({
      role: msg.role === "visitor" ? "user" : "model",
      parts: [{ text: msg.content }],
    })),
    { role: "user", parts: [{ text: params.visitorMessage }] },
  ];

  const response = await getGenAI().models.generateContent({
    model: GEMINI_MODEL,
    contents,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      responseSchema,
    },
  });

  const text = response.text ?? "";

  try {
    return JSON.parse(text) as AIResponse;
  } catch {
    // JSON パース失敗時のフォールバック
    return {
      answer: text,
      resolved: true,
      escalationReason: "",
      language: params.visitorLanguage,
      directToContact: false,
      photoUrls: [],
    };
  }
}

/**
 * Gemini で会話サマリーを生成
 */
export async function generateSummary(
  messages: { role: string; content: string }[]
): Promise<string> {
  const conversation = messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const response = await getGenAI().models.generateContent({
    model: GEMINI_MODEL,
    contents: `以下のチャット会話を日本語で3行以内に要約してください。\n\n${conversation}`,
  });

  return response.text ?? "";
}

/** RAG下書き（L1自動生成）の構造化出力スキーマ */
const ragDraftSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "知識ベースの短いタイトル（日本語）" },
    category: {
      type: Type.STRING,
      description: "分類（例: setup, troubleshoot, billing, plan, general）",
    },
    content: {
      type: Type.STRING,
      description:
        "6言語（日本語/English/中文/한국어/ไทย/Tiếng Việt）で書いた知識ベース本文。各言語を見出し付きで併記する。",
    },
  },
  required: ["title", "category", "content"],
};

export interface RagDraft {
  title: string;
  category: string;
  content: string;
}

/**
 * L1: 知識欠落（RAGヒット0）の代表質問から、RAG知識ベースの「下書き」を自動生成する。
 *
 * 🚨 事実の創作を禁止。確定情報が無い箇所は「要確認」と明記させる。
 *    生成物は必ず isActive:false の下書きとして保存し、公開は人が承認する。
 * @param sampleQuestions 同種の未解決質問（代表例。言語は混在してよい）
 */
export async function generateRagDraft(
  sampleQuestions: string[]
): Promise<RagDraft | null> {
  const systemPrompt = `あなたは yah.homes（日本の宿泊施設ブランド）のゲストサポート知識ベース編集者です。
以下は「AIが回答できなかった（知識ベースに該当が無かった）宿泊ゲストの質問」の実例です。
これらに今後AIが正しく答えられるよう、知識ベースの下書きを1本作成してください。

【厳守事項】
1. 事実を創作しない。設備の有無・使い方・時刻・ルールなど施設でしか確定できない点は、断定せず本文中に「（要確認）」と明記する。
2. 一般的で普遍的に正しい案内（例: 日本の宿泊マナー一般、緊急時は119/110）に留め、施設固有の数値や約束は書かない。
3. 🚫 ドアの暗証番号・鍵の受け渡し詳細・Wi-Fiパスワード等の機微情報は絶対に含めない。
4. 6言語（日本語 / English / 中文 / 한국어 / ไทย / Tiếng Việt）で併記し、各言語を見出しで区切る。
5. 簡潔・具体的に。`;

  const userPrompt = `# 未解決だった質問の実例\n${sampleQuestions
    .map((q, i) => `${i + 1}. ${q}`)
    .join("\n")}`;

  try {
    const response = await getGenAI().models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: ragDraftSchema,
      },
    });
    const text = response.text ?? "";
    const parsed = JSON.parse(text) as RagDraft;
    if (!parsed.title || !parsed.content) return null;
    return parsed;
  } catch (error) {
    console.error("RAG下書き生成エラー:", error);
    return null;
  }
}

/** text-embedding-004 の入力上限対策（トークン超過での失敗を防ぐソフト上限） */
const EMBED_INPUT_CHAR_CAP = 8000;

/**
 * text-embedding-004 でベクトル生成（768次元）
 * 長文（6言語ドラフト等）は上限超過で失敗するため、入力を安全長に切り詰める。
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const input =
    text.length > EMBED_INPUT_CHAR_CAP
      ? text.slice(0, EMBED_INPUT_CHAR_CAP)
      : text;
  const response = await getGenAI().models.embedContent({
    model: GEMINI_EMBEDDING_MODEL,
    contents: input,
  });

  const values = response.embeddings?.[0]?.values;
  if (!values || values.length === 0) {
    throw new Error("Embedding 生成失敗: values が空です");
  }
  if (values.length !== EMBEDDING_DIMENSION) {
    throw new Error(
      `Embedding dimension mismatch: expected ${EMBEDDING_DIMENSION}, got ${values.length}`
    );
  }

  return values;
}
