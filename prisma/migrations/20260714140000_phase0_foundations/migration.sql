-- Additive Phase 0 foundations: platform roles, encrypted-secret columns,
-- durable ingestion records, audit events, and platform telemetry.

CREATE TYPE "PlatformRole" AS ENUM ('NONE', 'SUPER_ADMIN', 'PLATFORM_ADMIN', 'SUPPORT', 'ANALYST', 'SECURITY_AUDITOR');
CREATE TYPE "IngestionJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

ALTER TABLE "User"
  ADD COLUMN "username" TEXT,
  ADD COLUMN "platformRole" "PlatformRole" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

ALTER TABLE "Workspace"
  ADD COLUMN "openaiApiKeyEncrypted" TEXT,
  ADD COLUMN "anthropicApiKeyEncrypted" TEXT,
  ADD COLUMN "groqApiKeyEncrypted" TEXT,
  ADD COLUMN "geminiApiKeyEncrypted" TEXT;

ALTER TABLE "Tool"
  ADD COLUMN "headersEncrypted" TEXT;

ALTER TABLE "ToolExecution"
  ADD COLUMN "approvalToken" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3);

ALTER TYPE "ToolExecutionStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';

CREATE UNIQUE INDEX "ToolExecution_approvalToken_key" ON "ToolExecution"("approvalToken");

CREATE TABLE "IngestionJob" (
  "id" TEXT NOT NULL,
  "knowledgeSourceId" TEXT NOT NULL,
  "status" "IngestionJobStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "input" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IngestionJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IngestionJob_status_runAfter_idx" ON "IngestionJob"("status", "runAfter");
CREATE INDEX "IngestionJob_knowledgeSourceId_createdAt_idx" ON "IngestionJob"("knowledgeSourceId", "createdAt");
ALTER TABLE "IngestionJob" ADD CONSTRAINT "IngestionJob_knowledgeSourceId_fkey"
  FOREIGN KEY ("knowledgeSourceId") REFERENCES "KnowledgeSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AuditEvent" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "actorId" TEXT,
  "workspaceId" TEXT,
  "targetType" TEXT,
  "targetId" TEXT,
  "metadata" JSONB,
  "ipHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditEvent_type_createdAt_idx" ON "AuditEvent"("type", "createdAt");
CREATE INDEX "AuditEvent_actorId_createdAt_idx" ON "AuditEvent"("actorId", "createdAt");
CREATE INDEX "AuditEvent_workspaceId_createdAt_idx" ON "AuditEvent"("workspaceId", "createdAt");
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PlatformEvent" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "botId" TEXT,
  "workspaceId" TEXT,
  "origin" TEXT,
  "sessionHash" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlatformEvent_type_createdAt_idx" ON "PlatformEvent"("type", "createdAt");
CREATE INDEX "PlatformEvent_botId_createdAt_idx" ON "PlatformEvent"("botId", "createdAt");
CREATE INDEX "PlatformEvent_workspaceId_createdAt_idx" ON "PlatformEvent"("workspaceId", "createdAt");
