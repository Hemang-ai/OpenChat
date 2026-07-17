import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { enforceRetention, processPrivacyRequests } from "@/lib/governance/retention";

export async function POST(req: NextRequest) {
  const secret = process.env.MAINTENANCE_WORKER_SECRET || process.env.INGESTION_WORKER_SECRET;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!secret || bearer.length !== secret.length || !timingSafeEqual(Buffer.from(secret), Buffer.from(bearer))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [retention, privacy] = await Promise.all([enforceRetention(), processPrivacyRequests()]);
  return NextResponse.json({ retention, privacy });
}
