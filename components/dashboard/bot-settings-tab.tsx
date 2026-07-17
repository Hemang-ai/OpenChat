"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Languages, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, MultiSelect, SelectOption } from "@/components/ui/select";
import { getLanguagePickerOptions } from "@/lib/i18n/languages";
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
  leadCaptureEnabled: z.boolean(),
  leadCapturePrompt: z.string().max(240).optional(),
  isActive: z.boolean(),
  allowedOriginsText: z.string().max(3000),
  privacyNotice: z.string().min(20).max(1000),
  industryTemplate: z.enum(["support", "product_discovery", "lead_qualification", "service_booking"]),
  defaultLocale: z.string().min(2),
  supportedLocales: z.array(z.string()).min(1),
});
type FormData = z.infer<typeof schema>;

// Native-script name first, English name + code as the secondary line.
// Popular languages are pinned in a labeled group above the searchable list.
const languageOptions: SelectOption[] = getLanguagePickerOptions();

const toneOptions: SelectOption[] = [
  { value: "professional", label: "Professional", description: "Formal, business-like replies" },
  { value: "friendly", label: "Friendly", description: "Warm and approachable" },
  { value: "concise", label: "Concise", description: "Short answers, bullet points" },
  { value: "detailed", label: "Detailed", description: "Thorough answers with examples" },
];

const fallbackOptions: SelectOption[] = [
  { value: "contact", label: "Direct to your contact info", description: "Warm apology + your email/phone (default)" },
  { value: "ask_clarify", label: "Ask the visitor to rephrase", description: "Invites more detail so the bot can retry" },
  { value: "general_knowledge", label: "Offer general info + suggest contact", description: "Shares general context, points to your team for specifics" },
];

const templateOptions: SelectOption[] = [
  { value: "support", label: "Customer support", description: "Answer product and policy questions" },
  { value: "product_discovery", label: "Product discovery", description: "Help visitors find the right product" },
  { value: "lead_qualification", label: "Lead qualification", description: "Qualify and capture sales leads" },
  { value: "service_booking", label: "Service booking", description: "Guide visitors toward booking services" },
];

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
    leadCaptureEnabled: boolean;
    leadCapturePrompt: string;
    isActive: boolean;
    allowedOrigins: string[];
    privacyNotice: string;
    industryTemplate?: string | null;
    publishedVersion: number;
    defaultLocale?: string;
    supportedLocales?: string[];
  };
}

