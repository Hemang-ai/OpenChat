"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Activity, Loader2, Globe, ShieldCheck, AlertTriangle, Wrench, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/lib/utils/use-toast";

interface ToolRow {
  id: string;
  name: string;
  description: string;
  kind: "HTTP_REQUEST" | "BUILTIN";
  method: string | null;
  endpoint: string | null;
  approvalMode: "AUTO" | "REQUIRE_CONFIRM";
  isActive: boolean;
  createdAt: string;
  _count: { executions: number };
  inputSchema: Record<string, unknown>;
  riskTier: "READ_ONLY" | "WRITE" | "EXTERNAL_COMMUNICATION" | "FINANCIAL" | "IDENTITY" | "DESTRUCTIVE";
  testStatus: "UNTESTED" | "PASSED" | "FAILED";
  testedAt: string | null;
}

interface ToolExecutionRow {
  id: string;
  toolName: string;
  input: unknown;
  output: unknown;
  errorMessage: string | null;
  status: "SUCCESS" | "ERROR" | "PENDING_APPROVAL" | "PROCESSING" | "REJECTED";
  latencyMs: number | null;
  createdAt: string;
}

const TEMPLATES = [
  {
    name: "get_weather",
    description: "Get the current weather for a given city. Use when the user asks about weather conditions.",
    method: "GET",
    endpoint: "https://wttr.in/{city}?format=j1",
    inputSchema: {
      type: "object",
      properties: { city: { type: "string", description: "City name, e.g. 'San Francisco'" } },
      required: ["city"],
    },
  },
  {
    name: "lookup_order",
    description: "Look up the current status of a customer order by order ID.",
    method: "GET",
    endpoint: "https://example.com/api/orders/{order_id}",
    inputSchema: {
      type: "object",
      properties: { order_id: { type: "string", description: "The order number, e.g. '12345'" } },
      required: ["order_id"],
    },
  },
  {
    name: "create_support_ticket",
    description: "Create a support ticket when the user has an issue you cannot resolve.",
    method: "POST",
    endpoint: "https://example.com/api/tickets",
    inputSchema: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Short summary of the issue" },
        body: { type: "string", description: "Full description from the user" },
        email: { type: "string", description: "Customer email" },
      },
      required: ["subject", "body"],
    },
  },
];

