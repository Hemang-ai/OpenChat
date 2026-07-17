import { createHash, timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";

export async function authenticateServiceRequest(req: NextRequest, requiredScope: string) {
  const raw = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!raw.startsWith("obc_live_") || raw.length < 30) return null;
  const hash = createHash("sha256").update(raw).digest("hex");
  const key = await db.serviceApiKey.findFirst({
    where: { keyHash: hash, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }], serviceAccount: { revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } },
    include: { serviceAccount: true },
  });
  if (!key || !timingSafeEqual(Buffer.from(hash), Buffer.from(key.keyHash))) return null;
  if (!key.serviceAccount.scopes.includes(requiredScope) && !key.serviceAccount.scopes.includes("*")) return null;
  await db.serviceApiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
  return { workspaceId: key.serviceAccount.workspaceId, serviceAccountId: key.serviceAccountId, keyId: key.id };
}
