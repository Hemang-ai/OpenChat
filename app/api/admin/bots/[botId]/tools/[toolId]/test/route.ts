import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/jwt";
import { db } from "@/lib/db/client";
import { executeTool } from "@/lib/agents/tool-runner";
import { writeAuditEvent } from "@/lib/security/audit";
import { canAccessBot } from "@/lib/auth/workspace-access";

const schema = z.object({ input: z.record(z.string(), z.unknown()) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ botId: string; toolId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId, toolId } = await params;
  if (!await canAccessBot(botId, session.userId, "tool:write")) return NextResponse.json({ error: "Tool not found" }, { status: 404 });
  const tool = await db.tool.findFirst({
    where: { id: toolId, botId },
    include: { bot: { select: { workspaceId: true } } },
  });
  if (!tool) return NextResponse.json({ error: "Tool not found" }, { status: 404 });

  try {
    const { input } = schema.parse(await req.json());
    const result = await executeTool(
      { ...tool, approvalMode: "AUTO" },
      { id: `test_${randomUUID()}`, name: tool.name, input },
      null,
      { isTest: true, idempotencyKey: `tool-test:${tool.id}:${randomUUID()}` }
    );
    await db.tool.update({
      where: { id: tool.id },
      data: { testedAt: new Date(), testStatus: result.status === "success" ? "PASSED" : "FAILED", testSummary: { status: result.status, latencyMs: result.latencyMs, error: result.errorMessage } },
    });
    await writeAuditEvent({ type: "tool.tested", actorId: session.userId, workspaceId: tool.bot.workspaceId, targetType: "tool", targetId: tool.id, metadata: { status: result.status } });
    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Invalid test input" }, { status: 400 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Tool test failed" }, { status: 500 });
  }
}
