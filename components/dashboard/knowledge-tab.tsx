"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, Globe, Play, FileText, Trash2, RefreshCw, PenLine, LoaderCircle, Eye, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/lib/utils/use-toast";

interface Source {
  id: string;
  type: string;
  name: string;
  status: string;
  createdAt: Date | string;
  errorMessage?: string | null;
  url?: string | null;
  fileSize?: number | null;
  metadata?: unknown;
  ownerLabel?: string | null;
  tags?: string[];
  reviewStatus?: "APPROVED" | "NEEDS_REVIEW" | "ARCHIVED";
  expiresAt?: Date | string | null;
  lastReviewedAt?: Date | string | null;
  conflictStatus?: "CLEAR" | "DUPLICATE" | "POSSIBLE_CONFLICT";
  citationVisibility?: "PUBLIC" | "HIDDEN";
}

interface Props {
  bot: { id: string; name: string };
  sources: Source[];
}

const statusVariant: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  COMPLETED: "success",
  PROCESSING: "warning",
  PENDING: "secondary",
  FAILED: "destructive",
};

// Plain-language extraction quality signal.
const completenessDisplay: Record<string, { label: string; className: string }> = {
  complete: { label: "Looks complete", className: "text-green-700 bg-green-50 border-green-200" },
  partial: { label: "Partial — some content may be missing", className: "text-amber-700 bg-amber-50 border-amber-200" },
  low: { label: "Low confidence — review recommended", className: "text-red-700 bg-red-50 border-red-200" },
};

interface ConflictMatch { sourceId: string; sourceName: string; reason: string; excerpt: string }

/** One "why this needs attention" reason with a plain-language explanation of what to do about it. */
interface SourceIssue {
  key: string;
  label: string;
  detail: string;
  className: string;
}

function getSourceIssues(source: Source): SourceIssue[] {
  const issues: SourceIssue[] = [];
  const meta = source.metadata as Record<string, unknown> | null | undefined;
  const conflictMatches = (meta && typeof meta === "object" && !Array.isArray(meta) ? meta.conflictMatches : undefined) as ConflictMatch[] | undefined;

  if (source.conflictStatus === "DUPLICATE") {
    issues.push({
      key: "duplicate",
      label: "Duplicate content",
      detail: "This text is nearly identical to another source in your knowledge base. Delete the redundant one, or mark reviewed if both are intentional (e.g. a translation).",
      className: "text-amber-700 bg-amber-50 border-amber-200",
    });
  } else if (source.conflictStatus === "POSSIBLE_CONFLICT") {
    const first = conflictMatches?.[0];
    issues.push({
      key: "conflict",
      label: "Possible conflicting statement",
      detail: first
        ? `A statement here may contradict "${first.sourceName}": ${first.reason.toLowerCase()}. Compare the two, fix whichever is outdated, then mark reviewed.`
        : "A statement here may contradict another source. Compare the two, fix whichever is outdated, then mark reviewed.",
      className: "text-amber-700 bg-amber-50 border-amber-200",
    });
  }

  if (source.reviewStatus === "NEEDS_REVIEW" && source.conflictStatus === "CLEAR") {
    issues.push({
      key: "flagged",
      label: "Flagged for manual review",
      detail: "This source was flagged for a manual check. Open it, confirm the content is accurate, then mark reviewed.",
      className: "text-amber-700 bg-amber-50 border-amber-200",
    });
  }

  if (source.expiresAt && new Date(source.expiresAt) < new Date()) {
    issues.push({
      key: "expired",
      label: "Review date passed",
      detail: `You set a reminder to re-check this source by ${new Date(source.expiresAt).toLocaleDateString()}. Confirm it's still accurate, then extend the review date.`,
      className: "text-red-700 bg-red-50 border-red-200",
    });
  }

  return issues;
}

