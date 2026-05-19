"use client";

import { Sparkles, ArrowRight, RefreshCw } from "lucide-react";

interface Props {
  questions: string[];
  onPick: (q: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  variant?: "widget" | "preview";
}

/**
 * Animated suggested-question bubbles. Each bubble sizes to fit its text,
 * fades in with a stagger, and lifts on hover.
 */
export default function SuggestedBubbles({
  questions,
  onPick,
  onRefresh,
  refreshing,
  variant = "widget",
}: Props) {
  if (!questions.length) return null;
  const isPreview = variant === "preview";

  return (
    <div className={`${isPreview ? "px-1 py-2" : "px-1"} animate-in fade-in duration-500`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
          <span className="relative flex h-4 w-4 items-center justify-center">
            <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-50 animate-ping" />
            <Sparkles className="relative w-3.5 h-3.5 text-blue-600" />
          </span>
          <span>Try asking</span>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            title="Regenerate suggestions"
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Thinking…" : "Refresh"}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {questions.map((q, i) => (
          <button
            key={`${i}-${q}`}
            onClick={() => onPick(q)}
            style={{
              animationDelay: `${i * 100}ms`,
              animationFillMode: "backwards",
            }}
            className="group relative overflow-hidden inline-flex items-center gap-1.5 max-w-full
                       px-3.5 py-1.5 rounded-full
                       bg-white/70 backdrop-blur-sm
                       border border-gray-200/70 hover:border-blue-400 hover:bg-white
                       text-xs text-gray-700 hover:text-blue-700
                       transition-all duration-200
                       hover:-translate-y-0.5
                       animate-in fade-in slide-in-from-bottom-2 zoom-in-95"
          >
            {/* Shimmer effect */}
            <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-blue-100/40 to-transparent" />
            <span className="relative whitespace-normal text-left leading-snug break-words">{q}</span>
            <ArrowRight className="relative w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all" />
          </button>
        ))}
      </div>
    </div>
  );
}
