import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformPermission } from "@/lib/auth/platform-admin";
import { db } from "@/lib/db/client";
import { writeAuditEvent } from "@/lib/security/audit";

const updateSchema = z.object({ alertId: z.string().cuid(), status: z.enum(["OPEN", "ACKNOWLEDGED", "RESOLVED"]), ownerLabel: z.string().max(120).nullable().optional(), notes: z.string().max(2000).nullable().optional(), incidentUrl: z.string().url().nullable().optional() });

async function observeAlerts() {
  const since = new Date(Date.now() - 15 * 60_000);
  const [ingestionFailures, webhookFailures, providerFailures, queueDepth] = await Promise.all([
    db.ingestionJob.count({ where: { status: "FAILED", updatedAt: { gte: since } } }),
    db.webhookDelivery.count({ where: { status: "FAILED", updatedAt: { gte: since } } }),
    db.auditEvent.count({ where: { type: { in: ["provider.failed", "tool.failed"] }, createdAt: { gte: since } } }),
    db.ingestionJob.count({ where: { status: { in: ["PENDING", "PROCESSING"] }, createdAt: { lt: new Date(Date.now() - 15 * 60_000) } } }),
  ]);
  const observations = [
    ingestionFailures ? { fingerprint: "ingestion-failures", type: "ingestion", title: "Ingestion failures increased", description: `${ingestionFailures} jobs failed in the last 15 minutes.`, severity: "WARNING" as const } : null,
    webhookFailures ? { fingerprint: "webhook-failures", type: "integration", title: "Webhook deliveries are failing", description: `${webhookFailures} deliveries failed in the last 15 minutes.`, severity: "WARNING" as const } : null,
    providerFailures >= 5 ? { fingerprint: "provider-failures", type: "provider", title: "Provider/tool failure threshold exceeded", description: `${providerFailures} failures were recorded in the last 15 minutes.`, severity: "CRITICAL" as const } : null,
    queueDepth ? { fingerprint: "ingestion-slo", type: "slo", title: "Ingestion queue is outside SLO", description: `${queueDepth} jobs have waited or processed for more than 15 minutes.`, severity: "CRITICAL" as const } : null,
  ].filter((value) => value !== null);
  await Promise.all(observations.map((alert) => db.platformAlert.upsert({ where: { fingerprint: alert.fingerprint }, update: { ...alert, lastSeenAt: new Date(), status: "OPEN", resolvedAt: null }, create: alert })));
}

export async function GET() {
  try { await requirePlatformPermission("overview:read"); await observeAlerts(); const alerts = await db.platformAlert.findMany({ orderBy: [{ status: "asc" }, { severity: "desc" }, { lastSeenAt: "desc" }], take: 100 }); return NextResponse.json({ alerts }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Platform access required" }, { status: 403 }); }
}
export async function PATCH(req: NextRequest) {
  try { const actor = await requirePlatformPermission("security:read"); const data = updateSchema.parse(await req.json()); const alert = await db.platformAlert.update({ where: { id: data.alertId }, data: { status: data.status, ownerLabel: data.ownerLabel, notes: data.notes, incidentUrl: data.incidentUrl, acknowledgedAt: data.status === "ACKNOWLEDGED" ? new Date() : undefined, resolvedAt: data.status === "RESOLVED" ? new Date() : null } }); await writeAuditEvent({ type: "platform.alert_updated", actorId: actor.id, targetType: "platformAlert", targetId: alert.id, metadata: { status: alert.status } }); return NextResponse.json({ alert }); }
  catch (error) { if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 }); return NextResponse.json({ error: error instanceof Error ? error.message : "Alert update failed" }, { status: 403 }); }
}
