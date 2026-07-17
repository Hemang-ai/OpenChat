import { createHash, randomBytes } from "crypto";
import { promises as dns } from "dns";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/jwt";
import { getWorkspaceAccess, hasWorkspaceRole } from "@/lib/auth/workspace-access";
import { db } from "@/lib/db/client";
import { encryptSecret } from "@/lib/security/secrets";
import { writeAuditEvent } from "@/lib/security/audit";

const actions = z.discriminatedUnion("action", [
  z.object({ action: z.literal("invite"), email: z.string().email(), role: z.enum(["ADMIN", "BUILDER", "ANALYST", "SUPPORT_AGENT", "VIEWER"]) }),
  z.object({ action: z.literal("service-account"), name: z.string().min(2).max(100), scopes: z.array(z.string().min(1).max(100)).min(1).max(20), expiresInDays: z.number().int().min(1).max(3650).optional() }),
  z.object({ action: z.literal("policy"), allowedProviders: z.array(z.enum(["openai", "anthropic", "groq", "gemini", "ollama"])), allowedModels: z.array(z.string().max(120)).max(50), requirePublishApproval: z.boolean(), externalToolsAllowed: z.boolean(), retentionDays: z.number().int().min(1).max(3650), dataRegion: z.string().min(2).max(50), customerKeyReference: z.string().max(300).nullable() }),
  z.object({ action: z.literal("sso"), type: z.enum(["OIDC", "SAML"]), issuer: z.string().url(), clientId: z.string().max(300).optional(), clientSecret: z.string().max(1000).optional(), metadataUrl: z.string().url().optional(), enforced: z.boolean() }),
  z.object({ action: z.literal("domain"), domain: z.string().regex(/^[a-z0-9.-]+$/i).max(253) }),
  z.object({ action: z.literal("verify-domain"), domainId: z.string().cuid() }),
  z.object({ action: z.literal("privacy-request"), type: z.enum(["EXPORT", "CORRECT", "DELETE"]), subjectEmail: z.string().email() }),
  z.object({ action: z.literal("revoke-key"), keyId: z.string().cuid() }),
]);

