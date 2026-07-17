import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/jwt";
import { db } from "@/lib/db/client";
import { encryptSecret } from "@/lib/security/secrets";
import { writeAuditEvent } from "@/lib/security/audit";
import { canAccessBot } from "@/lib/auth/workspace-access";

const policySchema = z.object({
  handoffPolicy: z.object({
    explicitRequest: z.boolean(), lowEvidence: z.boolean(), repeatedRefusal: z.boolean(),
    toolFailure: z.boolean(), negativeSentiment: z.boolean(), refusalThreshold: z.number().int().min(1).max(5),
  }),
  businessHours: z.object({
    timezone: z.string().min(1).max(100),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7),
    start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/),
  }),
  fallbackContactMethod: z.string().max(300).nullable(),
  defaultSlaMinutes: z.number().int().min(5).max(43200),
});

const webhookSchema = z.object({
  name: z.string().min(2).max(100), url: z.string().url().max(1000),
  events: z.array(z.enum(["conversation.handoff_requested", "conversation.resolved", "lead.created", "tool.failed"])).min(1),
});
const webhookActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("replay"), deliveryId: z.string().cuid() }),
  z.object({ action: z.literal("rotate"), endpointId: z.string().cuid() }),
  z.object({ action: z.literal("toggle"), endpointId: z.string().cuid(), isActive: z.boolean() }),
]);

async function ownedBot(botId: string, userId: string) {
  return await canAccessBot(botId, userId, "conversation:write") ? db.bot.findUnique({ where: { id: botId }, select: { id: true, workspaceId: true, handoffPolicy: true, businessHours: true, fallbackContactMethod: true, defaultSlaMinutes: true } }) : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId } = await params;
  const bot = await ownedBot(botId, session.userId);
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  const [webhooks, deliveries] = await Promise.all([
    db.webhookEndpoint.findMany({ where: { botId }, select: { id: true, name: true, url: true, events: true, isActive: true, secretVersion: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
    db.webhookDelivery.findMany({ where: { endpoint: { botId } }, select: { id: true, event: true, status: true, attempts: true, responseCode: true, errorMessage: true, createdAt: true, endpoint: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 25 }),
  ]);
  return NextResponse.json({ bot, webhooks, deliveries });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId } = await params;
  const bot = await ownedBot(botId, session.userId);
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  try {
    const data = policySchema.parse(await req.json());
    await db.bot.update({ where: { id: botId }, data: { ...data, handoffPolicy: data.handoffPolicy, businessHours: data.businessHours } });
    await writeAuditEvent({ type: "handoff.policy_updated", actorId: session.userId, workspaceId: bot.workspaceId, targetType: "bot", targetId: botId });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Invalid policy" }, { status: 400 });
    return NextResponse.json({ error: "Policy could not be saved" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId } = await params;
  const bot = await ownedBot(botId, session.userId);
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  try {
    const data = webhookSchema.parse(await req.json());
    const secret = `whsec_${randomBytes(24).toString("base64url")}`;
    const endpoint = await db.webhookEndpoint.create({ data: { ...data, botId, workspaceId: bot.workspaceId, secretEncrypted: encryptSecret(secret) } });
    await writeAuditEvent({ type: "webhook.created", actorId: session.userId, workspaceId: bot.workspaceId, targetType: "webhookEndpoint", targetId: endpoint.id });
    return NextResponse.json({ endpoint: { id: endpoint.id, name: endpoint.name, url: endpoint.url, events: endpoint.events }, signingSecret: secret }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Invalid webhook" }, { status: 400 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Webhook could not be created" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  const session = await getSession(); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId } = await params; const bot = await ownedBot(botId, session.userId); if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  try {
    const data = webhookActionSchema.parse(await req.json()); let result: Record<string, unknown> = { success: true };
    if (data.action === "replay") {
      const delivery = await db.webhookDelivery.findFirst({ where: { id: data.deliveryId, endpoint: { botId } } });
      if (!delivery) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
      await db.webhookDelivery.update({ where: { id: delivery.id }, data: { status: "PENDING", attempts: 0, runAfter: new Date(), errorMessage: null } });
    } else if (data.action === "rotate") {
      const secret = `whsec_${randomBytes(24).toString("base64url")}`;
      const endpoint = await db.webhookEndpoint.updateMany({ where: { id: data.endpointId, botId }, data: { secretEncrypted: encryptSecret(secret), secretVersion: { increment: 1 } } });
      if (!endpoint.count) return NextResponse.json({ error: "Endpoint not found" }, { status: 404 }); result = { success: true, signingSecret: secret };
    } else {
      const endpoint = await db.webhookEndpoint.updateMany({ where: { id: data.endpointId, botId }, data: { isActive: data.isActive } });
      if (!endpoint.count) return NextResponse.json({ error: "Endpoint not found" }, { status: 404 });
    }
    await writeAuditEvent({ type: `webhook.${data.action}`, actorId: session.userId, workspaceId: bot.workspaceId, targetType: "bot", targetId: botId });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Invalid webhook action" }, { status: 400 });
    return NextResponse.json({ error: "Webhook action failed" }, { status: 500 });
  }
}
