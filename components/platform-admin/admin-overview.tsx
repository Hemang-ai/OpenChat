"use client";

import { useEffect, useState } from "react";
import { Activity, Bot, Building2, Cable, ChartNoAxesCombined, Database, MessageSquare, ShieldCheck, UserPlus, Users, Wrench } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Metrics = {
  totalUsers: number; newUsers: number; totalWorkspaces: number; newWorkspaces: number;
  totalBots: number; newBots: number; activeBots: number; completedSources: number;
  newCompletedSources: number; conversations: number; messages: number; refusedMessages: number;
  leads: number; toolExecutions: number; toolFailures: number; ingestionFailures: number; securityEvents: number;
  activatedWorkspaces: number; verifiedInstalls: number; verifiedOrigins: number; widgetOpens: number;
  handoffs: number; webhookFailures: number; queueDepth: number; openPrivacyRequests: number;
  inputTokens: number; outputTokens: number; estimatedCostUsd: number;
  providerUsage: Array<{ provider: string | null; model: string | null; replies: number; estimatedCostUsd: number }>;
};

type Response = { period: { days: number }; actor: { role: string; name: string }; metrics: Metrics };
type Alert = { id: string; title: string; description: string; severity: string; status: string; ownerLabel: string | null; lastSeenAt: string };

