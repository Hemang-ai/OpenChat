import { PlatformRole } from "@prisma/client";
import { getSession } from "@/lib/auth/jwt";
import { db } from "@/lib/db/client";

const PERMISSIONS: Record<PlatformRole, readonly string[]> = {
  NONE: [],
  SUPER_ADMIN: ["overview:read", "accounts:read", "security:read", "support:break-glass"],
  PLATFORM_ADMIN: ["overview:read", "accounts:read", "security:read"],
  SUPPORT: ["overview:read", "accounts:read"],
  ANALYST: ["overview:read"],
  SECURITY_AUDITOR: ["overview:read", "security:read"],
};

export interface PlatformActor {
  id: string;
  email: string;
  username: string | null;
  name: string | null;
  platformRole: PlatformRole;
  mustChangePassword: boolean;
}

export async function getPlatformActor(): Promise<PlatformActor | null> {
  const session = await getSession();
  if (!session) return null;

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      platformRole: true,
      mustChangePassword: true,
    },
  });

  if (!user || user.platformRole === "NONE") return null;
  return user;
}

export function hasPlatformPermission(actor: PlatformActor, permission: string): boolean {
  return PERMISSIONS[actor.platformRole].includes(permission);
}

export async function requirePlatformPermission(permission = "overview:read"): Promise<PlatformActor> {
  const actor = await getPlatformActor();
  if (!actor || actor.mustChangePassword || !hasPlatformPermission(actor, permission)) {
    throw new Error("Platform administrator access is required.");
  }
  return actor;
}
