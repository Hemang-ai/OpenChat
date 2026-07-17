"use client";
import { useEffect, useState } from "react";
import { FlaskConical, Languages, Loader2, Plug, Radio, Shapes } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, MultiSelect } from "@/components/ui/select";
import { getLanguagePickerOptions } from "@/lib/i18n/languages";
import { toast } from "@/lib/utils/use-toast";

const languageOptions = getLanguagePickerOptions();

type Data = { bot: { defaultLocale: string; supportedLocales: string[] }; channels: Array<{ id: string; channel: string; name: string; isActive: boolean }>; templates: Array<{ id: string; name: string; industry: string; description: string; locale: string; isPublic: boolean; isReviewed: boolean }>; experiments: Array<{ id: string; name: string; status: string; controlVersion: number; variantVersion: number; allocation: number }>; experimentResults: Array<{ experimentId: string; minimumSamplesReached: boolean; variants: Array<{ variant: string; conversations: number; refusalRate: number; csat: number | null }> }>; plugins: Array<{ id: string; name: string; description: string; version: string; permissions: string[] }>; versions: Array<{ version: number }> };
export default function EcosystemTab({ botId }: { botId: string }) {
  const [data, setData] = useState<Data | null>(null); const [defaultLocale, setDefaultLocale] = useState("en"); const [supportedLocales, setSupportedLocales] = useState<string[]>(["en"]); const [experimentName, setExperimentName] = useState(""); const [channelName, setChannelName] = useState("");
  const load = async () => { const response = await fetch(`/api/admin/bots/${botId}/ecosystem`); const next = await response.json(); if (!response.ok) throw new Error(next.error); setData(next); setDefaultLocale(next.bot.defaultLocale); setSupportedLocales(next.bot.supportedLocales); };
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/bots/${botId}/ecosystem`).then(async (response) => { const next = await response.json(); if (!response.ok) throw new Error(next.error); return next as Data; }).then((next) => { if (!cancelled) { setData(next); setDefaultLocale(next.bot.defaultLocale); setSupportedLocales(next.bot.supportedLocales); } }).catch((error) => toast({ title: "Ecosystem unavailable", description: error.message, variant: "destructive" }));
    return () => { cancelled = true; };
  }, [botId]);
  const action = async (body: Record<string, unknown>) => { const response = await fetch(`/api/admin/bots/${botId}/ecosystem`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const result = await response.json(); if (!response.ok) return toast({ title: "Action failed", description: result.error, variant: "destructive" }); toast({ title: "Saved" }); await load(); };
  if (!data) return <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading ecosystem</div>;
  const versions = data.versions.map((item) => item.version);
  return <div className="space-y-6">
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Languages className="h-4 w-4" /> Multilingual quality</CardTitle></CardHeader><CardContent className="space-y-3">
      <p className="text-sm text-gray-600">Visitor locale is detected by the widget, stored with the conversation, and applied to the grounded prompt. Add locale-specific evaluation cases before enabling a language in production.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Primary language</label>
          <Select options={languageOptions} value={defaultLocale} onChange={setDefaultLocale} ariaLabel="Primary language" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Supported visitor languages</label>
          <MultiSelect options={languageOptions} value={supportedLocales} onChange={setSupportedLocales} ariaLabel="Supported visitor languages" />
        </div>
      </div>
      <Button
        onClick={() => {
          const values = supportedLocales.includes(defaultLocale) ? supportedLocales : [defaultLocale, ...supportedLocales];
          action({ action: "locales", defaultLocale, supportedLocales: values });
        }}
      >
        Save locales
      </Button>
    </CardContent></Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Radio className="h-4 w-4" /> Channels</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm text-gray-600">Every adapter shares the same conversation, policy, RAG, analytics, and handoff contract. API is available now; external channel credentials remain encrypted.</p><div className="grid gap-2 sm:grid-cols-[1fr_auto]"><Input value={channelName} onChange={(event) => setChannelName(event.target.value)} placeholder="Customer API" /><Button disabled={!channelName} onClick={() => action({ action: "channel", channel: "API", name: channelName })}>Add API channel</Button></div>{data.channels.map((channel) => <div key={channel.id} className="flex justify-between rounded-md border p-3 text-sm"><span>{channel.name}</span><Badge variant={channel.isActive ? "success" : "secondary"}>{channel.channel} · {channel.isActive ? "Active" : "Needs configuration"}</Badge></div>)}</CardContent></Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Shapes className="h-4 w-4" /> Template marketplace</CardTitle></CardHeader><CardContent className="space-y-3"><Button variant="outline" onClick={() => action({ action: "save-template", name: `Template ${new Date().toLocaleDateString()}`, industry: "Custom", description: "Workspace-approved bot configuration template", isPublic: false })}>Save current draft as template</Button>{data.templates.map((template) => <div key={template.id} className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm"><strong>{template.name}</strong><Badge variant="secondary">{template.industry}</Badge><span className="min-w-0 flex-1 text-gray-500">{template.description}</span><Button size="sm" variant="outline" onClick={() => action({ action: "apply-template", templateId: template.id })}>Apply to draft</Button></div>)}</CardContent></Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><FlaskConical className="h-4 w-4" /> Version experiments</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm text-gray-600">Assignments are stable per anonymous session and use immutable published versions. One experiment can run per bot; guardrails are recorded with every experiment.</p>{versions.length >= 2 && <div className="grid gap-2 sm:grid-cols-[1fr_auto]"><Input value={experimentName} onChange={(event) => setExperimentName(event.target.value)} placeholder="Shorter support answers" /><Button disabled={!experimentName} onClick={() => action({ action: "experiment", name: experimentName, controlVersion: versions[1], variantVersion: versions[0], allocation: 50 })}>Create 50/50 test</Button></div>}{data.experiments.map((experiment) => { const result = data.experimentResults.find((item) => item.experimentId === experiment.id); return <div key={experiment.id} className="rounded-md border p-3 text-sm"><div className="flex flex-wrap items-center gap-2"><strong>{experiment.name}</strong><span className="text-gray-500">v{experiment.controlVersion} vs v{experiment.variantVersion} · {experiment.allocation}% variant</span><Badge variant={experiment.status === "RUNNING" ? "success" : "secondary"}>{experiment.status}</Badge><div className="ml-auto flex gap-2">{experiment.status !== "RUNNING" && <Button size="sm" variant="outline" onClick={() => action({ action: "experiment-status", experimentId: experiment.id, status: "RUNNING" })}>Start</Button>}{experiment.status === "RUNNING" && <Button size="sm" variant="outline" onClick={() => action({ action: "experiment-status", experimentId: experiment.id, status: "PAUSED" })}>Pause</Button>}<Button size="sm" variant="ghost" onClick={() => action({ action: "experiment-status", experimentId: experiment.id, status: "COMPLETED" })}>Complete</Button></div></div>{result && <div className="mt-3 grid grid-cols-2 gap-2">{result.variants.map((variant) => <div key={variant.variant} className="rounded bg-gray-50 p-2 text-xs"><strong className="capitalize">{variant.variant}</strong><p>{variant.conversations} sessions · {variant.refusalRate}% refusal · {variant.csat ?? "-"}% CSAT</p></div>)}<p className="col-span-2 text-xs text-gray-500">{result.minimumSamplesReached ? "Minimum sample guardrail reached." : "Directional only until each group reaches 100 sessions."}</p></div>}</div>; })}</CardContent></Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Plug className="h-4 w-4" /> Reviewed integration catalog</CardTitle></CardHeader><CardContent className="space-y-3">{data.plugins.length === 0 ? <p className="text-sm text-gray-500">No community manifests have completed security review. The open manifest specification is included in the repository.</p> : data.plugins.map((plugin) => <div key={plugin.id} className="rounded-md border p-3 text-sm"><div className="flex justify-between"><strong>{plugin.name}</strong><Badge variant="success">Reviewed v{plugin.version}</Badge></div><p className="mt-1 text-gray-500">{plugin.description}</p><p className="mt-2 text-xs">Permissions: {plugin.permissions.join(", ")}</p></div>)}</CardContent></Card>
  </div>;
}
