-- Add lead capture settings to each bot.
ALTER TABLE "Bot"
ADD COLUMN "leadCaptureEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "leadCapturePrompt" TEXT NOT NULL DEFAULT 'Want us to follow up? Leave your details and our team will reach out.';

-- Track visitor contact requests created from public chat sessions.
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'DISMISSED');

CREATE TABLE "Lead" (
  "id" TEXT NOT NULL,
  "name" TEXT,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "company" TEXT,
  "message" TEXT,
  "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "botId" TEXT NOT NULL,
  "conversationId" TEXT,

  CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Lead_botId_status_idx" ON "Lead"("botId", "status");
CREATE INDEX "Lead_conversationId_idx" ON "Lead"("conversationId");

ALTER TABLE "Lead"
ADD CONSTRAINT "Lead_botId_fkey"
FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Lead"
ADD CONSTRAINT "Lead_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
