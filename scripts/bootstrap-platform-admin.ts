import { db } from "../lib/db/client";
import { hashPassword } from "../lib/auth/password";

async function main() {
  const username = (process.env.PLATFORM_ADMIN_USERNAME || "admin").trim().toLowerCase();
  const email = (process.env.PLATFORM_ADMIN_EMAIL || `${username}@localhost`).trim().toLowerCase();
  const password = process.env.PLATFORM_ADMIN_INITIAL_PASSWORD;

  if (!password || password.length < 15) {
    throw new Error("Set PLATFORM_ADMIN_INITIAL_PASSWORD to a unique password with at least 15 characters.");
  }
  if (!/^[a-z][a-z0-9_-]{2,49}$/.test(username)) {
    throw new Error("PLATFORM_ADMIN_USERNAME must contain 3-50 lowercase letters, digits, underscores, or hyphens.");
  }

  const existingPlatformOwner = await db.user.findFirst({ where: { platformRole: { not: "NONE" } }, select: { id: true } });
  if (existingPlatformOwner) {
    throw new Error("A platform administrator already exists. Bootstrap is intentionally one-time only.");
  }

  const existingIdentity = await db.user.findFirst({ where: { OR: [{ email }, { username }] }, select: { id: true } });
  if (existingIdentity) {
    throw new Error("The requested administrator email or username is already in use.");
  }

  await db.user.create({
    data: {
      email,
      username,
      name: "Platform Administrator",
      passwordHash: await hashPassword(password),
      platformRole: "SUPER_ADMIN",
      mustChangePassword: true,
    },
  });

  console.log(`Created one-time platform administrator '${username}'. Sign in, then change the bootstrap password at /admin.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