function MetricCard({ label, value, detail, icon: Icon, tone = "text-gray-700" }: { label: string; value: number; detail: string; icon: typeof Users; tone?: string }) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-gray-500">{label}</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{value.toLocaleString()}</p>
            <p className="mt-1 text-xs text-gray-500">{detail}</p>
          </div>
          <div className="rounded-md bg-gray-100 p-2"><Icon className="h-4 w-4 text-gray-600" /></div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminOverview() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Response | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/platform-admin/overview?days=${days}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not load platform metrics");
        return body as Response;
      })
      .then((body) => { if (!cancelled) { setError(null); setData(body); } })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load platform metrics"); });
    return () => { cancelled = true; };
  }, [days]);

  useEffect(() => { let cancelled = false; fetch("/api/platform-admin/alerts").then((response) => response.json()).then((body) => { if (!cancelled) setAlerts(body.alerts || []); }); return () => { cancelled = true; }; }, []);

  if (error) {
    return <Card className="border-red-200"><CardContent className="p-6 text-sm text-red-700">{error}</CardContent></Card>;
  }

  const metrics = data?.metrics;
  const range = `${days} days`;

  return (
    <div className="mx-auto max-w-7xl space-y-7 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">Platform control plane</p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-950">OpenBusinessChat administration</h1>
          <p className="mt-1 text-sm text-gray-600">Acquisition, activation, quality, operations, and security across every workspace.</p>
        </div>
        <div className="flex rounded-md border bg-white p-1" aria-label="Reporting period">
          {[7, 30, 90].map((option) => <Button key={option} variant={days === option ? "default" : "ghost"} size="sm" onClick={() => setDays(option)}>{option}d</Button>)}
        </div>
      </div>

      {!metrics ? <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <Card key={index}><CardContent className="p-5"><div className="h-3 w-20 animate-pulse rounded bg-gray-100" /><div className="mt-3 h-8 w-14 animate-pulse rounded bg-gray-100" /></CardContent></Card>)}</div> : <>
        {alerts.filter((alert) => alert.status !== "RESOLVED").length > 0 && <section className="space-y-3" aria-labelledby="alerts-heading"><div><h2 id="alerts-heading" className="text-base font-semibold">Operational alerts</h2><p className="text-sm text-gray-500">Threshold observations with owner and acknowledgement workflow.</p></div>{alerts.filter((alert) => alert.status !== "RESOLVED").map((alert) => <Card key={alert.id} className={alert.severity === "CRITICAL" ? "border-red-300" : "border-amber-300"}><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><div className="flex-1"><div className="flex gap-2"><strong className="text-sm">{alert.title}</strong><span className="text-xs text-gray-500">{alert.severity}</span></div><p className="mt-1 text-xs text-gray-600">{alert.description}</p></div><Button size="sm" variant="outline" onClick={async () => { await fetch("/api/platform-admin/alerts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ alertId: alert.id, status: alert.status === "OPEN" ? "ACKNOWLEDGED" : "RESOLVED", ownerLabel: data?.actor.name || null }) }); setAlerts((items) => items.map((item) => item.id === alert.id ? { ...item, status: item.status === "OPEN" ? "ACKNOWLEDGED" : "RESOLVED" } : item)); }}>{alert.status === "OPEN" ? "Acknowledge" : "Resolve"}</Button></CardContent></Card>)}</section>}
        <section aria-labelledby="growth-heading" className="space-y-3">
          <div><h2 id="growth-heading" className="text-base font-semibold">Growth and activation</h2><p className="text-sm text-gray-500">New activity in the last {range}; totals are shown as context.</p></div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="New signups" value={metrics.newUsers} detail={`${metrics.totalUsers.toLocaleString()} total users`} icon={UserPlus} tone="text-blue-700" />
            <MetricCard label="New workspaces" value={metrics.newWorkspaces} detail={`${metrics.totalWorkspaces.toLocaleString()} total workspaces`} icon={Building2} tone="text-violet-700" />
            <MetricCard label="Activated workspaces" value={metrics.activatedWorkspaces} detail="Sources and visitor conversations" icon={ChartNoAxesCombined} tone="text-emerald-700" />
            <MetricCard label="Verified installs" value={metrics.verifiedInstalls} detail={`${metrics.verifiedOrigins} observed domains`} icon={Cable} tone="text-cyan-700" />
          </div>
        </section>

        <section aria-labelledby="usage-heading" className="space-y-3">
          <div><h2 id="usage-heading" className="text-base font-semibold">Product usage</h2><p className="text-sm text-gray-500">A copied embed code is not counted as an installation until a live load is observed.</p></div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="New bots" value={metrics.newBots} detail={`${metrics.activeBots} active of ${metrics.totalBots}`} icon={Bot} />
            <MetricCard label="Conversations" value={metrics.conversations} detail={`${metrics.messages.toLocaleString()} messages`} icon={MessageSquare} tone="text-indigo-700" />
            <MetricCard label="Leads captured" value={metrics.leads} detail={`${metrics.widgetOpens.toLocaleString()} widget opens`} icon={Users} tone="text-emerald-700" />
            <MetricCard label="Knowledge processed" value={metrics.newCompletedSources} detail={`${metrics.completedSources.toLocaleString()} completed sources`} icon={Database} tone="text-amber-700" />
          </div>
        </section>

        <section aria-labelledby="operations-heading" className="space-y-3">
          <div><h2 id="operations-heading" className="text-base font-semibold">Quality and operations</h2><p className="text-sm text-gray-500">Use these indicators to find friction before it affects customers.</p></div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="Refused answers" value={metrics.refusedMessages} detail="Assistant messages marked as refused" icon={MessageSquare} tone="text-orange-700" />
            <MetricCard label="Tool actions" value={metrics.toolExecutions} detail={`${metrics.toolFailures} failed in period`} icon={Wrench} tone={metrics.toolFailures ? "text-orange-700" : "text-gray-700"} />
            <MetricCard label="Ingestion failures" value={metrics.ingestionFailures} detail="Retryable jobs needing attention" icon={Activity} tone={metrics.ingestionFailures ? "text-red-700" : "text-gray-700"} />
            <MetricCard label="Security events" value={metrics.securityEvents} detail="Failed logins and tool failures" icon={ShieldCheck} tone={metrics.securityEvents ? "text-orange-700" : "text-emerald-700"} />
          </div>
        </section>
        <section aria-labelledby="capacity-heading" className="space-y-3">
          <div><h2 id="capacity-heading" className="text-base font-semibold">Capacity and service operations</h2><p className="text-sm text-gray-500">Estimated cost uses the versioned in-product price catalog; provider invoices remain authoritative.</p></div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="Estimated AI cost (cents)" value={Math.round(metrics.estimatedCostUsd * 100)} detail={`${metrics.inputTokens.toLocaleString()} input tokens`} icon={ChartNoAxesCombined} />
            <MetricCard label="Active handoffs" value={metrics.handoffs} detail="Requested or human-controlled" icon={Users} tone={metrics.handoffs ? "text-amber-700" : "text-gray-700"} />
            <MetricCard label="Queue depth" value={metrics.queueDepth} detail="Pending and processing ingestion" icon={Database} tone={metrics.queueDepth ? "text-blue-700" : "text-gray-700"} />
            <MetricCard label="Webhook failures" value={metrics.webhookFailures} detail={`${metrics.openPrivacyRequests} privacy workflows open`} icon={Activity} tone={metrics.webhookFailures ? "text-red-700" : "text-gray-700"} />
          </div>
          {metrics.providerUsage.length > 0 && <Card><CardContent className="space-y-2 p-4 sm:p-5">{metrics.providerUsage.map((item) => <div key={`${item.provider}:${item.model}`} className="flex items-center justify-between text-sm"><span>{item.provider} · {item.model}<span className="ml-2 text-xs text-gray-400">{item.replies} replies</span></span><strong>${item.estimatedCostUsd.toFixed(4)}</strong></div>)}</CardContent></Card>}
        </section>
      </>}
    </div>
  );
}
