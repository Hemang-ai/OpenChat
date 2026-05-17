-- AlterTable
ALTER TABLE "Bot" ADD COLUMN     "contactInfo" TEXT,
ADD COLUMN     "fallbackBehavior" TEXT NOT NULL DEFAULT 'contact',
ADD COLUMN     "suggestedQuestions" JSONB,
ADD COLUMN     "suggestedQuestionsUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "fallbackLlmProvider" TEXT;
