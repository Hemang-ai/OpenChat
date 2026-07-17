import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/jwt";
import { db } from "@/lib/db/client";
import { writeAuditEvent } from "@/lib/security/audit";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const session = await getSession(); if (!session) return NextResponse.json({ error: "Sign in before accepting this invitation" }, { status: 401 });
  const { token } = await params; const hash = createHash("sha256").update(token).digest("hex");
  const invitation = await db.workspaceInvitation.findUnique({ where: { tokenHash: hash } });
  if (!invitation || invitation.revokedAt || invitation.acceptedAt || invitation.expiresAt <= new Date()) return NextResponse.json({ error: "Invitation is invalid or expired" }, { status: 410 });
  if (invitation.email.toLowerCase() !== session.email.toLowerCase()) return NextResponse.json({ error: "This invitation belongs to another email address" }, { status: 403 });
  await db.$transaction([db.workspaceMember.upsert({ where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId: session.userId } }, update: { role: invitation.role }, create: { workspaceId: invitation.workspaceId, userId: session.userId, role: invitation.role } }), db.workspaceInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } })]);
  await writeAuditEvent({ type: "membership.invitation_accepted", actorId: session.userId, workspaceId: invitation.workspaceId, targetType: "workspaceInvitation", targetId: invitation.id, metadata: { role: invitation.role } });
  return NextResponse.json({ success: true, workspaceId: invitation.workspaceId });
}
