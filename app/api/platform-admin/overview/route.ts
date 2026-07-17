import { NextRequest, NextResponse } from "next/server";
import { requirePlatformPermission } from "@/lib/auth/platform-admin";
import { db } from "@/lib/db/client";

function daysFromRequest(req: NextRequest): number {
  const value = Number(req.nextUrl.searchParams.get("days") || 30);
  return [7, 30, 90].includes(value) ? value : 30;
}

export async function GET(req: NextRequest) {
  try {
    const actor = await requirePlatformPermission("overview:read");
    const days = daysFromRequest(req);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [totalUsers, newUsers, totalWorkspaces, newWorkspaces, totalBots, newBots, activeBots, completedSources, newCompletedSources, conversations, messages, refusedMessages, leads, toolExecutions, toolFailures, ingestionFailures, securityEvents, embedEvents, widgetOpens, workspaces, handoffs, webhookFailures, queueDepth, usage, providerUsage, openPrivacyRequests] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { createdAt: { gte: since } } }),
      db.workspace.count(),
      db.workspace.count({ where: { createdAt: { gte: since } } }),
      db.bot.count(),
      db.bot.count({ where: { createdAt: { gte: since } } }),
      db.bot.count({ where: { isActive: true } }),
      db.knowledgeSource.count({ where: { status: "COMPLETED" } }),
      db.knowledgeSource.count({ where: { status: "COMPLETED", updatedAt: { gte: since } } }),
      db.conversation.count({ where: { createdAt: { gte: since } } }),
      db.message.count({ where: { createdAt: { gte: since } } }),
      db.message.count({ where: { role: "ASSISTANT", isRefused: true, createdAt: { gte: since } } }),
      db.lead.count({ where: { createdAt: { gte: since } } }),
      db.toolExecution.count({ where: { createdAt: { gte: since } } }),
      db.toolExecution.count({ where: { status: "ERROR", createdAt: { gte: since } } }),
      db.ingestionJob.count({ where: { status: "FAILED", createdAt: { gte: since } } }),
      db.auditEvent.count({ where: { createdAt: { gte: since }, type: { in: ["auth.login.failed", "tool.failed", "tool.rejected"] } } }),
      db.platformEvent.findMany({ where: { type: "embed.loaded", createdAt: { gte: since } }, select: { botId: true, origin: true } }),
      db.platformEvent.count({ where: { type: "widget.opened", createdAt: { gte: since } } }),
      db.workspace.findMany({
        select: {
          id: true,
          bots: {
            select: {
              id: true,
              _count: {
                select: {
                  knowledgeSources: { where: { status: "COMPLETED" } },
                  conversations: true,
                },
              },
            },
          },
        },
      }),
      db.conversation.count({ where: { status: { in: ["HANDOFF_REQUESTED", "HUMAN_ACTIVE"] }, updatedAt: { gte: since } } }),
      db.webhookDelivery.count({ where: { status: "FAILED", createdAt: { gte: since } } }),
      db.ingestionJob.count({ where: { status: { in: ["PENDING", "PROCESSING"] } } }),
      db.message.aggregate({ where: { role: "ASSISTANT", createdAt: { gte: since } }, _sum: { inputTokens: true, outputTokens: true, estimatedCostUsd: true } }),
      db.message.groupBy({ by: ["provider", "model"], where: { role: "ASSISTANT", provider: { not: null }, createdAt: { gte: since } }, _count: true, _sum: { inputTokens: true, outputTokens: true, estimatedCostUsd: true } }),
      db.privacyRequest.count({ where: { status: { in: ["OPEN", "VERIFYING", "PROCESSING"] } } }),
    ]);

    const verifiedBotIds = new Set(embedEvents.map((event) => event.botId).filter(Boolean));
    const verifiedOrigins = new Set(embedEvents.map((event) => event.origin).filter(Boolean));
    const activatedWorkspaces = workspaces.filter((workspace) =>
      workspace.bots.some((bot) => bot._count.knowledgeSources > 0 && bot._count.conversations > 0)
    ).length;

    return NextResponse.json({
      period: { days, since: since.toISOString() },
      actor: { role: actor.platformRole, name: actor.name || actor.username || actor.email },
      metrics: { totalUsers, newUsers, totalWorkspaces, newWorkspaces, totalBots, newBots, activeBots, completedSources, newCompletedSources, conversations, messages, refusedMessages, leads, toolExecutions, toolFailures, ingestionFailures, securityEvents, activatedWorkspaces, verifiedInstalls: verifiedBotIds.size, verifiedOrigins: verifiedOrigins.size, widgetOpens, handoffs, webhookFailures, queueDepth, openPrivacyRequests, inputTokens: usage._sum.inputTokens || 0, outputTokens: usage._sum.outputTokens || 0, estimatedCostUsd: Number(usage._sum.estimatedCostUsd || 0), providerUsage: providerUsage.map((item) => ({ provider: item.provider, model: item.model, replies: item._count, estimatedCostUsd: Number(item._sum.estimatedCostUsd || 0) })) },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Platform access is required";
    return NextResponse.json({ error: message }, { status: message.includes("required") ? 403 : 500 });
  }
}
