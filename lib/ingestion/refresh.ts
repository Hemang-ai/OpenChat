import { db } from "@/lib/db/client";
import { createIngestionJob } from "@/lib/ingestion/jobs";

export async function scheduleDueSourceRefreshes(limit = 25) {
  const due = await db.knowledgeSource.findMany({
    where: {
      type: { in: ["WEBSITE", "YOUTUBE", "MANUAL", "GOOGLE_DRIVE"] },
      status: "COMPLETED",
      refreshIntervalHours: { not: null },
      nextRefreshAt: { lte: new Date() },
      ingestionJobs: { none: { status: { in: ["PENDING", "PROCESSING"] } } },
    },
    select: { id: true, refreshIntervalHours: true },
    orderBy: { nextRefreshAt: "asc" },
    take: Math.min(Math.max(limit, 1), 100),
  });

  await Promise.all(due.map(async (source) => {
    await createIngestionJob(source.id, { retryable: true });
    await db.knowledgeSource.update({
      where: { id: source.id },
      data: { nextRefreshAt: new Date(Date.now() + (source.refreshIntervalHours || 24) * 60 * 60_000) },
    });
  }));
  return due.length;
}
