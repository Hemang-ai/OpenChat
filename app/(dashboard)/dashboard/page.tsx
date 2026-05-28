import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/jwt";
import { db } from "@/lib/db/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import CreateBotDialog from "@/components/dashboard/create-bot-dialog";
import { Bot, MessageSquare, Plus, Settings, UserPlus } from "lucide-react";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const workspaces = await db.workspace.findMany({
    where: { ownerId: session.userId },
    include: {
      bots: {
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { conversations: true, knowledgeSources: true, leads: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { name: true, email: true },
  });

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}!
          </h1>
          <p className="text-gray-500 text-sm mt-1">Manage your AI chatbots</p>
        </div>
        <CreateBotDialog workspaces={workspaces.map((w) => ({ id: w.id, name: w.name }))} />
      </div>

      {workspaces.map((workspace) => (
        <div key={workspace.id} className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              {workspace.name}
            </h2>
            <Badge variant="secondary" className="text-xs">{workspace.bots.length} bots</Badge>
          </div>

          {workspace.bots.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Bot className="w-10 h-10 text-gray-300 mb-3" />
                <p className="text-gray-500 text-sm mb-4">No chatbots yet in this workspace</p>
                <CreateBotDialog
                  workspaces={[{ id: workspace.id, name: workspace.name }]}
                  defaultWorkspaceId={workspace.id}
                  trigger={
                    <Button size="sm" variant="outline" className="gap-1">
                      <Plus className="w-3 h-3" /> Create first bot
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workspace.bots.map((bot) => (
                <Card key={bot.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                        <Bot className="w-5 h-5 text-gray-600" />
                      </div>
                      <Badge variant={bot.isActive ? "success" : "secondary"} className="text-xs">
                        {bot.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <CardTitle className="text-base mt-2">{bot.name}</CardTitle>
                    {bot.description && (
                      <CardDescription className="text-xs line-clamp-2">{bot.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        {bot._count.conversations} conversations
                      </span>
                      <span className="flex items-center gap-1">
                        <UserPlus className="w-3 h-3" />
                        {bot._count.leads} leads
                      </span>
                      <span>{bot._count.knowledgeSources} sources</span>
                    </div>
                    <Link href={`/dashboard/bots/${bot.id}`}>
                      <Button className="w-full" size="sm" variant="outline">
                        <Settings className="w-3 h-3 mr-1" /> Manage
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
