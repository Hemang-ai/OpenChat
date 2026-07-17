import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/jwt";
import { db } from "@/lib/db/client";
import { runBotEvaluations } from "@/lib/evaluations/run";
import { writeAuditEvent } from "@/lib/security/audit";
import { canAccessBot } from "@/lib/auth/workspace-access";

async function authorizedBot(botId: string, userId: string) {
  return await canAccessBot(botId, userId, "evaluation:write") ? db.bot.findUnique({ where: { id: botId }, select: { id: true, workspaceId: true } }) : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId } = await params;
  if (!await authorizedBot(botId, session.userId)) return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  const [cases, runs, sources] = await Promise.all([
    db.evaluationCase.findMany({ where: { botId }, orderBy: { createdAt: "asc" } }),
    db.evaluationRun.findMany({ where: { botId }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.knowledgeSource.findMany({ where: { botId, status: "COMPLETED" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return NextResponse.json({ cases, runs, sources });
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), question: z.string().min(5).max(1000), expectedAnswer: z.string().max(4000).optional(), allowRefusal: z.boolean().default(false), requiredSourceIds: z.array(z.string()).max(10).default([]), riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"), locale: z.string().min(2).max(10).default("en") }),
  z.object({ action: z.literal("delete"), caseId: z.string().min(1) }),
  z.object({ action: z.literal("run") }),
]);

export const maxDuration = 300;

export async function POST(req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId } = await params;
  const bot = await authorizedBot(botId, session.userId);
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  try {
    const data = actionSchema.parse(await req.json());
    if (data.action === "create") {
      const evaluationCase = await db.evaluationCase.create({ data: { botId, question: data.question, expectedAnswer: data.expectedAnswer || null, allowRefusal: data.allowRefusal, requiredSourceIds: data.requiredSourceIds, riskLevel: data.riskLevel, locale: data.locale } });
      return NextResponse.json({ case: evaluationCase }, { status: 201 });
    }
    if (data.action === "delete") {
      const deleted = await db.evaluationCase.deleteMany({ where: { id: data.caseId, botId } });
      if (!deleted.count) return NextResponse.json({ error: "Evaluation case not found" }, { status: 404 });
      return NextResponse.json({ success: true });
    }
    const run = await runBotEvaluations(botId);
    await writeAuditEvent({ type: "evaluation.completed", actorId: session.userId, workspaceId: bot.workspaceId, targetType: "bot", targetId: botId, metadata: { runId: run.id, status: run.status, passed: run.passed, total: run.total } });
    return NextResponse.json({ run });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Invalid evaluation request" }, { status: 400 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Evaluation failed" }, { status: 422 });
  }
}