export default function BotSettingsTab({ bot }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, control, formState: { errors, isDirty } } = useForm<FormData>({
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
      leadCaptureEnabled: bot.leadCaptureEnabled,
      leadCapturePrompt: bot.leadCapturePrompt || "Want us to follow up? Leave your details and our team will reach out.",
      isActive: bot.isActive,
      allowedOriginsText: bot.allowedOrigins.join("\n"),
      privacyNotice: bot.privacyNotice,
      industryTemplate: (bot.industryTemplate || "support") as FormData["industryTemplate"],
      defaultLocale: bot.defaultLocale || "en",
      supportedLocales: bot.supportedLocales?.length ? bot.supportedLocales : ["en"],
    },
  });

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    // The default language is always chat-enabled.
    if (!data.supportedLocales.includes(data.defaultLocale)) {
      data.supportedLocales = [data.defaultLocale, ...data.supportedLocales];
    }
    try {
      const res = await fetch(`/api/admin/bots/${bot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          allowedOrigins: data.allowedOriginsText.split(/\r?\n|,/).map((value) => value.trim()).filter(Boolean),
          allowedOriginsText: undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast({ title: "Draft saved", description: "Run evaluations and publish from the Launch tab when ready." });
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
            <Label>Business workflow template</Label>
            <Controller
              control={control}
              name="industryTemplate"
              render={({ field }) => (
                <Select options={templateOptions} value={field.value} onChange={field.onChange} ariaLabel="Business workflow template" />
              )}
            />
            <p className="text-xs text-gray-400">Templates set sensible workflow defaults without inserting business facts.</p>
          </div>
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
            <Controller
              control={control}
              name="tone"
              render={({ field }) => (
                <Select options={toneOptions} value={field.value} onChange={field.onChange} ariaLabel="Tone" />
              )}
            />
          </div>
          <div className="space-y-2">
            <Label>Answer mode (controls hallucination)</Label>
            <p className="text-xs text-gray-500">
              When your bot answers <strong>“I do not have that information”</strong>, that is a <em>refusal</em> - it means
              the question did not match any chunks in your knowledge base. Loosening this lets the bot answer more, but increases the risk of inventing facts.
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
            <Label>When the bot cannot answer (fallback behavior)</Label>
            <p className="text-xs text-gray-500">
              How should the bot respond when the user asks something not in the knowledge base?
            </p>
            <Controller
              control={control}
              name="fallbackBehavior"
              render={({ field }) => (
                <Select options={fallbackOptions} value={field.value} onChange={field.onChange} ariaLabel="Fallback behavior" />
              )}
            />
          </div>

          <div className="space-y-1">
            <Label>Contact info (shown when bot cannot answer)</Label>
            <Input {...register("contactInfo")} placeholder="e.g., support@acme.com or +1 555 0100" />
            <p className="text-xs text-gray-400">Optional. Replaces the generic “contact the business” phrasing.</p>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="isActive" {...register("isActive")} className="w-4 h-4 rounded" />
            <Label htmlFor="isActive">Bot should be active after the next publish</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Languages className="w-4 h-4 text-gray-500" />
            <CardTitle className="text-base">Languages</CardTitle>
          </div>
          <CardDescription>
            Choose the languages visitors can chat in. The widget detects each visitor&apos;s
            browser language automatically and lets them switch at any time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Primary language</Label>
            <Controller
              control={control}
              name="defaultLocale"
              render={({ field }) => (
                <Select
                  options={languageOptions}
                  value={field.value}
                  onChange={field.onChange}
                  ariaLabel="Primary language"
                  placeholder="Select a language"
                />
              )}
            />
            <p className="text-xs text-gray-400">The language of your knowledge base and default replies.</p>
          </div>
          <div className="space-y-1">
            <Label>Additional visitor languages</Label>
            <Controller
              control={control}
              name="supportedLocales"
              render={({ field }) => (
                <MultiSelect
                  options={languageOptions}
                  value={field.value}
                  onChange={field.onChange}
                  ariaLabel="Enabled visitor languages"
                  placeholder="Select languages"
                />
              )}
            />
            <p className="text-xs text-gray-400">
              Visitors chatting in these languages get answers translated from your knowledge base —
              the bot never invents facts to fill language gaps.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Website access and privacy</CardTitle>
          <CardDescription>Restrict where the published widget can run and explain how AI processes messages.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Approved website origins</Label>
            <Textarea {...register("allowedOriginsText")} rows={4} placeholder={"https://example.com\nhttps://www.example.com"} className="font-mono text-xs" />
            <p className="text-xs text-gray-400">One origin per line, including https://. Leave empty during local testing; add production domains before launch.</p>
          </div>
          <div className="space-y-1">
            <Label>Visitor AI and privacy notice</Label>
            <Textarea {...register("privacyNotice")} rows={3} />
            {errors.privacyNotice && <p className="text-xs text-red-500">{errors.privacyNotice.message}</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-gray-500" />
            <CardTitle className="text-base">Lead capture</CardTitle>
          </div>
          <CardDescription>Collect contact details from high-intent chat visitors</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 cursor-pointer has-[:checked]:border-gray-900 has-[:checked]:bg-gray-50">
            <input
              type="checkbox"
              {...register("leadCaptureEnabled")}
              className="mt-1 w-4 h-4 rounded accent-gray-900"
            />
            <div>
              <div className="font-medium text-sm text-gray-900">Show a follow-up form in the widget</div>
              <p className="text-xs text-gray-500 mt-0.5">
                Visitors can leave their email, phone, company, and request after chatting.
              </p>
            </div>
          </label>

          <div className="space-y-1">
            <Label>Lead capture prompt</Label>
            <Textarea
              {...register("leadCapturePrompt")}
              rows={2}
              placeholder="Want us to follow up? Leave your details and our team will reach out."
            />
            {errors.leadCapturePrompt && (
              <p className="text-xs text-red-500">{errors.leadCapturePrompt.message}</p>
            )}
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
        {saving ? "Saving draft..." : "Save draft settings"}
      </Button>
      <p className="text-xs text-gray-400">{bot.publishedVersion ? `Website visitors remain on version ${bot.publishedVersion} until you publish.` : "This bot is not public until its first successful publish."}</p>
    </form>
  );
}
