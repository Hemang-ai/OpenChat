import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/jwt";
import { db } from "@/lib/db/client";

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
  isActive: z.boolean().default(true),
});

async function authorizedBot(botId: string, userId: string) {
  return db.bot.findFirst({ where: { id: botId, workspace: { ownerId: userId } } });
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
  return NextResponse.json({ tools });
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

    // Tool name must be unique per bot (the LLM addresses tools by name)
    const existing = await db.tool.findFirst({ where: { botId, name: data.name } });
    if (existing) {
      return NextResponse.json({ error: `A tool named '${data.name}' already exists for this bot` }, { status: 409 });
    }

    const tool = await db.tool.create({
      data: {
        botId,
        name: data.name,
        description: data.description,
        inputSchema: data.inputSchema as object,
        kind: data.kind,
        method: data.method,
        endpoint: data.endpoint,
        headers: data.headers as object | undefined,
        approvalMode: data.approvalMode,
        isActive: data.isActive,
      },
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
