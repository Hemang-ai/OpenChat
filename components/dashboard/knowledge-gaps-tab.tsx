"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, CircleHelp, LoaderCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/utils/use-toast";

type Gap = {
  id: string;
  exampleQuestion: string;
  occurrences: number;
  status: "OPEN" | "RESOLVED" | "DISMISSED";
  lastSeenAt: string;
  resolvedSource: { name: string } | null;
};

export default function KnowledgeGapsTab({ botId }: { botId: string }) {
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [sources, setSources] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedSources, setSelectedSources] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/bots/${botId}/gaps`);
    const body = await response.json();
    if (response.ok) {
      setGaps(body.gaps || []);
      setSources(body.sources || []);
    }
  }, [botId]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/bots/${botId}/gaps`)
      .then((response) => response.json())
      .then((body) => {
        if (!cancelled) {
          setGaps(body.gaps || []);
          setSources(body.sources || []);
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [botId]);

  const update = async (gapId: string, status: Gap["status"]) => {
    setBusy(gapId);
    try {
      const response = await fetch(`/api/admin/bots/${botId}/gaps`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gapId,
          status,
          resolvedSourceId: status === "RESOLVED" ? selectedSources[gapId] || null : null,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Update failed");
      await load();
    } catch (error) {
      toast({ title: "Could not update gap", description: error instanceof Error ? error.message : "Try again", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const open = gaps.filter((gap) => gap.status === "OPEN");

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold">Knowledge gaps</h2>
        <p className="text-sm text-gray-500">Repeated refusals and negative feedback are grouped here so you can prioritize knowledge improvements.</p>
      </div>
      {gaps.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center">
          <CircleHelp className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">No knowledge gaps recorded yet.</p>
        </div>
      ) : (
        <div className="divide-y rounded-md border bg-white">
          {gaps.map((gap) => (
            <div key={gap.id} className="flex flex-col gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{gap.exampleQuestion}</p>
                  <Badge variant={gap.status === "OPEN" ? "warning" : "secondary"}>{gap.status.toLowerCase()}</Badge>
                  <Badge variant="outline">{gap.occurrences} occurrence{gap.occurrences === 1 ? "" : "s"}</Badge>
                </div>
                <p className="mt-1 text-xs text-gray-500">Last seen {new Date(gap.lastSeenAt).toLocaleString()}{gap.resolvedSource ? ` · Resolved with ${gap.resolvedSource.name}` : ""}</p>
              </div>
              {gap.status === "OPEN" && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <select
                    aria-label="Knowledge source that resolves this gap"
                    className="min-h-9 min-w-0 flex-1 rounded-md border bg-transparent px-3 text-sm"
                    value={selectedSources[gap.id] || ""}
                    onChange={(event) => setSelectedSources((current) => ({ ...current, [gap.id]: event.target.value }))}
                  >
                    <option value="">Select resolving source (optional)</option>
                    {sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
                  </select>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={busy === gap.id} onClick={() => update(gap.id, "DISMISSED")}>
                      {busy === gap.id ? <LoaderCircle className="animate-spin" /> : <X />} Dismiss
                    </Button>
                    <Button size="sm" disabled={busy === gap.id} onClick={() => update(gap.id, "RESOLVED")}>
                      <Check /> Mark resolved
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-400">{open.length} open gap{open.length === 1 ? "" : "s"}. Add or update knowledge, rerun evaluations, then resolve the matching item.</p>
    </div>
  );
}
