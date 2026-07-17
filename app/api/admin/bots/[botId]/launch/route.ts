import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/jwt";
import { db } from "@/lib/db/client";
import { draftAwareBotConfig, getBotReadiness, publishBot, rollbackBot } from "@/lib/bots/versioning";
import { canAccessBot } from "@/lib/auth/workspace-access";

async function authorizedBot(botId: string, userId: string) {
  return await canAccessBot(botId, userId, "publish:write") ? db.bot.findUnique({ where: { id: botId } }) : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId } = await params;
  const bot = await authorizedBot(botId, session.userId);
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  const [readiness, versions] = await Promise.all([
    getBotReadiness(botId),
    db.botVersion.findMany({ where: { botId }, orderBy: { version: "desc" }, take: 20, select: { id: true, version: true, evaluationSummary: true, rollbackFromVersion: true, createdAt: true } }),
  ]);
  return NextResponse.json({ readiness, versions, draftConfig: draftAwareBotConfig(bot) });
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("publish") }),
  z.object({ action: z.literal("rollback"), version: z.number().int().positive() }),
]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId } = await params;
  const bot = await authorizedBot(botId, session.userId);
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  try {
    const data = actionSchema.parse(await req.json());
    const result = data.action === "publish"
      ? await publishBot(botId, session.userId)
      : await rollbackBot(botId, data.version, session.userId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Invalid launch action" }, { status: 400 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Launch action failed" }, { status: 409 });
  }
}
