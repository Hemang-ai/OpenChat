"use client";

import { useEffect, useState } from "react";
import { BellRing, Clock3, Loader2, Plus, Webhook } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/utils/use-toast";

type OperationsData = {
  bot: { handoffPolicy: Record<string, unknown> | null; businessHours: Record<string, unknown> | null; fallbackContactMethod: string | null; defaultSlaMinutes: number };
  webhooks: Array<{ id: string; name: string; url: string; events: string[]; isActive: boolean }>;
  deliveries: Array<{ id: string; event: string; status: string; attempts: number; responseCode: number | null; errorMessage: string | null; createdAt: string; endpoint: { name: string } }>;
};

const defaults = {
  explicitRequest: true, lowEvidence: true, repeatedRefusal: true, toolFailure: true,
  negativeSentiment: true, refusalThreshold: 2,
};

export default function OperationsTab({ botId }: { botId: string }) {
  const [data, setData] = useState<OperationsData | null>(null);
  const [saving, setSaving] = useState(false);
  const [policy, setPolicy] = useState(defaults);
  const [timezone, setTimezone] = useState("UTC");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");
  const [sla, setSla] = useState(240);
  const [contact, setContact] = useState("");
  const [webhookName, setWebhookName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");

  const load = async () => {
    const response = await fetch(`/api/admin/bots/${botId}/operations`);
    const next = await response.json();
    if (!response.ok) throw new Error(next.error || "Operations settings could not be loaded");
    setData(next);
    setPolicy({ ...defaults, ...(next.bot.handoffPolicy || {}) });
    const hours = next.bot.businessHours || {};
    setTimezone(String(hours.timezone || "UTC"));
    setStart(String(hours.start || "09:00"));
    setEnd(String(hours.end || "17:00"));
    setSla(next.bot.defaultSlaMinutes || 240);
    setContact(next.bot.fallbackContactMethod || "");
  };

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/bots/${botId}/operations`).then(async (response) => { const next = await response.json(); if (!response.ok) throw new Error(next.error); return next as OperationsData; }).then((next) => {
      if (cancelled) return;
      setData(next); setPolicy({ ...defaults, ...(next.bot.handoffPolicy || {}) });
      const hours = next.bot.businessHours || {}; setTimezone(String(hours.timezone || "UTC")); setStart(String(hours.start || "09:00")); setEnd(String(hours.end || "17:00")); setSla(next.bot.defaultSlaMinutes || 240); setContact(next.bot.fallbackContactMethod || "");
    }).catch((error) => toast({ title: "Could not load operations", description: error.message, variant: "destructive" }));
    return () => { cancelled = true; };
  }, [botId]);

  const save = async () => {
    setSaving(true);
    const response = await fetch(`/api/admin/bots/${botId}/operations`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handoffPolicy: policy, businessHours: { timezone, weekdays: [1, 2, 3, 4, 5], start, end }, fallbackContactMethod: contact || null, defaultSlaMinutes: sla }),
    });
    const result = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) return toast({ title: "Settings not saved", description: result.error, variant: "destructive" });
    toast({ title: "Service policy saved" });
  };

  const addWebhook = async () => {
    const response = await fetch(`/api/admin/bots/${botId}/operations`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: webhookName, url: webhookUrl, events: ["conversation.handoff_requested", "conversation.resolved", "lead.created", "tool.failed"] }),
    });
    const result = await response.json();
    if (!response.ok) return toast({ title: "Webhook not created", description: result.error, variant: "destructive" });
    toast({ title: "Webhook created", description: `Signing secret (shown once): ${result.signingSecret}` });
    setWebhookName(""); setWebhookUrl(""); await load();
  };
  const webhookAction = async (body: Record<string, unknown>) => { const response = await fetch(`/api/admin/bots/${botId}/operations`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const result = await response.json(); if (!response.ok) return toast({ title: "Webhook action failed", description: result.error, variant: "destructive" }); toast({ title: "Webhook updated", description: result.signingSecret ? `New signing secret (shown once): ${result.signingSecret}` : undefined }); await load(); };

  if (!data) return <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading service operations</div>;

  return <div className="space-y-6">
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BellRing className="h-4 w-4" /> Handoff policy</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-gray-600">Escalations remain in Conversation logs with the transcript, summary, contact details, attempted actions, owner, priority, and SLA.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["explicitRequest", "lowEvidence", "repeatedRefusal", "toolFailure", "negativeSentiment"] as const).map((key) => <label key={key} className="flex min-h-11 items-center gap-3 rounded-md border p-3 text-sm">
            <input type="checkbox" checked={policy[key]} onChange={(event) => setPolicy((current) => ({ ...current, [key]: event.target.checked }))} />
            {key.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase())}
          </label>)}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div><Label htmlFor="timezone">Timezone</Label><Input id="timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)} /></div>
          <div><Label htmlFor="hours">Business hours</Label><div className="flex gap-2"><Input id="hours" type="time" value={start} onChange={(event) => setStart(event.target.value)} /><Input aria-label="Business hours end" type="time" value={end} onChange={(event) => setEnd(event.target.value)} /></div></div>
          <div><Label htmlFor="sla">Response SLA (minutes)</Label><Input id="sla" type="number" min={5} value={sla} onChange={(event) => setSla(Number(event.target.value))} /></div>
          <div><Label htmlFor="contact">Fallback contact</Label><Input id="contact" value={contact} onChange={(event) => setContact(event.target.value)} placeholder="support@example.com" /></div>
        </div>
        <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save policy</Button>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Webhook className="h-4 w-4" /> Helpdesk and CRM webhooks</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">Events are HMAC-signed, idempotent, retried with backoff, and visible below. Connect any helpdesk or CRM that accepts webhooks.</p>
        <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]"><Input value={webhookName} onChange={(event) => setWebhookName(event.target.value)} placeholder="Support desk" /><Input value={webhookUrl} onChange={(event) => setWebhookUrl(event.target.value)} placeholder="https://helpdesk.example.com/webhooks" /><Button onClick={addWebhook} disabled={!webhookName || !webhookUrl}><Plus className="mr-1 h-4 w-4" /> Add</Button></div>
        {data.webhooks.map((webhook) => <div key={webhook.id} className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm"><strong>{webhook.name}</strong><span className="min-w-0 flex-1 truncate text-gray-500">{webhook.url}</span><Badge variant={webhook.isActive ? "success" : "secondary"}>{webhook.isActive ? "Active" : "Disabled"}</Badge><Button size="sm" variant="ghost" onClick={() => webhookAction({ action: "rotate", endpointId: webhook.id })}>Rotate secret</Button><Button size="sm" variant="ghost" onClick={() => webhookAction({ action: "toggle", endpointId: webhook.id, isActive: !webhook.isActive })}>{webhook.isActive ? "Disable" : "Enable"}</Button></div>)}
        <div className="space-y-2 border-t pt-4"><h3 className="text-sm font-medium">Recent deliveries</h3>{data.deliveries.length === 0 ? <p className="text-sm text-gray-500">No events delivered yet.</p> : data.deliveries.map((delivery) => <div key={delivery.id} className="grid gap-1 rounded-md bg-gray-50 p-3 text-xs sm:grid-cols-[1fr_auto_auto_auto]"><span>{delivery.endpoint.name}: {delivery.event}</span><Badge variant={delivery.status === "DELIVERED" ? "success" : delivery.status === "FAILED" ? "destructive" : "secondary"}>{delivery.status}</Badge><span className="flex items-center gap-1 text-gray-500"><Clock3 className="h-3 w-3" /> {delivery.attempts} attempt(s)</span>{delivery.status === "FAILED" && <Button size="sm" variant="outline" onClick={() => webhookAction({ action: "replay", deliveryId: delivery.id })}>Replay</Button>}{delivery.errorMessage && <p className="text-red-600 sm:col-span-4">{delivery.errorMessage}</p>}</div>)}</div>
      </CardContent>
    </Card>
  </div>;
}
