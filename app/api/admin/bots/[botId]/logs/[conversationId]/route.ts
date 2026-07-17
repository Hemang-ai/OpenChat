import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/jwt";
import { db } from "@/lib/db/client";
import { queueWebhookEvent } from "@/lib/integrations/webhooks";
import { writeAuditEvent } from "@/lib/security/audit";
import { canAccessBot } from "@/lib/auth/workspace-access";

const updateSchema = z.object({
  status: z.enum(["AI_ACTIVE", "HANDOFF_REQUESTED", "HUMAN_ACTIVE", "RESOLVED"]).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  assignedToLabel: z.string().trim().max(120).nullable().optional(),
});
const noteSchema = z.object({ note: z.string().trim().min(1).max(2000) });

async function ownedConversation(botId: string, conversationId: string, userId: string) {
  return await canAccessBot(botId, userId, "conversation:write") ? db.conversation.findFirst({ where: { id: conversationId, botId }, include: { bot: { select: { workspaceId: true } } } }) : null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ botId: string; conversationId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId, conversationId } = await params;
  const conversation = await ownedConversation(botId, conversationId, session.userId);
  if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  try {
    const data = updateSchema.parse(await req.json());
    const updated = await db.conversation.update({
      where: { id: conversationId },
      data: { ...data, resolvedAt: data.status === "RESOLVED" ? new Date() : data.status ? null : undefined },
    });
    await writeAuditEvent({ type: "conversation.workflow_updated", actorId: session.userId, workspaceId: conversation.bot.workspaceId, targetType: "conversation", targetId: conversationId, metadata: data });
    if (data.status === "RESOLVED") await queueWebhookEvent({ workspaceId: conversation.bot.workspaceId, botId, conversationId, event: "conversation.resolved", idempotencyKey: `resolved:${conversationId}:${updated.updatedAt.toISOString()}`, payload: { conversationId, status: updated.status, resolvedAt: updated.resolvedAt?.toISOString() || null } });
    return NextResponse.json({ conversation: updated });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Invalid update" }, { status: 400 });
    return NextResponse.json({ error: "Conversation could not be updated" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ botId: string; conversationId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId, conversationId } = await params;
  const conversation = await ownedConversation(botId, conversationId, session.userId);
  if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  try {
    const { note } = noteSchema.parse(await req.json());
    const created = await db.conversationNote.create({ data: { conversationId, authorId: session.userId, body: note }, include: { author: { select: { name: true, email: true } } } });
    await writeAuditEvent({ type: "conversation.note_added", actorId: session.userId, workspaceId: conversation.bot.workspaceId, targetType: "conversation", targetId: conversationId });
    return NextResponse.json({ note: created }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Invalid note" }, { status: 400 });
    return NextResponse.json({ error: "Note could not be added" }, { status: 500 });
  }
}
