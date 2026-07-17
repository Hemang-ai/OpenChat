import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { hasWorkspaceSecretsKey } from "@/lib/security/secrets";

export async function GET() {
  const started = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "reachable", latencyMs: Date.now() - started, configuration: { secretsEncryption: hasWorkspaceSecretsKey(), ingestionWorker: Boolean(process.env.INGESTION_WORKER_SECRET), maintenanceWorker: Boolean(process.env.MAINTENANCE_WORKER_SECRET || process.env.INGESTION_WORKER_SECRET) }, version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || "local" });
  } catch {
    return NextResponse.json({ status: "degraded", database: "unreachable", latencyMs: Date.now() - started }, { status: 503 });
  }
}
