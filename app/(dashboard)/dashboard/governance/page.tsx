import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/jwt";
import { db } from "@/lib/db/client";
import { workspaceAccessWhere } from "@/lib/auth/workspace-access";
import GovernancePanel from "@/components/dashboard/governance-panel";

export default async function GovernancePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const workspaces = await db.workspace.findMany({ where: workspaceAccessWhere(session.userId), select: { id: true, name: true }, orderBy: { createdAt: "asc" } });
  return <div className="mx-auto max-w-5xl"><h1 className="text-2xl font-bold">Governance</h1><p className="mt-1 text-sm text-gray-500">People, policies, service identities, enterprise authentication, privacy, and audit evidence.</p><GovernancePanel workspaces={workspaces} /></div>;
}
