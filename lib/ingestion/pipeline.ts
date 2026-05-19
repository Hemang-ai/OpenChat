import { db } from "@/lib/db/client";
import { getLLMProvider, getAIConfigForBot } from "@/lib/ai/provider";
import { chunkText } from "./chunker";
import { extractPdfText } from "@/lib/loaders/pdf";
import { extractDocxText } from "@/lib/loaders/docx";
import { extractWebsiteText } from "@/lib/loaders/website";
import { extractYouTubeTranscript } from "@/lib/loaders/youtube";
import path from "path";
import fs from "fs";

export async function ingestKnowledgeSource(sourceId: string): Promise<void> {
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

    switch (source.type) {
      case "FILE": {
        if (!source.filePath) throw new Error("No file path");
        const ext = path.extname(source.filePath).toLowerCase();
        if (ext === ".pdf") {
          text = await extractPdfText(source.filePath);
        } else if (ext === ".docx") {
          text = await extractDocxText(source.filePath);
        } else if ([".txt", ".md", ".csv"].includes(ext)) {
          text = fs.readFileSync(source.filePath, "utf-8");
        } else {
          throw new Error(`Unsupported file type: ${ext}`);
        }
        break;
      }
      case "WEBSITE": {
        if (!source.url) throw new Error("No URL");
        text = await extractWebsiteText(source.url);
        title = source.url;
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

    const document = await db.document.create({
      data: {
        title,
        content: text,
        knowledgeSourceId: sourceId,
      },
    });

    const chunks = chunkText(text);
    const aiConfig = await getAIConfigForBot(source.botId);
    const provider = getLLMProvider(aiConfig);

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

    await db.knowledgeSource.update({
      where: { id: sourceId },
      data: {
        status: "COMPLETED",
        metadata: {
          ...(source.metadata as object | null || {}),
          chunkCount: chunks.length,
          charCount: text.length,
        },
      },
    });

    // Refresh starter questions in the background (don't block ingestion completion)
    import("@/lib/rag/suggested-questions").then((m) =>
      m.generateSuggestedQuestions(source.botId).catch((e) =>
        console.warn("Failed to refresh suggested questions:", e)
      )
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await db.knowledgeSource.update({
      where: { id: sourceId },
      data: { status: "FAILED", errorMessage: message },
    });
    throw err;
  }
}
