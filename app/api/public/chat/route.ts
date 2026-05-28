import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { agenticChat } from "@/lib/agents/agent-chat";
import {
  getClientIp,
  getPublicChatRateLimitConfig,
  rateLimit,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";

const chatSchema = z.object({
  publicKey: z.string().min(1),
  message: z.string().min(1).max(2000),
  sessionId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  try {
    const body = await req.json();
    const { publicKey, message, sessionId } = chatSchema.parse(body);

    const limitConfig = getPublicChatRateLimitConfig();

    const limitResult = await rateLimit({
      key: `${publicKey}:${ip}`,
      namespace: "public-chat",
      limit: limitConfig.limit,
      windowSeconds: limitConfig.windowSeconds,
    });

    const limitHeaders = rateLimitHeaders(limitResult);

    if (!limitResult.allowed) {
      return NextResponse.json(
        {
          error: "Too many requests. Please slow down.",
          retryAfterSeconds: limitResult.retryAfterSeconds,
        },
        {
          status: 429,
          headers: limitHeaders,
        }
      );
    }

    const bot = await db.bot.findUnique({
      where: { publicKey },
      select: { id: true, name: true, welcomeMessage: true, isActive: true },
    });

    if (!bot || !bot.isActive) {
      return NextResponse.json(
        { error: "Chatbot not found or inactive" },
        {
          status: 404,
          headers: limitHeaders,
        }
      );
    }

    let conversation;
    if (sessionId) {
      conversation = await db.conversation.findFirst({
        where: { sessionId, botId: bot.id },
        include: { messages: { orderBy: { createdAt: "asc" }, take: 12 } },
      });
    }

    if (!conversation) {
      conversation = await db.conversation.create({
        data: {
          botId: bot.id,
          userAgent: req.headers.get("user-agent") || undefined,
          ipAddress: ip,
        },
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

    const result = await agenticChat(bot.id, message, conversation.id, history);

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

    return NextResponse.json(
      {
        answer: result.answer,
        sessionId: conversation.sessionId,
      },
      {
        headers: limitHeaders,
      }
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message || err.message },
        { status: 400 }
      );
    }

    console.error("Public chat error:", err);
    return NextResponse.json(
      { error: "Chat service unavailable" },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
