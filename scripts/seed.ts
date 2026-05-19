import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const hash = await bcrypt.hash("password123", 12);

  const user = await db.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      passwordHash: hash,
      name: "Demo Admin",
      workspaces: {
        create: {
          name: "Demo Workspace",
          slug: "demo-workspace",
          bots: {
            create: {
              name: "Demo Support Bot",
              description: "A demo chatbot for testing",
              welcomeMessage: "Hi! I'm a demo support bot. How can I help you today?",
              businessContext: "A demo company providing software solutions",
              tone: "friendly",
            },
          },
        },
      },
    },
  });

  console.log(`✓ Created demo user: admin@example.com / password123`);
  console.log(`✓ Created demo workspace and bot`);

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
