import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/jwt";
import { db } from "@/lib/db/client";
import { saveBotDraft } from "@/lib/bots/versioning";
import { writeAuditEvent } from "@/lib/security/audit";
import { canAccessBot } from "@/lib/auth/workspace-access";
import { isSupportedLanguage } from "@/lib/i18n/languages";

async function getBotForUser(botId: string, userId: string) {
  if (!await canAccessBot(botId, userId, "bot:read")) return null;
  return db.bot.findUnique({
    where: { id: botId },
    include: {
      workspace: { select: { id: true, name: true } },
      knowledgeSources: {
        orderBy: { createdAt: "desc" },
        select: { id: true, type: true, name: true, status: true, createdAt: true, errorMessage: true, metadata: true },
      },
    },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId } = await params;
  const bot = await getBotForUser(botId, session.userId);
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  return NextResponse.json({ bot });
}

const updateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  welcomeMessage: z.string().max(500).optional(),
  systemPrompt: z.string().max(4000).optional(),
  businessContext: z.string().max(2000).optional(),
  tone: z.enum(["professional", "friendly", "concise", "detailed"]).optional(),
  strictness: z.enum(["strict", "balanced", "flexible", "moderate"]).optional(),
  fallbackBehavior: z.enum(["contact", "general_knowledge", "ask_clarify"]).optional(),
  contactInfo: z.string().max(500).optional().nullable(),
  leadCaptureEnabled: z.boolean().optional(),
  leadCapturePrompt: z.string().max(240).optional(),
  isActive: z.boolean().optional(),
  allowedOrigins: z.array(z.string().url()).max(25).optional(),
  privacyNotice: z.string().min(20).max(1000).optional(),
  industryTemplate: z.enum(["support", "product_discovery", "lead_qualification", "service_booking"]).optional().nullable(),
  defaultLocale: z
    .string()
    .refine(isSupportedLanguage, { message: "Unsupported language" })
    .optional(),
  supportedLocales: z
    .array(z.string().refine(isSupportedLanguage, { message: "Unsupported language" }))
    .min(1)
    .max(30)
    .optional(),
});

export async function PATCH(
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
    const { defaultLocale, supportedLocales, ...data } = updateSchema.parse(body);

    // Language settings are operational (like publishedSourceIds), not part of
    // the versioned draft config: they apply immediately so the widget's
    // language switcher and localized copy stay consistent for visitors.
    if (defaultLocale || supportedLocales) {
      const nextDefault = defaultLocale ?? bot.defaultLocale;
      const nextSupported = supportedLocales ?? bot.supportedLocales;
      await db.bot.update({
        where: { id: botId },
        data: {
          defaultLocale: nextDefault,
          supportedLocales: nextSupported.includes(nextDefault)
            ? nextSupported
            : [nextDefault, ...nextSupported],
        },
      });
    }

    const updated = await saveBotDraft(botId, data);
    await writeAuditEvent({ type: "bot.draft.updated", actorId: session.userId, workspaceId: bot.workspaceId, targetType: "bot", targetId: botId, metadata: { draftRevision: updated.draftRevision } });
    return NextResponse.json({ bot: updated, draft: updated.draftConfig, draftRevision: updated.draftRevision });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId } = await params;
  if (!await canAccessBot(botId, session.userId, "workspace:manage")) return NextResponse.json({ error: "Bot not found" }, { status: 404 });

  const bot = await db.bot.findUnique({ where: { id: botId } });
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });

  await db.bot.delete({ where: { id: botId } });
  return NextResponse.json({ success: true });
}
