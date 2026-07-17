import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { getClientIp, rateLimit } from "@/lib/security/rate-limit";
import { isOriginAllowed, normalizeRequestOrigin } from "@/lib/bots/origin-policy";

const schema = z.object({ publicKey: z.string().min(1), type: z.enum(["embed.loaded", "widget.opened", "chat.started"]), sessionId: z.string().max(120).optional(), origin: z.string().url().max(500).optional() });

function requestOrigin(req: NextRequest): string | undefined {
  const candidate = req.headers.get("origin") || req.headers.get("referer");
  if (!candidate) return undefined;
  try { return new URL(candidate).origin; } catch { return undefined; }
}

export async function POST(req: NextRequest) {
  try {
    const data = schema.parse(await req.json());
    const ip = getClientIp(req);
    const limit = await rateLimit({ key: `${data.publicKey}:${ip}`, namespace: "public-events", limit: 60, windowSeconds: 60 });
    if (!limit.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    const bot = await db.bot.findUnique({ where: { publicKey: data.publicKey }, select: { id: true, workspaceId: true, isActive: true, allowedOrigins: true, publishedVersion: true } });
    if (!bot?.isActive) return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    const origin = normalizeRequestOrigin(data.origin) || requestOrigin(req);
    if (bot.publishedVersion < 1 || !isOriginAllowed(bot.allowedOrigins, origin)) return NextResponse.json({ error: "Chatbot is not approved for this website" }, { status: 403 });
    await db.platformEvent.create({
      data: {
        type: data.type,
        botId: bot.id,
        workspaceId: bot.workspaceId,
        origin,
        sessionHash: data.sessionId ? createHash("sha256").update(`${process.env.AUDIT_HASH_SALT || process.env.JWT_SECRET || "obc"}:${data.sessionId}`).digest("hex").slice(0, 40) : undefined,
      },
    });
    return NextResponse.json({ success: true }, { status: 202 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Invalid event" }, { status: 400 });
    return NextResponse.json({ error: "Event could not be recorded" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
}
