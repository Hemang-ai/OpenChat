"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, Globe, Play, FileText, Trash2, RefreshCw, Plus, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export default function KnowledgeTab({ bot, sources: initialSources }: Props) {
  const router = useRouter();
  const [sources, setSources] = useState(initialSources);
  const [uploading, setUploading] = useState(false);
  const [urlDialogOpen, setUrlDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [urlForm, setUrlForm] = useState({ type: "WEBSITE", url: "", name: "" });
  const [manualForm, setManualForm] = useState({ name: "", content: "" });
  const [manualOpen, setManualOpen] = useState(false);

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
        toast({ title: "File queued", description: `${file.name} is being processed...` });
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
    try {
      const res = await fetch(`/api/admin/bots/${bot.id}/knowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: urlForm.type, url: urlForm.url, name: urlForm.name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast({ title: "Source added", description: "Processing in background..." });
      setUrlDialogOpen(false);
      setUrlForm({ type: "WEBSITE", url: "", name: "" });
      refresh();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    }
  };

  const handleAddManual = async () => {
    if (!manualForm.name || !manualForm.content) {
      toast({ title: "Fill all fields", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch(`/api/admin/bots/${bot.id}/knowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "MANUAL", name: manualForm.name, content: manualForm.content }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast({ title: "Knowledge added" });
      setManualOpen(false);
      setManualForm({ name: "", content: "" });
      refresh();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    }
  };

  const handleDelete = async (sourceId: string, sourceName: string) => {
    if (!confirm(`Delete "${sourceName}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/bots/${bot.id}/knowledge`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId }),
      });
      if (!res.ok) throw new Error("Delete failed");
      toast({ title: "Source deleted" });
      refresh();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    }
  };

  const sourceIcon = (type: string) => {
    switch (type) {
      case "FILE": return <FileText className="w-4 h-4" />;
      case "WEBSITE": return <Globe className="w-4 h-4" />;
      case "YOUTUBE": return <Play className="w-4 h-4" />;
      default: return <PenLine className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
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
            className="gap-2"
            variant="outline"
          >
            <Upload className="w-4 h-4" />
            {uploading ? "Uploading..." : "Upload files"}
          </Button>
        </div>

        <Dialog open={urlDialogOpen} onOpenChange={setUrlDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2">
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
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
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
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setUrlDialogOpen(false)}>Cancel</Button>
                <Button className="flex-1" onClick={handleAddUrl}>Add source</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={manualOpen} onOpenChange={setManualOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2">
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
                <Button className="flex-1" onClick={handleAddManual}>Add knowledge</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Button variant="ghost" size="icon" onClick={refresh} title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <div className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
        Supported file types: PDF, DOCX, TXT, MD, CSV · Max size: {process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || "10"}MB
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
          {sources.map((source) => (
            <div key={source.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
              <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-gray-500 shrink-0">
                {sourceIcon(source.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{source.name}</p>
                {source.url && <p className="text-xs text-gray-400 truncate">{source.url}</p>}
                {source.errorMessage && (
                  <p className="text-xs text-red-500">{source.errorMessage}</p>
                )}
                {(() => {
                  const meta = source.metadata as Record<string, unknown> | null | undefined;
                  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
                  if (!meta.chunkCount) return null;
                  return <p className="text-xs text-gray-400">{String(meta.chunkCount)} chunks</p>;
                })()}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={statusVariant[source.status] || "secondary"} className="text-xs">
                  {source.status.toLowerCase()}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7 text-gray-400 hover:text-red-500"
                  onClick={() => handleDelete(source.id, source.name)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
