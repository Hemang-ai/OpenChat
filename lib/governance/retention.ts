import { createHash } from "crypto";
import { db } from "@/lib/db/client";
import { writeAuditEvent } from "@/lib/security/audit";

type RetentionPolicy = { conversationDays?: number; leadDays?: number; auditDays?: number };

export async function enforceRetention(limit = 1000) {
  const workspaces = (await db.workspace.findMany({ select: { id: true, retentionPolicy: true } }))
    .filter((workspace) => workspace.retentionPolicy !== null);
  const results: Array<{ workspaceId: string; conversations: number; leads: number; auditEvents: number }> = [];
  for (const workspace of workspaces) {
    const policy = (workspace.retentionPolicy || {}) as RetentionPolicy;
    const now = Date.now();
    const conversationCutoff = new Date(now - Math.max(policy.conversationDays || 365, 1) * 86400_000);
    const leadCutoff = new Date(now - Math.max(policy.leadDays || 365, 1) * 86400_000);
    const auditCutoff = new Date(now - Math.max(policy.auditDays || 365, 90) * 86400_000);
    const conversations = await db.conversation.findMany({ where: { bot: { workspaceId: workspace.id }, createdAt: { lt: conversationCutoff } }, select: { id: true }, take: limit });
    const leads = await db.lead.findMany({ where: { bot: { workspaceId: workspace.id }, createdAt: { lt: leadCutoff }, conversationId: null }, select: { id: true }, take: limit });
    const [conversationDelete, leadDelete, auditDelete] = await db.$transaction([
      db.conversation.deleteMany({ where: { id: { in: conversations.map((item) => item.id) } } }),
      db.lead.deleteMany({ where: { id: { in: leads.map((item) => item.id) } } }),
      db.auditEvent.deleteMany({ where: { workspaceId: workspace.id, createdAt: { lt: auditCutoff }, type: { notIn: ["privacy.deleted", "retention.enforced"] } } }),
    ]);
    results.push({ workspaceId: workspace.id, conversations: conversationDelete.count, leads: leadDelete.count, auditEvents: auditDelete.count });
    await writeAuditEvent({ type: "retention.enforced", workspaceId: workspace.id, targetType: "workspace", targetId: workspace.id, metadata: results.at(-1) });
  }
  return results;
}

export async function processPrivacyRequests(limit = 25) {
  const requests = await db.privacyRequest.findMany({ where: { status: "OPEN" }, orderBy: { requestedAt: "asc" }, take: Math.min(Math.max(limit, 1), 100) });
  const results: Array<{ id: string; status: string }> = [];
  for (const request of requests) {
    await db.privacyRequest.update({ where: { id: request.id }, data: { status: "PROCESSING" } });
    const email = request.subjectEmail?.toLowerCase();
    if (!email) { await db.privacyRequest.update({ where: { id: request.id }, data: { status: "REJECTED", evidence: { reason: "Verified subject email is required" } } }); continue; }
    const leads = await db.lead.findMany({ where: { email: { equals: email, mode: "insensitive" }, bot: { workspaceId: request.workspaceId } }, select: { id: true, conversationId: true } });
    const conversations = Array.from(new Set(leads.flatMap((lead) => lead.conversationId ? [lead.conversationId] : [])));
    if (request.type === "DELETE") {
      const [leadDelete, conversationDelete] = await db.$transaction([db.lead.deleteMany({ where: { id: { in: leads.map((lead) => lead.id) } } }), db.conversation.deleteMany({ where: { id: { in: conversations }, bot: { workspaceId: request.workspaceId } } })]);
      await db.privacyRequest.update({ where: { id: request.id }, data: { subjectEmail: null, status: "COMPLETED", completedAt: new Date(), evidence: { leadsDeleted: leadDelete.count, conversationsDeleted: conversationDelete.count, subjectHash: createHash("sha256").update(email).digest("hex") } } });
    } else {
      await db.privacyRequest.update({ where: { id: request.id }, data: { status: "COMPLETED", completedAt: new Date(), evidence: { leadIds: leads.map((lead) => lead.id), conversationIds: conversations, correctionRequiresOwnerReview: request.type === "CORRECT" } } });
    }
    await writeAuditEvent({ type: `privacy.${request.type.toLowerCase()}d`, workspaceId: request.workspaceId, targetType: "privacyRequest", targetId: request.id, metadata: { records: leads.length + conversations.length } });
    results.push({ id: request.id, status: "COMPLETED" });
  }
  return results;
}
