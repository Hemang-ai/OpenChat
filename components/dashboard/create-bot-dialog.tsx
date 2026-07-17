"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/lib/utils/use-toast";

const schema = z.object({
  name: z.string().min(2, "Bot name must be at least 2 characters"),
  description: z.string().max(500).optional(),
  workspaceId: z.string().min(1, "Select a workspace"),
  welcomeMessage: z.string().max(500).optional(),
  businessContext: z.string().max(2000).optional(),
  industryTemplate: z.enum(["support", "product_discovery", "lead_qualification", "service_booking"]),
});
type FormData = z.infer<typeof schema>;

interface Props {
  workspaces: { id: string; name: string }[];
  defaultWorkspaceId?: string;
  firstBot?: boolean;
}

export default function CreateBotDialog({ workspaces, defaultWorkspaceId, firstBot = false }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { workspaceId: defaultWorkspaceId || workspaces[0]?.id, industryTemplate: "support" },
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast({ title: "Draft bot created", description: "Add knowledge, run launch tests, then publish." });
      setOpen(false);
      reset();
      router.push(`/dashboard/bots/${json.bot.id}`);
      router.refresh();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={firstBot ? "outline" : "default"} className="gap-1">
          <Plus className={firstBot ? "h-3 w-3" : "h-4 w-4"} /> {firstBot ? "Create first bot" : "New bot"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create a new chatbot</DialogTitle>
          <DialogDescription>Configure your AI chatbot for your business.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {workspaces.length > 1 && (
            <div className="space-y-1">
              <Label>Workspace</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                {...register("workspaceId")}
              >
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1">
            <Label>Workflow template</Label>
            <select className="flex min-h-11 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" {...register("industryTemplate")}>
              <option value="support">Customer support</option>
              <option value="product_discovery">Product discovery</option>
              <option value="lead_qualification">Lead qualification</option>
              <option value="service_booking">Service booking</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Bot name *</Label>
            <Input placeholder="e.g. Acme Support Bot" {...register("name")} />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Input placeholder="What does this bot help with?" {...register("description")} />
          </div>
          <div className="space-y-1">
            <Label>Welcome message</Label>
            <Input placeholder="Hello! How can I help you today?" {...register("welcomeMessage")} />
          </div>
          <div className="space-y-1">
            <Label>Business context (optional)</Label>
            <Textarea
              placeholder="Briefly describe your business so the bot introduces itself correctly..."
              rows={3}
              {...register("businessContext")}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Creating..." : "Create bot"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
