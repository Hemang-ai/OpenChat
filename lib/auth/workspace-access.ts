import type { WorkspaceRole } from "@prisma/client";
import { db } from "@/lib/db/client";
import { hasWorkspacePermission, type WorkspacePermission } from "@/lib/auth/workspace-permissions";

export { hasWorkspacePermission, type WorkspacePermission } from "@/lib/auth/workspace-permissions";

const rank: Record<WorkspaceRole, number> = { VIEWER: 0, SUPPORT_AGENT: 1, ANALYST: 2, BUILDER: 3, ADMIN: 4, OWNER: 5 };

export async function getWorkspaceAccess(workspaceId: string, userId: string) {
  const workspace = await db.workspace.findUnique({ where: { id: workspaceId }, select: { id: true, ownerId: true } });
  if (!workspace) return null;
  if (workspace.ownerId === userId) return { workspaceId, role: "OWNER" as WorkspaceRole };
  const membership = await db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId } }, select: { role: true } });
  return membership ? { workspaceId, role: membership.role } : null;
}

export function hasWorkspaceRole(role: WorkspaceRole, minimum: WorkspaceRole) {
  return rank[role] >= rank[minimum];
}

export async function getBotAccess(botId: string, userId: string) {
  const bot = await db.bot.findUnique({ where: { id: botId }, select: { id: true, workspaceId: true } });
  if (!bot) return null;
  const access = await getWorkspaceAccess(bot.workspaceId, userId);
  return access ? { ...access, botId } : null;
}

export async function canAccessBot(botId: string, userId: string, permission: WorkspacePermission) {
  const access = await getBotAccess(botId, userId);
  return access && hasWorkspacePermission(access.role, permission) ? access : null;
}

export const workspaceAccessWhere = (userId: string) => ({
  OR: [{ ownerId: userId }, { members: { some: { userId } } }],
});

export const botAccessWhere = (userId: string) => ({ workspace: workspaceAccessWhere(userId) });
