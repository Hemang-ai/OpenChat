import { db } from "@/lib/db/client";

export async function isProductionVersionApproved(botId: string, publishedVersion: number) {
  const bot = await db.bot.findUnique({ where: { id: botId }, select: { workspace: { select: { policy: true } } } });
  const policy = (bot?.workspace.policy || {}) as { requirePublishApproval?: boolean };
  if (!policy.requirePublishApproval) return true;
  const production = await db.botEnvironment.findUnique({ where: { botId_environment: { botId, environment: "PRODUCTION" } }, select: { activeVersion: true, approvalStatus: true } });
  return production?.approvalStatus === "APPROVED" && production.activeVersion === publishedVersion;
}
