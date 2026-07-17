import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/jwt";
import { db } from "@/lib/db/client";
import { touchBotDraft } from "@/lib/bots/versioning";
import { canAccessBot, type WorkspacePermission } from "@/lib/auth/workspace-access";

async function sourceForUser(botId: string, sourceId: string, userId: string, permission: WorkspacePermission) {
  return await canAccessBot(botId, userId, permission) ? db.knowledgeSource.findFirst({ where: { id: sourceId, botId } }) : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ botId: string; sourceId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId, sourceId } = await params;
  const source = await sourceForUser(botId, sourceId, session.userId, "bot:read");
  if (!source) return NextResponse.json({ error: "Source not found" }, { status: 404 });
  const documents = await db.document.findMany({
    where: { knowledgeSourceId: sourceId },
    select: { id: true, title: true, content: true, chunks: { orderBy: { chunkIndex: "asc" }, take: 8, select: { id: true, chunkIndex: true, content: true } } },
  });
  return NextResponse.json({
    source,
    extraction: documents.map((document) => ({ id: document.id, title: document.title, preview: document.content.slice(0, 5000), charCount: document.content.length, chunks: document.chunks })),
  });
}

const lifecycleSchema = z.object({
  ownerLabel: z.string().max(120).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  reviewStatus: z.enum(["APPROVED", "NEEDS_REVIEW", "ARCHIVED"]).optional(),
  // Reset alongside reviewStatus so "mark reviewed" can also clear a
  // conflict flag once the admin has confirmed the content is fine.
  conflictStatus: z.enum(["CLEAR", "DUPLICATE", "POSSIBLE_CONFLICT"]).optional(),
  expiresAt: z.string().datetime().optional().nullable(),
  citationVisibility: z.enum(["PUBLIC", "HIDDEN"]).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ botId: string; sourceId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId, sourceId } = await params;
  if (!await sourceForUser(botId, sourceId, session.userId, "knowledge:write")) return NextResponse.json({ error: "Source not found" }, { status: 404 });
  try {
    const data = lifecycleSchema.parse(await req.json());
    const source = await db.knowledgeSource.update({
      where: { id: sourceId },
      data: {
        ownerLabel: data.ownerLabel,
        tags: data.tags,
        reviewStatus: data.reviewStatus,
        conflictStatus: data.conflictStatus,
        expiresAt: data.expiresAt === null ? null : data.expiresAt ? new Date(data.expiresAt) : undefined,
        citationVisibility: data.citationVisibility,
        lastReviewedAt: data.reviewStatus === "APPROVED" ? new Date() : undefined,
      },
    });
    await touchBotDraft(botId);
    return NextResponse.json({ source });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Invalid source settings" }, { status: 400 });
    return NextResponse.json({ error: "Source update failed" }, { status: 500 });
  }
}
