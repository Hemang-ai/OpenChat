import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/jwt";
import { db } from "@/lib/db/client";
import { ingestKnowledgeSource } from "@/lib/ingestion/pipeline";
import { isValidUrl, isAllowedFile, getMaxFileSizeBytes } from "@/lib/utils/validation";
import fs from "fs";

export const maxDuration = 300;

const urlSchema = z.object({
  type: z.enum(["WEBSITE", "YOUTUBE", "MANUAL"]),
  url: z.string().url().optional(),
  name: z.string().min(1).max(200),
  content: z.string().max(50000).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId } = await params;

  const bot = await db.bot.findFirst({
    where: { id: botId, workspace: { ownerId: session.userId } },
  });
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
      await ingestKnowledgeSource(source.id, { fileBuffer: buffer, fileName: file.name });
      const completedSource = await db.knowledgeSource.findUnique({ where: { id: source.id } });
      return NextResponse.json({ source: completedSource }, { status: 201 });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Document processing failed";
      return NextResponse.json({ error: message, sourceId: source.id }, { status: 422 });
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
      },
    });

    try {
      await ingestKnowledgeSource(source.id);
      const completedSource = await db.knowledgeSource.findUnique({ where: { id: source.id } });
      return NextResponse.json({ source: completedSource }, { status: 201 });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Knowledge processing failed";
      return NextResponse.json({ error: message, sourceId: source.id }, { status: 422 });
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

  const { sourceId } = await req.json();

  const source = await db.knowledgeSource.findFirst({
    where: { id: sourceId, botId, bot: { workspace: { ownerId: session.userId } } },
  });
  if (!source) return NextResponse.json({ error: "Source not found" }, { status: 404 });

  if (source.filePath && fs.existsSync(source.filePath)) {
    fs.unlinkSync(source.filePath);
  }

  await db.knowledgeSource.delete({ where: { id: sourceId } });
  return NextResponse.json({ success: true });
}

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId } = await params;

  const body = await _req.json().catch(() => null);
  const parsed = z.object({ sourceId: z.string().min(1) }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A source ID is required" }, { status: 400 });
  }

  const source = await db.knowledgeSource.findFirst({
    where: {
      id: parsed.data.sourceId,
      botId,
      bot: { workspace: { ownerId: session.userId } },
    },
  });
  if (!source) return NextResponse.json({ error: "Source not found" }, { status: 404 });
  if (source.type === "FILE") {
    return NextResponse.json(
      { error: "Files must be uploaded again because their contents are not retained on the application server." },
      { status: 409 }
    );
  }

  try {
    await ingestKnowledgeSource(source.id);
    const completedSource = await db.knowledgeSource.findUnique({ where: { id: source.id } });
    return NextResponse.json({ source: completedSource });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Knowledge processing failed";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
