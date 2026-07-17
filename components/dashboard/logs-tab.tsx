"use client";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle, XCircle, User, Bot, Clock3, UserRoundCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarkdownMessage } from "@/components/chat/markdown-message";

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
  status: "AI_ACTIVE" | "HANDOFF_REQUESTED" | "HUMAN_ACTIVE" | "RESOLVED";
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  assignedToLabel: string | null;
  summary: string | null;
  handoffReason: string | null;
  slaDueAt: string | null;
  notes: Array<{ id: string; body: string; createdAt: string; author: { name: string | null; email: string } | null }>;
  leads: Array<{ name: string | null; email: string; phone: string | null; company: string | null }>;
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
  const [status, setStatus] = useState("ALL");
  const [note, setNote] = useState<Record<string, string>>({});
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/bots/${botId}/logs?page=${page}${status === "ALL" ? "" : `&status=${status}`}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [botId, page, status, refresh]);

  const updateConversation = async (conversationId: string, update: Record<string, unknown>) => {
    const response = await fetch(`/api/admin/bots/${botId}/logs/${conversationId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(update) });
    if (response.ok) { setLoading(true); setRefresh((current) => current + 1); }
  };

  const addNote = async (conversationId: string) => {
    const body = note[conversationId]?.trim(); if (!body) return;
    const response = await fetch(`/api/admin/bots/${botId}/logs/${conversationId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note: body }) });
    if (response.ok) { setNote((current) => ({ ...current, [conversationId]: "" })); setLoading(true); setRefresh((current) => current + 1); }
  };

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
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
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-gray-500">{data.total} matching conversations</p><select aria-label="Conversation status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); setLoading(true); }} className="h-10 rounded-md border bg-white px-3 text-sm"><option value="ALL">All conversations</option><option value="HANDOFF_REQUESTED">Needs handoff</option><option value="HUMAN_ACTIVE">Human active</option><option value="AI_ACTIVE">AI active</option><option value="RESOLVED">Resolved</option></select></div>

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
                    <Badge variant={conv.status === "HANDOFF_REQUESTED" ? "warning" : conv.status === "RESOLVED" ? "success" : "secondary"} className="text-xs">{conv.status.replaceAll("_", " ")}</Badge>
                    {conv.priority !== "NORMAL" && <Badge variant={conv.priority === "URGENT" ? "destructive" : "warning"} className="text-xs">{conv.priority}</Badge>}
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
                  {(conv.handoffReason || conv.summary) && <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm"><strong>Handoff packet</strong>{conv.handoffReason && <p className="mt-1 text-amber-900">Reason: {conv.handoffReason}</p>}{conv.summary && <p className="mt-2 whitespace-pre-wrap text-xs text-amber-900">{conv.summary}</p>}{conv.leads[0] && <p className="mt-2 text-xs">Visitor: {conv.leads[0].name || "Unknown"} · {conv.leads[0].email}{conv.leads[0].phone ? ` · ${conv.leads[0].phone}` : ""}</p>}{conv.slaDueAt && <p className="mt-2 flex items-center gap-1 text-xs"><Clock3 className="h-3 w-3" /> SLA due {new Date(conv.slaDueAt).toLocaleString()}</p>}</div>}
                  <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_1fr_auto]">
                    <select aria-label="Workflow status" value={conv.status} onChange={(event) => updateConversation(conv.id, { status: event.target.value })} className="h-10 rounded-md border bg-white px-3 text-sm"><option value="AI_ACTIVE">AI active</option><option value="HANDOFF_REQUESTED">Needs handoff</option><option value="HUMAN_ACTIVE">Human active</option><option value="RESOLVED">Resolved</option></select>
                    <select aria-label="Priority" value={conv.priority} onChange={(event) => updateConversation(conv.id, { priority: event.target.value })} className="h-10 rounded-md border bg-white px-3 text-sm"><option value="LOW">Low priority</option><option value="NORMAL">Normal priority</option><option value="HIGH">High priority</option><option value="URGENT">Urgent</option></select>
                    <Button variant="outline" onClick={() => updateConversation(conv.id, { assignedToLabel: conv.assignedToLabel ? null : "Workspace owner", status: conv.assignedToLabel ? conv.status : "HUMAN_ACTIVE" })}><UserRoundCheck className="mr-1 h-4 w-4" />{conv.assignedToLabel ? "Unassign" : "Assign to me"}</Button>
                  </div>
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
                        <div className={`overflow-hidden rounded-xl px-3 py-2 text-xs ${
                          msg.role === "USER" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-800"
                        }`}>
                          {msg.role === "ASSISTANT"
                            ? <MarkdownMessage content={msg.content} />
                            : <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
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
                  <div className="space-y-2 border-t pt-3"><p className="text-xs font-medium text-gray-700">Internal notes</p>{conv.notes.map((item) => <div key={item.id} className="rounded bg-gray-50 p-2 text-xs"><span className="font-medium">{item.author?.name || item.author?.email || "Team member"}</span><span className="ml-2 text-gray-400">{new Date(item.createdAt).toLocaleString()}</span><p className="mt-1 whitespace-pre-wrap">{item.body}</p></div>)}<div className="flex gap-2"><input aria-label="Internal note" value={note[conv.id] || ""} onChange={(event) => setNote((current) => ({ ...current, [conv.id]: event.target.value }))} className="h-10 min-w-0 flex-1 rounded-md border px-3 text-sm" placeholder="Add an internal note" /><Button variant="outline" onClick={() => addNote(conv.id)}>Add note</Button></div></div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => {
              setLoading(true);
              setPage(p => p - 1);
            }}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-500">Page {page} of {data.totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.totalPages}
            onClick={() => {
              setLoading(true);
              setPage(p => p + 1);
            }}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
