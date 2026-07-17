import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { getClientIp, getPublicChatRateLimitConfig, rateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";
import { writeAuditEvent } from "@/lib/security/audit";
import { isOriginAllowed } from "@/lib/bots/origin-policy";
import { queueWebhookEvent } from "@/lib/integrations/webhooks";
import { isProductionVersionApproved } from "@/lib/bots/production-policy";
import { resolvePublicBotKey } from "@/lib/bots/public-key";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || undefined);

const leadSchema = z.object({
  publicKey: z.string().min(1),
  sessionId: z.string().optional(),
  name: optionalText(100),
  email: z.string().trim().email().max(255),
  phone: optionalText(50),
  company: optionalText(120),
  message: optionalText(1000),
  origin: z.string().url().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  try {
    const body = await req.json();
    const data = leadSchema.parse(body);

    const config = getPublicChatRateLimitConfig();
    const limit = await rateLimit({
      key: `${data.publicKey}:${ip}:lead`,
      namespace: "public-leads",
      limit: Math.min(config.limit, 5),
      windowSeconds: Math.max(config.windowSeconds, 300),
    });
    const headers = rateLimitHeaders(limit);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many lead submissions. Please wait a moment." },
        { status: 429, headers }
      );
    }

    const resolved = await resolvePublicBotKey(data.publicKey);
    const bot = resolved?.bot;

    if (!bot || !bot.isActive || bot.publishedVersion < 1 || !bot.leadCaptureEnabled) {
      return NextResponse.json({ error: "Lead capture is not available" }, { status: 404 });
    }
    if (!resolved.environment && !(await isProductionVersionApproved(bot.id, bot.publishedVersion))) return NextResponse.json({ error: "Lead capture is awaiting production approval" }, { status: 503 });
    if (!isOriginAllowed(bot.allowedOrigins, data.origin)) return NextResponse.json({ error: "Lead capture is not approved for this website" }, { status: 403 });

    const conversation = data.sessionId
      ? await db.conversation.findFirst({
          where: { sessionId: data.sessionId, botId: bot.id },
          select: { id: true },
        })
      : null;

    const existingLead = conversation
      ? await db.lead.findFirst({
          where: { botId: bot.id, conversationId: conversation.id, email: data.email },
          select: { id: true },
        })
      : null;

    const leadData = {
      name: data.name,
      email: data.email,
      phone: data.phone,
      company: data.company,
      message: data.message,
    };

    const lead = existingLead
      ? await db.lead.update({
          where: { id: existingLead.id },
          data: { ...leadData, status: "NEW" },
          select: { id: true, status: true },
        })
      : await db.lead.create({
          data: {
            ...leadData,
            botId: bot.id,
            conversationId: conversation?.id,
          },
          select: { id: true, status: true },
        });

    await writeAuditEvent({
      type: "lead.captured",
      targetType: "lead",
      targetId: lead.id,
      metadata: { botId: bot.id, hasConversation: Boolean(conversation) },
      ip,
    });
    await queueWebhookEvent({
      workspaceId: bot.workspaceId,
      botId: bot.id,
      conversationId: conversation?.id,
      event: "lead.created",
      idempotencyKey: `lead:${lead.id}`,
      payload: { leadId: lead.id, ...leadData },
    });
    return NextResponse.json({ lead }, { headers });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || err.message }, { status: 400 });
    }
    console.error("Public lead capture error:", err);
    return NextResponse.json({ error: "Lead capture unavailable" }, { status: 500 });
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
