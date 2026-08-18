/**
 * ChatView — AIチャット本体（メッセージ一覧・入力・終了）
 *
 * 入力欄と自動スクロールはこのビュー内に閉じる。
 * エスカレーション（予約経路別の窓口誘導）はAIの回答テキスト内で案内される
 * （固定の誘導ボタンは持たない＝窓口は施設・予約経路で異なるため）。
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Headphones, Send, Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ChatMessage } from "@/hooks/useChatMessages";

interface ChatViewProps {
  messages: ChatMessage[];
  typing: boolean;
  onSend: (content: string) => Promise<void>;
  onEndSession: () => void;
}

export function ChatView({ messages, typing, onSend, onEndSession }: ChatViewProps) {
  const { t, lang: language } = useLanguage();
  const [input, setInput] = useState("");
  // 送信中／失敗の状態（無言の失敗を防ぐ: 電波の悪い部屋でも状況が分かるように）
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── 自動スクロール ──
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const handleSend = useCallback(
    async (retryText?: string) => {
      const content = (retryText ?? input).trim();
      if (!content || sending) return;
      if (!retryText) setInput("");
      setSending(true);
      setFailed(null);
      try {
        await onSend(content);
      } catch (error) {
        console.error("[ChatView] メッセージ送信エラー:", error);
        setFailed(content); // 本文を保持して再送できるようにする
      } finally {
        setSending(false);
      }
    },
    [input, onSend, sending]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <>
      <ScrollArea className="flex-1 min-h-0 px-3 py-3">
        <div className="space-y-2">
          {messages.map((msg, i) => {
            const isVisitor = msg.role === "visitor";
            return (
              <div
                key={msg.id ?? i}
                className={cn(
                  "flex items-end gap-2",
                  isVisitor ? "flex-row-reverse" : "flex-row"
                )}
              >
                {!isVisitor && (
                  <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                    {msg.role === "ai" ? (
                      <Bot className="w-3 h-3 text-gray-500" />
                    ) : (
                      <Headphones className="w-3 h-3 text-gray-500" />
                    )}
                  </div>
                )}
                <div className="max-w-[80%] space-y-1.5">
                  <div
                    className={cn(
                      "rounded-xl px-3 py-2 text-xs",
                      isVisitor
                        ? "bg-black text-white rounded-br-sm"
                        : "bg-gray-100 text-gray-800 rounded-bl-sm"
                    )}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </p>
                  </div>
                  {/* 写真カード（AIが添付・サーバ側で登録済み写真にホワイトリスト済み） */}
                  {(msg.photoUrls?.length ?? 0) > 0 &&
                    msg.photoUrls!.map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <img
                          src={url}
                          alt=""
                          loading="lazy"
                          className="rounded-xl border border-gray-200 max-w-full max-h-56 object-cover"
                        />
                      </a>
                    ))}
                </div>
              </div>
            );
          })}

          {typing && (
            <div className="flex items-end gap-2">
              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                <Bot className="w-3 h-3 text-gray-500" />
              </div>
              <div className="bg-gray-100 rounded-xl rounded-bl-sm px-3 py-2">
                <div className="flex gap-1">
                  <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* 送信失敗の通知（再送ボタン付き） */}
      {failed && (
        <div className="mx-3 mb-1 flex items-center justify-between gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 flex-shrink-0">
          <p className="text-xs text-red-700">{t("widget_send_failed")}</p>
          <button
            onClick={() => void handleSend(failed)}
            className="text-xs text-red-700 font-medium flex items-center gap-1 hover:underline flex-shrink-0"
          >
            <RotateCcw className="w-3 h-3" />
            {t("widget_retry")}
          </button>
        </div>
      )}

      {/* 入力エリア */}
      <div className="border-t border-gray-100 px-3 py-2 flex items-end gap-2 flex-shrink-0">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("widget_placeholder")}
          rows={1}
          className="flex-1 resize-none border-gray-200 focus:border-black focus:ring-black min-h-[36px] max-h-[80px] py-2 text-base"
        />
        <Button
          onClick={() => void handleSend()}
          disabled={!input.trim() || sending}
          className="bg-black hover:bg-gray-800 text-white rounded-full w-8 h-8 p-0 flex-shrink-0"
        >
          {sending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>

      {/* セッション終了ボタン */}
      <div className="px-3 pb-2 flex-shrink-0">
        <button
          onClick={onEndSession}
          className="text-xs text-gray-400 hover:text-gray-600 w-full text-center"
        >
          {t("widget_ended")}
        </button>
      </div>
    </>
  );
}
