"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { Send, Bot, User, UserPlus, CheckCircle2, X, ThumbsUp, ThumbsDown, BookOpen, WifiOff, Globe } from "lucide-react";
import SuggestedBubbles from "./suggested-bubbles";
import { getMessages } from "@/lib/i18n/messages";
import { getLanguage, normalizeLanguage, describeLanguages } from "@/lib/i18n/languages";
import { MarkdownMessage } from "./markdown-message";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  messageId?: string;
  citations?: Array<{ title: string; url?: string | null; excerpt: string; updatedAt: string }>;
  feedback?: "POSITIVE" | "NEGATIVE";
  isRefused?: boolean;
}

interface Props {
  publicKey: string;
  botName: string;
  welcomeMessage: string;
  suggestedQuestions?: string[];
  leadCaptureEnabled?: boolean;
  leadCapturePrompt?: string;
  privacyNotice?: string;
  initialOrigin?: string;
  defaultLocale?: string;
  supportedLocales?: string[];
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
  privacyNotice = "Messages may be processed by AI to answer your questions. Do not share sensitive information.",
  initialOrigin,
  defaultLocale = "en",
  supportedLocales = ["en"],
}: Props) {
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "assistant", content: welcomeMessage },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [hideSuggestions, setHideSuggestions] = useState(false);
  const [language, setLanguage] = useState(defaultLocale);
  const [questions, setQuestions] = useState<string[]>(suggestedQuestions);
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
  const [online, setOnline] = useState(true);
  const [origin, setOrigin] = useState(initialOrigin);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const t = useMemo(() => getMessages(language), [language]);
  const isRtl = getLanguage(language)?.rtl === true;

  const switchLanguage = async (next: string) => {
    setLanguage(next);
    // Starter questions are verified per language; fetch that language's
    // verified set (generated lazily server-side if missing).
    try {
      const res = await fetch(`/api/public/bot/${publicKey}?lang=${encodeURIComponent(next)}${origin ? `&origin=${encodeURIComponent(origin)}` : ""}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.bot?.suggestedQuestions)) setQuestions(data.bot.suggestedQuestions);
      }
    } catch {
      // Keep current questions if the refresh fails.
    }
  };

  // Visitor language auto-detect with manual override: greet in the browser's
  // language when the bot supports it; the switcher always wins.
  useEffect(() => {
    const detected = normalizeLanguage(navigator.language);
    if (detected && detected !== defaultLocale && supportedLocales.includes(detected)) {
      switchLanguage(detected);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const eventOrigin = initialOrigin || (() => { try { return document.referrer ? new URL(document.referrer).origin : undefined; } catch { return undefined; } })();
    void fetch("/api/public/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicKey, type: "embed.loaded", origin: eventOrigin }),
    }).catch(() => undefined);
  }, [publicKey, initialOrigin]);

  useEffect(() => {
    const inferredOrigin = initialOrigin || (() => { try { return document.referrer ? new URL(document.referrer).origin : undefined; } catch { return undefined; } })();
    setOrigin(inferredOrigin);
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, [initialOrigin]);

  const hasUserMessage = messages.some((msg) => msg.role === "user");
  const shouldShowLeadCapture = leadCaptureEnabled && hasUserMessage && !leadSubmitted;
  const lastMessage = messages[messages.length - 1];
  const showRefusalActions = !loading && lastMessage?.role === "assistant" && lastMessage.isRefused;

  // Refusal quick replies: one tap toward a next step instead of a dead end.
  // "Talk to a person" opens the lead form when it's available.
  const refusalActions = [
    ...(leadCaptureEnabled && !leadSubmitted
      ? [{ label: t.talkToPerson, run: () => setLeadFormOpen(true) }]
      : []),
    { label: t.tryDifferentQuestion, run: () => inputRef.current?.focus() },
    { label: t.whatCanYouHelpWith, run: () => sendMessage(t.whatCanYouHelpWithQuestion) },
  ];

  const updateLeadField = (field: keyof LeadFormState, value: string) => {
    setLeadData((prev) => ({ ...prev, [field]: value }));
  };

  const sendMessage = async (text?: string) => {
    const userText = (text ?? input).trim();
    if (!userText || loading || !online) return;
    setInput("");
    setMessages((prev) => [...prev, { id: Date.now().toString(), role: "user", content: userText }]);
    setLoading(true);

    try {
      const res = await fetch("/api/public/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey, message: userText, sessionId, origin, locale: language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      if (data.sessionId) setSessionId(data.sessionId);
      const responseMessages = typeof data.locale === "string" ? getMessages(data.locale) : t;
      if (typeof data.locale === "string" && data.locale !== language && supportedLocales.includes(data.locale)) {
        void switchLanguage(data.locale);
      }
      if (!sessionId && data.sessionId) {
        void fetch("/api/public/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicKey, type: "chat.started", sessionId: data.sessionId }),
        }).catch(() => undefined);
      }
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString() + "_bot", role: "assistant", content: data.handoff ? `${data.answer}\n\n${responseMessages.passToTeam}` : data.answer, messageId: data.messageId, citations: data.citations, isRefused: data.isRefused === true },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + "_err",
          role: "assistant",
          content: err instanceof Error && err.message === "Too many requests. Please slow down."
            ? t.tooManyRequests
            : t.connectionTrouble,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const submitFeedback = async (messageId: string, rating: "POSITIVE" | "NEGATIVE") => {
    setMessages((current) => current.map((message) => message.messageId === messageId ? { ...message, feedback: rating } : message));
    try {
      const response = await fetch("/api/public/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publicKey, messageId, rating }) });
      if (!response.ok) throw new Error("Feedback failed");
    } catch {
      setMessages((current) => current.map((message) => message.messageId === messageId ? { ...message, feedback: undefined } : message));
    }
  };

  const submitLead = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!leadData.email.trim()) {
      setLeadError(t.emailRequired);
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
          origin,
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
          content: t.detailsConfirmed,
        },
      ]);
    } catch (err) {
      setLeadError(err instanceof Error ? err.message : "Could not send contact details.");
    } finally {
      setLeadSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full" dir={isRtl ? "rtl" : "ltr"} lang={language}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-gray-900 text-white">
        <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center">
          <Bot className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{botName}</p>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
            <span className="text-xs text-white/70">{online ? t.onlineStatus : t.offlineStatus}</span>
          </div>
        </div>
        {supportedLocales.length > 1 && (
          <div className="flex items-center gap-1.5 shrink-0">
            <Globe className="w-3.5 h-3.5 text-white/70" aria-hidden />
            <select
              value={language}
              onChange={(e) => switchLanguage(e.target.value)}
              aria-label={t.languageLabel}
              className="max-w-32 rounded-md border border-white/20 bg-transparent px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-white/60 [&>option]:text-gray-900"
            >
              {supportedLocales.map((code) => {
                const lang = getLanguage(code);
                return (
                  <option key={code} value={code}>
                    {lang?.nativeName || code}
                  </option>
                );
              })}
            </select>
          </div>
        )}
      </div>
      {supportedLocales.length > 1 && (
        <p className="border-b bg-gray-50 px-4 py-1.5 text-center text-[11px] text-gray-500">
          {t.availableInLanguages.replace("{languages}", describeLanguages(supportedLocales))}
        </p>
      )}

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
            <div className="min-w-0 max-w-[85%]">
            <div className={`overflow-hidden rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
              msg.role === "user"
                ? "bg-gray-900 text-white rounded-tr-sm"
                : "bg-white text-gray-900 rounded-tl-sm border border-gray-100"
            }`}>
              {msg.role === "assistant"
                ? <MarkdownMessage content={msg.content} />
                : <p className="whitespace-pre-wrap break-words leading-6">{msg.content}</p>}
            </div>
            {msg.role === "assistant" && msg.citations && msg.citations.length > 0 && <details className="mt-1.5 rounded-md border bg-white px-3 py-2 text-xs"><summary className="flex cursor-pointer items-center gap-1 font-medium text-gray-600"><BookOpen className="h-3 w-3" /> {t.sources} ({msg.citations.length})</summary><div className="mt-2 space-y-2">{msg.citations.map((citation, index) => <div key={`${citation.title}-${index}`} className="border-t pt-2 first:border-0 first:pt-0"><p className="font-medium text-gray-700">{citation.url ? <a href={citation.url} target="_blank" rel="noopener noreferrer" className="underline">{citation.title}</a> : citation.title}</p><p className="mt-0.5 text-gray-500">{citation.excerpt}</p><p className="mt-1 text-[10px] text-gray-400">{t.updated} {new Date(citation.updatedAt).toLocaleDateString()}</p></div>)}</div></details>}
            {msg.role === "assistant" && msg.messageId && <div className="mt-1 flex items-center gap-1"><span className="me-1 text-[10px] text-gray-400">{t.helpfulPrompt}</span><button type="button" onClick={() => submitFeedback(msg.messageId!, "POSITIVE")} className={`flex h-8 w-8 items-center justify-center rounded-md ${msg.feedback === "POSITIVE" ? "bg-emerald-100 text-emerald-700" : "text-gray-400 hover:bg-white"}`} aria-label={t.markHelpful}><ThumbsUp className="h-3.5 w-3.5" /></button><button type="button" onClick={() => submitFeedback(msg.messageId!, "NEGATIVE")} className={`flex h-8 w-8 items-center justify-center rounded-md ${msg.feedback === "NEGATIVE" ? "bg-orange-100 text-orange-700" : "text-gray-400 hover:bg-white"}`} aria-label={t.markNotHelpful}><ThumbsDown className="h-3.5 w-3.5" /></button></div>}
            </div>
          </div>
        ))}
        {showRefusalActions && (
          <div className="flex flex-wrap gap-2 ps-9">
            {refusalActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={action.run}
                className="min-h-9 rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:border-gray-500 hover:text-gray-900 transition-colors"
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
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
                      {t.humanFollowUp}
                    </div>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{leadCapturePrompt}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLeadFormOpen(true)}
                    className="min-h-11 w-full rounded-lg bg-gray-900 px-3 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
                  >
                    {t.leaveContactDetails}
                  </button>
                </div>
              ) : (
                <form onSubmit={submitLead} className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-gray-900">{t.contactDetails}</div>
                      <p className="text-xs text-gray-500 mt-0.5">{t.passToTeam}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setLeadFormOpen(false);
                        setLeadError("");
                      }}
                      className="w-11 h-11 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center"
                      aria-label={t.closeForm}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={leadData.name}
                      onChange={(e) => updateLeadField("name", e.target.value)}
                      placeholder={t.namePlaceholder}
                      className="min-w-0 min-h-11 rounded-lg border border-gray-200 px-3 text-base focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                    <input
                      value={leadData.company}
                      onChange={(e) => updateLeadField("company", e.target.value)}
                      placeholder={t.companyPlaceholder}
                      className="min-w-0 min-h-11 rounded-lg border border-gray-200 px-3 text-base focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                  <input
                    type="email"
                    value={leadData.email}
                    onChange={(e) => updateLeadField("email", e.target.value)}
                    placeholder={t.emailPlaceholder}
                    className="min-h-11 w-full rounded-lg border border-gray-200 px-3 text-base focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  <input
                    value={leadData.phone}
                    onChange={(e) => updateLeadField("phone", e.target.value)}
                    placeholder={t.phonePlaceholder}
                    className="min-h-11 w-full rounded-lg border border-gray-200 px-3 text-base focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  <textarea
                    value={leadData.message}
                    onChange={(e) => updateLeadField("message", e.target.value)}
                    placeholder={t.helpWithPlaceholder}
                    rows={2}
                    className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  {leadError && <p className="text-xs text-red-500">{leadError}</p>}
                  <button
                    type="submit"
                    disabled={leadSubmitting}
                    className="min-h-11 w-full rounded-lg bg-gray-900 px-3 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
                  >
                    {leadSubmitting ? t.sending : t.sendToTeam}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
        {leadSubmitted && (
          <div className="flex items-center gap-2 pl-9 text-xs text-green-700">
            <CheckCircle2 className="w-4 h-4" />
            {t.detailsSent}
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
      {!online && <div className="flex items-center justify-center gap-2 border-t bg-amber-50 px-3 py-2 text-xs text-amber-800" role="status"><WifiOff className="h-3.5 w-3.5" /> {t.offlineBanner}</div>}
      {!hideSuggestions && questions.length > 0 && (
        <div className="relative bg-gray-50 px-3 pt-2 pb-1 max-h-[40%] overflow-y-auto">
          <button
            type="button"
            onClick={() => setHideSuggestions(true)}
            className="absolute top-1 right-1 w-11 h-11 rounded-md text-gray-400 hover:text-gray-700 hover:bg-white flex items-center justify-center z-10"
            aria-label={t.hideSuggestions}
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <SuggestedBubbles
            questions={questions}
            onPick={(q) => sendMessage(q)}
            label={t.tryAsking}
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
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.typeMessage}
            disabled={loading || !online}
            className="flex-1 min-h-11 min-w-0 px-3 text-base rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={loading || !online || !input.trim()}
            className="w-11 h-11 bg-gray-900 text-white rounded-lg flex items-center justify-center hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label={t.send}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <p className="text-center text-xs text-gray-400 mt-2">
          {privacyNotice} {t.poweredBy} <a href="https://github.com/Hemang-ai/OpenChat" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600">OpenBusinessChat</a>
        </p>
      </div>
    </div>
  );
}
