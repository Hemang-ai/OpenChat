import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { processWebhookBatch } from "@/lib/integrations/webhooks";

export async function POST(req: NextRequest) {
  const secret = process.env.WEBHOOK_WORKER_SECRET || process.env.INGESTION_WORKER_SECRET;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!secret || bearer.length !== secret.length || !timingSafeEqual(Buffer.from(secret), Buffer.from(bearer))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await processWebhookBatch(Number(req.nextUrl.searchParams.get("limit") || 20)));
}
