import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/jwt";
import { db } from "@/lib/db/client";
import { encryptSecret } from "@/lib/security/secrets";
import { writeAuditEvent } from "@/lib/security/audit";
import { canAccessBot } from "@/lib/auth/workspace-access";

const updateSchema = z.object({
  name: z.string().min(2).max(60).regex(/^[a-z_][a-z0-9_]*$/).optional(),
  description: z.string().min(8).max(500).optional(),
  inputSchema: z.record(z.string(), z.unknown()).optional(),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).optional(),
  endpoint: z.string().url().optional().nullable(),
  headers: z.record(z.string(), z.string()).optional().nullable(),
  approvalMode: z.enum(["AUTO", "REQUIRE_CONFIRM"]).optional(),
  isActive: z.boolean().optional(),
});

async function authorizedTool(botId: string, toolId: string, userId: string) {
  if (!await canAccessBot(botId, userId, "tool:write")) return null;
  return db.tool.findFirst({
    where: { id: toolId, botId },
    include: { bot: { select: { workspaceId: true } } },
  });
}

function isSafeToolEndpoint(endpoint: string | null | undefined): boolean {
  if (!endpoint) return true;
  try {
    const normalized = endpoint.replace(/\{[^}]+\}/g, "placeholder");
    const url = new URL(normalized);
    const rawHost = endpoint.slice(endpoint.indexOf("://") + 3).split(/[/?#]/)[0] || "";
    return (url.protocol === "https:" || url.protocol === "http:") && !rawHost.includes("{");
  } catch {
    return false;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ botId: string; toolId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId, toolId } = await params;
  const tool = await authorizedTool(botId, toolId, session.userId);
  if (!tool) return NextResponse.json({ error: "Tool not found" }, { status: 404 });
  const { headers: _headers, headersEncrypted: _headersEncrypted, ...safeTool } = tool;
  return NextResponse.json({ tool: { ...safeTool, headersSet: Boolean(_headers || _headersEncrypted) } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string; toolId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId, toolId } = await params;
  const tool = await authorizedTool(botId, toolId, session.userId);
  if (!tool) return NextResponse.json({ error: "Tool not found" }, { status: 404 });

  try {
    const data = updateSchema.parse(await req.json());
    if (data.endpoint !== undefined && !isSafeToolEndpoint(data.endpoint)) {
      return NextResponse.json({ error: "Tool endpoints must use a fixed HTTP(S) hostname." }, { status: 400 });
    }
    const updateData: Record<string, unknown> = { ...data };
    if (data.inputSchema !== undefined) updateData.inputSchema = data.inputSchema as object;
    if (data.headers === null) {
      updateData.headers = null;
      updateData.headersEncrypted = null;
    } else if (data.headers !== undefined) {
      updateData.headers = null;
      updateData.headersEncrypted = encryptSecret(JSON.stringify(data.headers));
    }
    const updated = await db.tool.update({
      where: { id: toolId },
      data: updateData,
    });
    await writeAuditEvent({
      type: "tool.updated",
      actorId: session.userId,
      workspaceId: tool.bot.workspaceId,
      targetType: "tool",
      targetId: updated.id,
      metadata: { botId, updatedFields: Object.keys(updateData).filter((key) => !key.toLowerCase().includes("header")) },
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    });
    const { headers: _headers, headersEncrypted: _headersEncrypted, ...safeTool } = updated;
    return NextResponse.json({ tool: { ...safeTool, headersSet: Boolean(_headers || _headersEncrypted) } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ botId: string; toolId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId, toolId } = await params;
  const tool = await authorizedTool(botId, toolId, session.userId);
  if (!tool) return NextResponse.json({ error: "Tool not found" }, { status: 404 });

  await db.tool.delete({ where: { id: toolId } });
  await writeAuditEvent({
    type: "tool.deleted",
    actorId: session.userId,
    workspaceId: tool.bot.workspaceId,
    targetType: "tool",
    targetId: toolId,
    metadata: { botId },
    ip: _req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });
  return NextResponse.json({ success: true });
}
