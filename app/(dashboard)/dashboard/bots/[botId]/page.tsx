import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth/jwt";
import { db } from "@/lib/db/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Bot, Lock } from "lucide-react";
import BotSettingsTab from "@/components/dashboard/bot-settings-tab";

/**
 * Bot detail page — Phase 2 release.
 * Only the Settings tab is wired up; Knowledge, Preview, Embed, Analytics, and Logs
 * arrive in upcoming releases (Parts 3 & 4).
 */
export default async function BotPage({ params }: { params: Promise<{ botId: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { botId } = await params;

  const bot = await db.bot.findFirst({
    where: { id: botId, workspace: { ownerId: session.userId } },
    include: { workspace: { select: { id: true, name: true } } },
  });

  if (!bot) notFound();

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-start gap-4 mb-8">
        <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
          <Bot className="w-6 h-6 text-gray-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{bot.name}</h1>
            <Badge variant={bot.isActive ? "success" : "secondary"}>
              {bot.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
          {bot.description && (
            <p className="text-gray-500 text-sm mt-1">{bot.description}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">Workspace: {bot.workspace.name}</p>
        </div>
      </div>

      <Tabs defaultValue="settings">
        <TabsList className="mb-6 flex-wrap h-auto gap-1">
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="knowledge" disabled className="opacity-50">
            <Lock className="w-3 h-3 mr-1" /> Knowledge (Part 3)
          </TabsTrigger>
          <TabsTrigger value="preview" disabled className="opacity-50">
            <Lock className="w-3 h-3 mr-1" /> Preview (Part 4)
          </TabsTrigger>
          <TabsTrigger value="embed" disabled className="opacity-50">
            <Lock className="w-3 h-3 mr-1" /> Embed (Part 4)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <BotSettingsTab bot={{
            id: bot.id,
            name: bot.name,
            description: bot.description,
            welcomeMessage: bot.welcomeMessage,
            systemPrompt: bot.systemPrompt,
            businessContext: bot.businessContext,
            tone: bot.tone,
            strictness: bot.strictness,
            fallbackBehavior: bot.fallbackBehavior,
            contactInfo: bot.contactInfo,
            isActive: bot.isActive,
          }} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
