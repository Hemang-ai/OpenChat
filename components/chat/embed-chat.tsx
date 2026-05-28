"use client";
import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, UserPlus, CheckCircle2, X } from "lucide-react";
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
  leadCaptureEnabled?: boolean;
  leadCapturePrompt?: string;
}

interface LeadFormState {
  name: string;
  email: string;
  phone: string;
  company: string;
  message: string;
}

export default function EmbedChat({
  publicKey,
  botName,
  welcomeMessage,
  suggestedQuestions = [],
  leadCaptureEnabled = false,
  leadCapturePrompt = "Want us to follow up? Leave your details and our team will reach out.",
}: Props) {
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "assistant", content: welcomeMessage },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [hideSuggestions, setHideSuggestions] = useState(false);
  const [leadFormOpen, setLeadFormOpen] = useState(false);
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadError, setLeadError] = useState("");
  const [leadData, setLeadData] = useState<LeadFormState>({
    name: "",
    email: "",
    phone: "",
    company: "",
    message: "",
  });
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const hasUserMessage = messages.some((msg) => msg.role === "user");
  const shouldShowLeadCapture = leadCaptureEnabled && hasUserMessage && !leadSubmitted;

  const updateLeadField = (field: keyof LeadFormState, value: string) => {
    setLeadData((prev) => ({ ...prev, [field]: value }));
  };

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

  const submitLead = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!leadData.email.trim()) {
      setLeadError("Email is required.");
      return;
    }

    setLeadSubmitting(true);
    setLeadError("");

    try {
      const res = await fetch("/api/public/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey,
          sessionId,
          name: leadData.name,
          email: leadData.email,
          phone: leadData.phone,
          company: leadData.company,
          message: leadData.message,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send contact details");

      setLeadSubmitted(true);
      setLeadFormOpen(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + "_lead",
          role: "assistant",
          content: "Thanks, we have your details and our team can follow up.",
        },
      ]);
    } catch (err) {
      setLeadError(err instanceof Error ? err.message : "Could not send contact details.");
    } finally {
      setLeadSubmitting(false);
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
        {shouldShowLeadCapture && (
          <div className="flex gap-2">
            <div className="w-7 h-7 bg-white border border-gray-200 rounded-full flex items-center justify-center shrink-0">
              <UserPlus className="w-3.5 h-3.5 text-gray-600" />
            </div>
            <div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-white border border-gray-100 px-4 py-3 text-sm shadow-sm">
              {!leadFormOpen ? (
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center gap-1.5 font-medium text-gray-900">
                      <UserPlus className="w-4 h-4" />
                      Human follow-up
                    </div>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{leadCapturePrompt}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLeadFormOpen(true)}
                    className="h-9 w-full rounded-lg bg-gray-900 px-3 text-xs font-medium text-white hover:bg-gray-700 transition-colors"
                  >
                    Leave contact details
                  </button>
                </div>
              ) : (
                <form onSubmit={submitLead} className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-gray-900">Contact details</div>
                      <p className="text-xs text-gray-500 mt-0.5">We will pass this to the team.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setLeadFormOpen(false);
                        setLeadError("");
                      }}
                      className="w-7 h-7 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center"
                      aria-label="Close contact form"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={leadData.name}
                      onChange={(e) => updateLeadField("name", e.target.value)}
                      placeholder="Name"
                      className="min-w-0 h-9 rounded-lg border border-gray-200 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                    <input
                      value={leadData.company}
                      onChange={(e) => updateLeadField("company", e.target.value)}
                      placeholder="Company"
                      className="min-w-0 h-9 rounded-lg border border-gray-200 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                  <input
                    type="email"
                    value={leadData.email}
                    onChange={(e) => updateLeadField("email", e.target.value)}
                    placeholder="Email *"
                    className="h-9 w-full rounded-lg border border-gray-200 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  <input
                    value={leadData.phone}
                    onChange={(e) => updateLeadField("phone", e.target.value)}
                    placeholder="Phone"
                    className="h-9 w-full rounded-lg border border-gray-200 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  <textarea
                    value={leadData.message}
                    onChange={(e) => updateLeadField("message", e.target.value)}
                    placeholder="What should we help with?"
                    rows={2}
                    className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  {leadError && <p className="text-xs text-red-500">{leadError}</p>}
                  <button
                    type="submit"
                    disabled={leadSubmitting}
                    className="h-9 w-full rounded-lg bg-gray-900 px-3 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
                  >
                    {leadSubmitting ? "Sending..." : "Send to team"}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
        {leadSubmitted && (
          <div className="flex items-center gap-2 pl-9 text-xs text-green-700">
            <CheckCircle2 className="w-4 h-4" />
            Contact details sent
          </div>
        )}
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
            className="absolute top-2 right-2 w-6 h-6 rounded-md text-gray-300 hover:text-gray-600 hover:bg-white flex items-center justify-center z-10"
            aria-label="Hide suggestions"
          >
            <X className="w-3.5 h-3.5" />
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
