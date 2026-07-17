import type { IngestionJob, IngestionJobStatus } from "@prisma/client";
import { db } from "@/lib/db/client";
import { ingestKnowledgeSource } from "@/lib/ingestion/pipeline";

export interface IngestionJobInput {
  fileName?: string;
  retryable?: boolean;
}

export async function createIngestionJob(sourceId: string, input: IngestionJobInput = {}): Promise<IngestionJob> {
  return db.ingestionJob.create({
    data: {
      knowledgeSourceId: sourceId,
      input: input as object,
    },
  });
}

/**
 * Claims and runs one job. The caller may execute this inline today or from a
 * future worker/queue; the persisted job contract is identical in both modes.
 */
export async function runIngestionJob(
  jobId: string,
  fileBuffer?: Buffer
): Promise<{ job: IngestionJob; status: IngestionJobStatus }> {
  const existing = await db.ingestionJob.findUniqueOrThrow({ where: { id: jobId } });
  if (existing.status === "CANCELLED" || existing.status === "COMPLETED" || existing.attempts >= existing.maxAttempts) {
    return { job: existing, status: existing.status };
  }
  const claimed = await db.ingestionJob.updateMany({
    where: { id: jobId, status: { in: ["PENDING", "FAILED"] } },
    data: {
      status: "PROCESSING",
      attempts: { increment: 1 },
      startedAt: new Date(),
      errorMessage: null,
    },
  });

  if (claimed.count === 0) {
    const job = await db.ingestionJob.findUniqueOrThrow({ where: { id: jobId } });
    return { job, status: job.status };
  }

  const job = await db.ingestionJob.findUniqueOrThrow({ where: { id: jobId } });
  const input = (job.input || {}) as IngestionJobInput;

  try {
    await ingestKnowledgeSource(job.knowledgeSourceId, {
      fileBuffer,
      fileName: input.fileName,
    });
    const completed = await db.ingestionJob.update({
      where: { id: jobId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    return { job: completed, status: completed.status };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Knowledge processing failed";
    const retryDelaySeconds = Math.min(60 * 2 ** Math.max(job.attempts - 1, 0), 3600);
    const failed = await db.ingestionJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        errorMessage: message,
        completedAt: new Date(),
        runAfter: new Date(Date.now() + retryDelaySeconds * 1000),
      },
    });
    throw Object.assign(new Error(message), { job: failed });
  }
}
