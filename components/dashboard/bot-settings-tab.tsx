"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "@/lib/utils/use-toast";

const schema = z.object({
  name: z.string().min(2),
  description: z.string().max(500).optional(),
  welcomeMessage: z.string().max(500),
  systemPrompt: z.string().max(4000).optional(),
  businessContext: z.string().max(2000).optional(),
  tone: z.enum(["professional", "friendly", "concise", "detailed"]),
  strictness: z.enum(["strict", "balanced", "flexible"]),
  fallbackBehavior: z.enum(["contact", "general_knowledge", "ask_clarify"]),
  contactInfo: z.string().max(500).optional(),
  isActive: z.boolean(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  bot: {
    id: string;
    name: string;
    description?: string | null;
    welcomeMessage: string;
    systemPrompt?: string | null;
    businessContext?: string | null;
    tone: string;
    strictness: string;
    fallbackBehavior?: string;
    contactInfo?: string | null;
    isActive: boolean;
  };
}

export default function BotSettingsTab({ bot }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: bot.name,
      description: bot.description || "",
      welcomeMessage: bot.welcomeMessage,
      systemPrompt: bot.systemPrompt || "",
      businessContext: bot.businessContext || "",
      tone: bot.tone as FormData["tone"],
      strictness: (["strict", "balanced", "flexible"].includes(bot.strictness)
        ? bot.strictness
        : "balanced") as FormData["strictness"],
      fallbackBehavior: (bot.fallbackBehavior as FormData["fallbackBehavior"]) || "contact",
      contactInfo: bot.contactInfo || "",
      isActive: bot.isActive,
    },
  });

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/bots/${bot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast({ title: "Settings saved" });
      router.refresh();
    } catch (err) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bot information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Bot name *</Label>
            <Input {...register("name")} />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Input {...register("description")} placeholder="What does this bot help with?" />
          </div>
          <div className="space-y-1">
            <Label>Business context</Label>
            <Textarea
              {...register("businessContext")}
              rows={3}
              placeholder="Describe your business so the bot can introduce itself correctly..."
            />
            <p className="text-xs text-gray-400">Used to give context to the LLM about your business</p>
          </div>
          <div className="space-y-1">
            <Label>Welcome message</Label>
            <Input {...register("welcomeMessage")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Behavior</CardTitle>
          <CardDescription>Control how the bot responds to users</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Tone</Label>
            <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" {...register("tone")}>
              <option value="professional">Professional</option>
              <option value="friendly">Friendly</option>
              <option value="concise">Concise</option>
              <option value="detailed">Detailed</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Answer mode (controls hallucination)</Label>
            <p className="text-xs text-gray-500">
              When your bot answers <strong>“I don't have that information”</strong>, that's a <em>refusal</em> — it means
              the question didn't match any chunks in your knowledge base. Loosening this lets the bot answer more, but increases the risk of inventing facts.
            </p>
            <div className="grid gap-2">
              {[
                {
                  v: "strict",
                  label: "Strict",
                  desc: "Refuses unless the answer is clearly in your knowledge base. Best for legal/medical/financial.",
                  industry: "Industry standard for compliance-sensitive bots.",
                },
                {
                  v: "balanced",
                  label: "Balanced (recommended)",
                  desc: "Answers from your knowledge base, paraphrases freely, handles greetings/conversation naturally. Refuses on business-specific facts not in the KB.",
                  industry: "Industry standard for customer-support bots.",
                },
                {
                  v: "flexible",
                  label: "Flexible",
                  desc: "Uses general knowledge for non-business questions (definitions, math, greetings). Still refuses on business-specific facts.",
                  industry: "Best CX, but slight risk of off-topic answers.",
                },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className="flex gap-3 p-3 rounded-lg border border-gray-200 hover:border-gray-400 cursor-pointer has-[:checked]:border-gray-900 has-[:checked]:bg-gray-50"
                >
                  <input
                    type="radio"
                    value={opt.v}
                    {...register("strictness")}
                    className="mt-1 accent-gray-900"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{opt.label}</div>
                    <div className="text-xs text-gray-600 mt-0.5">{opt.desc}</div>
                    <div className="text-xs text-gray-400 mt-1">{opt.industry}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-gray-100">
            <Label>When the bot can't answer (fallback behavior)</Label>
            <p className="text-xs text-gray-500">
              How should the bot respond when the user asks something not in the knowledge base?
            </p>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              {...register("fallbackBehavior")}
            >
              <option value="contact">Apologize and direct to your contact info (default)</option>
              <option value="ask_clarify">Ask the user to rephrase or clarify</option>
              <option value="general_knowledge">Offer general info + suggest contacting the business</option>
            </select>
          </div>

          <div className="space-y-1">
            <Label>Contact info (shown when bot can't answer)</Label>
            <Input {...register("contactInfo")} placeholder="e.g., support@acme.com or +1 555 0100" />
            <p className="text-xs text-gray-400">Optional. Replaces the generic “contact the business” phrasing.</p>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="isActive" {...register("isActive")} className="w-4 h-4 rounded" />
            <Label htmlFor="isActive">Bot is active (public embed will work)</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Custom system prompt</CardTitle>
          <CardDescription>
            Override the default system prompt. Leave blank to use the default RAG prompt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            {...register("systemPrompt")}
            rows={6}
            placeholder="You are a helpful assistant for [Business Name]..."
            className="font-mono text-xs"
          />
        </CardContent>
      </Card>

      <Button type="submit" disabled={saving || !isDirty}>
        {saving ? "Saving..." : "Save settings"}
      </Button>
    </form>
  );
}
