import { db } from "@/lib/db/client";

export function normalizeGapQuestion(question: string): string {
  return question.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);
}

export async function recordKnowledgeGap(botId: string, question: string): Promise<void> {
  const normalizedQuestion = normalizeGapQuestion(question);
  if (!normalizedQuestion) return;
  await db.knowledgeGap.upsert({
    where: { botId_normalizedQuestion: { botId, normalizedQuestion } },
    create: { botId, normalizedQuestion, exampleQuestion: question.slice(0, 1000) },
    update: { occurrences: { increment: 1 }, exampleQuestion: question.slice(0, 1000), lastSeenAt: new Date(), status: "OPEN", resolvedAt: null },
  });
}
