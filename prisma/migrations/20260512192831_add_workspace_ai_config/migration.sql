-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "anthropicApiKey" TEXT,
ADD COLUMN     "anthropicModel" TEXT,
ADD COLUMN     "groqApiKey" TEXT,
ADD COLUMN     "groqModel" TEXT,
ADD COLUMN     "llmProvider" TEXT,
ADD COLUMN     "ollamaBaseUrl" TEXT,
ADD COLUMN     "ollamaModel" TEXT,
ADD COLUMN     "openaiApiKey" TEXT,
ADD COLUMN     "openaiEmbeddingModel" TEXT,
ADD COLUMN     "openaiModel" TEXT;
