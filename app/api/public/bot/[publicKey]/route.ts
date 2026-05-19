import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { getSuggestedQuestions } from "@/lib/rag/suggested-questions";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ publicKey: string }> }
) {
  const { publicKey } = await params;

  const bot = await db.bot.findUnique({
    where: { publicKey },
    select: {
      id: true,
      name: true,
      welcomeMessage: true,
      isActive: true,
      tone: true,
    },
  });

  if (!bot || !bot.isActive) {
    return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  }

  let suggestedQuestions: string[] = [];
  try {
    suggestedQuestions = await getSuggestedQuestions(bot.id);
  } catch (err) {
    console.error("Failed to load suggested questions:", err);
  }

  return NextResponse.json({
    bot: {
      name: bot.name,
      welcomeMessage: bot.welcomeMessage,
      isActive: bot.isActive,
      tone: bot.tone,
      suggestedQuestions,
    },
  });
}
