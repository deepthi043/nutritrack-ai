import { useState, useRef, useEffect, type FormEvent } from "react";
import { Send, MessageCircleQuestion } from "lucide-react";
import { Card } from "../Card";
import { Button } from "../Button";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { askAI } from "../../services/aiService";
import { getApiErrorMessage } from "../../services/api";
import type { ChatMessage } from "../../types";

const SUGGESTED_QUESTIONS = [
  "How many steps did I take today?",
  "How much water have I had today?",
  "How many steps did I take this week?",
  "Summarize my week.",
];

let messageIdCounter = 0;
function nextId() {
  messageIdCounter += 1;
  return `msg-${messageIdCounter}`;
}

export function AIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function sendQuestion(question: string) {
    if (!question.trim() || isSending) return;

    const userMessage: ChatMessage = { id: nextId(), role: "user", text: question };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsSending(true);

    try {
      const response = await askAI(question);
      setMessages((prev) => [...prev, { id: nextId(), role: "assistant", text: response.answer }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "assistant", text: getApiErrorMessage(err), isError: true },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    sendQuestion(input);
  }

  return (
    <Card className="flex h-[32rem] flex-col p-0">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
        <MessageCircleQuestion className="h-4 w-4 text-brand-600" />
        <h3 className="text-sm font-semibold text-slate-900">Wellness Assistant</h3>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Ask about your logged activity, water, or trends.</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendQuestion(q)}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <ChatMessageBubble key={message.id} message={message} />
        ))}

        {isSending && <p className="text-xs text-slate-400">Thinking...</p>}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-slate-100 px-4 py-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your data..."
          className="flex-1 rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          disabled={isSending}
        />
        <Button type="submit" variant="primary" size="sm" disabled={!input.trim() || isSending} aria-label="Send">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </Card>
  );
}
