import { createHash } from "crypto";
import { db } from "@/lib/db/client";

interface AuditInput {
  type: string;
  actorId?: string | null;
  workspaceId?: string | null;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}

function hashIp(ip?: string | null): string | undefined {
  if (!ip) return undefined;
  const salt = process.env.AUDIT_HASH_SALT || process.env.JWT_SECRET;
  if (!salt) return undefined;
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 40);
}

/** Audit writes must not turn a successful customer action into a failed request. */
export async function writeAuditEvent(input: AuditInput): Promise<void> {
  try {
    await db.auditEvent.create({
      data: {
        type: input.type,
        actorId: input.actorId || undefined,
        workspaceId: input.workspaceId || undefined,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: input.metadata as object | undefined,
        ipHash: hashIp(input.ip),
      },
    });
  } catch (error) {
    console.error("Audit event write failed:", error instanceof Error ? error.message : error);
  }
}
