import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth/jwt";
import { db } from "@/lib/db/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Bot } from "lucide-react";
import KnowledgeTab from "@/components/dashboard/knowledge-tab";
import BotSettingsTab from "@/components/dashboard/bot-settings-tab";
import EmbedTab from "@/components/dashboard/embed-tab";
import ChatPreviewTab from "@/components/dashboard/chat-preview-tab";
import AnalyticsTab from "@/components/dashboard/analytics-tab";
import LogsTab from "@/components/dashboard/logs-tab";

export default async function BotPage({ params }: { params: Promise<{ botId: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { botId } = await params;

  const bot = await db.bot.findFirst({
    where: { id: botId, workspace: { ownerId: session.userId } },
    include: {
      workspace: { select: { id: true, name: true } },
      knowledgeSources: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true, type: true, name: true, status: true,
          createdAt: true, errorMessage: true, url: true,
          fileSize: true, mimeType: true,
        },
      },
    },
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

      <Tabs defaultValue="knowledge">
        <TabsList className="mb-6 flex-wrap h-auto gap-1">
          <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="embed">Embed</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="knowledge">
          <KnowledgeTab bot={{ id: bot.id, name: bot.name }} sources={bot.knowledgeSources} />
        </TabsContent>

        <TabsContent value="preview">
          <ChatPreviewTab bot={{ id: bot.id, name: bot.name, welcomeMessage: bot.welcomeMessage }} />
        </TabsContent>

        <TabsContent value="embed">
          <EmbedTab bot={{ id: bot.id, name: bot.name, publicKey: bot.publicKey }} />
        </TabsContent>

        <TabsContent value="analytics">
          <AnalyticsTab botId={bot.id} />
        </TabsContent>

        <TabsContent value="logs">
          <LogsTab botId={bot.id} />
        </TabsContent>

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
