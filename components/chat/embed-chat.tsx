"use client";
import { useState, useRef, useEffect } from "react";
import { Send, Bot, User } from "lucide-react";
import SuggestedBubbles from "./suggested-bubbles";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface Props {
  publicKey: string;
  botName: string;
  welcomeMessage: string;
  suggestedQuestions?: string[];
}

export default function EmbedChat({ publicKey, botName, welcomeMessage, suggestedQuestions = [] }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "assistant", content: welcomeMessage },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [hideSuggestions, setHideSuggestions] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const userText = (text ?? input).trim();
    if (!userText || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { id: Date.now().toString(), role: "user", content: userText }]);
    setLoading(true);

    try {
      const res = await fetch("/api/public/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey, message: userText, sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      if (data.sessionId) setSessionId(data.sessionId);
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString() + "_bot", role: "assistant", content: data.answer },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + "_err",
          role: "assistant",
          content: err instanceof Error && err.message === "Too many requests. Please slow down."
            ? "You're sending messages too quickly. Please wait a moment."
            : "Sorry, I'm having trouble connecting. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-gray-900 text-white">
        <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center">
          <Bot className="w-4 h-4" />
        </div>
        <div>
          <p className="font-semibold text-sm">{botName}</p>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
            <span className="text-xs text-white/70">Online</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
              msg.role === "user" ? "bg-gray-900" : "bg-white border border-gray-200"
            }`}>
              {msg.role === "user"
                ? <User className="w-3.5 h-3.5 text-white" />
                : <Bot className="w-3.5 h-3.5 text-gray-600" />}
            </div>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
              msg.role === "user"
                ? "bg-gray-900 text-white rounded-tr-sm"
                : "bg-white text-gray-900 rounded-tl-sm border border-gray-100"
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <div className="w-7 h-7 bg-white border border-gray-200 rounded-full flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-gray-600" />
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggested questions strip — transparent, blends with chat background */}
      {!hideSuggestions && suggestedQuestions.length > 0 && (
        <div className="relative bg-gray-50 px-3 pt-2 pb-1 max-h-[40%] overflow-y-auto">
          <button
            type="button"
            onClick={() => setHideSuggestions(true)}
            className="absolute top-2 right-2 text-gray-300 hover:text-gray-600 text-xs z-10"
            aria-label="Hide suggestions"
          >
            ✕
          </button>
          <SuggestedBubbles
            questions={suggestedQuestions}
            onPick={(q) => sendMessage(q)}
          />
        </div>
      )}

      {/* Input */}
      <div className="p-3 bg-white border-t">
        <form
          className="flex gap-2"
          onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
          /* sendMessage takes optional text param; submit form uses input state */
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            disabled={loading}
            className="flex-1 h-10 px-3 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="w-10 h-10 bg-gray-900 text-white rounded-lg flex items-center justify-center hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <p className="text-center text-xs text-gray-400 mt-2">
          Powered by <a href="https://github.com/openbusinesschat" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600">OpenBusinessChat</a>
        </p>
      </div>
    </div>
  );
}
