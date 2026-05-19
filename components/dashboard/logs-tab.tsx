"use client";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle, XCircle, User, Bot } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Message {
  id: string;
  role: string;
  content: string;
  isGrounded?: boolean;
  isRefused?: boolean;
  createdAt: string;
}

interface Conversation {
  id: string;
  sessionId: string;
  createdAt: string;
  messages: Message[];
}

interface LogsResponse {
  conversations: Conversation[];
  total: number;
  page: number;
  totalPages: number;
}

export default function LogsTab({ botId }: { botId: string }) {
  const [data, setData] = useState<LogsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/bots/${botId}/logs?page=${page}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [botId, page]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data || data.conversations.length === 0) {
    return (
      <div className="text-center py-16">
        <Bot className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">No conversations yet</p>
        <p className="text-gray-400 text-xs mt-1">Conversations will appear here once users start chatting</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">{data.total} total conversations</p>

      {data.conversations.map((conv) => {
        const isOpen = expanded.has(conv.id);
        const firstMsg = conv.messages[0];
        const hasRefused = conv.messages.some((m) => m.isRefused);

        return (
          <Card key={conv.id} className="border-gray-100">
            <CardContent className="p-0">
              <button
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors rounded-xl"
                onClick={() => toggle(conv.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-400 font-mono">
                      {new Date(conv.createdAt).toLocaleString()}
                    </span>
                    <span className="text-xs text-gray-400">{conv.messages.length} messages</span>
                    {hasRefused && (
                      <Badge variant="warning" className="text-xs">Has refused</Badge>
                    )}
                  </div>
                  {firstMsg && (
                    <p className="text-sm text-gray-700 truncate">
                      {firstMsg.role === "USER" ? firstMsg.content : ""}
                    </p>
                  )}
                </div>
                {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
              </button>

              {isOpen && (
                <div className="border-t border-gray-100 p-4 space-y-3">
                  {conv.messages.map((msg) => (
                    <div key={msg.id} className={`flex gap-2 ${msg.role === "USER" ? "flex-row-reverse" : ""}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                        msg.role === "USER" ? "bg-gray-900" : "bg-gray-100"
                      }`}>
                        {msg.role === "USER"
                          ? <User className="w-3 h-3 text-white" />
                          : <Bot className="w-3 h-3 text-gray-600" />}
                      </div>
                      <div className="max-w-[80%]">
                        <div className={`rounded-xl px-3 py-2 text-xs ${
                          msg.role === "USER" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-800"
                        }`}>
                          {msg.content}
                        </div>
                        {msg.role === "ASSISTANT" && msg.isRefused !== null && msg.isRefused !== undefined && (
                          <div className="flex items-center gap-1 mt-1">
                            {msg.isRefused
                              ? <span className="text-xs text-orange-500 flex items-center gap-0.5"><XCircle className="w-3 h-3" /> Refused</span>
                              : <span className="text-xs text-green-600 flex items-center gap-0.5"><CheckCircle className="w-3 h-3" /> Grounded</span>
                            }
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-gray-500">Page {page} of {data.totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
