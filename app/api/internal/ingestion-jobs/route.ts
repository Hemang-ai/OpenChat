import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { runIngestionJob } from "@/lib/ingestion/jobs";
import { scheduleDueSourceRefreshes } from "@/lib/ingestion/refresh";

export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.INGESTION_WORKER_SECRET;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!secret || bearer.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(bearer), Buffer.from(secret));
}

/** Queue/cron entry point for every source type, including private stored uploads. */
export async function POST(req: NextRequest) {
  if (!process.env.INGESTION_WORKER_SECRET) {
    return NextResponse.json({ error: "Ingestion worker is not configured" }, { status: 503 });
  }
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const batchSize = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") || 10), 1), 25);
  const scheduled = await scheduleDueSourceRefreshes(batchSize);
  const jobs = await db.ingestionJob.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      runAfter: { lte: new Date() },
      attempts: { lt: 3 },
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: batchSize,
  });

  const results = await Promise.allSettled(jobs.map((job) => runIngestionJob(job.id)));
  const completed = results.filter((result) => result.status === "fulfilled" && result.value.status === "COMPLETED").length;
  return NextResponse.json({ scheduled, claimed: jobs.length, completed, failed: jobs.length - completed });
}
