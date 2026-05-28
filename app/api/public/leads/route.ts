import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";

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
});

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 5 * 60 * 1000;

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
    const data = leadSchema.parse(body);

    const rateLimitKey = `${data.publicKey}:${ip}:lead`;
    if (!checkRateLimit(rateLimitKey)) {
      return NextResponse.json(
        { error: "Too many lead submissions. Please wait a moment." },
        { status: 429 }
      );
    }

    const bot = await db.bot.findUnique({
      where: { publicKey: data.publicKey },
      select: { id: true, isActive: true, leadCaptureEnabled: true },
    });

    if (!bot || !bot.isActive || !bot.leadCaptureEnabled) {
      return NextResponse.json({ error: "Lead capture is not available" }, { status: 404 });
    }

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

    return NextResponse.json({ lead });
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
