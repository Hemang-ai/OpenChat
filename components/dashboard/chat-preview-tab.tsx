"use client";
import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, BookOpen, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import SuggestedBubbles from "@/components/chat/suggested-bubbles";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isGrounded?: boolean;
  isRefused?: boolean;
  sources?: Array<{ id: string; content: string; documentTitle?: string | null }>;
}

interface Props {
  bot: { id: string; name: string; welcomeMessage: string };
}

export default function ChatPreviewTab({ bot }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "assistant", content: bot.welcomeMessage },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [refreshingSuggestions, setRefreshingSuggestions] = useState(false);
  const [hideSuggestions, setHideSuggestions] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/admin/bots/${bot.id}/suggested-questions`);
        const d = await r.json();
        if (Array.isArray(d.questions)) setSuggestions(d.questions);
      } catch (e) {
        console.warn("Failed to load suggestions:", e);
      }
    })();
  }, [bot.id]);

  const refreshSuggestions = async () => {
    setRefreshingSuggestions(true);
    try {
      const r = await fetch(`/api/admin/bots/${bot.id}/suggested-questions`, { method: "POST" });
      const d = await r.json();
      if (Array.isArray(d.questions)) setSuggestions(d.questions);
    } catch (e) {
      console.warn("Failed to refresh suggestions:", e);
    } finally {
      setRefreshingSuggestions(false);
    }
  };

  const sendMessage = async (text?: string) => {
    const userText = (text ?? input).trim();
    if (!userText || loading) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: userText };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/bots/${bot.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText, conversationId, includeSources: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setConversationId(data.conversationId);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + "_bot",
          role: "assistant",
          content: data.answer,
          isGrounded: data.isGrounded,
          isRefused: data.isRefused,
          sources: data.sources,
        },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + "_err",
          role: "assistant",
          content: `⚠️ Error: ${message}\n\nCheck:\n• AI Settings — is your OpenAI key saved?\n• Knowledge tab — is at least one source COMPLETED?\n• Server terminal — look for the full error.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const toggleSources = (id: string) => {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-700">
        <strong>Admin preview</strong> — Shows retrieved sources and grounding status. The public widget doesn&apos;t show these details.
      </div>

      <div className="flex flex-col h-[600px] border rounded-xl overflow-hidden bg-white">
        {/* Chat header */}
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
          <div className="w-7 h-7 bg-gray-900 rounded-full flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <span className="font-medium text-sm">{bot.name}</span>
          <Badge variant="secondary" className="text-xs ml-auto">Preview Mode</Badge>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                msg.role === "user" ? "bg-gray-900" : "bg-gray-100"
              }`}>
                {msg.role === "user"
                  ? <User className="w-4 h-4 text-white" />
                  : <Bot className="w-4 h-4 text-gray-600" />}
              </div>
              <div className={`max-w-[80%] ${msg.role === "user" ? "items-end" : ""}`}>
                <div className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-gray-900 text-white rounded-tr-sm"
                    : "bg-gray-100 text-gray-900 rounded-tl-sm"
                }`}>
                  {msg.content}
                </div>
                {msg.role === "assistant" && (msg.isGrounded !== undefined || msg.isRefused !== undefined) && (
                  <div className="flex items-center gap-2 mt-1.5">
                    {msg.isRefused ? (
                      <span className="text-xs text-orange-500 flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> No grounded answer
                      </span>
                    ) : (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Grounded answer
                      </span>
                    )}
                    {msg.sources && msg.sources.length > 0 && (
                      <button
                        onClick={() => toggleSources(msg.id)}
                        className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
                      >
                        <BookOpen className="w-3 h-3" />
                        {msg.sources.length} source{msg.sources.length > 1 ? "s" : ""}
                      </button>
                    )}
                  </div>
                )}
                {expandedSources.has(msg.id) && msg.sources && (
                  <div className="mt-2 space-y-1.5">
                    {msg.sources.map((src, i) => (
                      <Card key={src.id} className="border-gray-200">
                        <CardContent className="p-2.5">
                          <p className="text-xs font-medium text-gray-500 mb-1">
                            Source {i + 1}{src.documentTitle ? ` — ${src.documentTitle}` : ""}
                          </p>
                          <p className="text-xs text-gray-700 line-clamp-3">{src.content}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center">
                <Bot className="w-4 h-4 text-gray-600" />
              </div>
              <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-2.5">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggested questions strip — transparent, blends with chat background */}
        {!hideSuggestions && suggestions.length > 0 && (
          <div className="relative bg-transparent px-3 pt-2 pb-1 max-h-[40%] overflow-y-auto">
            <button
              type="button"
              onClick={() => setHideSuggestions(true)}
              className="absolute top-2 right-2 text-gray-300 hover:text-gray-600 text-xs z-10"
              aria-label="Hide suggestions"
            >
              ✕
            </button>
            <SuggestedBubbles
              questions={suggestions}
              onPick={(q) => sendMessage(q)}
              onRefresh={refreshSuggestions}
              refreshing={refreshingSuggestions}
              variant="preview"
            />
          </div>
        )}

        {/* Input */}
        <div className="p-3 border-t">
          <form
            className="flex gap-2"
            onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
            /* sendMessage uses input state when no arg passed */
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about your business..."
              disabled={loading}
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={loading || !input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
