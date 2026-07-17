import { db } from "../lib/db/client";
import { encryptSecret, hasWorkspaceSecretsKey } from "../lib/security/secrets";

async function main() {
  if (!hasWorkspaceSecretsKey()) {
    throw new Error("Set WORKSPACE_SECRETS_KEY before migrating workspace credentials.");
  }

  const workspaces = await db.workspace.findMany({
    select: {
      id: true,
      openaiApiKey: true, openaiApiKeyEncrypted: true,
      anthropicApiKey: true, anthropicApiKeyEncrypted: true,
      groqApiKey: true, groqApiKeyEncrypted: true,
      geminiApiKey: true, geminiApiKeyEncrypted: true,
    },
  });

  let migrated = 0;
  for (const workspace of workspaces) {
    const update: Record<string, string | null> = {};
    const pairs = [
      ["openaiApiKey", "openaiApiKeyEncrypted"],
      ["anthropicApiKey", "anthropicApiKeyEncrypted"],
      ["groqApiKey", "groqApiKeyEncrypted"],
      ["geminiApiKey", "geminiApiKeyEncrypted"],
    ] as const;

    for (const [legacy, encrypted] of pairs) {
      if (workspace[legacy] && !workspace[encrypted]) {
        update[encrypted] = encryptSecret(workspace[legacy]!);
        update[legacy] = null;
      }
    }
    if (Object.keys(update).length) {
      await db.workspace.update({ where: { id: workspace.id }, data: update });
      migrated++;
    }
  }

  console.log(`Migrated credentials for ${migrated} workspace(s).`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
