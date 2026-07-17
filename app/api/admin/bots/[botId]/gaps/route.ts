import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/jwt";
import { db } from "@/lib/db/client";
import { canAccessBot } from "@/lib/auth/workspace-access";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId } = await params;
  if (!await canAccessBot(botId, session.userId, "analytics:read")) return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  const [gaps, sources] = await Promise.all([
    db.knowledgeGap.findMany({ where: { botId }, orderBy: [{ status: "asc" }, { occurrences: "desc" }, { lastSeenAt: "desc" }], take: 100, include: { resolvedSource: { select: { id: true, name: true } } } }),
    db.knowledgeSource.findMany({ where: { botId, status: "COMPLETED", reviewStatus: "APPROVED" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return NextResponse.json({ gaps, sources });
}

const updateSchema = z.object({ gapId: z.string(), status: z.enum(["OPEN", "RESOLVED", "DISMISSED"]), resolvedSourceId: z.string().optional().nullable() });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId } = await params;
  if (!await canAccessBot(botId, session.userId, "knowledge:write")) return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  try {
    const data = updateSchema.parse(await req.json());
    const updated = await db.knowledgeGap.updateMany({ where: { id: data.gapId, botId }, data: { status: data.status, resolvedSourceId: data.resolvedSourceId, resolvedAt: data.status === "RESOLVED" ? new Date() : null } });
    if (!updated.count) return NextResponse.json({ error: "Knowledge gap not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Invalid gap update" }, { status: 400 });
    return NextResponse.json({ error: "Gap update failed" }, { status: 500 });
  }
}
