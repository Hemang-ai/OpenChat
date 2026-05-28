-- CreateEnum
CREATE TYPE "ToolKind" AS ENUM ('HTTP_REQUEST', 'BUILTIN');

-- CreateEnum
CREATE TYPE "ToolApprovalMode" AS ENUM ('AUTO', 'REQUIRE_CONFIRM');

-- CreateEnum
CREATE TYPE "ToolExecutionStatus" AS ENUM ('SUCCESS', 'ERROR', 'PENDING_APPROVAL', 'REJECTED');

-- CreateTable
CREATE TABLE "Tool" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "inputSchema" JSONB NOT NULL,
    "kind" "ToolKind" NOT NULL DEFAULT 'HTTP_REQUEST',
    "method" TEXT DEFAULT 'POST',
    "endpoint" TEXT,
    "headers" JSONB,
    "approvalMode" "ToolApprovalMode" NOT NULL DEFAULT 'AUTO',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolExecution" (
    "id" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "conversationId" TEXT,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "errorMessage" TEXT,
    "status" "ToolExecutionStatus" NOT NULL DEFAULT 'SUCCESS',
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Tool_botId_idx" ON "Tool"("botId");

-- CreateIndex
CREATE INDEX "ToolExecution_toolId_idx" ON "ToolExecution"("toolId");

-- CreateIndex
CREATE INDEX "ToolExecution_conversationId_idx" ON "ToolExecution"("conversationId");

-- AddForeignKey
ALTER TABLE "Tool" ADD CONSTRAINT "Tool_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolExecution" ADD CONSTRAINT "ToolExecution_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolExecution" ADD CONSTRAINT "ToolExecution_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
