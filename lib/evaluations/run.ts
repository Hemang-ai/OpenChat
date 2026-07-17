import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { agenticChat } from "@/lib/agents/agent-chat";

function importantWords(value: string): Set<string> {
  const stop = new Set(["the", "and", "that", "this", "with", "from", "your", "have", "will", "for", "are", "you"]);
  return new Set(value.toLowerCase().match(/[\p{L}\p{N}]+/gu)?.filter((word) => word.length > 2 && !stop.has(word)) || []);
}

function answerOverlap(expected: string, actual: string): number {
  const expectedWords = importantWords(expected);
  if (expectedWords.size === 0) return 1;
  const actualWords = importantWords(actual);
  return Array.from(expectedWords).filter((word) => actualWords.has(word)).length / expectedWords.size;
}

export async function runBotEvaluations(botId: string) {
  const [bot, cases] = await Promise.all([
    db.bot.findUniqueOrThrow({ where: { id: botId }, select: { draftRevision: true } }),
    db.evaluationCase.findMany({ where: { botId }, orderBy: { createdAt: "asc" }, take: 25 }),
  ]);
  if (cases.length < 3) throw new Error("Add at least three evaluation questions before running the launch suite.");

  const results = [];
  for (const testCase of cases) {
    const result = await agenticChat(botId, testCase.question, null, [], { useDraft: true, allowTools: false, locale: testCase.locale });
    const sourceIds = new Set(result.sources.map((source) => source.knowledgeSourceId));
    const requiredSourcesPresent = testCase.requiredSourceIds.every((sourceId) => sourceIds.has(sourceId));
    const overlap = testCase.expectedAnswer ? answerOverlap(testCase.expectedAnswer, result.answer) : 1;
    const expectedOutcome = testCase.allowRefusal ? result.isRefused : result.isGrounded && !result.isRefused;
    const passed = expectedOutcome && requiredSourcesPresent && overlap >= 0.35;
    const reason = !expectedOutcome
      ? testCase.allowRefusal ? "The bot answered when this case expected a refusal." : "The answer was refused or lacked evidence."
      : !requiredSourcesPresent
        ? "One or more required knowledge sources were not retrieved."
        : overlap < 0.35
          ? "The answer did not cover enough of the expected key information."
          : "Grounding, required sources, and expected outcome passed.";
    results.push({
      caseId: testCase.id,
      question: testCase.question,
      riskLevel: testCase.riskLevel,
      locale: testCase.locale,
      passed,
      reason,
      answer: result.answer,
      isGrounded: result.isGrounded,
      isRefused: result.isRefused,
      evidenceScore: result.sources.length ? Math.max(...result.sources.map((source) => source.similarity)) : 0,
      sourceIds: Array.from(sourceIds),
      expectedAnswerOverlap: Number(overlap.toFixed(2)),
    });
  }
  const passed = results.filter((result) => result.passed).length;
  return db.evaluationRun.create({
    data: {
      botId,
      draftRevision: bot.draftRevision,
      status: passed === results.length ? "PASSED" : "FAILED",
      total: results.length,
      passed,
      failed: results.length - passed,
      results: results as unknown as Prisma.InputJsonValue,
    },
  });
}
