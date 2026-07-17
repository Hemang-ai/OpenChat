"use client";
import { useEffect, useState } from "react";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/lib/utils/use-toast";

type Environment = { id: string; environment: "DEVELOPMENT" | "STAGING" | "PRODUCTION"; publicKey: string; activeVersion: number | null; pendingVersion: number | null; approvalStatus: string };
type Version = { version: number; createdAt: string; rollbackFromVersion: number | null };

export default function EnvironmentsTab({ botId }: { botId: string }) {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const load = async () => { const response = await fetch(`/api/admin/bots/${botId}/environments`); const data = await response.json(); if (!response.ok) throw new Error(data.error); setEnvironments(data.environments); setVersions(data.versions); setLoading(false); };
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/bots/${botId}/environments`).then(async (response) => { const next = await response.json(); if (!response.ok) throw new Error(next.error); return next; }).then((next) => { if (!cancelled) { setEnvironments(next.environments); setVersions(next.versions); setLoading(false); } }).catch((error) => toast({ title: "Environments unavailable", description: error.message, variant: "destructive" }));
    return () => { cancelled = true; };
  }, [botId]);
  const request = async (environment: Environment["environment"], version: number) => { const response = await fetch(`/api/admin/bots/${botId}/environments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ environment, version }) }); const data = await response.json(); if (!response.ok) return toast({ title: "Promotion failed", description: data.error, variant: "destructive" }); toast({ title: `Version ${version} submitted for ${environment.toLowerCase()}` }); await load(); };
  const decide = async (environmentId: string, decision: "approve" | "reject") => { const response = await fetch(`/api/admin/bots/${botId}/environments`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ environmentId, decision }) }); const data = await response.json(); if (!response.ok) return toast({ title: "Decision failed", description: data.error, variant: "destructive" }); await load(); };
  if (loading) return <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading environments</div>;
  const latest = versions[0]?.version;
  return <div className="space-y-6"><Card><CardHeader><CardTitle className="text-base">Controlled promotion</CardTitle></CardHeader><CardContent><p className="text-sm text-gray-600">Development, staging, and production have separate public keys and active versions. Promotion requests and decisions are recorded in the audit log.</p></CardContent></Card><div className="grid gap-4 md:grid-cols-3">{(["DEVELOPMENT", "STAGING", "PRODUCTION"] as const).map((kind) => { const environment = environments.find((item) => item.environment === kind); return <Card key={kind}><CardHeader><CardTitle className="flex items-center justify-between text-sm"><span>{kind}</span><Badge variant={environment?.approvalStatus === "PENDING" ? "warning" : environment?.activeVersion ? "success" : "secondary"}>{environment?.approvalStatus === "PENDING" ? "Approval pending" : environment?.activeVersion ? `v${environment.activeVersion}` : "Not promoted"}</Badge></CardTitle></CardHeader><CardContent className="space-y-3"><code className="block truncate rounded bg-gray-50 p-2 text-[10px]">{environment?.publicKey || "Created on first promotion"}</code>{latest && <Button size="sm" variant="outline" className="w-full" onClick={() => request(kind, latest)}><ArrowUpRight className="mr-1 h-4 w-4" /> Promote v{latest}</Button>}{environment?.approvalStatus === "PENDING" && <div className="flex gap-2"><Button size="sm" className="flex-1" onClick={() => decide(environment.id, "approve")}>Approve</Button><Button size="sm" variant="outline" className="flex-1" onClick={() => decide(environment.id, "reject")}>Reject</Button></div>}</CardContent></Card>; })}</div></div>;
}
