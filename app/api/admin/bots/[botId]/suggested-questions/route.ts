import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/jwt";
import { db } from "@/lib/db/client";
import {
  generateSuggestedQuestions,
  getSuggestedQuestions,
} from "@/lib/rag/suggested-questions";

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
  if (!bot) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const questions = await getSuggestedQuestions(botId);
    return NextResponse.json({ questions });
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

  const bot = await db.bot.findFirst({
    where: { id: botId, workspace: { ownerId: session.userId } },
  });
  if (!bot) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const questions = await generateSuggestedQuestions(botId);
    return NextResponse.json({ questions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
