import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/jwt";
import { db } from "@/lib/db/client";

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
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });

  const [totalConversations, messages, refusedMessages, recentConversations] =
    await Promise.all([
      db.conversation.count({ where: { botId } }),
      db.message.findMany({
        where: { conversation: { botId }, role: "USER" },
        select: { content: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      db.message.count({
        where: { conversation: { botId }, role: "ASSISTANT", isRefused: true },
      }),
      db.conversation.findMany({
        where: { botId },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            take: 2,
            select: { role: true, content: true, createdAt: true },
          },
        },
      }),
    ]);

  const totalMessages = messages.length;
  const topQuestions = messages
    .slice(0, 20)
    .map((m) => m.content.slice(0, 100));

  return NextResponse.json({
    totalConversations,
    totalMessages,
    refusedMessages,
    topQuestions,
    recentConversations,
  });
}
