import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/jwt";
import { db } from "@/lib/db/client";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId } = await params;

  const bot = await db.bot.findFirst({
    where: { id: botId, workspace: { ownerId: session.userId } },
  });
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });

  const executions = await db.toolExecution.findMany({
    where: { tool: { botId } },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { tool: { select: { name: true } } },
  });

  return NextResponse.json({
    executions: executions.map((e) => ({
      id: e.id,
      toolName: e.tool.name,
      input: e.input,
      output: e.output,
      errorMessage: e.errorMessage,
      status: e.status,
      latencyMs: e.latencyMs,
      conversationId: e.conversationId,
      createdAt: e.createdAt,
    })),
  });
}
