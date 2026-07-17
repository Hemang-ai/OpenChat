"use client";
import { useEffect, useState } from "react";
import { MessageSquare, Users, ThumbsDown, TrendingUp, UserPlus, Clock, ShieldCheck, Gauge, CircleHelp, ThumbsUp, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Analytics {
  totalConversations: number;
  totalMessages: number;
  refusedMessages: number;
  totalLeads: number;
  newLeads: number;
  topQuestions: string[];
  assistantMessages: number;
  groundedMessages: number;
  evidenceCoverage: number;
  averageEvidenceScore: number;
  averageLatencyMs: number;
  positiveFeedback: number;
  negativeFeedback: number;
  feedbackSatisfaction: number;
  openGaps: number;
  handoffs: number;
  resolved: number;
  containmentRate: number;
  resolutionRate: number;
  actionSuccess: number;
  actionFailure: number;
  usage: { inputTokens: number; outputTokens: number; estimatedCostUsd: number; priceCatalogVersion: string };
  providerBreakdown: Array<{ provider: string | null; model: string | null; _count: number; _sum: { inputTokens: number | null; outputTokens: number | null }; estimatedCostUsd: number }>;
}

export default function AnalyticsTab({ botId }: { botId: string }) {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/bots/${botId}/analytics`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [botId]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="h-8 bg-gray-100 rounded animate-pulse mb-2" />
              <div className="h-4 bg-gray-100 rounded animate-pulse w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) return <p className="text-gray-500 text-sm">Failed to load analytics.</p>;

  const leadConversionRate = data.totalConversations > 0
    ? Math.round((data.totalLeads / data.totalConversations) * 100)
    : 0;

  const stats = [
    { label: "Conversations", value: data.totalConversations, icon: Users, color: "text-blue-600" },
    { label: "Total messages", value: data.totalMessages, icon: MessageSquare, color: "text-green-600" },
    { label: "Refused answers", value: data.refusedMessages, icon: ThumbsDown, color: "text-orange-500" },
    { label: "Evidence coverage", value: `${data.evidenceCoverage}%`, icon: ShieldCheck, color: "text-purple-600" },
    { label: "Average evidence", value: `${data.averageEvidenceScore}%`, icon: Gauge, color: "text-indigo-600" },
    { label: "Average latency", value: `${(data.averageLatencyMs / 1000).toFixed(1)}s`, icon: Clock, color: "text-blue-600" },
    { label: "Helpful ratings", value: `${data.feedbackSatisfaction}%`, icon: ThumbsUp, color: "text-emerald-600" },
    { label: "Negative ratings", value: data.negativeFeedback, icon: ThumbsDown, color: "text-orange-600" },
    { label: "Open knowledge gaps", value: data.openGaps, icon: CircleHelp, color: "text-amber-600" },
    { label: "Leads captured", value: data.totalLeads, icon: UserPlus, color: "text-cyan-600" },
    { label: "New leads", value: data.newLeads, icon: Clock, color: "text-amber-600" },
    { label: "Lead conversion", value: `${leadConversionRate}%`, icon: TrendingUp, color: "text-emerald-600" },
    { label: "Containment", value: `${data.containmentRate}%`, icon: ShieldCheck, color: "text-emerald-600" },
    { label: "Resolved", value: `${data.resolutionRate}%`, icon: CheckCircle, color: "text-green-600" },
    { label: "Active handoffs", value: data.handoffs, icon: Users, color: "text-amber-600" },
    { label: "Action success", value: data.actionSuccess, icon: Gauge, color: "text-blue-600" },
    { label: "Estimated AI cost", value: `$${data.usage.estimatedCostUsd.toFixed(4)}`, icon: TrendingUp, color: "text-gray-900" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-end"><a href={`/api/admin/bots/${botId}/analytics?format=csv`}><Button size="sm" variant="outline">Export redacted CSV</Button></a></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-6">
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="flex items-center gap-1.5 mt-1">
                <stat.icon className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-sm text-gray-500">{stat.label}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {data.topQuestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent user questions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.topQuestions.slice(0, 10).map((q, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-gray-300 font-mono text-xs mt-0.5 w-5 shrink-0">{i + 1}.</span>
                  <span className="text-gray-700">{q}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      <Card><CardHeader><CardTitle className="text-base">Provider and model usage</CardTitle></CardHeader><CardContent><p className="mb-3 text-xs text-gray-500">Estimated from text length using price catalog {data.usage.priceCatalogVersion}; provider invoices remain authoritative.</p>{data.providerBreakdown.length === 0 ? <p className="text-sm text-gray-500">Usage will appear after new conversations.</p> : <div className="space-y-2">{data.providerBreakdown.map((item) => <div key={`${item.provider}:${item.model}`} className="grid grid-cols-[1fr_auto] gap-3 rounded-md border p-3 text-sm"><span>{item.provider} · {item.model}</span><strong>${item.estimatedCostUsd.toFixed(4)}</strong><span className="text-xs text-gray-500">{item._sum.inputTokens || 0} input · {item._sum.outputTokens || 0} output tokens</span><span className="text-xs text-gray-500">{item._count} replies</span></div>)}</div>}</CardContent></Card>
    </div>
  );
}
