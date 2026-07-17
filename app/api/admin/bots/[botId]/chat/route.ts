import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/jwt";
import { db } from "@/lib/db/client";
import { agenticChat } from "@/lib/agents/agent-chat";
import { canAccessBot } from "@/lib/auth/workspace-access";
import { resolveResponseLanguage } from "@/lib/i18n/languages";

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  conversationId: z.string().optional(),
  includeSources: z.boolean().optional().default(true),
  locale: z.string().max(10).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId } = await params;
  if (!await canAccessBot(botId, session.userId, "bot:write")) return NextResponse.json({ error: "Bot not found" }, { status: 404 });

  const bot = await db.bot.findUnique({ where: { id: botId } });
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });

  try {
    const body = await req.json();
    const { message, conversationId, includeSources, locale } = chatSchema.parse(body);
    const responseLocale = resolveResponseLanguage(
      message,
      locale,
      bot.supportedLocales,
      bot.defaultLocale
    );

    let conversation;
    if (conversationId) {
      conversation = await db.conversation.findFirst({
        where: { id: conversationId, botId },
        include: { messages: { orderBy: { createdAt: "asc" }, take: 12 } },
      });
    }

    if (!conversation) {
      conversation = await db.conversation.create({
        data: { botId, locale: responseLocale },
        include: { messages: true },
      });
    }

    if (conversation.locale !== responseLocale) {
      conversation = await db.conversation.update({
        where: { id: conversation.id },
        data: { locale: responseLocale },
        include: { messages: { orderBy: { createdAt: "asc" }, take: 12 } },
      });
    }

    const history = conversation.messages.map((m) => ({
      role: m.role.toLowerCase() as "user" | "assistant",
      content: m.content,
    }));

    await db.message.create({
      data: { conversationId: conversation.id, role: "USER", content: message },
    });

    const startedAt = Date.now();
    const result = await agenticChat(botId, message, conversation.id, history, {
      useDraft: true,
      locale: responseLocale,
    });
    const latencyMs = Date.now() - startedAt;
    const evidenceScore = result.sources.length ? Math.max(...result.sources.map((source) => source.similarity)) : null;

    const assistantMessage = await db.message.create({
      data: {
        conversationId: conversation.id,
        role: "ASSISTANT",
        content: result.answer,
        isGrounded: result.isGrounded,
        isRefused: result.isRefused,
        sourceChunkIds: result.sources.map((s) => s.id),
        evidenceScore,
        latencyMs,
        provider: result.usage?.provider,
        model: result.usage?.model,
        inputTokens: result.usage?.inputTokens,
        outputTokens: result.usage?.outputTokens,
        estimatedCostUsd: result.usage?.estimatedCostUsd,
        retrievalTrace: { sourceCount: result.sources.length, toolCallCount: result.toolCalls.length, priceCatalogVersion: result.usage?.priceCatalogVersion },
      },
    });

    return NextResponse.json({
      answer: result.answer,
      conversationId: conversation.id,
      isGrounded: result.isGrounded,
      isRefused: result.isRefused,
      sources: includeSources ? result.sources : undefined,
      toolCalls: result.toolCalls,
      messageId: assistantMessage.id,
      evidenceScore,
      latencyMs,
      locale: responseLocale,
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
