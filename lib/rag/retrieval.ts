import { db } from "@/lib/db/client";
import { getLLMProvider, AIConfig } from "@/lib/ai/provider";

export interface RetrievedChunk {
  id: string;
  content: string;
  chunkIndex: number;
  documentId: string;
  documentTitle?: string | null;
  similarity: number;
}

export async function retrieveRelevantChunks(
  botId: string,
  query: string,
  topK = 5,
  aiConfig: AIConfig = {}
): Promise<RetrievedChunk[]> {
  const provider = getLLMProvider(aiConfig);
  const queryEmbedding = await provider.embed(query);
  const embeddingStr = `[${queryEmbedding.join(",")}]`;

  const chunks = await db.$queryRaw<
    Array<{
      id: string;
      content: string;
      chunk_index: number;
      document_id: string;
      document_title: string | null;
      similarity: number;
    }>
  >`
    SELECT
      dc.id,
      dc.content,
      dc."chunkIndex" as chunk_index,
      dc."documentId" as document_id,
      d.title as document_title,
      1 - (dc.embedding::vector <=> ${embeddingStr}::vector) as similarity
    FROM "DocumentChunk" dc
    JOIN "Document" d ON d.id = dc."documentId"
    JOIN "KnowledgeSource" ks ON ks.id = d."knowledgeSourceId"
    WHERE ks."botId" = ${botId}
      AND ks.status = 'COMPLETED'
      AND dc.embedding IS NOT NULL
    ORDER BY dc.embedding::vector <=> ${embeddingStr}::vector
    LIMIT ${topK}
  `;

  return chunks.map((c) => ({
    id: c.id,
    content: c.content,
    chunkIndex: c.chunk_index,
    documentId: c.document_id,
    documentTitle: c.document_title,
    similarity: c.similarity,
  }));
}
