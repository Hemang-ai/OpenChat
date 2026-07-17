"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Circle, History, LoaderCircle, Rocket, RotateCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "@/lib/utils/use-toast";

type Check = { id: string; label: string; detail: string; passed: boolean; required: boolean; tab: string };
type Version = { id: string; version: number; evaluationSummary: unknown; rollbackFromVersion: number | null; createdAt: string };
type LaunchData = { readiness: { checks: Check[]; score: number; readyToPublish: boolean; bot: { draftRevision: number; publishedVersion: number; publishedAt: string | null; hasDraft: boolean } }; versions: Version[] };

export default function LaunchTab({ botId }: { botId: string }) {
  const [data, setData] = useState<LaunchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/bots/${botId}/launch`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load launch readiness");
      setData(body);
    } catch (error) {
      toast({ title: "Launch readiness unavailable", description: error instanceof Error ? error.message : "Try again", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [botId]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/bots/${botId}/launch`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not load launch readiness");
        return body as LaunchData;
      })
      .then((body) => { if (!cancelled) setData(body); })
      .catch((error) => { if (!cancelled) toast({ title: "Launch readiness unavailable", description: error instanceof Error ? error.message : "Try again", variant: "destructive" }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [botId]);

  const runAction = async (payload: { action: "publish" } | { action: "rollback"; version: number }) => {
    const key = payload.action === "publish" ? "publish" : `rollback-${payload.version}`;
    setAction(key);
    try {
      const response = await fetch(`/api/admin/bots/${botId}/launch`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Launch action failed");
      toast({ title: payload.action === "publish" ? `Version ${body.version} published` : `Restored as version ${body.version}` });
      await load();
    } catch (error) {
      toast({ title: "Could not complete launch action", description: error instanceof Error ? error.message : "Try again", variant: "destructive" });
    } finally {
      setAction(null);
    }
  };

  if (loading || !data) return <div className="h-40 animate-pulse rounded-md bg-gray-100" />;
  const { readiness, versions } = data;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base"><Rocket className="h-4 w-4" /> Launch readiness</CardTitle>
              <CardDescription>Required checks protect the live bot. Recommended checks improve customer experience.</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right"><p className="text-2xl font-semibold tabular-nums">{readiness.score}%</p><p className="text-xs text-gray-500">ready</p></div>
              <Button disabled={!readiness.readyToPublish || action !== null} onClick={() => runAction({ action: "publish" })}>
                {action === "publish" ? <LoaderCircle className="animate-spin" /> : <Rocket />}
                {readiness.bot.publishedVersion ? "Publish new version" : "Publish bot"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-2">
          {readiness.checks.map((check) => (
            <div key={check.id} className={`flex gap-3 rounded-md border p-3 ${check.passed ? "border-emerald-200 bg-emerald-50/40" : check.required ? "border-orange-200 bg-orange-50/40" : "border-gray-200"}`}>
              {check.passed ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />}
              <div className="min-w-0"><div className="flex items-center gap-2"><p className="text-sm font-medium">{check.label}</p><Badge variant={check.required ? "secondary" : "outline"} className="text-[10px]">{check.required ? "Required" : "Recommended"}</Badge></div><p className="mt-0.5 text-xs leading-relaxed text-gray-500">{check.detail}</p></div>
            </div>
          ))}
        </CardContent>
      </Card>

      <section className="space-y-3" aria-labelledby="versions-heading">
        <div><h2 id="versions-heading" className="flex items-center gap-2 text-base font-semibold"><History className="h-4 w-4" /> Published versions</h2><p className="text-sm text-gray-500">Every publish is immutable. Rollback creates a new version from a known-good snapshot.</p></div>
        {versions.length === 0 ? <div className="rounded-md border border-dashed p-8 text-center text-sm text-gray-500">No published version yet.</div> : (
          <div className="divide-y rounded-md border bg-white">
            {versions.map((version) => (
              <div key={version.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-md bg-gray-100 font-mono text-sm">v{version.version}</div><div><div className="flex items-center gap-2"><p className="text-sm font-medium">Version {version.version}</p>{version.version === readiness.bot.publishedVersion && <Badge variant="success">Live</Badge>}{version.rollbackFromVersion && <Badge variant="secondary">From v{version.rollbackFromVersion}</Badge>}</div><p className="text-xs text-gray-500">{new Date(version.createdAt).toLocaleString()}</p></div></div>
                {version.version !== readiness.bot.publishedVersion && <Button variant="outline" size="sm" disabled={action !== null} onClick={() => runAction({ action: "rollback", version: version.version })}>{action === `rollback-${version.version}` ? <LoaderCircle className="animate-spin" /> : <RotateCcw />} Restore</Button>}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><p>Dashboard preview and evaluations use the current draft. Website visitors continue using the last published version until every required check passes and you publish.</p></div>
    </div>
  );
}
