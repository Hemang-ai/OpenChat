import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/jwt";
import { db } from "@/lib/db/client";
import { getWorkspaceAccess, hasWorkspacePermission } from "@/lib/auth/workspace-access";

const createBotSchema = z.object({
  workspaceId: z.string().cuid(),
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  welcomeMessage: z.string().max(500).optional(),
  businessContext: z.string().max(2000).optional(),
  tone: z.enum(["professional", "friendly", "concise", "detailed"]).optional(),
  industryTemplate: z.enum(["support", "product_discovery", "lead_qualification", "service_booking"]).optional(),
});

const templateDefaults = {
  support: { tone: "friendly", strictness: "balanced", leadCaptureEnabled: false, welcomeMessage: "Hi! I’m the AI support assistant. How can I help?" },
  product_discovery: { tone: "friendly", strictness: "balanced", leadCaptureEnabled: true, welcomeMessage: "Hi! I can help you find the right product or service." },
  lead_qualification: { tone: "concise", strictness: "balanced", leadCaptureEnabled: true, welcomeMessage: "Hi! Tell me what you’re looking for and I’ll help with the next step." },
  service_booking: { tone: "professional", strictness: "balanced", leadCaptureEnabled: true, welcomeMessage: "Hi! I can answer service questions and help you prepare to book." },
} as const;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const data = createBotSchema.parse(body);

    const access = await getWorkspaceAccess(data.workspaceId, session.userId);
    if (!access || !hasWorkspacePermission(access.role, "bot:write")) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const template = data.industryTemplate ? templateDefaults[data.industryTemplate] : templateDefaults.support;
    const config = {
      name: data.name,
      description: data.description || null,
      welcomeMessage: data.welcomeMessage || template.welcomeMessage,
      systemPrompt: null,
      businessContext: data.businessContext || null,
      tone: data.tone || template.tone,
      strictness: template.strictness,
      fallbackBehavior: "contact",
      contactInfo: null,
      leadCaptureEnabled: template.leadCaptureEnabled,
      leadCapturePrompt: "Want us to follow up? Leave your details and our team will reach out.",
      isActive: true,
      allowedOrigins: [],
      privacyNotice: "Messages may be processed by AI to answer your questions. Do not share sensitive information.",
      industryTemplate: data.industryTemplate || "support",
    };
    const bot = await db.bot.create({
      data: {
        name: config.name,
        description: config.description,
        welcomeMessage: config.welcomeMessage,
        businessContext: config.businessContext,
        tone: config.tone,
        strictness: config.strictness,
        leadCaptureEnabled: config.leadCaptureEnabled,
        industryTemplate: config.industryTemplate,
        isActive: false,
        draftConfig: config,
        workspaceId: data.workspaceId,
      },
    });

    return NextResponse.json({ bot }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create bot" }, { status: 500 });
  }
}
