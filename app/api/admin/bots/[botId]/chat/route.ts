import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/jwt";
import { db } from "@/lib/db/client";
import { chatWithBot } from "@/lib/rag/chat";

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  conversationId: z.string().optional(),
  includeSources: z.boolean().optional().default(true),
});

export async function POST(
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
    const { message, conversationId, includeSources } = chatSchema.parse(body);

    let conversation;
    if (conversationId) {
      conversation = await db.conversation.findFirst({
        where: { id: conversationId, botId },
        include: { messages: { orderBy: { createdAt: "asc" }, take: 12 } },
      });
    }

    if (!conversation) {
      conversation = await db.conversation.create({
        data: { botId },
        include: { messages: true },
      });
    }

    const history = conversation.messages.map((m) => ({
      role: m.role.toLowerCase() as "user" | "assistant",
      content: m.content,
    }));

    await db.message.create({
      data: { conversationId: conversation.id, role: "USER", content: message },
    });

    const result = await chatWithBot(botId, message, history);

    await db.message.create({
      data: {
        conversationId: conversation.id,
        role: "ASSISTANT",
        content: result.answer,
        isGrounded: result.isGrounded,
        isRefused: result.isRefused,
        sourceChunkIds: result.sources.map((s) => s.id),
      },
    });

    return NextResponse.json({
      answer: result.answer,
      conversationId: conversation.id,
      isGrounded: result.isGrounded,
      isRefused: result.isRefused,
      sources: includeSources ? result.sources : undefined,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || err.message }, { status: 400 });
    }
    console.error("Chat error:", err);
    const message = err instanceof Error ? err.message : "Chat failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
