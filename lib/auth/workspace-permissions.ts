import type { WorkspaceRole } from "@prisma/client";

export type WorkspacePermission =
  | "workspace:read"
  | "workspace:manage"
  | "bot:read"
  | "bot:write"
  | "knowledge:write"
  | "evaluation:write"
  | "publish:write"
  | "analytics:read"
  | "conversation:read"
  | "conversation:write"
  | "tool:write";

const permissions: Record<WorkspaceRole, readonly WorkspacePermission[]> = {
  OWNER: ["workspace:read", "workspace:manage", "bot:read", "bot:write", "knowledge:write", "evaluation:write", "publish:write", "analytics:read", "conversation:read", "conversation:write", "tool:write"],
  ADMIN: ["workspace:read", "workspace:manage", "bot:read", "bot:write", "knowledge:write", "evaluation:write", "publish:write", "analytics:read", "conversation:read", "conversation:write", "tool:write"],
  BUILDER: ["workspace:read", "bot:read", "bot:write", "knowledge:write", "evaluation:write", "publish:write", "analytics:read", "conversation:read", "tool:write"],
  ANALYST: ["workspace:read", "bot:read", "analytics:read", "conversation:read"],
  SUPPORT_AGENT: ["workspace:read", "bot:read", "conversation:read", "conversation:write"],
  VIEWER: ["workspace:read", "bot:read"],
};

export function hasWorkspacePermission(role: WorkspaceRole, permission: WorkspacePermission) {
  return permissions[role].includes(permission);
}

