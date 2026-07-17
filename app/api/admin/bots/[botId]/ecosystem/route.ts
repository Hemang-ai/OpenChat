import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/jwt";
import { db } from "@/lib/db/client";
import { encryptSecret } from "@/lib/security/secrets";
import { draftAwareBotConfig, saveBotDraft } from "@/lib/bots/versioning";
import { writeAuditEvent } from "@/lib/security/audit";
import { canAccessBot } from "@/lib/auth/workspace-access";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("locales"), defaultLocale: z.string().min(2).max(10), supportedLocales: z.array(z.string().min(2).max(10)).min(1).max(20) }),
  z.object({ action: z.literal("channel"), channel: z.enum(["API", "EMAIL", "SLACK", "TEAMS", "WHATSAPP"]), name: z.string().min(2).max(100), config: z.record(z.string(), z.unknown()).optional() }),
  z.object({ action: z.literal("save-template"), name: z.string().min(2).max(100), industry: z.string().min(2).max(100), description: z.string().min(8).max(500), isPublic: z.boolean().default(false) }),
  z.object({ action: z.literal("apply-template"), templateId: z.string().cuid() }),
  z.object({ action: z.literal("experiment"), name: z.string().min(2).max(120), controlVersion: z.number().int().min(1), variantVersion: z.number().int().min(1), allocation: z.number().int().min(1).max(99) }),
  z.object({ action: z.literal("experiment-status"), experimentId: z.string().cuid(), status: z.enum(["RUNNING", "PAUSED", "COMPLETED"]) }),
]);

async function ownedBot(botId: string, userId: string) { return await canAccessBot(botId, userId, "bot:write") ? db.bot.findUnique({ where: { id: botId } }) : null; }
export async function GET(_req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  const session = await getSession(); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId } = await params; const bot = await ownedBot(botId, session.userId); if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  const [channels, templates, experiments, plugins, versions] = await Promise.all([
    db.channelConnection.findMany({ where: { botId }, select: { id: true, channel: true, name: true, isActive: true, createdAt: true } }),
    db.botTemplate.findMany({ where: { OR: [{ workspaceId: bot.workspaceId }, { isPublic: true, isReviewed: true }] }, select: { id: true, name: true, industry: true, description: true, locale: true, isPublic: true, isReviewed: true }, orderBy: { createdAt: "desc" } }),
    db.experiment.findMany({ where: { botId }, orderBy: { createdAt: "desc" } }),
    db.pluginManifest.findMany({ where: { reviewStatus: "APPROVED" }, orderBy: { name: "asc" } }),
    db.botVersion.findMany({ where: { botId }, select: { version: true }, orderBy: { version: "desc" } }),
  ]);
  const experimentResults = await Promise.all(experiments.map(async (experiment) => {
    const rows = await Promise.all((["control", "variant"] as const).map(async (variant) => {
      const where = { botId, experimentId: experiment.id, experimentVariant: variant };
      const [conversations, replies, refusals, positive, negative] = await Promise.all([
        db.conversation.count({ where }), db.message.count({ where: { conversation: where, role: "ASSISTANT" } }),
        db.message.count({ where: { conversation: where, role: "ASSISTANT", isRefused: true } }),
        db.messageFeedback.count({ where: { rating: "POSITIVE", message: { conversation: where } } }),
        db.messageFeedback.count({ where: { rating: "NEGATIVE", message: { conversation: where } } }),
      ]);
      return { variant, conversations, replies, refusalRate: replies ? Math.round(refusals / replies * 100) : 0, csat: positive + negative ? Math.round(positive / (positive + negative) * 100) : null };
    }));
    return { experimentId: experiment.id, variants: rows, minimumSamplesReached: rows.every((row) => row.conversations >= 100) };
  }));
  return NextResponse.json({ bot: { defaultLocale: bot.defaultLocale, supportedLocales: bot.supportedLocales }, channels, templates, experiments, experimentResults, plugins, versions });
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  const session = await getSession(); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId } = await params; const bot = await ownedBot(botId, session.userId); if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  try {
    const data = actionSchema.parse(await req.json()); let result: unknown = { success: true };
    if (data.action === "locales") {
      const supported = Array.from(new Set([data.defaultLocale, ...data.supportedLocales]));
      result = await db.bot.update({ where: { id: botId }, data: { defaultLocale: data.defaultLocale, supportedLocales: supported } });
    } else if (data.action === "channel") {
      result = await db.channelConnection.create({ data: { botId, workspaceId: bot.workspaceId, channel: data.channel, name: data.name, configEncrypted: data.config ? encryptSecret(JSON.stringify(data.config)) : null, isActive: data.channel === "API" } });
    } else if (data.action === "save-template") {
      const config = draftAwareBotConfig(bot); const slug = `${data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;
      result = await db.botTemplate.create({ data: { workspaceId: bot.workspaceId, slug, name: data.name, industry: data.industry, description: data.description, config: config as unknown as object, locale: bot.defaultLocale, isPublic: data.isPublic, isReviewed: false } });
    } else if (data.action === "apply-template") {
      const template = await db.botTemplate.findFirst({ where: { id: data.templateId, OR: [{ workspaceId: bot.workspaceId }, { isPublic: true, isReviewed: true }] } });
      if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });
      result = await saveBotDraft(botId, template.config as object);
    } else if (data.action === "experiment") {
      if (data.controlVersion === data.variantVersion) return NextResponse.json({ error: "Control and variant must use different published versions" }, { status: 400 });
      result = await db.experiment.create({ data: { botId, name: data.name, controlVersion: data.controlVersion, variantVersion: data.variantVersion, allocation: data.allocation, guardrails: { minimumSamples: 100, stopOnRefusalIncreasePercent: 10, stopOnCsatDropPercent: 5 } } });
    } else if (data.action === "experiment-status") {
      if (data.status === "RUNNING") await db.experiment.updateMany({ where: { botId, status: "RUNNING" }, data: { status: "PAUSED" } });
      result = await db.experiment.updateMany({ where: { id: data.experimentId, botId }, data: { status: data.status, startedAt: data.status === "RUNNING" ? new Date() : undefined, endedAt: data.status === "COMPLETED" ? new Date() : undefined } });
    }
    await writeAuditEvent({ type: `ecosystem.${data.action}`, actorId: session.userId, workspaceId: bot.workspaceId, targetType: "bot", targetId: botId });
    return NextResponse.json({ result }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Invalid request" }, { status: 400 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ecosystem action failed" }, { status: 500 });
  }
}