export default function KnowledgeTab({ bot, sources: initialSources }: Props) {
  const router = useRouter();
  const [sources, setSources] = useState(initialSources);
  const [uploading, setUploading] = useState(false);
  const [savingUrl, setSavingUrl] = useState(false);
  const [savingManual, setSavingManual] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [urlDialogOpen, setUrlDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [urlForm, setUrlForm] = useState({ type: "WEBSITE", url: "", name: "", crawl: false, maxPages: 10, maxDepth: 1, refreshHours: 24 });
  const [manualForm, setManualForm] = useState({ name: "", content: "" });
  const [manualOpen, setManualOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [sourceDetails, setSourceDetails] = useState<{ source: Source; extraction: Array<{ id: string; title?: string | null; preview: string; charCount: number; chunks: Array<{ id: string; chunkIndex: number; content: string }> }> } | null>(null);
  const [lifecycle, setLifecycle] = useState({ ownerLabel: "", tags: "", reviewStatus: "APPROVED", expiresAt: "", citationVisibility: "PUBLIC" });
  const [savingLifecycle, setSavingLifecycle] = useState(false);
  const [filter, setFilter] = useState<"all" | "review" | "stale">("all");

  const refresh = () => router.refresh();

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch(`/api/admin/bots/${bot.id}/knowledge`, {
          method: "POST",
          body: formData,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        if (json.source) setSources(current => [json.source, ...current.filter(item => item.id !== json.source.id)]);
        toast({ title: "File ready", description: `${file.name} was added to the knowledge base.` });
      } catch (err) {
        toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
      }
    }
    setUploading(false);
    refresh();
  };

  const handleAddUrl = async () => {
    if (!urlForm.url || !urlForm.name) {
      toast({ title: "Fill all fields", variant: "destructive" });
      return;
    }
    setSavingUrl(true);
    try {
      const res = await fetch(`/api/admin/bots/${bot.id}/knowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: urlForm.type, url: urlForm.url, name: urlForm.name, crawlConfig: urlForm.type === "WEBSITE" ? { enabled: urlForm.crawl, maxPages: urlForm.maxPages, maxDepth: urlForm.maxDepth, includePaths: [], excludePaths: [] } : undefined, refreshIntervalHours: urlForm.refreshHours || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      if (json.source) setSources(current => [json.source, ...current.filter(item => item.id !== json.source.id)]);
      toast({ title: "Source ready", description: "The page was extracted and added to the knowledge base." });
      setUrlDialogOpen(false);
      setUrlForm({ type: "WEBSITE", url: "", name: "", crawl: false, maxPages: 10, maxDepth: 1, refreshHours: 24 });
      refresh();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
      refresh();
    } finally {
      setSavingUrl(false);
    }
  };

  const handleAddManual = async () => {
    if (!manualForm.name || !manualForm.content) {
      toast({ title: "Fill all fields", variant: "destructive" });
      return;
    }
    setSavingManual(true);
    try {
      const res = await fetch(`/api/admin/bots/${bot.id}/knowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "MANUAL", name: manualForm.name, content: manualForm.content }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      if (json.source) setSources(current => [json.source, ...current.filter(item => item.id !== json.source.id)]);
      toast({ title: "Knowledge ready" });
      setManualOpen(false);
      setManualForm({ name: "", content: "" });
      refresh();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
      refresh();
    } finally {
      setSavingManual(false);
    }
  };

  const handleRetry = async (source: Source) => {
    setRetryingId(source.id);
    try {
      const res = await fetch(`/api/admin/bots/${bot.id}/knowledge`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: source.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Retry failed");
      if (json.source) setSources(current => current.map(item => item.id === source.id ? json.source : item));
      toast({ title: "Source ready", description: `${source.name} was processed successfully.` });
    } catch (err) {
      toast({ title: "Retry failed", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
      refresh();
    } finally {
      setRetryingId(null);
    }
  };

  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const patchLifecycle = async (source: Source, body: Record<string, unknown>, successMessage: string) => {
    setResolvingId(source.id);
    try {
      const res = await fetch(`/api/admin/bots/${bot.id}/knowledge/${source.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      setSources((current) => current.map((item) => (item.id === source.id ? { ...item, ...json.source } : item)));
      toast({ title: successMessage });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally {
      setResolvingId(null);
    }
  };

  // Clears every content-based flag (conflict, manual review) in one click —
  // review date is handled separately by "Extend" since it's time-based, not
  // a judgment call about the content itself.
  const markReviewed = (source: Source) =>
    patchLifecycle(source, { reviewStatus: "APPROVED", conflictStatus: "CLEAR" }, "Marked as reviewed");

  const extendReview = (source: Source) => {
    const next = new Date();
    next.setDate(next.getDate() + 90);
    return patchLifecycle(source, { expiresAt: next.toISOString(), reviewStatus: "APPROVED" }, "Review date extended 90 days");
  };

  const handleDelete = async (sourceId: string, sourceName: string) => {
    if (!confirm(`Delete "${sourceName}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/bots/${bot.id}/knowledge`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Delete failed");
      toast({
        title: body.archived ? "Source removed from draft" : "Source deleted",
        description: body.archived ? "The current live version keeps using it until you publish the draft." : undefined,
      });
      refresh();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    }
  };

  const openSourceDetails = async (source: Source) => {
    setDetailsOpen(true);
    setDetailsLoading(true);
    setLifecycle({
      ownerLabel: source.ownerLabel || "",
      tags: (source.tags || []).join(", "),
      reviewStatus: source.reviewStatus || "APPROVED",
      expiresAt: source.expiresAt ? new Date(source.expiresAt).toISOString().slice(0, 10) : "",
      citationVisibility: source.citationVisibility || "PUBLIC",
    });
    try {
      const response = await fetch(`/api/admin/bots/${bot.id}/knowledge/${source.id}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load source preview");
      setSourceDetails(body);
    } catch (error) {
      toast({ title: "Preview unavailable", description: error instanceof Error ? error.message : "Try again", variant: "destructive" });
      setDetailsOpen(false);
    } finally { setDetailsLoading(false); }
  };

  const saveLifecycle = async () => {
    if (!sourceDetails) return;
    setSavingLifecycle(true);
    try {
      const response = await fetch(`/api/admin/bots/${bot.id}/knowledge/${sourceDetails.source.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerLabel: lifecycle.ownerLabel || null,
          tags: lifecycle.tags.split(",").map((value) => value.trim()).filter(Boolean),
          reviewStatus: lifecycle.reviewStatus,
          expiresAt: lifecycle.expiresAt ? new Date(`${lifecycle.expiresAt}T00:00:00.000Z`).toISOString() : null,
          citationVisibility: lifecycle.citationVisibility,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not update source");
      setSources((current) => current.map((item) => item.id === body.source.id ? { ...item, ...body.source } : item));
      setSourceDetails((current) => current ? { ...current, source: { ...current.source, ...body.source } } : current);
      toast({ title: "Source lifecycle updated", description: "Run evaluations again before publishing." });
    } catch (error) {
      toast({ title: "Update failed", description: error instanceof Error ? error.message : "Try again", variant: "destructive" });
    } finally { setSavingLifecycle(false); }
  };

  const sourceIcon = (type: string) => {
    switch (type) {
      case "FILE": return <FileText className="w-4 h-4" />;
      case "WEBSITE": return <Globe className="w-4 h-4" />;
      case "YOUTUBE": return <Play className="w-4 h-4" />;
      default: return <PenLine className="w-4 h-4" />;
    }
  };

  const visibleSources = sources.filter((source) => {
    if (filter === "review") return source.reviewStatus === "NEEDS_REVIEW" || source.conflictStatus !== "CLEAR";
    if (filter === "stale") return Boolean(source.expiresAt && new Date(source.expiresAt) < new Date());
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.txt,.md,.csv"
            className="hidden"
            onChange={(e) => handleFileUpload(e.target.files)}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full gap-2 sm:w-auto"
            variant="outline"
          >
            <Upload className="w-4 h-4" />
            {uploading ? "Uploading..." : "Upload files"}
          </Button>
        </div>

        <Dialog open={urlDialogOpen} onOpenChange={setUrlDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full gap-2 sm:w-auto">
              <Globe className="w-4 h-4" /> Add URL
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add URL source</DialogTitle>
              <DialogDescription>Add a website or YouTube URL as knowledge.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Source type</Label>
                <select
                  className="flex min-h-11 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base md:text-sm"
                  value={urlForm.type}
                  onChange={(e) => setUrlForm(f => ({ ...f, type: e.target.value }))}
                >
                  <option value="WEBSITE">Website URL</option>
                  <option value="YOUTUBE">YouTube URL</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>URL</Label>
                <Input
                  placeholder={urlForm.type === "YOUTUBE" ? "https://youtube.com/watch?v=..." : "https://example.com/about"}
                  value={urlForm.url}
                  onChange={(e) => setUrlForm(f => ({ ...f, url: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Name / label</Label>
                <Input
                  placeholder="e.g. About page, Product demo"
                  value={urlForm.name}
                  onChange={(e) => setUrlForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              {urlForm.type === "WEBSITE" && <div className="space-y-3 rounded-md border p-3"><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={urlForm.crawl} onChange={(event) => setUrlForm((form) => ({ ...form, crawl: event.target.checked }))} /><span><strong>Crawl linked pages</strong><span className="block text-xs text-gray-500">Same origin only, with strict page and depth limits.</span></span></label>{urlForm.crawl && <div className="grid grid-cols-2 gap-3"><div><Label>Maximum pages</Label><Input type="number" min={1} max={50} value={urlForm.maxPages} onChange={(event) => setUrlForm((form) => ({ ...form, maxPages: Number(event.target.value) }))} /></div><div><Label>Link depth</Label><Input type="number" min={0} max={3} value={urlForm.maxDepth} onChange={(event) => setUrlForm((form) => ({ ...form, maxDepth: Number(event.target.value) }))} /></div></div>}</div>}
              <div className="space-y-1"><Label>Automatic refresh</Label><select className="flex min-h-11 w-full rounded-md border bg-white px-3 text-sm" value={urlForm.refreshHours} onChange={(event) => setUrlForm((form) => ({ ...form, refreshHours: Number(event.target.value) }))}><option value={0}>Manual only</option><option value={24}>Daily</option><option value={168}>Weekly</option><option value={720}>Monthly</option></select></div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setUrlDialogOpen(false)}>Cancel</Button>
                <Button className="flex-1" onClick={handleAddUrl} disabled={savingUrl}>
                  {savingUrl && <LoaderCircle className="animate-spin" />}
                  {savingUrl ? "Processing..." : "Add source"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={manualOpen} onOpenChange={setManualOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full gap-2 sm:w-auto">
              <PenLine className="w-4 h-4" /> Manual text
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add manual knowledge</DialogTitle>
              <DialogDescription>Paste or type business knowledge directly.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Title</Label>
                <Input
                  placeholder="e.g. Refund Policy"
                  value={manualForm.name}
                  onChange={(e) => setManualForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Content</Label>
                <Textarea
                  rows={8}
                  placeholder="Type or paste your knowledge here..."
                  value={manualForm.content}
                  onChange={(e) => setManualForm(f => ({ ...f, content: e.target.value }))}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setManualOpen(false)}>Cancel</Button>
                <Button className="flex-1" onClick={handleAddManual} disabled={savingManual}>
                  {savingManual && <LoaderCircle className="animate-spin" />}
                  {savingManual ? "Processing..." : "Add knowledge"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Button variant="ghost" size="icon" className="justify-self-start" onClick={refresh} title="Refresh" aria-label="Refresh sources">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <div className="text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
        Supported file types: PDF, DOCX, TXT, MD, CSV · Max size: {process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || "10"}MB
      </div>

      <div className="space-y-1">
        <div className="flex flex-wrap gap-2" aria-label="Filter knowledge sources">
          {([['all', 'All sources'], ['review', 'Needs review'], ['stale', 'Expired']] as const).map(([value, label]) => <Button key={value} size="sm" variant={filter === value ? "default" : "outline"} onClick={() => setFilter(value)}>{label}</Button>)}
        </div>
        {filter === "review" && (
          <p className="text-xs text-gray-500">
            These sources have a duplicate, a possible conflict with another source, or were manually flagged.
            Open a source to see why, then use <strong>Mark reviewed</strong> once you&apos;ve confirmed it&apos;s accurate.
          </p>
        )}
        {filter === "stale" && (
          <p className="text-xs text-gray-500">
            You set a reminder to periodically re-check these sources for accuracy. Use <strong>Extend</strong> once
            you&apos;ve confirmed the content is still correct.
          </p>
        )}
      </div>

      {sources.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm">No knowledge sources yet</p>
            <p className="text-gray-400 text-xs mt-1">Upload files or add URLs to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {visibleSources.map((source) => (
            <div key={source.id} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors sm:items-center">
              <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-gray-500 shrink-0">
                {sourceIcon(source.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-medium text-gray-900 break-words sm:text-sm">{source.name}</p>
                {source.url && <p className="text-sm text-gray-500 break-all sm:text-xs">{source.url}</p>}
                {source.errorMessage && (
                  <p className="mt-1 text-sm text-red-600 break-words" role="alert">{source.errorMessage}</p>
                )}
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {source.ownerLabel && <Badge variant="outline">Owner: {source.ownerLabel}</Badge>}
                  {(source.tags || []).slice(0, 3).map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}
                </div>
                {(() => {
                  const meta = source.metadata as Record<string, unknown> | null | undefined;
                  const extraction = meta && typeof meta === "object" && !Array.isArray(meta) ? (meta.extraction as { completeness?: string } | undefined) : undefined;
                  const completenessBadge = source.status === "COMPLETED" && extraction?.completeness
                    ? completenessDisplay[extraction.completeness]
                    : null;
                  const chunkCount = meta && typeof meta === "object" && !Array.isArray(meta) ? meta.chunkCount : undefined;
                  const issues = getSourceIssues(source);
                  const canReExtract = source.status === "COMPLETED" && extraction?.completeness === "low" && source.type !== "FILE";
                  const isExpired = issues.some((issue) => issue.key === "expired");
                  const isBusy = resolvingId === source.id;
                  return (
                    <>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {chunkCount ? <p className="text-xs text-gray-400">{String(chunkCount)} chunks</p> : null}
                        {completenessBadge && (
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${completenessBadge.className}`}>
                            {completenessBadge.label}
                          </span>
                        )}
                      </div>
                      {issues.length > 0 && (
                        <div className="mt-2 space-y-1.5 rounded-md border border-amber-100 bg-amber-50/50 p-2">
                          {issues.map((issue) => (
                            <div key={issue.key} className="flex items-start gap-1.5 text-xs">
                              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" aria-hidden />
                              <p className="text-gray-700">
                                <strong>{issue.label}.</strong> {issue.detail}
                              </p>
                            </div>
                          ))}
                          <div className="flex flex-wrap gap-2 pt-0.5">
                            {issues.some((issue) => issue.key !== "expired") && (
                              <Button size="sm" variant="outline" disabled={isBusy} onClick={() => markReviewed(source)}>
                                {isBusy ? "Saving..." : "Mark reviewed"}
                              </Button>
                            )}
                            {isExpired && (
                              <Button size="sm" variant="outline" disabled={isBusy} onClick={() => extendReview(source)}>
                                {isBusy ? "Saving..." : "Extend 90 days"}
                              </Button>
                            )}
                            {canReExtract && (
                              <Button size="sm" variant="outline" disabled={retryingId === source.id} onClick={() => handleRetry(source)}>
                                {retryingId === source.id ? "Re-extracting..." : "Re-extract"}
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Badge variant={statusVariant[source.status] || "secondary"} className="text-xs">
                  {source.status.toLowerCase()}
                </Badge>
                {source.status === "FAILED" && source.type !== "FILE" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-gray-500 hover:text-gray-900"
                    onClick={() => handleRetry(source)}
                    disabled={retryingId === source.id}
                    aria-label={`Retry ${source.name}`}
                    title="Retry processing"
                  >
                    <RefreshCw className={retryingId === source.id ? "animate-spin" : ""} />
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => openSourceDetails(source)} aria-label={`Preview ${source.name}`} title="Preview extraction and lifecycle"><Eye className="w-4 h-4" /></Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-gray-400 hover:text-red-500"
                  onClick={() => handleDelete(source.id, source.name)}
                  aria-label={`Delete ${source.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={detailsOpen} onOpenChange={(open) => { setDetailsOpen(open); if (!open) setSourceDetails(null); }}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{sourceDetails?.source.name || "Source preview"}</DialogTitle><DialogDescription>Inspect extracted text and control freshness, review, and public citation behavior.</DialogDescription></DialogHeader>
          {detailsLoading ? <div className="h-48 animate-pulse rounded-md bg-gray-100" /> : sourceDetails && <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label>Source owner</Label><Input value={lifecycle.ownerLabel} onChange={(event) => setLifecycle((current) => ({ ...current, ownerLabel: event.target.value }))} placeholder="Support team" /></div>
              <div className="space-y-1"><Label>Tags</Label><Input value={lifecycle.tags} onChange={(event) => setLifecycle((current) => ({ ...current, tags: event.target.value }))} placeholder="policy, billing" /></div>
              <div className="space-y-1"><Label>Review status</Label><select className="min-h-11 w-full rounded-md border bg-transparent px-3 text-sm" value={lifecycle.reviewStatus} onChange={(event) => setLifecycle((current) => ({ ...current, reviewStatus: event.target.value }))}><option value="APPROVED">Approved</option><option value="NEEDS_REVIEW">Needs review</option><option value="ARCHIVED">Archived</option></select></div>
              <div className="space-y-1"><Label>Review by</Label><Input type="date" value={lifecycle.expiresAt} onChange={(event) => setLifecycle((current) => ({ ...current, expiresAt: event.target.value }))} /></div>
              <div className="space-y-1 sm:col-span-2"><Label>Public citations</Label><select className="min-h-11 w-full rounded-md border bg-transparent px-3 text-sm" value={lifecycle.citationVisibility} onChange={(event) => setLifecycle((current) => ({ ...current, citationVisibility: event.target.value }))}><option value="PUBLIC">Show source name, excerpt, and safe URL</option><option value="HIDDEN">Use for grounding but hide from visitors</option></select></div>
            </div>
            <Button onClick={saveLifecycle} disabled={savingLifecycle}>{savingLifecycle && <LoaderCircle className="animate-spin" />}{savingLifecycle ? "Saving..." : "Save source settings"}</Button>
            {sourceDetails.extraction.map((document) => <section key={document.id} className="space-y-2"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">{document.title || "Extracted document"}</h3><span className="text-xs text-gray-400">{document.charCount.toLocaleString()} characters</span></div><pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md border bg-gray-50 p-3 font-sans text-xs leading-relaxed text-gray-700">{document.preview}</pre><details><summary className="cursor-pointer text-xs font-medium text-blue-600">Inspect {document.chunks.length} sample chunks</summary><div className="mt-2 space-y-2">{document.chunks.map((chunk) => <div key={chunk.id} className="rounded border p-2 text-xs"><span className="font-mono text-gray-400">Chunk {chunk.chunkIndex + 1}</span><p className="mt-1 whitespace-pre-wrap text-gray-600">{chunk.content}</p></div>)}</div></details></section>)}
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
