import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/jwt";
import { db } from "@/lib/db/client";
import { encryptSecret } from "@/lib/security/secrets";
import { writeAuditEvent } from "@/lib/security/audit";
import { canAccessBot } from "@/lib/auth/workspace-access";

const toolSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z_][a-z0-9_]*$/, "Use snake_case (lowercase letters, digits, underscores)"),
  description: z.string().min(8).max(500),
  inputSchema: z.record(z.string(), z.unknown()).default({
    type: "object",
    properties: {},
    required: [],
  }),
  kind: z.enum(["HTTP_REQUEST", "BUILTIN"]).default("HTTP_REQUEST"),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("POST"),
  endpoint: z.string().url().optional().nullable(),
  headers: z.record(z.string(), z.string()).optional().nullable(),
  approvalMode: z.enum(["AUTO", "REQUIRE_CONFIRM"]).default("AUTO"),
  riskTier: z.enum(["READ_ONLY", "WRITE", "EXTERNAL_COMMUNICATION", "FINANCIAL", "IDENTITY", "DESTRUCTIVE"]).default("READ_ONLY"),
  dataClassification: z.enum(["public", "internal", "confidential", "restricted"]).default("internal"),
  allowedDomains: z.array(z.string().min(1).max(253)).max(20).default([]),
  timeoutMs: z.number().int().min(1000).max(30000).default(12000),
  isActive: z.boolean().default(true),
});

async function authorizedBot(botId: string, userId: string) {
  return await canAccessBot(botId, userId, "tool:write") ? db.bot.findUnique({ where: { id: botId }, include: { workspace: { select: { policy: true } } } }) : null;
}

function isSafeToolEndpoint(endpoint: string | null | undefined): boolean {
  if (!endpoint) return true;
  try {
    const normalized = endpoint.replace(/\{[^}]+\}/g, "placeholder");
    const url = new URL(normalized);
    const rawHost = endpoint.slice(endpoint.indexOf("://") + 3).split(/[/?#]/)[0] || "";
    return (url.protocol === "https:" || url.protocol === "http:") && !rawHost.includes("{");
  } catch {
    return false;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId } = await params;
  const bot = await authorizedBot(botId, session.userId);
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });

  const tools = await db.tool.findMany({
    where: { botId },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { executions: true } },
    },
  });
  return NextResponse.json({
    tools: tools.map(({ headers, headersEncrypted, ...tool }) => ({
      ...tool,
      headersSet: Boolean(headers || headersEncrypted),
    })),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId } = await params;
  const bot = await authorizedBot(botId, session.userId);
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });

  try {
    const body = await req.json();
    const data = toolSchema.parse(body);
    const workspacePolicy = (bot.workspace.policy || {}) as { externalToolsAllowed?: boolean };
    if (workspacePolicy.externalToolsAllowed === false) return NextResponse.json({ error: "External tools are disabled by workspace policy." }, { status: 403 });
    if (!isSafeToolEndpoint(data.endpoint)) {
      return NextResponse.json({ error: "Tool endpoints must use a fixed HTTP(S) hostname." }, { status: 400 });
    }

    // Tool name must be unique per bot (the LLM addresses tools by name)
    const existing = await db.tool.findFirst({ where: { botId, name: data.name } });
    if (existing) {
      return NextResponse.json({ error: `A tool named '${data.name}' already exists for this bot` }, { status: 409 });
    }

    const encryptedHeaders = data.headers ? encryptSecret(JSON.stringify(data.headers)) : undefined;
    const tool = await db.tool.create({
      data: {
        botId,
        name: data.name,
        description: data.description,
        inputSchema: data.inputSchema as object,
        kind: data.kind,
        method: data.method,
        endpoint: data.endpoint,
        headersEncrypted: encryptedHeaders,
        approvalMode: data.riskTier === "READ_ONLY" ? data.approvalMode : "REQUIRE_CONFIRM",
        riskTier: data.riskTier,
        dataClassification: data.dataClassification,
        allowedDomains: data.allowedDomains,
        timeoutMs: data.timeoutMs,
        isActive: data.isActive,
      },
    });

    await writeAuditEvent({
      type: "tool.created",
      actorId: session.userId,
      workspaceId: bot.workspaceId,
      targetType: "tool",
      targetId: tool.id,
      metadata: { botId, approvalMode: tool.approvalMode, method: tool.method },
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    });

    return NextResponse.json({ tool }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || "Invalid input" }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Failed to create tool";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
