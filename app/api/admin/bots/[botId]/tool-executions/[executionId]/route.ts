import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/jwt";
import { db } from "@/lib/db/client";
import { approveToolExecution, rejectToolExecution } from "@/lib/agents/tool-runner";
import { writeAuditEvent } from "@/lib/security/audit";
import { canAccessBot } from "@/lib/auth/workspace-access";

const actionSchema = z.object({ action: z.enum(["approve", "reject"]) });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string; executionId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId, executionId } = await params;
  if (!await canAccessBot(botId, session.userId, "tool:write")) return NextResponse.json({ error: "Tool action not found" }, { status: 404 });

  const execution = await db.toolExecution.findFirst({
    where: { id: executionId, tool: { botId } },
    include: { tool: { select: { bot: { select: { workspaceId: true } } } } },
  });
  if (!execution) return NextResponse.json({ error: "Tool action not found" }, { status: 404 });
  if (execution.status !== "PENDING_APPROVAL") {
    return NextResponse.json({ error: "This tool action has already been resolved" }, { status: 409 });
  }

  try {
    const { action } = actionSchema.parse(await req.json());
    if (action === "reject") {
      await rejectToolExecution(executionId);
      await writeAuditEvent({
        type: "tool.approval.rejected",
        actorId: session.userId,
        workspaceId: execution.tool.bot.workspaceId,
        targetType: "toolExecution",
        targetId: executionId,
        ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      });
      return NextResponse.json({ success: true, status: "REJECTED" });
    }

    const result = await approveToolExecution(executionId);
    await writeAuditEvent({
      type: "tool.approval.approved",
      actorId: session.userId,
      workspaceId: execution.tool.bot.workspaceId,
      targetType: "toolExecution",
      targetId: executionId,
      metadata: { status: result.status, latencyMs: result.latencyMs },
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    });
    return NextResponse.json({ success: true, status: result.status, result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid action" }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not resolve tool action" },
      { status: 422 }
    );
  }
}
