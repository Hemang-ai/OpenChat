import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";
import { recordKnowledgeGap } from "@/lib/rag/knowledge-gaps";

const schema = z.object({ publicKey: z.string().min(1), messageId: z.string().min(1), rating: z.enum(["POSITIVE", "NEGATIVE"]), comment: z.string().max(1000).optional() });

export async function POST(req: NextRequest) {
  try {
    const data = schema.parse(await req.json());
    const limit = await rateLimit({ key: `${data.publicKey}:${getClientIp(req)}`, namespace: "public-feedback", limit: 20, windowSeconds: 60 });
    const headers = rateLimitHeaders(limit);
    if (!limit.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers });
    const message = await db.message.findFirst({ where: { id: data.messageId, role: "ASSISTANT", conversation: { bot: { publicKey: data.publicKey, isActive: true } } }, include: { conversation: { include: { messages: { where: { role: "USER" }, orderBy: { createdAt: "desc" }, take: 1 } } } } });
    if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404, headers });
    await db.messageFeedback.upsert({ where: { messageId: message.id }, create: { messageId: message.id, rating: data.rating, comment: data.comment }, update: { rating: data.rating, comment: data.comment } });
    if (data.rating === "NEGATIVE") {
      const question = message.conversation.messages[0]?.content;
      if (question) await recordKnowledgeGap(message.conversation.botId, question);
    }
    return NextResponse.json({ success: true }, { status: 201, headers });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Invalid feedback" }, { status: 400 });
    return NextResponse.json({ error: "Feedback could not be saved" }, { status: 500 });
  }
}
