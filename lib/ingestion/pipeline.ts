import { db } from "@/lib/db/client";
import { getLLMProvider, getAIConfigForBot } from "@/lib/ai/provider";
import { chunkText } from "./chunker";
import { extractDocxText, extractDocxTextFromBuffer } from "@/lib/loaders/docx";
import { crawlWebsite } from "@/lib/loaders/website";
import { extractYouTubeTranscript } from "@/lib/loaders/youtube";
import path from "path";
import { assessIngestedContent } from "@/lib/ingestion/quality";
import { touchBotDraft } from "@/lib/bots/versioning";
import { readPrivateUpload } from "@/lib/storage/private-object-store";

interface IngestionInput {
  fileBuffer?: Buffer;
  fileName?: string;
}

export async function ingestKnowledgeSource(
  sourceId: string,
  input: IngestionInput = {}
): Promise<void> {
  const source = await db.knowledgeSource.findUnique({
    where: { id: sourceId },
  });
  if (!source) throw new Error("Knowledge source not found");

  await db.knowledgeSource.update({
    where: { id: sourceId },
    data: { status: "PROCESSING" },
  });

  try {
    let text = "";
    let title = source.name;
    // Extraction-quality signal: populated by loaders that can measure
    // completeness; other types are scored on extracted length below.
    let extractionQuality: Record<string, unknown> | null = null;

    // Resolve the embedding provider before extraction so configuration errors
    // are returned quickly and do not leave a source stuck in PROCESSING.
    const aiConfig = await getAIConfigForBot(source.botId);
    const provider = getLLMProvider(aiConfig);

    switch (source.type) {
      case "FILE": {
        const ext = path.extname(input.fileName || source.name || source.filePath || "").toLowerCase();
        const buffer = input.fileBuffer || (source.filePath ? await readPrivateUpload(source.filePath) : undefined);
        if (!buffer && !source.filePath) throw new Error("The uploaded file is no longer available. Please upload it again.");
        if (ext === ".pdf") {
          const { extractPdfText, extractPdfTextFromBuffer } = await import("@/lib/loaders/pdf");
          text = buffer ? await extractPdfTextFromBuffer(buffer) : await extractPdfText(source.filePath!);
        } else if (ext === ".docx") {
          text = buffer ? await extractDocxTextFromBuffer(buffer) : await extractDocxText(source.filePath!);
        } else if ([".txt", ".md", ".csv"].includes(ext)) {
          text = buffer ? buffer.toString("utf-8") : "";
        } else {
          throw new Error(`Unsupported file type: ${ext}`);
        }
        break;
      }
      case "WEBSITE": {
        if (!source.url) throw new Error("No URL");
        const crawled = await crawlWebsite(source.url, (source.crawlConfig || {}) as {
          enabled?: boolean; maxPages?: number; maxDepth?: number; includePaths?: string[]; excludePaths?: string[];
        });
        text = crawled.text;
        title = source.url;
        extractionQuality = { ...crawled.quality };
        source.metadata = { ...(source.metadata as object | null || {}), crawledPages: crawled.pages };
        break;
      }
      case "YOUTUBE": {
        if (!source.url) throw new Error("No URL");
        text = await extractYouTubeTranscript(source.url);
        title = `YouTube: ${source.url}`;
        break;
      }
      case "MANUAL": {
        const meta = source.metadata as { content?: string } | null;
        text = meta?.content || "";
        break;
      }
      default:
        throw new Error(`Unsupported source type: ${source.type}`);
    }

    if (!text || text.trim().length < 10) {
      throw new Error("Extracted text is empty or too short");
    }

    await db.document.deleteMany({ where: { knowledgeSourceId: sourceId } });

    const document = await db.document.create({
      data: {
        title,
        content: text,
        knowledgeSourceId: sourceId,
      },
    });

    const chunks = chunkText(text);
    // Process embeddings in batches
    const BATCH = 10;
    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async (chunk) => {
          const embedding = await provider.embed(chunk.content);
          const embeddingStr = `[${embedding.join(",")}]`;

          await db.$executeRaw`
            INSERT INTO "DocumentChunk" (id, content, "chunkIndex", embedding, "documentId", "createdAt")
            VALUES (
              gen_random_uuid()::text,
              ${chunk.content},
              ${chunk.index},
              ${embeddingStr}::vector,
              ${document.id},
              NOW()
            )
          `;
        })
      );
    }

    // Non-website types get a simple length-based completeness signal so the
    // knowledge tab can always show one.
    if (!extractionQuality) {
      extractionQuality = {
        completeness: text.length >= 500 ? "complete" : text.length >= 100 ? "partial" : "low",
      };
    }

    const quality = await assessIngestedContent(source.botId, sourceId, text);
    await db.knowledgeSource.update({
      where: { id: sourceId },
      data: {
        status: "COMPLETED",
        metadata: {
          ...(source.metadata as object | null || {}),
          chunkCount: chunks.length,
          charCount: text.length,
          conflictMatches: quality.matches,
          extraction: JSON.parse(JSON.stringify(extractionQuality)),
        },
        contentHash: quality.contentHash,
        conflictStatus: quality.conflictStatus,
        reviewStatus: quality.conflictStatus === "CLEAR" ? "APPROVED" : "NEEDS_REVIEW",
        lastReviewedAt: quality.conflictStatus === "CLEAR" ? new Date() : null,
        lastSyncedAt: new Date(),
        nextRefreshAt: source.refreshIntervalHours
          ? new Date(Date.now() + source.refreshIntervalHours * 60 * 60_000)
          : null,
        sourceVersion: { increment: 1 },
      },
    });
    await touchBotDraft(source.botId);

    try {
      const { generateSuggestedQuestions } = await import("@/lib/rag/suggested-questions");
      await generateSuggestedQuestions(source.botId);
    } catch (error) {
      console.warn("Failed to refresh suggested questions:", error);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await db.knowledgeSource.update({
      where: { id: sourceId },
      data: { status: "FAILED", errorMessage: message },
    }).catch((updateError) => console.error("Failed to store ingestion error", updateError));
    throw err;
  }
}
