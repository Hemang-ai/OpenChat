import { db } from "@/lib/db/client";
import { getLLMProvider, AIConfig } from "@/lib/ai/provider";
import { Prisma } from "@prisma/client";

type ChunkRow = {
  id: string;
  content: string;
  chunk_index: number;
  document_id: string;
  document_title: string | null;
  knowledge_source_id: string;
  source_name: string;
  source_url: string | null;
  source_updated_at: Date;
  citation_visibility: "PUBLIC" | "HIDDEN";
  similarity: number;
};

export interface RetrievedChunk {
  id: string;
  content: string;
  chunkIndex: number;
  documentId: string;
  documentTitle?: string | null;
  knowledgeSourceId: string;
  sourceName: string;
  sourceUrl?: string | null;
  sourceUpdatedAt: Date;
  citationVisibility: "PUBLIC" | "HIDDEN";
  similarity: number;
}

export async function retrieveRelevantChunks(
  botId: string,
  query: string,
  topK = 5,
  aiConfig: AIConfig = {},
  sourceIds?: string[]
): Promise<RetrievedChunk[]> {
  if (sourceIds && sourceIds.length === 0) return [];
  const provider = getLLMProvider(aiConfig);
  const queryEmbedding = await provider.embed(query);
  const embeddingStr = `[${queryEmbedding.join(",")}]`;

  const chunks = sourceIds ? await db.$queryRaw<ChunkRow[]>`
    SELECT
      dc.id, dc.content, dc."chunkIndex" as chunk_index, dc."documentId" as document_id,
      d.title as document_title, ks.id as knowledge_source_id, ks.name as source_name,
      ks.url as source_url, ks."updatedAt" as source_updated_at,
      ks."citationVisibility" as citation_visibility,
      1 - (dc.embedding::vector <=> ${embeddingStr}::vector) as similarity
    FROM "DocumentChunk" dc
    JOIN "Document" d ON d.id = dc."documentId"
    JOIN "KnowledgeSource" ks ON ks.id = d."knowledgeSourceId"
    WHERE ks."botId" = ${botId}
      AND ks.id IN (${Prisma.join(sourceIds)})
      AND ks.status = 'COMPLETED'
      AND dc.embedding IS NOT NULL
    ORDER BY dc.embedding::vector <=> ${embeddingStr}::vector
    LIMIT ${topK}
  ` : await db.$queryRaw<ChunkRow[]>`
    SELECT
      dc.id,
      dc.content,
      dc."chunkIndex" as chunk_index,
      dc."documentId" as document_id,
      d.title as document_title,
      ks.id as knowledge_source_id,
      ks.name as source_name,
      ks.url as source_url,
      ks."updatedAt" as source_updated_at,
      ks."citationVisibility" as citation_visibility,
      1 - (dc.embedding::vector <=> ${embeddingStr}::vector) as similarity
    FROM "DocumentChunk" dc
    JOIN "Document" d ON d.id = dc."documentId"
    JOIN "KnowledgeSource" ks ON ks.id = d."knowledgeSourceId"
    WHERE ks."botId" = ${botId}
      AND ks.status = 'COMPLETED'
      AND ks."reviewStatus" = 'APPROVED'
      AND (ks."expiresAt" IS NULL OR ks."expiresAt" >= NOW())
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
    knowledgeSourceId: c.knowledge_source_id,
    sourceName: c.source_name,
    sourceUrl: c.source_url,
    sourceUpdatedAt: c.source_updated_at,
    citationVisibility: c.citation_visibility,
    similarity: c.similarity,
  }));
}
