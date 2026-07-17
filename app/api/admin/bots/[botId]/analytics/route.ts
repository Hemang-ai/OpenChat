import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/jwt";
import { db } from "@/lib/db/client";
import { writeAuditEvent } from "@/lib/security/audit";
import { canAccessBot } from "@/lib/auth/workspace-access";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId } = await params;
  if (!await canAccessBot(botId, session.userId, "analytics:read")) return NextResponse.json({ error: "Bot not found" }, { status: 404 });

  const bot = await db.bot.findUnique({ where: { id: botId } });
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });

  const [totalConversations, totalMessages, messages, assistantMessages, groundedMessages, refusedMessages, totalLeads, newLeads, positiveFeedback, negativeFeedback, openGaps, qualityAverages, recentConversations, handoffs, resolved, actionStats, usage, providerBreakdown] =
    await Promise.all([
      db.conversation.count({ where: { botId } }),
      db.message.count({ where: { conversation: { botId } } }),
      db.message.findMany({
        where: { conversation: { botId }, role: "USER" },
        select: { content: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      db.message.count({ where: { conversation: { botId }, role: "ASSISTANT" } }),
      db.message.count({ where: { conversation: { botId }, role: "ASSISTANT", isGrounded: true, isRefused: false } }),
      db.message.count({
        where: { conversation: { botId }, role: "ASSISTANT", isRefused: true },
      }),
      db.lead.count({ where: { botId } }),
      db.lead.count({ where: { botId, status: "NEW" } }),
      db.messageFeedback.count({ where: { rating: "POSITIVE", message: { conversation: { botId } } } }),
      db.messageFeedback.count({ where: { rating: "NEGATIVE", message: { conversation: { botId } } } }),
      db.knowledgeGap.count({ where: { botId, status: "OPEN" } }),
      db.message.aggregate({ where: { conversation: { botId }, role: "ASSISTANT" }, _avg: { evidenceScore: true, latencyMs: true } }),
      db.conversation.findMany({
        where: { botId },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            take: 2,
            select: { role: true, content: true, createdAt: true },
          },
        },
      }),
      db.conversation.count({ where: { botId, status: { in: ["HANDOFF_REQUESTED", "HUMAN_ACTIVE"] } } }),
      db.conversation.count({ where: { botId, status: "RESOLVED" } }),
      db.toolExecution.groupBy({ by: ["status"], where: { tool: { botId }, isTest: false }, _count: true }),
      db.message.aggregate({ where: { conversation: { botId }, role: "ASSISTANT" }, _sum: { inputTokens: true, outputTokens: true, estimatedCostUsd: true } }),
      db.message.groupBy({ by: ["provider", "model"], where: { conversation: { botId }, role: "ASSISTANT", provider: { not: null } }, _count: true, _sum: { inputTokens: true, outputTokens: true, estimatedCostUsd: true } }),
    ]);

  const topQuestions = messages
    .slice(0, 20)
    .map((m) => m.content.slice(0, 100));

  const responseBody = {
    totalConversations,
    totalMessages,
    refusedMessages,
    assistantMessages,
    groundedMessages,
    evidenceCoverage: assistantMessages ? Math.round((groundedMessages / assistantMessages) * 100) : 0,
    averageEvidenceScore: qualityAverages._avg.evidenceScore ? Math.round(qualityAverages._avg.evidenceScore * 100) : 0,
    averageLatencyMs: Math.round(qualityAverages._avg.latencyMs || 0),
    positiveFeedback,
    negativeFeedback,
    feedbackSatisfaction: positiveFeedback + negativeFeedback ? Math.round((positiveFeedback / (positiveFeedback + negativeFeedback)) * 100) : 0,
    openGaps,
    totalLeads,
    newLeads,
    topQuestions,
    recentConversations,
    handoffs,
    resolved,
    containmentRate: totalConversations ? Math.round(((totalConversations - handoffs) / totalConversations) * 100) : 0,
    resolutionRate: totalConversations ? Math.round((resolved / totalConversations) * 100) : 0,
    actionSuccess: actionStats.find((item) => item.status === "SUCCESS")?._count || 0,
    actionFailure: actionStats.find((item) => item.status === "ERROR")?._count || 0,
    usage: {
      inputTokens: usage._sum.inputTokens || 0,
      outputTokens: usage._sum.outputTokens || 0,
      estimatedCostUsd: Number(usage._sum.estimatedCostUsd || 0),
      priceCatalogVersion: "2026-07-01",
    },
    providerBreakdown: providerBreakdown.map((item) => ({ ...item, estimatedCostUsd: Number(item._sum.estimatedCostUsd || 0) })),
  };
  if (req.nextUrl.searchParams.get("format") === "csv") {
    const rows = [["metric", "value"], ...Object.entries(responseBody).filter(([, value]) => typeof value === "number").map(([key, value]) => [key, String(value)])];
    const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\n");
    await writeAuditEvent({ type: "analytics.exported", actorId: session.userId, workspaceId: bot.workspaceId, targetType: "bot", targetId: botId, metadata: { format: "csv", records: rows.length - 1 } });
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="bot-${botId}-analytics.csv"` } });
  }
  return NextResponse.json(responseBody);
}
