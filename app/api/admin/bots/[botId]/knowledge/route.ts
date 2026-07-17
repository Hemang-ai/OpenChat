import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/jwt";
import { db } from "@/lib/db/client";
import { createIngestionJob, runIngestionJob } from "@/lib/ingestion/jobs";
import { isValidUrl, isAllowedFile, getMaxFileSizeBytes, hasValidFileSignature } from "@/lib/utils/validation";
import { writeAuditEvent } from "@/lib/security/audit";
import { touchBotDraft } from "@/lib/bots/versioning";
import { canAccessBot } from "@/lib/auth/workspace-access";
import { deletePrivateUpload, putPrivateUpload } from "@/lib/storage/private-object-store";

export const maxDuration = 300;

const urlSchema = z.object({
  type: z.enum(["WEBSITE", "YOUTUBE", "MANUAL"]),
  url: z.string().url().optional(),
  name: z.string().min(1).max(200),
  content: z.string().max(50000).optional(),
  crawlConfig: z.object({
    enabled: z.boolean().default(false),
    maxPages: z.number().int().min(1).max(50).default(10),
    maxDepth: z.number().int().min(0).max(3).default(1),
    includePaths: z.array(z.string().max(200)).max(20).default([]),
    excludePaths: z.array(z.string().max(200)).max(20).default([]),
  }).optional(),
  refreshIntervalHours: z.number().int().min(1).max(8760).optional().nullable(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId } = await params;
  if (!await canAccessBot(botId, session.userId, "knowledge:write")) return NextResponse.json({ error: "Bot not found" }, { status: 404 });

  const bot = await db.bot.findUnique({ where: { id: botId } });
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });

  const contentType = req.headers.get("content-type") || "";

  // Handle file uploads
  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const maxBytes = getMaxFileSizeBytes();
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: `File too large. Max size is ${process.env.MAX_FILE_SIZE_MB || 10}MB` },
        { status: 400 }
      );
    }

    if (!isAllowedFile(file.name, file.type)) {
      return NextResponse.json(
        { error: "File type not allowed. Supported: PDF, DOCX, TXT, MD, CSV" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!hasValidFileSignature(file.name, buffer)) {
      return NextResponse.json({ error: "The file contents do not match the selected file type." }, { status: 400 });
    }

    const source = await db.knowledgeSource.create({
      data: {
        botId,
        type: "FILE",
        name: file.name,
        mimeType: file.type,
        fileSize: file.size,
      },
    });

    try {
      const filePath = await putPrivateUpload({ workspaceId: bot.workspaceId, botId, sourceId: source.id, fileName: file.name, body: buffer, contentType: file.type });
      await db.knowledgeSource.update({ where: { id: source.id }, data: { filePath } });
    } catch (error) {
      await db.knowledgeSource.delete({ where: { id: source.id } });
      throw error;
    }

    const job = await createIngestionJob(source.id, { fileName: file.name, retryable: true });

    try {
      await runIngestionJob(job.id);
      const completedSource = await db.knowledgeSource.findUnique({ where: { id: source.id } });
      await writeAuditEvent({
        type: "knowledge.ingested",
        actorId: session.userId,
        workspaceId: bot.workspaceId,
        targetType: "knowledgeSource",
        targetId: source.id,
        metadata: { type: "FILE", jobId: job.id },
      });
      return NextResponse.json({ source: completedSource, jobId: job.id }, { status: 201 });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Document processing failed";
      return NextResponse.json({ error: message, sourceId: source.id, jobId: job.id }, { status: 422 });
    }
  }

  // Handle URL / manual sources
  try {
    const body = await req.json();
    const data = urlSchema.parse(body);

    if ((data.type === "WEBSITE" || data.type === "YOUTUBE") && data.url) {
      if (!isValidUrl(data.url)) {
        return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
      }
    }

    const source = await db.knowledgeSource.create({
      data: {
        botId,
        type: data.type,
        name: data.name,
        url: data.url,
        metadata: data.content ? { content: data.content } : undefined,
        crawlConfig: data.type === "WEBSITE" ? data.crawlConfig : undefined,
        refreshIntervalHours: data.refreshIntervalHours,
        nextRefreshAt: data.refreshIntervalHours ? new Date(Date.now() + data.refreshIntervalHours * 60 * 60_000) : undefined,
      },
    });

    const job = await createIngestionJob(source.id, { retryable: true });

    try {
      await runIngestionJob(job.id);
      const completedSource = await db.knowledgeSource.findUnique({ where: { id: source.id } });
      await writeAuditEvent({
        type: "knowledge.ingested",
        actorId: session.userId,
        workspaceId: bot.workspaceId,
        targetType: "knowledgeSource",
        targetId: source.id,
        metadata: { type: data.type, jobId: job.id },
      });
      return NextResponse.json({ source: completedSource, jobId: job.id }, { status: 201 });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Knowledge processing failed";
      return NextResponse.json({ error: message, sourceId: source.id, jobId: job.id }, { status: 422 });
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to add knowledge source" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId } = await params;
  if (!await canAccessBot(botId, session.userId, "knowledge:write")) return NextResponse.json({ error: "Source not found" }, { status: 404 });

  const { sourceId } = await req.json();

  const source = await db.knowledgeSource.findFirst({
    where: { id: sourceId, botId },
    include: { bot: { select: { publishedSourceIds: true } } },
  });
  if (!source) return NextResponse.json({ error: "Source not found" }, { status: 404 });

  if (source.bot.publishedSourceIds.includes(sourceId)) {
    await db.knowledgeSource.update({ where: { id: sourceId }, data: { reviewStatus: "ARCHIVED" } });
    await touchBotDraft(botId);
    return NextResponse.json({ success: true, archived: true, message: "Source archived in the draft and retained for the live version until the next publish." });
  }

  if (source.filePath) await deletePrivateUpload(source.filePath);

  await db.knowledgeSource.delete({ where: { id: sourceId } });
  await touchBotDraft(botId);
  return NextResponse.json({ success: true });
}

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId } = await params;
  if (!await canAccessBot(botId, session.userId, "knowledge:write")) return NextResponse.json({ error: "Source not found" }, { status: 404 });

  const body = await _req.json().catch(() => null);
  const parsed = z.object({ sourceId: z.string().min(1) }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A source ID is required" }, { status: 400 });
  }

  const source = await db.knowledgeSource.findFirst({
    where: {
      id: parsed.data.sourceId,
      botId,
    },
  });
  if (!source) return NextResponse.json({ error: "Source not found" }, { status: 404 });
  if (source.type === "FILE") {
    return NextResponse.json(
      { error: "Files must be uploaded again because their contents are not retained on the application server." },
      { status: 409 }
    );
  }

  const job = await createIngestionJob(source.id, { retryable: true });
  try {
    await runIngestionJob(job.id);
    const completedSource = await db.knowledgeSource.findUnique({ where: { id: source.id } });
    return NextResponse.json({ source: completedSource, jobId: job.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Knowledge processing failed";
    return NextResponse.json({ error: message, jobId: job.id }, { status: 422 });
  }
}
