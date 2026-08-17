/**
 * FlowView — 冒頭デシジョンツリー（3分岐）の表示・選択
 *
 * ノードの遷移判定（qr_resend / formTrigger / aiTrigger）は親の onSelectNode が担当。
 * ここは表示と「AIフォールバック」導線のみ。
 */
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { parseI18n } from "@/lib/i18nJson";
import { AI_CHAT_LABEL, pick } from "./labels";
import type { FlowNode } from "./types";

interface FlowViewProps {
  currentNode: FlowNode | undefined;
  childNodes: FlowNode[];
  /** フローノードが1件も無い（ロード中/未投入）か */
  hasNodes: boolean;
  sessionCreating: boolean;
  onSelectNode: (node: FlowNode) => void;
  onStartAiChat: (greeting: string) => void;
}

export function FlowView({
  currentNode,
  childNodes,
  hasNodes,
  sessionCreating,
  onSelectNode,
  onStartAiChat,
}: FlowViewProps) {
  const { lang: language } = useLanguage();

  const aiFallbackButton = currentNode && (
    <button
      onClick={() => onStartAiChat(parseI18n(currentNode.label, language))}
      disabled={sessionCreating}
      className="w-full text-left px-3 py-2.5 rounded-xl border border-dashed border-gray-300 text-xs text-gray-500 hover:border-gray-500 hover:text-gray-700 transition-all flex items-center gap-2"
    >
      {sessionCreating ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <Bot className="w-3 h-3" />
      )}
      {pick(AI_CHAT_LABEL, language)}
    </button>
  );

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="p-4 flex flex-col gap-3">
        {currentNode && (
          <>
            {/* ボットメッセージバブル */}
            <div className="flex items-start gap-2">
              <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5 text-gray-500" />
              </div>
              <div className="bg-gray-100 rounded-xl rounded-tl-sm px-3 py-2.5 text-xs text-gray-800 leading-relaxed max-w-[85%]">
                <p className="whitespace-pre-wrap">
                  {parseI18n(currentNode.label, language)}
                </p>
                {/* 回答ノードの場合はコンテンツを表示 */}
                {currentNode.type === "answer" && currentNode.content && (
                  <p className="mt-2 whitespace-pre-wrap text-gray-700">
                    {parseI18n(currentNode.content, language)}
                  </p>
                )}
              </div>
            </div>

            {/* 選択肢ボタン */}
            {childNodes.length > 0 && (
              <div className="flex flex-col gap-2 mt-1">
                {childNodes.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => onSelectNode(child)}
                    disabled={sessionCreating}
                    className="w-full text-left px-3 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-700 hover:border-black hover:bg-gray-50 transition-all active:scale-[0.98] leading-snug"
                  >
                    {parseI18n(child.label, language)}
                  </button>
                ))}
                {/* AI フォールバックオプション */}
                {aiFallbackButton}
              </div>
            )}

            {/* リーフノード（子なし）: AI フォールバック表示 */}
            {childNodes.length === 0 && currentNode.type !== "redirect_form" && (
              <div className="flex flex-col gap-2 mt-1">{aiFallbackButton}</div>
            )}
          </>
        )}

        {/* ローディング状態 */}
        {!currentNode && !hasNodes && (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
