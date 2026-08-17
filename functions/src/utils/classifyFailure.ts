/**
 * classifyFailure — 失敗の原因分類（ルールベース・追加API無し）
 *
 * chat_agent_logs.failureBucket に入る値:
 * - resolved            : 解決（失敗ではない）
 * - knowledge_gap       : RAGヒット0（該当知識なし＝L1自動ドラフトの対象）
 * - account_or_emotional: 注文/eSIM/返金/怒り/人間希望 等（AI単独では不可の領域）
 * - answer_quality      : 上記以外の未解決（文書はあるが解決に至らず）
 */

const ACCOUNT_OR_EMOTIONAL = [
  // アカウント個別（AIでは実行不可）
  "注文", "order", "返金", "払い戻", "refund", "退款", "환불", "hoàn tiền",
  "esim", "iccid", "残量", "データ量", "使い切", "有効期限", "expire",
  // 感情/人間希望
  "最悪", "怒", "ふざけ", "詐欺", "terrible", "worst", "angry", "scam",
  "担当", "オペレーター", "人間", "human", "operator", "agent",
];

export function classifyFailure(
  resolved: boolean,
  ragHitCount: number,
  question: string,
  escalationReason: string
): string {
  if (resolved) return "resolved";
  if (ragHitCount === 0) return "knowledge_gap";
  const t = `${question} ${escalationReason}`.toLowerCase();
  if (ACCOUNT_OR_EMOTIONAL.some((k) => t.includes(k))) {
    return "account_or_emotional";
  }
  return "answer_quality";
}
