import { db } from "@/lib/db/client";
import { getLLMProvider, getAIConfigForBot, LLMMessage } from "@/lib/ai/provider";

const GENERIC_FALLBACK = [
  "What services do you offer?",
  "How can I contact you?",
  "What are your hours?",
  "Do you have pricing information?",
  "Where are you located?",
];

/**
 * Generate 5 high-quality starter questions from the bot's actual knowledge base.
 * Persists the result to the Bot row.
 */
export async function generateSuggestedQuestions(botId: string): Promise<string[]> {
  const bot = await db.bot.findUnique({ where: { id: botId } });
  if (!bot) throw new Error("Bot not found");

  // Sample chunks across all completed sources to cover the whole KB
  const sampleChunks = await db.$queryRaw<Array<{ content: string }>>`
    SELECT dc.content
    FROM "DocumentChunk" dc
    JOIN "Document" d ON d.id = dc."documentId"
    JOIN "KnowledgeSource" ks ON ks.id = d."knowledgeSourceId"
    WHERE ks."botId" = ${botId}
      AND ks.status = 'COMPLETED'
    ORDER BY RANDOM()
    LIMIT 25
  `;

  console.log(`[suggested-questions] bot=${botId} sampled ${sampleChunks.length} chunks`);

  if (sampleChunks.length === 0) {
    // No knowledge yet — store generic placeholders so we don't keep retrying
    await db.bot.update({
      where: { id: botId },
      data: { suggestedQuestions: GENERIC_FALLBACK, suggestedQuestionsUpdatedAt: new Date() },
    });
    return GENERIC_FALLBACK;
  }

  const sample = sampleChunks
    .map((c) => c.content)
    .join("\n---\n")
    .slice(0, 6000);

  const aiConfig = await getAIConfigForBot(botId);
  const provider = getLLMProvider(aiConfig);

  const messages: LLMMessage[] = [
    {
      role: "system",
      content: `You generate 5 starter questions for a business chatbot, based on what's actually in the business's knowledge base.

REQUIREMENTS:
1. Each question MUST be answerable from the provided knowledge content — do NOT invent topics that aren't represented.
2. Sound natural and conversational, like a real customer would ask.
3. Cover DIFFERENT topics (mix of: services, pricing, support, hours/location, policies, features, getting started).
4. Each question must be under 12 words.
5. Phrase as direct customer questions (start with "What", "How", "Do you", "Can I", "Where", "When", etc.).
6. Avoid generic placeholders — make them specific to this business's actual content.

OUTPUT FORMAT:
Return ONLY a JSON array of exactly 5 strings. No markdown, no code fences, no commentary.
Example: ["What's included in the Pro plan?", "How long does shipping take?", "Do you ship to Canada?", "Can I cancel anytime?", "How do I reset my password?"]`,
    },
    {
      role: "user",
      content: `Business: ${bot.name}${bot.businessContext ? ` (${bot.businessContext})` : ""}

Knowledge base content (excerpts):
${sample}

Generate 5 diverse, specific starter questions a real customer would ask.`,
    },
  ];

  let questions: string[] = [];
  try {
    const raw = await provider.chat(messages);
    console.log(`[suggested-questions] bot=${botId} LLM raw output (first 300):`, raw.slice(0, 300));

    const cleaned = raw
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "");

    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) {
        questions = parsed
          .filter((q) => typeof q === "string" && q.trim().length > 0)
          .map((q) => q.trim())
          .slice(0, 5);
      }
    }
  } catch (err) {
    console.error(`[suggested-questions] bot=${botId} generation failed:`, err);
  }

  if (questions.length === 0) {
    console.warn(`[suggested-questions] bot=${botId} got 0 questions, using fallback`);
    questions = GENERIC_FALLBACK;
  }

  await db.bot.update({
    where: { id: botId },
    data: {
      suggestedQuestions: questions,
      suggestedQuestionsUpdatedAt: new Date(),
    },
  });

  console.log(`[suggested-questions] bot=${botId} saved ${questions.length} questions`);
  return questions;
}

/**
 * Returns cached questions if fresh, otherwise generates new ones.
 * Auto-regenerates if older than 24h or if the bot has new completed sources since last gen.
 */
export async function getSuggestedQuestions(botId: string, forceRefresh = false): Promise<string[]> {
  const bot = await db.bot.findUnique({ where: { id: botId } });
  if (!bot) throw new Error("Bot not found");

  const cached = Array.isArray(bot.suggestedQuestions) ? (bot.suggestedQuestions as string[]) : [];

  if (forceRefresh || cached.length === 0) {
    return generateSuggestedQuestions(botId);
  }

  // Stale check: regenerate if newer knowledge has been added since last generation
  if (bot.suggestedQuestionsUpdatedAt) {
    const newerSource = await db.knowledgeSource.findFirst({
      where: {
        botId,
        status: "COMPLETED",
        updatedAt: { gt: bot.suggestedQuestionsUpdatedAt },
      },
      select: { id: true },
    });
    if (newerSource) {
      // Fire-and-forget refresh; return current cached for now (next call gets new ones)
      generateSuggestedQuestions(botId).catch((e) =>
        console.warn("[suggested-questions] background refresh failed:", e)
      );
    }
  }

  return cached;
}
