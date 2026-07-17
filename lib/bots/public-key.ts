import { db } from "@/lib/db/client";

export async function resolvePublicBotKey(publicKey: string) {
  const direct = await db.bot.findUnique({ where: { publicKey } });
  if (direct) return { bot: direct, environment: null, version: direct.publishedVersion };
  const environment = await db.botEnvironment.findUnique({ where: { publicKey }, include: { bot: true } });
  if (!environment?.activeVersion || environment.approvalStatus !== "APPROVED") return null;
  return { bot: environment.bot, environment: environment.environment, version: environment.activeVersion };
}