export default function ToolsTab({ botId }: { botId: string }) {
  const [tools, setTools] = useState<ToolRow[]>([]);
  const [executions, setExecutions] = useState<ToolExecutionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [testTool, setTestTool] = useState<ToolRow | null>(null);
  const [testInput, setTestInput] = useState("{}");
  const [testing, setTesting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [tRes, eRes] = await Promise.all([
        fetch(`/api/admin/bots/${botId}/tools`),
        fetch(`/api/admin/bots/${botId}/tool-executions`),
      ]);
      const tData = await tRes.json();
      const eData = await eRes.json();
      setTools(tData.tools || []);
      setExecutions(eData.executions || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/admin/bots/${botId}/tools`).then(response => response.json()),
      fetch(`/api/admin/bots/${botId}/tool-executions`).then(response => response.json()),
    ]).then(([toolData, executionData]) => {
      if (cancelled) return;
      setTools(toolData.tools || []);
      setExecutions(executionData.executions || []);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [botId]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this tool? Existing execution history will also be removed.")) return;
    const res = await fetch(`/api/admin/bots/${botId}/tools/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Tool deleted" });
      load();
    } else {
      const d = await res.json().catch(() => ({}));
      toast({ title: "Delete failed", description: d.error, variant: "destructive" });
    }
  };

  const handleToggle = async (tool: ToolRow) => {
    const res = await fetch(`/api/admin/bots/${botId}/tools/${tool.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !tool.isActive }),
    });
    if (res.ok) load();
  };

  const resolveApproval = async (executionId: string, action: "approve" | "reject") => {
    const res = await fetch(`/api/admin/bots/${botId}/tool-executions/${executionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({ title: "Action could not be completed", description: data.error, variant: "destructive" });
      return;
    }
    toast({ title: action === "approve" ? "Tool action approved" : "Tool action rejected" });
    load();
  };

  const runTest = async () => {
    if (!testTool) return;
    let input: unknown;
    try { input = JSON.parse(testInput); } catch { return toast({ title: "Test input must be valid JSON", variant: "destructive" }); }
    setTesting(true);
    const res = await fetch(`/api/admin/bots/${botId}/tools/${testTool.id}/test`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input }) });
    const data = await res.json().catch(() => ({}));
    setTesting(false);
    if (!res.ok) return toast({ title: "Tool test failed", description: data.error, variant: "destructive" });
    toast({ title: data.result.status === "success" ? "Tool test passed" : "Tool test completed with an error", description: data.result.errorMessage || `${data.result.latencyMs}ms` });
    setTestTool(null);
    load();
  };

  return (
    <div className="space-y-6">
      {/* Header / introduction */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="p-4 flex gap-3 items-start">
          <Sparkles className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <strong>Agentic actions.</strong> Tools let your bot DO things — look up an order, create a ticket,
            send an email, query your API. The bot decides when to use them based on the conversation.
            Define a tool once and any LLM provider with tool-calling support (OpenAI, Anthropic) can invoke it.
          </div>
        </CardContent>
      </Card>

      {/* Tools list */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Wrench className="w-4 h-4" /> Tools ({tools.length})
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">Active tools are exposed to the LLM during chat</p>
        </div>
        <CreateToolDialog
          botId={botId}
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={load}
        />
      </div>

      {loading ? (
        <div className="text-sm text-gray-500 flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
        </div>
      ) : tools.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 flex flex-col items-center gap-3 text-center">
            <Wrench className="w-8 h-8 text-gray-300" />
            <div className="text-sm text-gray-600">No tools yet — your bot can only answer from knowledge.</div>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add your first tool
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {tools.map((t) => (
            <Card key={t.id} className={t.isActive ? "" : "opacity-60"}>
              <CardContent className="p-4 flex items-start gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                  <Globe className="w-5 h-5 text-gray-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-sm font-mono font-semibold">{t.name}</code>
                    <Badge variant={t.isActive ? "success" : "secondary"} className="text-[10px]">
                      {t.isActive ? "Active" : "Disabled"}
                    </Badge>
                    {t.approvalMode === "REQUIRE_CONFIRM" && (
                      <Badge variant="secondary" className="text-[10px] gap-0.5">
                        <ShieldCheck className="w-3 h-3" /> Approval required
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-[10px]">
                      {t._count.executions} runs
                    </Badge>
                    <Badge variant={t.testStatus === "PASSED" ? "success" : t.testStatus === "FAILED" ? "destructive" : "secondary"} className="text-[10px]">
                      {t.testStatus === "PASSED" ? "Tested" : t.testStatus === "FAILED" ? "Test failed" : "Untested"}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">{t.riskTier.replaceAll("_", " ")}</Badge>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">{t.description}</div>
                  {t.endpoint && (
                    <div className="text-[11px] text-gray-400 mt-1 font-mono truncate">
                      {t.method} {t.endpoint}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => { setTestTool(t); setTestInput("{}"); }}>Test</Button>
                  <Button size="sm" variant="ghost" onClick={() => handleToggle(t)}>
                    {t.isActive ? "Disable" : "Enable"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(t.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Execution log */}
      <div className="pt-2 border-t">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4" /> Recent invocations
        </h2>
        {executions.length === 0 ? (
          <p className="text-sm text-gray-500">No tool invocations yet. They will appear here when your bot calls a tool.</p>
        ) : (
          <div className="space-y-2">
            {executions.map((ex) => (
              <Card key={ex.id} className="border-gray-200">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <code className="text-xs font-mono font-semibold">{ex.toolName}</code>
                    <Badge
                      variant={ex.status === "SUCCESS" ? "success" : ex.status === "ERROR" ? "destructive" : "secondary"}
                      className="text-[10px]"
                    >
                      {ex.status === "ERROR" && <AlertTriangle className="w-3 h-3 mr-0.5" />}
                      {ex.status}
                    </Badge>
                    {ex.latencyMs != null && (
                      <span className="text-[10px] text-gray-400">{ex.latencyMs}ms</span>
                    )}
                    <span className="text-[10px] text-gray-400 ml-auto">
                      {new Date(ex.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {ex.status === "PENDING_APPROVAL" && (
                    <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                      <span className="flex-1">Review the input before this external action runs.</span>
                      <Button size="sm" variant="outline" onClick={() => resolveApproval(ex.id, "reject")}>Reject</Button>
                      <Button size="sm" onClick={() => resolveApproval(ex.id, "approve")}>Approve and run</Button>
                    </div>
                  )}
                  <details className="text-xs">
                    <summary className="cursor-pointer text-gray-500 hover:text-gray-700">View input / output</summary>
                    <div className="grid md:grid-cols-2 gap-2 mt-2">
                      <pre className="bg-gray-50 p-2 rounded text-[10px] overflow-x-auto max-h-40 overflow-y-auto">{JSON.stringify(ex.input, null, 2)}</pre>
                      <pre className="bg-gray-50 p-2 rounded text-[10px] overflow-x-auto max-h-40 overflow-y-auto">{JSON.stringify(ex.output, null, 2)}</pre>
                    </div>
                  </details>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={Boolean(testTool)} onOpenChange={(open) => !open && setTestTool(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Test {testTool?.name}</DialogTitle><DialogDescription>Run a redacted test through the production validation, network, timeout, and response mapping path. Test executions are labeled and do not enter a visitor conversation.</DialogDescription></DialogHeader>
          <div className="space-y-3"><Label htmlFor="tool-test-input">JSON input</Label><Textarea id="tool-test-input" value={testInput} onChange={(event) => setTestInput(event.target.value)} className="min-h-40 font-mono text-xs" /><pre className="max-h-32 overflow-auto rounded bg-gray-50 p-2 text-[10px]">Schema: {JSON.stringify(testTool?.inputSchema || {}, null, 2)}</pre><Button onClick={runTest} disabled={testing}>{testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Run safe test</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreateToolDialog({
  botId,
  open,
  onOpenChange,
  onCreated,
}: {
  botId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [method, setMethod] = useState("POST");
  const [endpoint, setEndpoint] = useState("");
  const [schemaText, setSchemaText] = useState('{\n  "type": "object",\n  "properties": {},\n  "required": []\n}');
  const [headersText, setHeadersText] = useState("");
  const [approvalMode, setApprovalMode] = useState<"AUTO" | "REQUIRE_CONFIRM">("AUTO");
  const [riskTier, setRiskTier] = useState<ToolRow["riskTier"]>("READ_ONLY");
  const [saving, setSaving] = useState(false);

  const applyTemplate = (idx: number) => {
    const t = TEMPLATES[idx];
    setName(t.name);
    setDescription(t.description);
    setMethod(t.method);
    setEndpoint(t.endpoint);
    setSchemaText(JSON.stringify(t.inputSchema, null, 2));
  };

  const submit = async () => {
    setSaving(true);
    try {
      let inputSchema: unknown;
      try {
        inputSchema = JSON.parse(schemaText);
      } catch {
        toast({ title: "Invalid JSON in input schema", variant: "destructive" });
        return;
      }
      let headers: Record<string, string> | undefined;
      if (headersText.trim()) {
        try {
          headers = JSON.parse(headersText);
        } catch {
          toast({ title: "Invalid JSON in headers", variant: "destructive" });
          return;
        }
      }
      const res = await fetch(`/api/admin/bots/${botId}/tools`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          method,
          endpoint: endpoint || null,
          inputSchema,
          headers,
          approvalMode,
          riskTier,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: "✓ Tool created" });
      onCreated();
      onOpenChange(false);
      setName(""); setDescription(""); setEndpoint(""); setHeadersText("");
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="w-3.5 h-3.5 mr-1" /> Add tool
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create a tool</DialogTitle>
          <DialogDescription>
            Define an action your bot can take. The bot will decide when to use it based on the conversation.
          </DialogDescription>
        </DialogHeader>

        {/* Templates */}
        <div>
          <Label className="text-xs">Quick templates</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {TEMPLATES.map((t, i) => (
              <button
                key={t.name}
                type="button"
                onClick={() => applyTemplate(i)}
                className="text-xs px-2 py-1 rounded-md border border-gray-200 hover:border-gray-400 transition-colors"
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label>Name (the LLM sees this)</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="lookup_order"
            />
            <p className="text-xs text-gray-400 mt-0.5">snake_case, e.g. <code>lookup_order</code>, <code>send_email</code></p>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="When the user asks about an order status, look up the order by ID and return its status, items, and ETA."
              rows={2}
            />
            <p className="text-xs text-gray-400 mt-0.5">Tell the LLM clearly when to use this tool.</p>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-1">
              <Label>Method</Label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm"
              >
                {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="col-span-3">
              <Label>Endpoint URL</Label>
              <Input
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="https://api.example.com/orders/{order_id}"
              />
              <p className="text-xs text-gray-400 mt-0.5">Use <code>{`{placeholders}`}</code> to substitute input values.</p>
            </div>
          </div>
          <div>
            <Label>Input schema (JSON Schema)</Label>
            <Textarea
              value={schemaText}
              onChange={(e) => setSchemaText(e.target.value)}
              rows={6}
              className="font-mono text-xs"
            />
            <p className="text-xs text-gray-400 mt-0.5">
              OpenAI-compatible JSON Schema. The bot uses property descriptions to know what to pass.
            </p>
          </div>
          <div>
            <Label>Static headers (optional, JSON)</Label>
            <Textarea
              value={headersText}
              onChange={(e) => setHeadersText(e.target.value)}
              rows={2}
              placeholder='{"Authorization": "Bearer xxx", "X-Tenant": "acme"}'
              className="font-mono text-xs"
            />
          </div>
          <div>
            <Label>Action risk</Label>
            <select value={riskTier} onChange={(event) => { const next = event.target.value as ToolRow["riskTier"]; setRiskTier(next); if (next !== "READ_ONLY") setApprovalMode("REQUIRE_CONFIRM"); }} className="mt-1 flex min-h-11 w-full rounded-md border bg-white px-3 text-sm">
              <option value="READ_ONLY">Read only</option><option value="WRITE">Writes business data</option><option value="EXTERNAL_COMMUNICATION">External communication</option><option value="FINANCIAL">Financial action</option><option value="IDENTITY">Identity or access</option><option value="DESTRUCTIVE">Destructive action</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">Anything beyond read-only requires visitor confirmation by default.</p>
          </div>
          <div>
            <Label>Approval mode</Label>
            <div className="flex gap-2 mt-1">
              {[
                { v: "AUTO", label: "Auto", desc: "Runs immediately" },
                { v: "REQUIRE_CONFIRM", label: "Require confirmation", desc: "Asks the user first" },
              ].map((o) => (
                <label
                  key={o.v}
                  className={`flex-1 border rounded-md px-3 py-2 cursor-pointer text-xs ${
                    approvalMode === o.v ? "border-gray-900 bg-gray-50" : "border-gray-200"
                  }`}
                >
                  <input
                    type="radio"
                    className="mr-1.5"
                    checked={approvalMode === o.v}
                    disabled={riskTier !== "READ_ONLY" && o.v === "AUTO"}
                    onChange={() => setApprovalMode(o.v as "AUTO" | "REQUIRE_CONFIRM")}
                  />
                  <span className="font-medium">{o.label}</span>
                  <div className="text-[10px] text-gray-500 ml-4">{o.desc}</div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !name || !description}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Create tool"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
