"use client";

import { useEffect, useState } from "react";
import {
  Bot, FileText, Globe, Play, CheckCircle2, Loader2,
  Send, Sparkles, Code2, MessageSquare, Settings, LayoutDashboard,
} from "lucide-react";

/**
 * Animated dashboard mockup for the landing page hero.
 * Cycles through a realistic 4-stage flow:
 *   1) Knowledge sources uploading (with progress bars)
 *   2) Knowledge indexed (green checkmarks)
 *   3) User asking the chatbot
 *   4) Bot responding with grounded answer + embed code reveal
 */
export default function DashboardMockup() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setStage((s) => (s + 1) % 4), 3500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-3 md:p-5 shadow-xl shadow-gray-200/40">
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 mb-3 px-1">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
        <div className="ml-3 flex-1 h-5 bg-white border border-gray-200 rounded text-[10px] text-gray-400 px-2 flex items-center">
          openchat.io/dashboard
        </div>
      </div>

      <div className="grid grid-cols-12 gap-3 min-h-[380px]">
        {/* Sidebar */}
        <div className="hidden md:flex col-span-2 flex-col gap-1 bg-white rounded-lg border border-gray-100 p-2">
          <div className="flex items-center gap-1.5 px-2 py-1.5 mb-2">
            <div className="w-5 h-5 bg-gray-900 rounded-md flex items-center justify-center">
              <Bot className="w-3 h-3 text-white" />
            </div>
            <span className="text-[11px] font-bold text-gray-900">OpenChat</span>
          </div>
          {[
            { Icon: LayoutDashboard, label: "Dashboard", active: true },
            { Icon: Bot, label: "Bots" },
            { Icon: Settings, label: "AI Settings" },
          ].map(({ Icon, label, active }) => (
            <div
              key={label}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px] ${
                active ? "bg-gray-900 text-white" : "text-gray-500"
              }`}
            >
              <Icon className="w-3 h-3" />
              <span>{label}</span>
            </div>
          ))}
        </div>

        {/* Main panel — left: knowledge sources, right: chat preview */}
        <div className="col-span-12 md:col-span-10 grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* LEFT — Knowledge sources */}
          <div className="bg-white rounded-lg border border-gray-100 p-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold text-gray-700">Knowledge Sources</span>
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors ${
                  stage >= 2 ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {stage >= 2 ? "✓ Ready" : "Indexing…"}
              </span>
            </div>

            <div className="space-y-2">
              {[
                { Icon: FileText, label: "Company Handbook.pdf", color: "bg-blue-500", size: "2.4 MB", chunks: 142 },
                { Icon: Globe, label: "acme.com/faq", color: "bg-purple-500", size: "—", chunks: 87 },
                { Icon: Play, label: "Onboarding Webinar", color: "bg-red-500", size: "32 min", chunks: 196 },
              ].map((src, i) => {
                const isLoading = stage === 1;
                const isDone = stage >= 2;
                const progress = stage === 0 ? 0 : stage === 1 ? 65 : 100;
                return (
                  <div
                    key={src.label}
                    className="border border-gray-100 rounded p-2"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 ${src.color} rounded flex items-center justify-center shrink-0`}>
                        <src.Icon className="w-3 h-3 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-medium text-gray-800 truncate">{src.label}</div>
                        <div className="text-[9px] text-gray-400">
                          {isDone ? `${src.chunks} chunks indexed` : src.size}
                        </div>
                      </div>
                      {isLoading ? (
                        <Loader2 className="w-3 h-3 text-blue-500 animate-spin shrink-0" />
                      ) : isDone ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      ) : null}
                    </div>
                    {/* Progress bar */}
                    <div className="mt-1.5 h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-1000 ease-out ${
                          isDone ? "bg-green-500" : "bg-blue-500"
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Embed code preview - appears on final stage */}
            <div
              className={`mt-3 rounded bg-gray-900 px-2 py-1.5 transition-all duration-500 overflow-hidden ${
                stage === 3 ? "max-h-20 opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Code2 className="w-3 h-3 text-green-400" />
                <span className="text-[9px] text-green-400 font-medium">Embed code copied!</span>
              </div>
              <code className="text-[9px] text-gray-300 font-mono break-all">
                {`<script src="openchat.io/widget.js" data-bot="acme"></script>`}
              </code>
            </div>
          </div>

          {/* RIGHT — Chat preview */}
          <div className="bg-white rounded-lg border border-gray-100 flex flex-col overflow-hidden">
            <div className="bg-gray-900 text-white px-3 py-2 flex items-center gap-2">
              <div className="w-5 h-5 bg-white/10 rounded-full flex items-center justify-center">
                <Bot className="w-3 h-3" />
              </div>
              <div className="flex-1">
                <div className="text-[11px] font-medium">Acme Support</div>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                  <span className="text-[9px] text-white/70">Online</span>
                </div>
              </div>
              <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
            </div>

            <div className="flex-1 p-2.5 space-y-2 bg-gray-50 min-h-[200px]">
              {/* Welcome message — always present */}
              <div className="flex gap-1.5">
                <div className="w-5 h-5 bg-white border border-gray-200 rounded-full flex items-center justify-center shrink-0">
                  <Bot className="w-2.5 h-2.5 text-gray-600" />
                </div>
                <div className="bg-white border border-gray-100 rounded-lg rounded-tl-sm px-2 py-1.5 text-[10px] text-gray-800 max-w-[85%]">
                  Hi! I'm trained on Acme's docs. Ask me anything.
                </div>
              </div>

              {/* User question — appears at stage 3 */}
              {stage >= 3 && (
                <div className="flex gap-1.5 flex-row-reverse animate-in fade-in slide-in-from-right-2 duration-500">
                  <div className="w-5 h-5 bg-gray-900 rounded-full flex items-center justify-center shrink-0">
                    <MessageSquare className="w-2.5 h-2.5 text-white" />
                  </div>
                  <div className="bg-gray-900 text-white rounded-lg rounded-tr-sm px-2 py-1.5 text-[10px] max-w-[85%]">
                    What's the refund window?
                  </div>
                </div>
              )}

              {/* Bot answer — appears with delay at stage 3 */}
              {stage >= 3 && (
                <div
                  className="flex gap-1.5 animate-in fade-in slide-in-from-left-2 duration-500"
                  style={{ animationDelay: "600ms", animationFillMode: "backwards" }}
                >
                  <div className="w-5 h-5 bg-white border border-gray-200 rounded-full flex items-center justify-center shrink-0">
                    <Bot className="w-2.5 h-2.5 text-gray-600" />
                  </div>
                  <div className="bg-white border border-gray-100 rounded-lg rounded-tl-sm px-2 py-1.5 text-[10px] text-gray-800 max-w-[85%]">
                    30 days from purchase for unused items. Email{" "}
                    <span className="underline">refunds@acme.com</span> with your order ID.
                  </div>
                </div>
              )}

              {/* Typing dots — only at stage 2 (just after indexing finishes) */}
              {stage === 2 && (
                <div className="flex gap-1.5 animate-in fade-in duration-300">
                  <div className="w-5 h-5 bg-white border border-gray-200 rounded-full flex items-center justify-center shrink-0">
                    <Bot className="w-2.5 h-2.5 text-gray-600" />
                  </div>
                  <div className="bg-white border border-gray-100 rounded-lg rounded-tl-sm px-2.5 py-2 flex gap-0.5">
                    <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}

              {/* Suggested chip — visible early stages, fades when user "types" */}
              {stage < 3 && (
                <div className="ml-6 mt-1 flex flex-wrap gap-1">
                  {["What's the refund window?", "How do I contact support?"].map((q, i) => (
                    <div
                      key={q}
                      className="text-[9px] px-2 py-1 rounded-full bg-white border border-gray-200 text-gray-600 animate-in fade-in slide-in-from-bottom-1"
                      style={{ animationDelay: `${i * 120}ms`, animationFillMode: "backwards" }}
                    >
                      {q}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-gray-100 p-2 flex items-center gap-1.5 bg-white">
              <div className="flex-1 h-6 bg-gray-50 border border-gray-200 rounded text-[10px] text-gray-400 px-2 flex items-center">
                Type a message…
              </div>
              <div className="w-6 h-6 bg-gray-900 rounded flex items-center justify-center">
                <Send className="w-3 h-3 text-white" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stage caption */}
      <div className="mt-3 flex items-center justify-center gap-2 text-[11px]">
        {["Upload knowledge", "AI indexes content", "Bot goes live", "Embed anywhere"].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full transition-all ${
                stage === i
                  ? "bg-gray-900 text-white scale-105"
                  : stage > i
                    ? "text-green-600"
                    : "text-gray-400"
              }`}
            >
              {stage > i && <CheckCircle2 className="w-3 h-3" />}
              <span>{label}</span>
            </div>
            {i < 3 && <span className="text-gray-300">→</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
