import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { chatWithBot } from "@/lib/rag/chat";

const chatSchema = z.object({
  publicKey: z.string().min(1),
  message: z.string().min(1).max(2000),
  sessionId: z.string().optional(),
});

// Simple in-memory rate limit (per public key, per IP)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60 * 1000;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";

  try {
    const body = await req.json();
    const { publicKey, message, sessionId } = chatSchema.parse(body);

    const rateLimitKey = `${publicKey}:${ip}`;
    if (!checkRateLimit(rateLimitKey)) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        { status: 429 }
      );
    }

    const bot = await db.bot.findUnique({
      where: { publicKey },
      select: { id: true, name: true, welcomeMessage: true, isActive: true },
    });

    if (!bot || !bot.isActive) {
      return NextResponse.json({ error: "Chatbot not found or inactive" }, { status: 404 });
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

    const result = await chatWithBot(bot.id, message, history);

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
      sessionId: conversation.sessionId,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || err.message }, { status: 400 });
    }
    console.error("Public chat error:", err);
    return NextResponse.json({ error: "Chat service unavailable" }, { status: 500 });
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
