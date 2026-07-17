import { NextRequest, NextResponse } from "next/server";
import { authenticateServiceRequest } from "@/lib/auth/service-api";
import { db } from "@/lib/db/client";

export async function GET(req: NextRequest) {
  const identity = await authenticateServiceRequest(req, "bots:read");
  if (!identity) return NextResponse.json({ error: "Unauthorized or missing bots:read scope" }, { status: 401 });
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") || 25), 1), 100);
  const cursor = req.nextUrl.searchParams.get("cursor") || undefined;
  const bots = await db.bot.findMany({ where: { workspaceId: identity.workspaceId }, select: { id: true, name: true, description: true, isActive: true, publishedVersion: true, publishedAt: true, createdAt: true, updatedAt: true }, orderBy: { id: "asc" }, take: limit + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
  const hasMore = bots.length > limit;
  return NextResponse.json({ object: "list", data: bots.slice(0, limit), nextCursor: hasMore ? bots[limit - 1]?.id : null }, { headers: { "X-API-Version": "2026-07-14", "X-RateLimit-Policy": "service-account" } });
}
