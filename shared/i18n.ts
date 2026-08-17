/**
 * i18n — ウィジェットUIの多言語辞書（6言語）
 *
 * ここには「実際に t() で使われるキーだけ」を置く（未使用キーは持たない）。
 * デシジョンツリー/RAG/ホスピタリティ等の動的テキストは Firestore 側で
 * i18n JSON（{ja,en,zh,ko,th,vi}）として管理される。
 */

export type Lang = "en" | "ja" | "zh" | "ko" | "th" | "vi";

export interface Translations {
  // チャットウィジェット
  widget_placeholder: string;
  widget_ended: string;
  // 終了アンケート
  widget_survey_title: string;
  survey_resolved_question: string;
  widget_survey_yes: string;
  widget_survey_no: string;
  survey_improve: string;
  survey_improve_placeholder: string;
  widget_survey_submit: string;
  widget_survey_thanks: string;
}

const en: Translations = {
  widget_placeholder: "Type a message...",
  widget_ended: "Chat ended",
  widget_survey_title: "How was your experience?",
  survey_resolved_question: "Was your issue resolved?",
  widget_survey_yes: "✔ Yes",
  widget_survey_no: "✖ No",
  survey_improve: "What could we improve?",
  survey_improve_placeholder: "Tell us what went wrong or how we can do better.",
  widget_survey_submit: "Submit",
  widget_survey_thanks: "Thank you for your feedback!",
};

const ja: Translations = {
  widget_placeholder: "メッセージを入力...",
  widget_ended: "チャットが終了しました",
  widget_survey_title: "チャットはいかがでしたか？",
  survey_resolved_question: "問題は解決しましたか？",
  widget_survey_yes: "✔ はい",
  widget_survey_no: "✖ いいえ",
  survey_improve: "改善点を教えてください",
  survey_improve_placeholder: "何が問題だったか、どうすれば改善できるかをお聞かせください。",
  widget_survey_submit: "送信",
  widget_survey_thanks: "フィードバックありがとうございました！",
};

const zh: Translations = {
  widget_placeholder: "输入消息...",
  widget_ended: "聊天已结束",
  widget_survey_title: "您的体验如何？",
  survey_resolved_question: "您的问题是否已解决？",
  widget_survey_yes: "✔ 是",
  widget_survey_no: "✖ 否",
  survey_improve: "您有什么改进建议？",
  survey_improve_placeholder: "请告诉我们哪里出了问题或如何改进。",
  widget_survey_submit: "提交",
  widget_survey_thanks: "感谢您的反馈！",
};

const ko: Translations = {
  widget_placeholder: "메시지를 입력하세요...",
  widget_ended: "채팅이 종료되었습니다",
  widget_survey_title: "경험이 어떠셨나요?",
  survey_resolved_question: "문제가 해결되었나요?",
  widget_survey_yes: "✔ 예",
  widget_survey_no: "✖ 아니오",
  survey_improve: "개선할 점이 있나요?",
  survey_improve_placeholder: "무엇이 잘못되었는지 또는 어떻게 개선할 수 있는지 알려주세요.",
  widget_survey_submit: "제출",
  widget_survey_thanks: "피드백 감사합니다!",
};

const th: Translations = {
  widget_placeholder: "พิมพ์ข้อความ...",
  widget_ended: "แชทสิ้นสุดแล้ว",
  widget_survey_title: "ประสบการณ์ของคุณเป็นอย่างไร?",
  survey_resolved_question: "ปัญหาของคุณได้รับการแก้ไขหรือไม่?",
  widget_survey_yes: "✔ ใช่",
  widget_survey_no: "✖ ไม่",
  survey_improve: "เราควรปรับปรุงอะไร?",
  survey_improve_placeholder: "บอกเราว่าอะไรผิดพลาดหรือเราจะปรับปรุงได้อย่างไร",
  widget_survey_submit: "ส่ง",
  widget_survey_thanks: "ขอบคุณสำหรับความคิดเห็น!",
};

const vi: Translations = {
  widget_placeholder: "Nhập tin nhắn...",
  widget_ended: "Chat đã kết thúc",
  widget_survey_title: "Trải nghiệm của bạn như thế nào?",
  survey_resolved_question: "Vấn đề của bạn đã được giải quyết chưa?",
  widget_survey_yes: "✔ Có",
  widget_survey_no: "✖ Không",
  survey_improve: "Chúng tôi có thể cải thiện điều gì?",
  survey_improve_placeholder:
    "Hãy cho chúng tôi biết điều gì đã xảy ra hoặc cách chúng tôi có thể làm tốt hơn.",
  widget_survey_submit: "Gửi",
  widget_survey_thanks: "Cảm ơn phản hồi của bạn!",
};

export const translations: Record<Lang, Translations> = { en, ja, zh, ko, th, vi };

export function t(lang: Lang, key: keyof Translations): string {
  return translations[lang]?.[key] ?? translations.en[key] ?? key;
}
