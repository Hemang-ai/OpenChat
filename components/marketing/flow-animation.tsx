"use client";

import { useEffect, useState } from "react";
import { FileText, Globe, Play, Sparkles, MessageSquare, Bot } from "lucide-react";

/**
 * End-to-end animated demo of the OpenBusinessChat workflow.
 * Cycles through 4 stages: Sources -> Ingestion -> Embedding -> Live chat.
 */
export default function FlowAnimation() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setStage((s) => (s + 1) % 4), 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-2xl p-6 md:p-10 overflow-hidden">
      {/* Stage labels */}
      <div className="flex items-center justify-between mb-8 text-xs md:text-sm">
        {["1. Add knowledge", "2. AI ingests", "3. Vector index", "4. Chatbot live"].map((label, i) => (
          <div key={label} className="flex-1 text-center">
            <div
              className={`inline-block px-3 py-1 rounded-full font-medium transition-all duration-500 ${
                stage === i
                  ? "bg-gray-900 text-white scale-110"
                  : stage > i
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-400"
              }`}
            >
              {label}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        {/* Column 1: Knowledge sources */}
        <div className="space-y-3">
          {[
            { Icon: FileText, label: "Company PDF", color: "bg-blue-500" },
            { Icon: Globe, label: "Website FAQ", color: "bg-purple-500" },
            { Icon: Play, label: "Demo Video", color: "bg-red-500" },
          ].map(({ Icon, label, color }, i) => (
            <div
              key={label}
              className={`flex items-center gap-3 p-3 bg-white border rounded-lg shadow-sm transition-all duration-700 ${
                stage >= 1
                  ? "translate-x-2 opacity-100 border-gray-300"
                  : "opacity-100 border-gray-200"
              }`}
              style={{ transitionDelay: `${i * 120}ms` }}
            >
              <div className={`w-8 h-8 ${color} rounded-md flex items-center justify-center`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700">{label}</span>
              {stage === 1 && (
                <div className="ml-auto">
                  <div className="w-3 h-3 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {stage >= 2 && (
                <div className="ml-auto text-green-600 text-xs font-medium">✓</div>
              )}
            </div>
          ))}
        </div>

        {/* Column 2: AI brain / vector index */}
        <div className="flex flex-col items-center justify-center py-6">
          <div className="relative">
            {/* Animated rings */}
            <div
              className={`absolute inset-0 rounded-full border-2 border-gray-900/20 transition-all duration-1000 ${
                stage === 1 || stage === 2 ? "animate-ping" : ""
              }`}
            />
            <div
              className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-700 ${
                stage >= 1 ? "bg-gradient-to-br from-gray-900 to-gray-700 scale-110" : "bg-gray-200"
              }`}
            >
              <Sparkles
                className={`w-10 h-10 transition-colors duration-500 ${
                  stage >= 1 ? "text-white" : "text-gray-400"
                }`}
              />
            </div>
          </div>
          <div className="mt-4 text-center">
            <div className="text-xs font-semibold text-gray-900">AI + Vector DB</div>
            <div className="text-xs text-gray-500 mt-1">
              {stage === 0 && "Waiting for sources…"}
              {stage === 1 && "Extracting text…"}
              {stage === 2 && "Indexing 1,247 chunks"}
              {stage === 3 && "Answering queries"}
            </div>
          </div>

          {/* Flowing particles when ingesting */}
          {(stage === 1 || stage === 2) && (
            <div className="hidden md:block absolute left-1/3 top-1/2 w-1/3 h-1 pointer-events-none">
              <div className="absolute inset-0 flex items-center">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 bg-gray-900 rounded-full animate-pulse"
                    style={{
                      marginLeft: `${i * 30}%`,
                      animationDelay: `${i * 200}ms`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Column 3: Chatbot widget */}
        <div
          className={`bg-white border rounded-xl shadow-lg overflow-hidden transition-all duration-700 ${
            stage === 3 ? "scale-105 border-gray-900 shadow-xl" : "border-gray-200"
          }`}
        >
          <div className="bg-gray-900 text-white px-4 py-3 flex items-center gap-2">
            <Bot className="w-4 h-4" />
            <span className="text-sm font-medium">Acme Support Bot</span>
            <div className="ml-auto flex gap-1">
              <div className="w-2 h-2 bg-green-400 rounded-full" />
            </div>
          </div>
          <div className="p-3 space-y-2 min-h-[180px] bg-gray-50">
            {stage >= 3 && (
              <>
                <div className="flex justify-end">
                  <div
                    className="bg-gray-900 text-white text-xs px-3 py-2 rounded-2xl rounded-br-sm max-w-[80%] animate-in fade-in slide-in-from-right-2"
                    style={{ animationDuration: "400ms" }}
                  >
                    What is your refund policy?
                  </div>
                </div>
                <div className="flex justify-start">
                  <div
                    className="bg-white border border-gray-200 text-gray-900 text-xs px-3 py-2 rounded-2xl rounded-bl-sm max-w-[85%] animate-in fade-in slide-in-from-left-2"
                    style={{ animationDuration: "600ms", animationDelay: "500ms", animationFillMode: "backwards" }}
                  >
                    We offer 30-day refunds on all purchases. Just email{" "}
                    <span className="underline">support@acme.com</span> with your order ID.
                  </div>
                </div>
              </>
            )}
            {stage < 3 && (
              <div className="flex items-center justify-center h-full pt-12">
                <MessageSquare className="w-8 h-8 text-gray-300" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom hint */}
      <div className="mt-8 text-center text-xs text-gray-400">
        Live demo • cycles every 3 seconds
      </div>
    </div>
  );
}
