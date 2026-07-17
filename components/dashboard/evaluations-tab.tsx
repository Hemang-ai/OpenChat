"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, FlaskConical, LoaderCircle, Plus, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "@/lib/utils/use-toast";

type Case = { id: string; question: string; expectedAnswer: string | null; allowRefusal: boolean; riskLevel: string; locale: string; requiredSourceIds: string[] };
type Result = { caseId: string; question: string; passed: boolean; reason: string; answer: string; evidenceScore: number };
type Run = { id: string; status: "PASSED" | "FAILED"; total: number; passed: number; failed: number; draftRevision: number; results: Result[]; createdAt: string };

export default function EvaluationsTab({ botId }: { botId: string }) {
  const [cases, setCases] = useState<Case[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [sources, setSources] = useState<Array<{ id: string; name: string }>>([]);
  const [requiredSourceIds, setRequiredSourceIds] = useState<string[]>([]);
  const [question, setQuestion] = useState("");
  const [expectedAnswer, setExpectedAnswer] = useState("");
  const [allowRefusal, setAllowRefusal] = useState(false);
  const [riskLevel, setRiskLevel] = useState("MEDIUM");
  const [locale, setLocale] = useState("en");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/bots/${botId}/evaluations`);
    const body = await response.json();
    if (response.ok) { setCases(body.cases || []); setRuns(body.runs || []); setSources(body.sources || []); }
  }, [botId]);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/bots/${botId}/evaluations`)
      .then((response) => response.json())
      .then((body) => { if (!cancelled) { setCases(body.cases || []); setRuns(body.runs || []); setSources(body.sources || []); } })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [botId]);

  const mutate = async (payload: Record<string, unknown>, key: string) => {
    setBusy(key);
    try {
      const response = await fetch(`/api/admin/bots/${botId}/evaluations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Evaluation action failed");
      if (payload.action === "create") { setQuestion(""); setExpectedAnswer(""); setRequiredSourceIds([]); }
      toast({ title: payload.action === "run" ? `Evaluation ${body.run.status.toLowerCase()}` : "Evaluation suite updated" });
      await load();
    } catch (error) {
      toast({ title: "Evaluation action failed", description: error instanceof Error ? error.message : "Try again", variant: "destructive" });
    } finally { setBusy(null); }
  };

  const latest = runs[0];
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-base font-semibold">Launch evaluation suite</h2><p className="text-sm text-gray-500">Test the draft against expected grounded answers and safe refusals. Tools never execute during evaluation.</p></div><Button onClick={() => mutate({ action: "run" }, "run")} disabled={cases.length < 3 || busy !== null}>{busy === "run" ? <LoaderCircle className="animate-spin" /> : <FlaskConical />} Run {cases.length} tests</Button></div>

      {latest && <Card className={latest.status === "PASSED" ? "border-emerald-200" : "border-red-200"}><CardHeader><div className="flex items-center justify-between"><div><CardTitle className="flex items-center gap-2 text-base">{latest.status === "PASSED" ? <CheckCircle2 className="text-emerald-600" /> : <XCircle className="text-red-600" />} Latest run: {latest.passed}/{latest.total} passed</CardTitle><CardDescription>Draft revision {latest.draftRevision} · {new Date(latest.createdAt).toLocaleString()}</CardDescription></div><Badge variant={latest.status === "PASSED" ? "success" : "destructive"}>{latest.status}</Badge></div></CardHeader><CardContent className="space-y-2">{Array.isArray(latest.results) && latest.results.map((result) => <details key={result.caseId} className="rounded-md border p-3"><summary className="cursor-pointer text-sm font-medium"><span className={result.passed ? "text-emerald-600" : "text-red-600"}>{result.passed ? "Pass" : "Fail"}</span> · {result.question}</summary><div className="mt-3 space-y-2 text-xs text-gray-600"><p>{result.reason}</p><p className="rounded bg-gray-50 p-2 whitespace-pre-wrap">{result.answer}</p><p>Evidence score: {Math.round(result.evidenceScore * 100)}%</p></div></details>)}</CardContent></Card>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-2"><h3 className="text-sm font-semibold">Test questions ({cases.length})</h3>{cases.length === 0 ? <div className="rounded-md border border-dashed p-8 text-center text-sm text-gray-500">Add at least three questions that represent real customer risks.</div> : <div className="divide-y rounded-md border bg-white">{cases.map((testCase) => <div key={testCase.id} className="flex items-start gap-3 p-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium">{testCase.question}</p><Badge variant="outline">{testCase.riskLevel.toLowerCase()}</Badge><Badge variant="secondary">{testCase.locale}</Badge>{testCase.allowRefusal && <Badge variant="secondary">Expected refusal</Badge>}</div>{testCase.expectedAnswer && <p className="mt-1 line-clamp-2 text-xs text-gray-500">Expected: {testCase.expectedAnswer}</p>}</div><Button variant="ghost" size="icon" aria-label="Delete evaluation question" disabled={busy !== null} onClick={() => mutate({ action: "delete", caseId: testCase.id }, testCase.id)}>{busy === testCase.id ? <LoaderCircle className="animate-spin" /> : <Trash2 className="text-gray-400" />}</Button></div>)}</div>}</section>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add test question</CardTitle>
            <CardDescription>Use customer wording and provide the key facts a correct answer should contain.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1"><Label>Question</Label><Input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="What is your return policy?" /></div>
            <div className="space-y-1"><Label>Expected answer facts</Label><Textarea value={expectedAnswer} onChange={(event) => setExpectedAnswer(event.target.value)} rows={4} placeholder="Returns are accepted within 30 days..." /></div>
            <div className="space-y-1"><Label>Risk</Label><select className="min-h-11 w-full rounded-md border bg-transparent px-3 text-sm" value={riskLevel} onChange={(event) => setRiskLevel(event.target.value)}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option></select></div>
            <div className="space-y-1"><Label>Locale</Label><Input value={locale} onChange={(event) => setLocale(event.target.value)} placeholder="en-US" /></div>
            {sources.length > 0 && (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Required sources</legend>
                <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border p-2">
                  {sources.map((source) => (
                    <label key={source.id} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={requiredSourceIds.includes(source.id)}
                        onChange={(event) => setRequiredSourceIds((current) => event.target.checked ? [...current, source.id] : current.filter((id) => id !== source.id))}
                      />
                      {source.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={allowRefusal} onChange={(event) => setAllowRefusal(event.target.checked)} className="mt-1" /><span>This question should be refused because the knowledge base does not support an answer.</span></label>
            <Button className="w-full" disabled={question.trim().length < 5 || busy !== null} onClick={() => mutate({ action: "create", question, expectedAnswer: expectedAnswer || undefined, allowRefusal, requiredSourceIds, riskLevel, locale }, "create")}>{busy === "create" ? <LoaderCircle className="animate-spin" /> : <Plus />} Add question</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
