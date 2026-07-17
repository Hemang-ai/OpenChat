-- Per-question verification records for the Suggested-Question Assurance
-- Engine (evidence counts, similarity, rejection reasons), keyed by language.
ALTER TABLE "Bot" ADD COLUMN "suggestedQuestionsMeta" JSONB;
