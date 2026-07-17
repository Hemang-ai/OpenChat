CREATE TYPE "ToolRiskTier" AS ENUM ('READ_ONLY', 'WRITE', 'EXTERNAL_COMMUNICATION', 'FINANCIAL', 'IDENTITY', 'DESTRUCTIVE');
CREATE TYPE "ToolTestStatus" AS ENUM ('UNTESTED', 'PASSED', 'FAILED');
CREATE TYPE "ConversationStatus" AS ENUM ('AI_ACTIVE', 'HANDOFF_REQUESTED', 'HUMAN_ACTIVE', 'RESOLVED');
CREATE TYPE "ConversationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED', 'CANCELLED');
CREATE TYPE "BudgetMode" AS ENUM ('ALERT', 'SOFT_LIMIT', 'HARD_LIMIT');
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'BUILDER', 'ANALYST', 'SUPPORT_AGENT', 'VIEWER');
CREATE TYPE "SsoType" AS ENUM ('OIDC', 'SAML');
CREATE TYPE "DomainClaimStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED');
CREATE TYPE "EnvironmentKind" AS ENUM ('DEVELOPMENT', 'STAGING', 'PRODUCTION');
CREATE TYPE "PromotionStatus" AS ENUM ('IDLE', 'PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "PrivacyRequestType" AS ENUM ('EXPORT', 'CORRECT', 'DELETE');
CREATE TYPE "PrivacyRequestStatus" AS ENUM ('OPEN', 'VERIFYING', 'PROCESSING', 'COMPLETED', 'REJECTED');
CREATE TYPE "PluginReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');
CREATE TYPE "ChannelKind" AS ENUM ('WEB', 'API', 'EMAIL', 'SLACK', 'TEAMS', 'WHATSAPP');
CREATE TYPE "ExperimentStatus" AS ENUM ('DRAFT', 'RUNNING', 'PAUSED', 'COMPLETED');
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

ALTER TABLE "Workspace" ADD COLUMN "policy" JSONB,
  ADD COLUMN "retentionPolicy" JSONB,
  ADD COLUMN "dataRegion" TEXT NOT NULL DEFAULT 'auto',
  ADD COLUMN "customerKeyReference" TEXT;

ALTER TABLE "Bot" ADD COLUMN "handoffPolicy" JSONB,
  ADD COLUMN "businessHours" JSONB,
  ADD COLUMN "fallbackContactMethod" TEXT,
  ADD COLUMN "defaultSlaMinutes" INTEGER NOT NULL DEFAULT 240,
  ADD COLUMN "budgetMonthlyUsd" DECIMAL(12,2),
  ADD COLUMN "budgetMode" "BudgetMode" NOT NULL DEFAULT 'ALERT',
  ADD COLUMN "defaultLocale" TEXT NOT NULL DEFAULT 'en',
  ADD COLUMN "supportedLocales" TEXT[] NOT NULL DEFAULT ARRAY['en']::TEXT[],
  ADD COLUMN "conversationsSummaryPrompt" TEXT;

ALTER TABLE "KnowledgeSource" ADD COLUMN "crawlConfig" JSONB,
  ADD COLUMN "refreshIntervalHours" INTEGER,
  ADD COLUMN "nextRefreshAt" TIMESTAMP(3),
  ADD COLUMN "lastSyncedAt" TIMESTAMP(3),
  ADD COLUMN "syncCursor" TEXT,
  ADD COLUMN "sourceVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en',
  ADD COLUMN "governanceScope" TEXT NOT NULL DEFAULT 'bot';

ALTER TABLE "Conversation" ADD COLUMN "status" "ConversationStatus" NOT NULL DEFAULT 'AI_ACTIVE',
  ADD COLUMN "priority" "ConversationPriority" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "assignedToLabel" TEXT,
  ADD COLUMN "summary" TEXT,
  ADD COLUMN "handoffReason" TEXT,
  ADD COLUMN "handoffRequestedAt" TIMESTAMP(3),
  ADD COLUMN "slaDueAt" TIMESTAMP(3),
  ADD COLUMN "resolvedAt" TIMESTAMP(3),
  ADD COLUMN "visitorName" TEXT,
  ADD COLUMN "visitorEmail" TEXT,
  ADD COLUMN "visitorConsent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en',
  ADD COLUMN "experimentId" TEXT,
  ADD COLUMN "experimentVariant" TEXT;

ALTER TABLE "EvaluationCase" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en';

ALTER TABLE "Message" ADD COLUMN "provider" TEXT,
  ADD COLUMN "model" TEXT,
  ADD COLUMN "inputTokens" INTEGER,
  ADD COLUMN "outputTokens" INTEGER,
  ADD COLUMN "estimatedCostUsd" DECIMAL(12,6),
  ADD COLUMN "retrievalTrace" JSONB;

ALTER TABLE "Tool" ADD COLUMN "riskTier" "ToolRiskTier" NOT NULL DEFAULT 'READ_ONLY',
  ADD COLUMN "dataClassification" TEXT NOT NULL DEFAULT 'internal',
  ADD COLUMN "allowedDomains" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "timeoutMs" INTEGER NOT NULL DEFAULT 12000,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "testedAt" TIMESTAMP(3),
  ADD COLUMN "testStatus" "ToolTestStatus" NOT NULL DEFAULT 'UNTESTED',
  ADD COLUMN "testSummary" JSONB;

ALTER TABLE "ToolExecution" ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "isTest" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "riskTier" "ToolRiskTier";
CREATE UNIQUE INDEX "ToolExecution_idempotencyKey_key" ON "ToolExecution"("idempotencyKey");

CREATE TABLE "WorkspaceMember" (
  "id" TEXT NOT NULL, "workspaceId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "role" "WorkspaceRole" NOT NULL DEFAULT 'VIEWER', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");
CREATE INDEX "WorkspaceMember_userId_role_idx" ON "WorkspaceMember"("userId", "role");

CREATE TABLE "WorkspaceInvitation" (
  "id" TEXT NOT NULL, "workspaceId" TEXT NOT NULL, "email" TEXT NOT NULL, "role" "WorkspaceRole" NOT NULL,
  "tokenHash" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "revokedAt" TIMESTAMP(3), "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "WorkspaceInvitation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkspaceInvitation_tokenHash_key" ON "WorkspaceInvitation"("tokenHash");
CREATE INDEX "WorkspaceInvitation_workspaceId_email_idx" ON "WorkspaceInvitation"("workspaceId", "email");

CREATE TABLE "ConversationNote" (
  "id" TEXT NOT NULL, "conversationId" TEXT NOT NULL, "authorId" TEXT, "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ConversationNote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ConversationNote_conversationId_createdAt_idx" ON "ConversationNote"("conversationId", "createdAt");

CREATE TABLE "WebhookEndpoint" (
  "id" TEXT NOT NULL, "workspaceId" TEXT NOT NULL, "botId" TEXT, "name" TEXT NOT NULL, "url" TEXT NOT NULL,
  "events" TEXT[] NOT NULL, "secretEncrypted" TEXT NOT NULL, "secretVersion" INTEGER NOT NULL DEFAULT 1,
  "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WebhookEndpoint_workspaceId_isActive_idx" ON "WebhookEndpoint"("workspaceId", "isActive");
CREATE INDEX "WebhookEndpoint_botId_idx" ON "WebhookEndpoint"("botId");

CREATE TABLE "WebhookDelivery" (
  "id" TEXT NOT NULL, "endpointId" TEXT NOT NULL, "conversationId" TEXT, "event" TEXT NOT NULL, "payload" JSONB NOT NULL,
  "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING', "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5, "idempotencyKey" TEXT NOT NULL, "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "responseCode" INTEGER, "responseBody" TEXT, "errorMessage" TEXT, "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WebhookDelivery_idempotencyKey_key" ON "WebhookDelivery"("idempotencyKey");
CREATE INDEX "WebhookDelivery_status_runAfter_idx" ON "WebhookDelivery"("status", "runAfter");
CREATE INDEX "WebhookDelivery_endpointId_createdAt_idx" ON "WebhookDelivery"("endpointId", "createdAt");

CREATE TABLE "ServiceAccount" (
  "id" TEXT NOT NULL, "workspaceId" TEXT NOT NULL, "name" TEXT NOT NULL, "scopes" TEXT[] NOT NULL,
  "createdById" TEXT, "expiresAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServiceAccount_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ServiceAccount_workspaceId_revokedAt_idx" ON "ServiceAccount"("workspaceId", "revokedAt");

CREATE TABLE "ServiceApiKey" (
  "id" TEXT NOT NULL, "serviceAccountId" TEXT NOT NULL, "prefix" TEXT NOT NULL, "keyHash" TEXT NOT NULL,
  "lastUsedAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3), "rateLimitPerHour" INTEGER NOT NULL DEFAULT 1000,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ServiceApiKey_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ServiceApiKey_keyHash_key" ON "ServiceApiKey"("keyHash");
CREATE INDEX "ServiceApiKey_serviceAccountId_revokedAt_idx" ON "ServiceApiKey"("serviceAccountId", "revokedAt");

CREATE TABLE "SsoConfiguration" (
  "id" TEXT NOT NULL, "workspaceId" TEXT NOT NULL, "type" "SsoType" NOT NULL, "issuer" TEXT NOT NULL,
  "clientId" TEXT, "clientSecretEncrypted" TEXT, "metadataUrl" TEXT, "groupMappings" JSONB,
  "enforced" BOOLEAN NOT NULL DEFAULT false, "isActive" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SsoConfiguration_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SsoConfiguration_workspaceId_isActive_idx" ON "SsoConfiguration"("workspaceId", "isActive");

CREATE TABLE "ClaimedDomain" (
  "id" TEXT NOT NULL, "workspaceId" TEXT NOT NULL, "domain" TEXT NOT NULL, "verificationTokenHash" TEXT NOT NULL,
  "status" "DomainClaimStatus" NOT NULL DEFAULT 'PENDING', "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ClaimedDomain_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClaimedDomain_domain_key" ON "ClaimedDomain"("domain");
CREATE INDEX "ClaimedDomain_workspaceId_status_idx" ON "ClaimedDomain"("workspaceId", "status");

CREATE TABLE "BotEnvironment" (
  "id" TEXT NOT NULL, "botId" TEXT NOT NULL, "environment" "EnvironmentKind" NOT NULL, "publicKey" TEXT NOT NULL,
  "activeVersion" INTEGER, "pendingVersion" INTEGER, "approvalStatus" "PromotionStatus" NOT NULL DEFAULT 'IDLE',
  "requestedById" TEXT, "approvedById" TEXT, "requestedAt" TIMESTAMP(3), "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BotEnvironment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BotEnvironment_publicKey_key" ON "BotEnvironment"("publicKey");
CREATE UNIQUE INDEX "BotEnvironment_botId_environment_key" ON "BotEnvironment"("botId", "environment");

CREATE TABLE "PrivacyRequest" (
  "id" TEXT NOT NULL, "workspaceId" TEXT NOT NULL, "type" "PrivacyRequestType" NOT NULL, "subjectEmail" TEXT,
  "subjectHash" TEXT, "status" "PrivacyRequestStatus" NOT NULL DEFAULT 'OPEN', "evidence" JSONB,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" TIMESTAMP(3),
  CONSTRAINT "PrivacyRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PrivacyRequest_workspaceId_status_requestedAt_idx" ON "PrivacyRequest"("workspaceId", "status", "requestedAt");

CREATE TABLE "PluginManifest" (
  "id" TEXT NOT NULL, "slug" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT NOT NULL, "version" TEXT NOT NULL,
  "manifest" JSONB NOT NULL, "permissions" TEXT[] NOT NULL, "compatibility" TEXT NOT NULL,
  "reviewStatus" "PluginReviewStatus" NOT NULL DEFAULT 'PENDING', "securityNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PluginManifest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PluginManifest_slug_key" ON "PluginManifest"("slug");

CREATE TABLE "ChannelConnection" (
  "id" TEXT NOT NULL, "workspaceId" TEXT NOT NULL, "botId" TEXT NOT NULL, "channel" "ChannelKind" NOT NULL,
  "name" TEXT NOT NULL, "configEncrypted" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChannelConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ChannelConnection_botId_channel_name_key" ON "ChannelConnection"("botId", "channel", "name");

CREATE TABLE "BotTemplate" (
  "id" TEXT NOT NULL, "workspaceId" TEXT, "slug" TEXT NOT NULL, "name" TEXT NOT NULL, "industry" TEXT NOT NULL,
  "description" TEXT NOT NULL, "config" JSONB NOT NULL, "locale" TEXT NOT NULL DEFAULT 'en',
  "isPublic" BOOLEAN NOT NULL DEFAULT false, "isReviewed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BotTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BotTemplate_slug_key" ON "BotTemplate"("slug");

CREATE TABLE "Experiment" (
  "id" TEXT NOT NULL, "botId" TEXT NOT NULL, "name" TEXT NOT NULL, "status" "ExperimentStatus" NOT NULL DEFAULT 'DRAFT',
  "controlVersion" INTEGER NOT NULL, "variantVersion" INTEGER NOT NULL, "allocation" INTEGER NOT NULL DEFAULT 50,
  "guardrails" JSONB, "metrics" JSONB, "startedAt" TIMESTAMP(3), "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Experiment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Experiment_botId_status_idx" ON "Experiment"("botId", "status");

CREATE TABLE "PlatformAlert" (
  "id" TEXT NOT NULL, "fingerprint" TEXT NOT NULL, "type" TEXT NOT NULL, "title" TEXT NOT NULL,
  "description" TEXT NOT NULL, "severity" "AlertSeverity" NOT NULL, "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
  "ownerLabel" TEXT, "notes" TEXT, "incidentUrl" TEXT, "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "acknowledgedAt" TIMESTAMP(3), "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformAlert_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlatformAlert_fingerprint_key" ON "PlatformAlert"("fingerprint");
CREATE INDEX "PlatformAlert_status_severity_lastSeenAt_idx" ON "PlatformAlert"("status", "severity", "lastSeenAt");

ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceInvitation" ADD CONSTRAINT "WorkspaceInvitation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationNote" ADD CONSTRAINT "ConversationNote_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationNote" ADD CONSTRAINT "ConversationNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceAccount" ADD CONSTRAINT "ServiceAccount_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceAccount" ADD CONSTRAINT "ServiceAccount_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceApiKey" ADD CONSTRAINT "ServiceApiKey_serviceAccountId_fkey" FOREIGN KEY ("serviceAccountId") REFERENCES "ServiceAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SsoConfiguration" ADD CONSTRAINT "SsoConfiguration_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClaimedDomain" ADD CONSTRAINT "ClaimedDomain_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BotEnvironment" ADD CONSTRAINT "BotEnvironment_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrivacyRequest" ADD CONSTRAINT "PrivacyRequest_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChannelConnection" ADD CONSTRAINT "ChannelConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChannelConnection" ADD CONSTRAINT "ChannelConnection_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BotTemplate" ADD CONSTRAINT "BotTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Experiment" ADD CONSTRAINT "Experiment_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "WorkspaceMember" ("id", "workspaceId", "userId", "role", "createdAt", "updatedAt")
SELECT CONCAT('owner_', "id"), "id", "ownerId", 'OWNER'::"WorkspaceRole", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Workspace"
ON CONFLICT ("workspaceId", "userId") DO NOTHING;

INSERT INTO "BotEnvironment" ("id", "botId", "environment", "publicKey", "activeVersion", "createdAt", "updatedAt")
SELECT CONCAT('prod_', "id"), "id", 'PRODUCTION'::"EnvironmentKind", CONCAT("publicKey", '_prod'), NULLIF("publishedVersion", 0), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Bot"
ON CONFLICT ("botId", "environment") DO NOTHING;
