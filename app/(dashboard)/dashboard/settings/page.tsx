"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { toast } from "@/lib/utils/use-toast";
import { Key, Sparkles, Building2, Check, AlertCircle, CheckCircle2, Shield, Zap } from "lucide-react";
import { PROVIDER_MODELS } from "@/lib/ai/models";

type Workspace = {
  id: string;
  name: string;
  description: string | null;
  llmProvider: string;
  fallbackLlmProvider: string;
  openaiApiKeyMasked: string | null;
  openaiApiKeySet: boolean;
  openaiModel: string | null;
  openaiEmbeddingModel: string | null;
  anthropicApiKeyMasked: string | null;
  anthropicApiKeySet: boolean;
  anthropicModel: string | null;
  groqApiKeyMasked: string | null;
  groqApiKeySet: boolean;
  groqModel: string | null;
  ollamaBaseUrl: string | null;
  ollamaModel: string | null;
  geminiApiKeyMasked: string | null;
  geminiApiKeySet: boolean;
  geminiModel: string | null;
};

type ProviderId = "openai" | "anthropic" | "groq" | "gemini" | "ollama";

const PROVIDERS: { id: ProviderId; label: string; desc: string; icon: string; helpUrl?: string }[] = [
  { id: "openai", label: "OpenAI", desc: "GPT-4o, GPT-4o-mini", icon: "🤖", helpUrl: "https://platform.openai.com/api-keys" },
  { id: "anthropic", label: "Anthropic", desc: "Claude Sonnet/Haiku", icon: "🟣", helpUrl: "https://console.anthropic.com/settings/keys" },
  { id: "gemini", label: "Google Gemini", desc: "Gemini Flash/Pro (free tier)", icon: "✨", helpUrl: "https://aistudio.google.com/apikey" },
  { id: "groq", label: "Groq", desc: "Llama, fast & free", icon: "⚡", helpUrl: "https://console.groq.com/keys" },
  { id: "ollama", label: "Ollama", desc: "Local / self-hosted", icon: "🦙", helpUrl: "https://ollama.com" },
];

