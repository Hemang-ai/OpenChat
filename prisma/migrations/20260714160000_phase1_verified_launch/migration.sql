-- Phase 1: verified launch, immutable bot versions, evaluations, source
-- lifecycle, feedback, and knowledge-gap records. Existing bots retain their
-- current public behavior and are captured as version 1.

CREATE TYPE "SourceReviewStatus" AS ENUM ('APPROVED', 'NEEDS_REVIEW', 'ARCHIVED');
CREATE TYPE "SourceConflictStatus" AS ENUM ('CLEAR', 'DUPLICATE', 'POSSIBLE_CONFLICT');
CREATE TYPE "CitationVisibility" AS ENUM ('PUBLIC', 'HIDDEN');
CREATE TYPE "EvaluationRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "EvaluationRunStatus" AS ENUM ('PASSED', 'FAILED');
CREATE TYPE "FeedbackRating" AS ENUM ('POSITIVE', 'NEGATIVE');
CREATE TYPE "KnowledgeGapStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

ALTER TABLE "Bot"
  ADD COLUMN "draftConfig" JSONB,
  ADD COLUMN "draftSuggestedQuestions" JSONB,
  ADD COLUMN "draftSuggestedQuestionsUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "draftRevision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "publishedVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "publishedSourceIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "allowedOrigins" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "privacyNotice" TEXT NOT NULL DEFAULT 'Messages may be processed by AI to answer your questions. Do not share sensitive information.',
  ADD COLUMN "industryTemplate" TEXT;

ALTER TABLE "KnowledgeSource"
  ADD COLUMN "ownerLabel" TEXT,
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "reviewStatus" "SourceReviewStatus" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "lastReviewedAt" TIMESTAMP(3),
  ADD COLUMN "contentHash" TEXT,
  ADD COLUMN "conflictStatus" "SourceConflictStatus" NOT NULL DEFAULT 'CLEAR',
  ADD COLUMN "citationVisibility" "CitationVisibility" NOT NULL DEFAULT 'PUBLIC';

ALTER TABLE "Conversation" ADD COLUMN "botVersion" INTEGER;
ALTER TABLE "Message" ADD COLUMN "evidenceScore" DOUBLE PRECISION, ADD COLUMN "latencyMs" INTEGER;

CREATE TABLE "BotVersion" (
  "id" TEXT NOT NULL,
  "botId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "config" JSONB NOT NULL,
  "sourceSnapshot" JSONB NOT NULL,
  "evaluationSummary" JSONB,
  "evaluationRunId" TEXT,
  "rollbackFromVersion" INTEGER,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BotVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EvaluationCase" (
  "id" TEXT NOT NULL,
  "botId" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "expectedAnswer" TEXT,
  "allowRefusal" BOOLEAN NOT NULL DEFAULT false,
  "requiredSourceIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "riskLevel" "EvaluationRiskLevel" NOT NULL DEFAULT 'MEDIUM',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EvaluationCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EvaluationRun" (
  "id" TEXT NOT NULL,
  "botId" TEXT NOT NULL,
  "draftRevision" INTEGER NOT NULL,
  "botVersion" INTEGER,
  "status" "EvaluationRunStatus" NOT NULL,
  "total" INTEGER NOT NULL,
  "passed" INTEGER NOT NULL,
  "failed" INTEGER NOT NULL,
  "results" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EvaluationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MessageFeedback" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "rating" "FeedbackRating" NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MessageFeedback_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeGap" (
  "id" TEXT NOT NULL,
  "botId" TEXT NOT NULL,
  "normalizedQuestion" TEXT NOT NULL,
  "exampleQuestion" TEXT NOT NULL,
  "occurrences" INTEGER NOT NULL DEFAULT 1,
  "status" "KnowledgeGapStatus" NOT NULL DEFAULT 'OPEN',
  "resolvedSourceId" TEXT,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "KnowledgeGap_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BotVersion_botId_version_key" ON "BotVersion"("botId", "version");
CREATE INDEX "BotVersion_botId_createdAt_idx" ON "BotVersion"("botId", "createdAt");
CREATE INDEX "EvaluationCase_botId_createdAt_idx" ON "EvaluationCase"("botId", "createdAt");
CREATE INDEX "EvaluationRun_botId_createdAt_idx" ON "EvaluationRun"("botId", "createdAt");
CREATE UNIQUE INDEX "MessageFeedback_messageId_key" ON "MessageFeedback"("messageId");
CREATE UNIQUE INDEX "KnowledgeGap_botId_normalizedQuestion_key" ON "KnowledgeGap"("botId", "normalizedQuestion");
CREATE INDEX "KnowledgeGap_botId_status_occurrences_idx" ON "KnowledgeGap"("botId", "status", "occurrences");

ALTER TABLE "BotVersion" ADD CONSTRAINT "BotVersion_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BotVersion" ADD CONSTRAINT "BotVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EvaluationCase" ADD CONSTRAINT "EvaluationCase_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EvaluationRun" ADD CONSTRAINT "EvaluationRun_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageFeedback" ADD CONSTRAINT "MessageFeedback_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeGap" ADD CONSTRAINT "KnowledgeGap_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeGap" ADD CONSTRAINT "KnowledgeGap_resolvedSourceId_fkey" FOREIGN KEY ("resolvedSourceId") REFERENCES "KnowledgeSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "Bot" b
SET
  "publishedVersion" = 1,
  "publishedAt" = COALESCE(b."updatedAt", CURRENT_TIMESTAMP),
  "publishedSourceIds" = COALESCE((SELECT array_agg(ks."id" ORDER BY ks."id") FROM "KnowledgeSource" ks WHERE ks."botId" = b."id" AND ks."status" = 'COMPLETED'), ARRAY[]::TEXT[]);

INSERT INTO "BotVersion" ("id", "botId", "version", "config", "sourceSnapshot", "createdById", "createdAt")
SELECT
  b."id" || '-version-1',
  b."id",
  1,
  jsonb_build_object(
    'name', b."name",
    'description', b."description",
    'welcomeMessage', b."welcomeMessage",
    'systemPrompt', b."systemPrompt",
    'businessContext', b."businessContext",
    'tone', b."tone",
    'strictness', b."strictness",
    'fallbackBehavior', b."fallbackBehavior",
    'contactInfo', b."contactInfo",
    'leadCaptureEnabled', b."leadCaptureEnabled",
    'leadCapturePrompt', b."leadCapturePrompt",
    'isActive', b."isActive",
    'allowedOrigins', ARRAY[]::TEXT[],
    'privacyNotice', 'Messages may be processed by AI to answer your questions. Do not share sensitive information.',
    'suggestedQuestions', COALESCE(b."suggestedQuestions", '[]'::jsonb)
  ),
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', ks."id", 'name', ks."name", 'updatedAt', ks."updatedAt"))
    FROM "KnowledgeSource" ks WHERE ks."botId" = b."id" AND ks."status" = 'COMPLETED'
  ), '[]'::jsonb),
  w."ownerId",
  COALESCE(b."updatedAt", CURRENT_TIMESTAMP)
FROM "Bot" b
JOIN "Workspace" w ON w."id" = b."workspaceId";
