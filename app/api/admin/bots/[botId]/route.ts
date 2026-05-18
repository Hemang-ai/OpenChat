import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/jwt";
import { db } from "@/lib/db/client";

async function getBotForUser(botId: string, userId: string) {
  return db.bot.findFirst({
    where: { id: botId, workspace: { ownerId: userId } },
    include: {
      workspace: { select: { id: true, name: true } },
      knowledgeSources: {
        orderBy: { createdAt: "desc" },
        select: { id: true, type: true, name: true, status: true, createdAt: true, errorMessage: true, metadata: true },
      },
    },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId } = await params;
  const bot = await getBotForUser(botId, session.userId);
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  return NextResponse.json({ bot });
}

const updateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  welcomeMessage: z.string().max(500).optional(),
  systemPrompt: z.string().max(4000).optional(),
  businessContext: z.string().max(2000).optional(),
  tone: z.enum(["professional", "friendly", "concise", "detailed"]).optional(),
  strictness: z.enum(["strict", "balanced", "flexible", "moderate"]).optional(),
  fallbackBehavior: z.enum(["contact", "general_knowledge", "ask_clarify"]).optional(),
  contactInfo: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId } = await params;

  const bot = await db.bot.findFirst({
    where: { id: botId, workspace: { ownerId: session.userId } },
  });
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });

  try {
    const body = await req.json();
    const data = updateSchema.parse(body);
    const updated = await db.bot.update({ where: { id: botId }, data });
    return NextResponse.json({ bot: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(
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

  await db.bot.delete({ where: { id: botId } });
  return NextResponse.json({ success: true });
}