export default function SettingsPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [active, setActive] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/workspaces");
        const data = await res.json();
        const list = data.workspaces || [];
        if (list.length > 0) {
          const detailRes = await fetch(`/api/admin/workspaces/${list[0].id}`);
          const detailData = await detailRes.json();
          setActive(detailData.workspace);
          setForm({
            llmProvider: detailData.workspace.llmProvider || "openai",
            fallbackLlmProvider: detailData.workspace.fallbackLlmProvider || "none",
          });
        }
        setWorkspaces(list);
      } catch (e) {
        toast({ title: "Failed to load settings", description: e instanceof Error ? e.message : "", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const reload = async (id: string) => {
    const detailRes = await fetch(`/api/admin/workspaces/${id}`);
    const detailData = await detailRes.json();
    setActive(detailData.workspace);
  };

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    if (!active) return;
    setSaving(true);
    try {
      // Strip UI-only state before sending to API
      const { __editing, ...payload } = form;
      void __editing;
      const res = await fetch(`/api/admin/workspaces/${active.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      toast({ title: "✓ Settings saved", description: "Your AI configuration was updated." });
      // Keep provider sticky, clear sensitive inputs
      setForm({
        llmProvider: form.llmProvider,
        fallbackLlmProvider: form.fallbackLlmProvider || "none",
        __editing: form.__editing || form.llmProvider,
      });
      await reload(active.id);
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-gray-500">Loading settings…</div>;
  if (!active) return <div className="text-gray-600">No workspace found.</div>;

  const provider = (form.llmProvider || "openai") as ProviderId;
  const fallback = (form.fallbackLlmProvider || "none") as ProviderId | "none";
  const editing = (form.__editing || provider) as ProviderId;
  const isProviderConfigured = (p: ProviderId) =>
    p === "ollama" ? !!active.ollamaBaseUrl : (active as unknown as Record<string, boolean>)[`${p}ApiKeySet`];

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Configuration</h1>
        <p className="text-sm text-gray-500 mt-1">
          Each business workspace brings its own AI provider and keys. Pick a provider, paste a key, save — that's it.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            {active.name}
          </CardTitle>
          <CardDescription>Workspace AI provider and credentials</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Primary / Fallback explainer */}
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm space-y-1.5">
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <div className="text-blue-900">
                <strong>How primary &amp; fallback work:</strong> Your <em>primary</em> provider answers every
                question. If it fails (rate limit, outage, expired key), the <em>fallback</em> takes over
                automatically — your customers never see an error. We recommend setting both for production.
              </div>
            </div>
          </div>

          {/* Provider cards — click anywhere to configure that provider's keys.
              GREEN border = Primary. ORANGE border = Fallback. */}
          <div>
            <Label className="mb-2 block">Available providers</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {PROVIDERS.map((p) => {
                const configured = isProviderConfigured(p.id);
                const isPrimary = provider === p.id;
                const isFallback = fallback === p.id;
                const isEditing = editing === p.id;

                const borderClass = isPrimary
                  ? "border-2 border-green-500 ring-2 ring-green-100 bg-green-50/50"
                  : isFallback
                    ? "border-2 border-orange-500 ring-2 ring-orange-100 bg-orange-50/50"
                    : isEditing
                      ? "border-2 border-blue-400 ring-2 ring-blue-100"
                      : "border border-gray-200 hover:border-gray-400";

                return (
                  <div
                    key={p.id}
                    onClick={() => set("__editing", p.id)}
                    className={`relative rounded-lg p-3 transition cursor-pointer ${borderClass}`}
                  >
                    {/* Role badge top-right */}
                    {isPrimary && (
                      <span className="absolute -top-2 right-2 bg-green-600 text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
                        PRIMARY
                      </span>
                    )}
                    {isFallback && (
                      <span className="absolute -top-2 right-2 bg-orange-500 text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
                        FALLBACK
                      </span>
                    )}

                    <div className="flex items-center gap-2">
                      <span className="text-lg">{p.icon}</span>
                      <span className="font-medium text-sm flex-1">{p.label}</span>
                      {configured && (
                        <CheckCircle2 className="w-4 h-4 text-green-600" aria-label="Configured" />
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 mb-2">{p.desc}</div>

                    <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => {
                          set("llmProvider", p.id);
                          set("__editing", p.id);
                          // If this provider was fallback, clear fallback (can't be both)
                          if (isFallback) set("fallbackLlmProvider", "none");
                        }}
                        disabled={isPrimary}
                        className={`flex-1 text-xs px-2 py-1 rounded transition ${
                          isPrimary
                            ? "bg-green-600 text-white cursor-default"
                            : "bg-gray-100 hover:bg-green-100 hover:text-green-700 text-gray-700"
                        }`}
                      >
                        {isPrimary ? <><Check className="inline w-3 h-3 mr-0.5" /> Primary</> : "Set primary"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          set("fallbackLlmProvider", isFallback ? "none" : p.id);
                          set("__editing", p.id);
                        }}
                        disabled={isPrimary}
                        className={`flex-1 text-xs px-2 py-1 rounded transition ${
                          isPrimary
                            ? "bg-gray-50 text-gray-300 cursor-not-allowed"
                            : isFallback
                              ? "bg-orange-500 text-white"
                              : "bg-gray-100 hover:bg-orange-100 hover:text-orange-700 text-gray-700"
                        }`}
                      >
                        {isFallback ? <><Zap className="inline w-3 h-3 mr-0.5" /> Fallback</> : "Set fallback"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded border-2 border-green-500" />
                Primary
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded border-2 border-orange-500" />
                Fallback
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> API key saved
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded border-2 border-blue-400" /> Editing
              </span>
            </div>
          </div>

          {/* Inline form for whichever card is currently being edited */}
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{PROVIDERS.find((p) => p.id === editing)?.icon}</span>
              <Label className="text-base font-semibold m-0">
                {PROVIDERS.find((p) => p.id === editing)?.label} credentials
              </Label>
            </div>
            <ProviderForm
              provider={editing}
              active={active}
              form={form}
              set={set}
            />
          </div>

          {provider !== "openai" && provider !== "ollama" && !active.openaiApiKeySet && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex gap-2 text-sm">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-amber-800">
                <strong>OpenAI key still required.</strong> Anthropic / Groq / Gemini don't offer embeddings,
                so we need an OpenAI key (just for indexing your knowledge). Switch to OpenAI tab and add it once.
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving ? "Saving…" : <><Sparkles className="w-4 h-4" /> Save settings</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {workspaces.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Switch workspace</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {workspaces.map((w) => (
              <button
                key={w.id}
                onClick={async () => {
                  const r = await fetch(`/api/admin/workspaces/${w.id}`);
                  const d = await r.json();
                  setActive(d.workspace);
                  setForm({ llmProvider: d.workspace.llmProvider || "openai" });
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                  active.id === w.id ? "bg-gray-900 text-white" : "hover:bg-gray-100"
                }`}
              >
                {w.name}
              </button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ProviderForm({
  provider,
  active,
  form,
  set,
}: {
  provider: ProviderId;
  active: Workspace;
  form: Record<string, string>;
  set: (k: string, v: string) => void;
}) {
  const helpUrl = PROVIDERS.find((p) => p.id === provider)?.helpUrl;
  const chatOptions = PROVIDER_MODELS[provider].chat.map((m) => ({
    value: m.id,
    label: m.label,
    description: m.description,
  }));

  if (provider === "ollama") {
    return (
      <div className="space-y-4">
        <div>
          <Label>Base URL</Label>
          <Input
            placeholder="http://localhost:11434"
            value={form.ollamaBaseUrl ?? active.ollamaBaseUrl ?? ""}
            onChange={(e) => set("ollamaBaseUrl", e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">URL of your Ollama server.</p>
        </div>
        <div>
          <Label>Model</Label>
          <Select
            value={form.ollamaModel || active.ollamaModel || "auto"}
            onChange={(v) => set("ollamaModel", v)}
            options={chatOptions}
          />
        </div>
        <p className="text-xs text-gray-500">
          Self-hosted models via <a className="underline" href="https://ollama.com" target="_blank">Ollama</a>.
          Make sure the server is reachable.
        </p>
      </div>
    );
  }

  const keyField = `${provider}ApiKey`;
  const modelField = `${provider}Model`;
  const isSet = (active as unknown as Record<string, boolean>)[`${provider}ApiKeySet`];
  const masked = (active as unknown as Record<string, string | null>)[`${provider}ApiKeyMasked`];

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label className="flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5" /> API Key
          </Label>
          {isSet && masked && (
            <Badge variant="secondary" className="text-xs">
              Saved: {masked}
            </Badge>
          )}
        </div>
        <Input
          type="password"
          placeholder={isSet ? "Enter a new key to replace" : "Paste your API key here"}
          value={form[keyField] || ""}
          onChange={(e) => set(keyField, e.target.value)}
        />
        {helpUrl && (
          <p className="text-xs text-gray-500 mt-1">
            Get one at{" "}
            <a className="underline" href={helpUrl} target="_blank" rel="noopener noreferrer">
              {helpUrl.replace(/^https?:\/\//, "")}
            </a>
          </p>
        )}
      </div>

      <div className={provider === "openai" ? "grid md:grid-cols-2 gap-4" : ""}>
        <div>
          <Label>Chat model</Label>
          <Select
            value={form[modelField] || (active as unknown as Record<string, string | null>)[modelField] || "auto"}
            onChange={(v) => set(modelField, v)}
            options={chatOptions}
          />
        </div>

        {provider === "openai" && (
          <div>
            <Label>Embedding model</Label>
            <Select
              value={form.openaiEmbeddingModel || active.openaiEmbeddingModel || "auto"}
              onChange={(v) => set("openaiEmbeddingModel", v)}
              options={(PROVIDER_MODELS.openai.embedding || []).map((m) => ({
                value: m.id,
                label: m.label,
                description: m.description,
              }))}
            />
          </div>
        )}
      </div>
    </div>
  );
}
