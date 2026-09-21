import { Bot, User as UserIcon } from "lucide-react";
import type { ChatMessage } from "../../types";

export function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex items-start gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          isUser ? "bg-slate-900 text-white" : "bg-brand-100 text-brand-700"
        }`}
      >
        {isUser ? <UserIcon className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>
      <div
        className={`max-w-[80%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm ${
          isUser
            ? "bg-slate-900 text-white"
            : message.isError
              ? "bg-red-50 text-red-700"
              : "bg-slate-100 text-slate-800"
        }`}
      >
        {message.text}
      </div>
    </div>
  );
}
