import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/jwt";
import { db } from "@/lib/db/client";

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
  return db.tool.findFirst({
    where: { id: toolId, botId, bot: { workspace: { ownerId: userId } } },
  });
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
  return NextResponse.json({ tool });
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
    const updateData: Record<string, unknown> = { ...data };
    if (data.inputSchema !== undefined) updateData.inputSchema = data.inputSchema as object;
    if (data.headers === null) updateData.headers = { set: null };
    else if (data.headers !== undefined) updateData.headers = data.headers as object;
    const updated = await db.tool.update({
      where: { id: toolId },
      data: updateData,
    });
    return NextResponse.json({ tool: updated });
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
  return NextResponse.json({ success: true });
}
