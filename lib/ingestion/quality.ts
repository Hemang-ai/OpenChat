import { createHash } from "crypto";
import { db } from "@/lib/db/client";

function normalized(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").replace(/[^a-z0-9 .!?'-]/g, "").trim();
}

function tokens(value: string): Set<string> {
  return new Set(normalized(value).match(/[a-z0-9]+/g)?.filter((word) => word.length > 3) || []);
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  const common = Array.from(a).filter((word) => b.has(word)).length;
  return common / Math.min(a.size, b.size);
}

function hasNegation(value: string): boolean {
  return /\b(no|not|never|cannot|can't|won't|without|excluded|unavailable)\b/i.test(value);
}

export async function assessIngestedContent(botId: string, sourceId: string, text: string) {
  const contentHash = createHash("sha256").update(normalized(text)).digest("hex");
  const duplicate = await db.knowledgeSource.findFirst({
    where: { botId, id: { not: sourceId }, contentHash },
    select: { id: true, name: true },
  });
  if (duplicate) {
    return { contentHash, conflictStatus: "DUPLICATE" as const, matches: [{ sourceId: duplicate.id, sourceName: duplicate.name, reason: "Exact normalized content match" }] };
  }

  const candidateSentences = text.split(/(?<=[.!?])\s+/).filter((sentence) => sentence.length >= 35 && sentence.length <= 350).slice(0, 80);
  const existing = await db.documentChunk.findMany({
    where: { document: { knowledgeSource: { botId, id: { not: sourceId }, status: "COMPLETED" } } },
    select: { content: true, document: { select: { knowledgeSource: { select: { id: true, name: true } } } } },
    take: 60,
  });
  const matches: Array<{ sourceId: string; sourceName: string; reason: string; excerpt: string }> = [];
  for (const sentence of candidateSentences) {
    const sentenceTokens = tokens(sentence);
    for (const chunk of existing) {
      const candidate = chunk.content.split(/(?<=[.!?])\s+/).find((part) => overlap(sentenceTokens, tokens(part)) >= 0.72 && hasNegation(part) !== hasNegation(sentence));
      if (candidate) {
        matches.push({ sourceId: chunk.document.knowledgeSource.id, sourceName: chunk.document.knowledgeSource.name, reason: "Similar statement with different negation", excerpt: candidate.slice(0, 240) });
        if (matches.length >= 5) break;
      }
    }
    if (matches.length >= 5) break;
  }
  return { contentHash, conflictStatus: matches.length ? "POSSIBLE_CONFLICT" as const : "CLEAR" as const, matches };
}
