import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth/jwt";
import { db } from "@/lib/db/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Bot, Zap } from "lucide-react";
import KnowledgeTab from "@/components/dashboard/knowledge-tab";
import BotSettingsTab from "@/components/dashboard/bot-settings-tab";
import EmbedTab from "@/components/dashboard/embed-tab";
import ChatPreviewTab from "@/components/dashboard/chat-preview-tab";
import AnalyticsTab from "@/components/dashboard/analytics-tab";
import LeadsTab from "@/components/dashboard/leads-tab";
import LogsTab from "@/components/dashboard/logs-tab";
import ToolsTab from "@/components/dashboard/tools-tab";
import LaunchTab from "@/components/dashboard/launch-tab";
import EvaluationsTab from "@/components/dashboard/evaluations-tab";
import KnowledgeGapsTab from "@/components/dashboard/knowledge-gaps-tab";
import OperationsTab from "@/components/dashboard/operations-tab";
import EnvironmentsTab from "@/components/dashboard/environments-tab";
import EcosystemTab from "@/components/dashboard/ecosystem-tab";
import { draftAwareBotConfig } from "@/lib/bots/versioning";
import { botAccessWhere } from "@/lib/auth/workspace-access";

export default async function BotPage({ params }: { params: Promise<{ botId: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { botId } = await params;

  const bot = await db.bot.findFirst({
    where: { id: botId, ...botAccessWhere(session.userId) },
    include: {
      workspace: { select: { id: true, name: true } },
      knowledgeSources: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true, type: true, name: true, status: true,
          createdAt: true, errorMessage: true, url: true,
          fileSize: true, mimeType: true, updatedAt: true,
          metadata: true,
          ownerLabel: true, tags: true, reviewStatus: true, expiresAt: true,
          lastReviewedAt: true, conflictStatus: true, citationVisibility: true,
        },
      },
    },
  });

  if (!bot) notFound();
  const draft = draftAwareBotConfig(bot);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-start gap-3 sm:gap-4 mb-6 sm:mb-8">
        <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
          <Bot className="w-6 h-6 text-gray-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 break-words">{bot.name}</h1>
            <Badge variant={bot.publishedVersion > 0 && bot.isActive ? "success" : "secondary"}>
              {bot.publishedVersion > 0 && bot.isActive ? `Live v${bot.publishedVersion}` : "Unpublished"}
            </Badge>
            {bot.draftConfig && <Badge variant="warning">Draft changes</Badge>}
          </div>
          {bot.description && (
            <p className="text-gray-500 text-sm mt-1">{bot.description}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">Workspace: {bot.workspace.name}</p>
        </div>
      </div>

      <Tabs defaultValue="launch">
        <div className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <TabsList className="w-max min-w-full gap-1">
          <TabsTrigger value="launch">Launch</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
          <TabsTrigger value="evaluations">Evaluations</TabsTrigger>
          <TabsTrigger value="tools"><Zap className="mr-1 h-3.5 w-3.5" /> Tools</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="embed">Embed</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="gaps">Knowledge gaps</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
          <TabsTrigger value="environments">Environments</TabsTrigger>
          <TabsTrigger value="ecosystem">Ecosystem</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        </div>

        <TabsContent value="launch">
          <LaunchTab botId={bot.id} />
        </TabsContent>

        <TabsContent value="knowledge">
          <KnowledgeTab
            key={bot.knowledgeSources.map(source => `${source.id}:${source.status}:${source.updatedAt.getTime()}`).join("|")}
            bot={{ id: bot.id, name: bot.name }}
            sources={bot.knowledgeSources}
          />
        </TabsContent>

        <TabsContent value="evaluations">
          <EvaluationsTab botId={bot.id} />
        </TabsContent>

        <TabsContent value="tools">
          <ToolsTab botId={bot.id} />
        </TabsContent>

        <TabsContent value="preview">
          <ChatPreviewTab bot={{ id: bot.id, name: draft.name, welcomeMessage: draft.welcomeMessage }} />
        </TabsContent>

        <TabsContent value="embed">
          <EmbedTab bot={{ id: bot.id, name: bot.name, publicKey: bot.publicKey, allowedOrigins: bot.allowedOrigins }} />
        </TabsContent>

        <TabsContent value="analytics">
          <AnalyticsTab botId={bot.id} />
        </TabsContent>

        <TabsContent value="gaps">
          <KnowledgeGapsTab botId={bot.id} />
        </TabsContent>

        <TabsContent value="leads">
          <LeadsTab botId={bot.id} />
        </TabsContent>

        <TabsContent value="operations">
          <OperationsTab botId={bot.id} />
        </TabsContent>

        <TabsContent value="environments">
          <EnvironmentsTab botId={bot.id} />
        </TabsContent>

        <TabsContent value="ecosystem">
          <EcosystemTab botId={bot.id} />
        </TabsContent>

        <TabsContent value="logs">
          <LogsTab botId={bot.id} />
        </TabsContent>

        <TabsContent value="settings">
          <BotSettingsTab bot={{
            id: bot.id,
            ...draft,
            publishedVersion: bot.publishedVersion,
            defaultLocale: bot.defaultLocale,
            supportedLocales: bot.supportedLocales,
          }} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