async function adminAccess(workspaceId: string, userId: string) {
  const access = await getWorkspaceAccess(workspaceId, userId);
  return access && hasWorkspaceRole(access.role, "ADMIN") ? access : null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ workspaceId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId } = await params;
  const access = await getWorkspaceAccess(workspaceId, session.userId);
  if (!access) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  if (req.nextUrl.searchParams.get("export") === "audit") {
    if (!hasWorkspaceRole(access.role, "ADMIN")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const events = await db.auditEvent.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, take: 5000, select: { id: true, type: true, actorId: true, targetType: true, targetId: true, metadata: true, createdAt: true } });
    await writeAuditEvent({ type: "audit.exported", actorId: session.userId, workspaceId, targetType: "workspace", targetId: workspaceId, metadata: { records: events.length } });
    return NextResponse.json({ generatedAt: new Date().toISOString(), redacted: true, events }, { headers: { "Content-Disposition": `attachment; filename="audit-${workspaceId}.json"` } });
  }

  const [workspace, members, invitations, serviceAccounts, sso, domains, privacyRequests, recentAudit] = await Promise.all([
    db.workspace.findUnique({ where: { id: workspaceId }, select: { id: true, name: true, policy: true, retentionPolicy: true, dataRegion: true, customerKeyReference: true } }),
    db.workspaceMember.findMany({ where: { workspaceId }, include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } }),
    db.workspaceInvitation.findMany({ where: { workspaceId, revokedAt: null, acceptedAt: null }, select: { id: true, email: true, role: true, expiresAt: true, createdAt: true } }),
    db.serviceAccount.findMany({ where: { workspaceId }, include: { keys: { select: { id: true, prefix: true, lastUsedAt: true, expiresAt: true, revokedAt: true, rateLimitPerHour: true, createdAt: true } } }, orderBy: { createdAt: "desc" } }),
    db.ssoConfiguration.findMany({ where: { workspaceId }, select: { id: true, type: true, issuer: true, clientId: true, metadataUrl: true, enforced: true, isActive: true, createdAt: true } }),
    db.claimedDomain.findMany({ where: { workspaceId }, select: { id: true, domain: true, status: true, verifiedAt: true, createdAt: true } }),
    db.privacyRequest.findMany({ where: { workspaceId }, orderBy: { requestedAt: "desc" }, take: 50 }),
    db.auditEvent.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, type: true, targetType: true, targetId: true, createdAt: true } }),
  ]);
  return NextResponse.json({ workspace, role: access.role, members, invitations, serviceAccounts, sso, domains, privacyRequests, recentAudit });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ workspaceId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId } = await params;
  const access = await adminAccess(workspaceId, session.userId);
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const data = actions.parse(await req.json());
    let response: Record<string, unknown> = { success: true };
    if (data.action === "invite") {
      const token = randomBytes(32).toString("base64url");
      const invitation = await db.workspaceInvitation.create({ data: { workspaceId, email: data.email.toLowerCase(), role: data.role, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 7 * 86400_000) } });
      response = { invitation: { id: invitation.id, email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt }, inviteToken: token };
    } else if (data.action === "service-account") {
      const raw = `obc_live_${randomBytes(32).toString("base64url")}`;
      const prefix = raw.slice(0, 16);
      const account = await db.serviceAccount.create({ data: { workspaceId, name: data.name, scopes: data.scopes, createdById: session.userId, expiresAt: data.expiresInDays ? new Date(Date.now() + data.expiresInDays * 86400_000) : null, keys: { create: { prefix, keyHash: createHash("sha256").update(raw).digest("hex"), expiresAt: data.expiresInDays ? new Date(Date.now() + data.expiresInDays * 86400_000) : null } } } });
      response = { serviceAccount: account, apiKey: raw };
    } else if (data.action === "policy") {
      await db.workspace.update({ where: { id: workspaceId }, data: { policy: { allowedProviders: data.allowedProviders, allowedModels: data.allowedModels, requirePublishApproval: data.requirePublishApproval, externalToolsAllowed: data.externalToolsAllowed }, retentionPolicy: { conversationDays: data.retentionDays, leadDays: data.retentionDays, auditDays: Math.max(data.retentionDays, 365) }, dataRegion: data.dataRegion, customerKeyReference: data.customerKeyReference } });
    } else if (data.action === "sso") {
      const config = await db.ssoConfiguration.create({ data: { workspaceId, type: data.type, issuer: data.issuer, clientId: data.clientId, clientSecretEncrypted: data.clientSecret ? encryptSecret(data.clientSecret) : null, metadataUrl: data.metadataUrl, enforced: data.enforced, isActive: false } });
      response = { configuration: config };
    } else if (data.action === "domain") {
      const token = randomBytes(24).toString("base64url");
      const domain = await db.claimedDomain.create({ data: { workspaceId, domain: data.domain.toLowerCase(), verificationTokenHash: createHash("sha256").update(token).digest("hex") } });
      response = { domain, dnsRecord: { name: `_openbusinesschat.${domain.domain}`, type: "TXT", value: token } };
    } else if (data.action === "verify-domain") {
      const domain = await db.claimedDomain.findFirst({ where: { id: data.domainId, workspaceId } });
      if (!domain) return NextResponse.json({ error: "Domain not found" }, { status: 404 });
      const records = await dns.resolveTxt(`_openbusinesschat.${domain.domain}`).catch(() => []);
      const verified = records.flat().some((value) => createHash("sha256").update(value).digest("hex") === domain.verificationTokenHash);
      await db.claimedDomain.update({ where: { id: domain.id }, data: { status: verified ? "VERIFIED" : "FAILED", verifiedAt: verified ? new Date() : null } });
      response = { verified };
    } else if (data.action === "privacy-request") {
      const subjectHash = createHash("sha256").update(data.subjectEmail.toLowerCase()).digest("hex");
      const request = await db.privacyRequest.create({ data: { workspaceId, type: data.type, subjectEmail: data.subjectEmail.toLowerCase(), subjectHash } });
      response = { request };
    } else if (data.action === "revoke-key") {
      await db.serviceApiKey.updateMany({ where: { id: data.keyId, serviceAccount: { workspaceId } }, data: { revokedAt: new Date() } });
    }
    await writeAuditEvent({ type: `governance.${data.action}`, actorId: session.userId, workspaceId, targetType: "workspace", targetId: workspaceId });
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Invalid governance request" }, { status: 400 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Governance request failed" }, { status: 500 });
  }
}
