import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/jwt";
import { db } from "@/lib/db/client";
import { writeAuditEvent } from "@/lib/security/audit";
import { canAccessBot } from "@/lib/auth/workspace-access";

const requestSchema = z.object({ environment: z.enum(["DEVELOPMENT", "STAGING", "PRODUCTION"]), version: z.number().int().min(1) });
const approveSchema = z.object({ environmentId: z.string().cuid(), decision: z.enum(["approve", "reject"]) });
async function ownedBot(botId: string, userId: string) { const access = await canAccessBot(botId, userId, "publish:write"); return access ? db.bot.findUnique({ where: { id: botId }, select: { id: true, workspaceId: true, publishedVersion: true } }) : null; }

export async function GET(_req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  const session = await getSession(); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId } = await params; const bot = await ownedBot(botId, session.userId); if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  const [environments, versions] = await Promise.all([db.botEnvironment.findMany({ where: { botId }, orderBy: { environment: "asc" } }), db.botVersion.findMany({ where: { botId }, select: { version: true, createdAt: true, rollbackFromVersion: true }, orderBy: { version: "desc" } })]);
  return NextResponse.json({ environments, versions });
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  const session = await getSession(); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId } = await params; const bot = await ownedBot(botId, session.userId); if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  try { const data = requestSchema.parse(await req.json()); const version = await db.botVersion.findUnique({ where: { botId_version: { botId, version: data.version } } }); if (!version) return NextResponse.json({ error: "Version not found" }, { status: 404 }); const environment = await db.botEnvironment.upsert({ where: { botId_environment: { botId, environment: data.environment } }, update: { pendingVersion: data.version, approvalStatus: "PENDING", requestedById: session.userId, requestedAt: new Date() }, create: { botId, environment: data.environment, pendingVersion: data.version, approvalStatus: "PENDING", requestedById: session.userId, requestedAt: new Date() } }); await writeAuditEvent({ type: "environment.promotion_requested", actorId: session.userId, workspaceId: bot.workspaceId, targetType: "botEnvironment", targetId: environment.id, metadata: { environment: data.environment, version: data.version } }); return NextResponse.json({ environment }); } catch (error) { if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 }); return NextResponse.json({ error: "Promotion request failed" }, { status: 500 }); }
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  const session = await getSession(); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId } = await params; const bot = await ownedBot(botId, session.userId); if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  try { const data = approveSchema.parse(await req.json()); const env = await db.botEnvironment.findFirst({ where: { id: data.environmentId, botId } }); if (!env || env.approvalStatus !== "PENDING") return NextResponse.json({ error: "No pending promotion" }, { status: 409 }); const updated = await db.botEnvironment.update({ where: { id: env.id }, data: { approvalStatus: data.decision === "approve" ? "APPROVED" : "REJECTED", activeVersion: data.decision === "approve" ? env.pendingVersion : env.activeVersion, pendingVersion: null, approvedById: session.userId, approvedAt: new Date() } }); await writeAuditEvent({ type: `environment.promotion_${data.decision}d`, actorId: session.userId, workspaceId: bot.workspaceId, targetType: "botEnvironment", targetId: env.id, metadata: { environment: env.environment, version: env.pendingVersion } }); return NextResponse.json({ environment: updated }); } catch (error) { if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 }); return NextResponse.json({ error: "Promotion decision failed" }, { status: 500 }); }
}
