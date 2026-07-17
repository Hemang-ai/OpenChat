import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/jwt";
import {
  generateSuggestedQuestions,
  getSuggestedQuestions,
  getVerificationMeta,
} from "@/lib/rag/suggested-questions";
import { db } from "@/lib/db/client";
import { canAccessBot } from "@/lib/auth/workspace-access";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId } = await params;

  if (!await canAccessBot(botId, session.userId, "bot:read")) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const questions = await getSuggestedQuestions(botId);
    const bot = await db.bot.findUnique({ where: { id: botId }, select: { defaultLocale: true } });
    const meta = await getVerificationMeta(botId);
    return NextResponse.json({
      questions,
      verification: meta.byLanguage[bot?.defaultLocale || "en"] || [],
      lastRejected: meta.lastRejected || [],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId } = await params;

  if (!await canAccessBot(botId, session.userId, "bot:write")) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const questions = await generateSuggestedQuestions(botId);
    const bot = await db.bot.findUnique({ where: { id: botId }, select: { defaultLocale: true } });
    const meta = await getVerificationMeta(botId);
    return NextResponse.json({
      questions,
      verification: meta.byLanguage[bot?.defaultLocale || "en"] || [],
      lastRejected: meta.lastRejected || [],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
