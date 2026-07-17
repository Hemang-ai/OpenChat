import { db } from "@/lib/db/client";
import { getLLMProvider, getAIConfigForBot, LLMMessage } from "@/lib/ai/provider";
import { agenticChat } from "@/lib/agents/agent-chat";
import { getLanguage } from "@/lib/i18n/languages";

/**
 * Suggested-Question Assurance Engine.
 *
 * Starter questions are a promise that the bot can answer them. This module
 * keeps that promise mechanical rather than assumed:
 *
 *  1. Candidates are generated from a stratified sample across EVERY
 *     completed source, not whichever chunks a single random query surfaces.
 *  2. Each candidate is round-tripped through the bot's real answer path;
 *     only grounded, non-refused candidates are eligible to be shown.
 *  3. Verification records (source counts, similarity, rejection reasons)
 *     are stored per question and per language for the admin UI.
 */

export interface VerifiedQuestion {
  text: string;
  language: string;
  verifiedAt: string; // ISO timestamp
  sourceCount: number;
  topSimilarity: number;
}

export interface SuggestedQuestionsMeta {
  byLanguage: Record<string, VerifiedQuestion[]>;
  /** Candidates that failed verification on the last run (admin insight). */
  lastRejected?: { text: string; language: string; reason: string }[];
}

const TARGET_QUESTIONS = 5;
const CANDIDATES_PER_ROUND = 8;
// Regenerate with fresh candidates (excluding everything already tried) until
// TARGET_QUESTIONS verify or the rounds run out — one unlucky batch must not
// leave the widget with 2 starter questions when the knowledge supports 5.
const MAX_GENERATION_ROUNDS = 3;
const SAMPLE_BUDGET = 24; // total chunks sampled across all sources

interface SampledChunk {
  content: string;
  source_id: string;
}

/**
 * Stratified sample: guarantee every completed, approved source contributes
 * chunks, splitting the budget evenly across sources.
 */
async function sampleChunksStratified(botId: string): Promise<SampledChunk[]> {
  const sources = await db.knowledgeSource.findMany({
    where: {
      botId,
      status: "COMPLETED",
      reviewStatus: "APPROVED",
      OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
    },
    select: { id: true },
  });
  if (sources.length === 0) return [];

  const perSource = Math.max(2, Math.ceil(SAMPLE_BUDGET / sources.length));

  const samples = await Promise.all(
    sources.map((s) =>
      db.$queryRaw<SampledChunk[]>`
        SELECT dc.content, ks.id as source_id
        FROM "DocumentChunk" dc
        JOIN "Document" d ON d.id = dc."documentId"
        JOIN "KnowledgeSource" ks ON ks.id = d."knowledgeSourceId"
        WHERE ks.id = ${s.id}
        ORDER BY RANDOM()
        LIMIT ${perSource}
      `
    )
  );

  return samples.flat().slice(0, SAMPLE_BUDGET);
}

function readMeta(raw: unknown): SuggestedQuestionsMeta {
  if (raw && typeof raw === "object" && !Array.isArray(raw) && "byLanguage" in raw) {
    return raw as unknown as SuggestedQuestionsMeta;
  }
  return { byLanguage: {} };
}

async function generateCandidates(
  botId: string,
  botName: string,
  businessContext: string | null,
  language: string,
  excluded: string[] = []
): Promise<string[]> {
  const chunks = await sampleChunksStratified(botId);
  console.log(`[suggested-questions] bot=${botId} sampled ${chunks.length} chunks (stratified)`);
  if (chunks.length === 0) return [];

  const sample = chunks
    .map((c) => c.content)
    .join("\n---\n")
    .slice(0, 6000);

  const lang = getLanguage(language);
  const languageNote = lang && language !== "en"
    ? `\n7. Write every question in ${lang.englishName} (${lang.nativeName}).`
    : "";
  const exclusionNote = excluded.length
    ? `\n\nDo NOT repeat or lightly rephrase any of these already-tried questions:\n${excluded.map((q) => `- ${q}`).join("\n")}`
    : "";

  const aiConfig = await getAIConfigForBot(botId);
  const provider = getLLMProvider(aiConfig);

  const messages: LLMMessage[] = [
    {
      role: "system",
      content: `You generate ${CANDIDATES_PER_ROUND} candidate starter questions for a business chatbot, based on what's actually in the business's knowledge base.

REQUIREMENTS:
1. Each question MUST be answerable from the provided knowledge content — do NOT invent topics that aren't represented.
2. Sound natural and conversational, like a real customer would ask.
3. Cover DIFFERENT topics (mix of: services, pricing, support, hours/location, policies, features, getting started).
4. Each question must be under 12 words.
5. Phrase as direct customer questions (start with "What", "How", "Do you", "Can I", "Where", "When", etc.).
6. Avoid generic placeholders — make them specific to this business's actual content.${languageNote}

OUTPUT FORMAT:
Return ONLY a JSON array of exactly ${CANDIDATES_PER_ROUND} strings. No markdown, no code fences, no commentary.
Example: ["What's included in the Pro plan?", "How long does shipping take?", "Do you ship to Canada?", "Can I cancel anytime?", "How do I reset my password?"]`,
    },
    {
      role: "user",
      content: `Business: ${botName}${businessContext ? ` (${businessContext})` : ""}

Knowledge base content (excerpts):
${sample}

Generate ${CANDIDATES_PER_ROUND} diverse, specific starter questions a real customer would ask.${exclusionNote}`,
    },
  ];

  try {
    const raw = await provider.chat(messages);
    console.log(`[suggested-questions] bot=${botId} LLM raw output (first 300):`, raw.slice(0, 300));
    const cleaned = raw
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "");
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((q) => typeof q === "string" && q.trim().length > 0)
      .map((q) => q.trim())
      .slice(0, CANDIDATES_PER_ROUND);
  } catch (err) {
    console.error(`[suggested-questions] bot=${botId} candidate generation failed:`, err);
    return [];
  }
}

/**
 * Generate + verify starter questions for one language, persisting the draft
 * string list (default language, promoted on publish as before) and the
 * per-language verification records.
 */
export async function generateSuggestedQuestions(
  botId: string,
  language?: string
): Promise<string[]> {
  const bot = await db.bot.findUnique({ where: { id: botId } });
  if (!bot) throw new Error("Bot not found");

  const lang = language && bot.supportedLocales.includes(language) ? language : bot.defaultLocale;
  const isDefault = lang === bot.defaultLocale;

  // Generate → verify → regenerate: keep producing fresh candidates
  // (excluding everything already tried) until TARGET_QUESTIONS verify or
  // the round budget runs out, so one weak batch doesn't leave the widget
  // with fewer starter questions than the knowledge actually supports.
  const verified: VerifiedQuestion[] = [];
  const rejected: { text: string; language: string; reason: string }[] = [];
  const seen = new Set<string>();

  for (let round = 0; round < MAX_GENERATION_ROUNDS && verified.length < TARGET_QUESTIONS; round++) {
    const candidates = await generateCandidates(botId, bot.name, bot.businessContext, lang, [...seen]);
    if (candidates.length === 0) break;

    // Round-trip verification: each candidate must produce a grounded,
    // non-refused answer through the real answer path in this language.
    for (const question of candidates) {
      if (verified.length >= TARGET_QUESTIONS) break;
      const key = question.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      try {
        // strictSourceOnly: the candidate must be answerable from the
        // business's own knowledge — never from general knowledge that a
        // flexible/balanced bot would otherwise be allowed to use.
        const result = await agenticChat(botId, question, null, [], { useDraft: true, allowTools: false, locale: lang, strictSourceOnly: true });
        if (result.isGrounded && !result.isRefused && result.sources.length > 0) {
          verified.push({
            text: question,
            language: lang,
            verifiedAt: new Date().toISOString(),
            sourceCount: new Set(result.sources.map((source) => source.knowledgeSourceId)).size,
            topSimilarity: Number(Math.max(...result.sources.map((source) => source.similarity)).toFixed(3)),
          });
        } else {
          rejected.push({ text: question, language: lang, reason: "The answer path refused or could not ground an answer" });
        }
      } catch (error) {
        rejected.push({ text: question, language: lang, reason: error instanceof Error ? error.message : "Verification error" });
        console.warn(`[suggested-questions] verification failed for bot=${botId}:`, error instanceof Error ? error.message : error);
      }
    }
    if (verified.length < TARGET_QUESTIONS) {
      console.log(`[suggested-questions] bot=${botId} round ${round + 1}: ${verified.length}/${TARGET_QUESTIONS} verified, ${seen.size} candidates tried`);
    }
  }

  const questions = verified.map((v) => v.text);

  const meta = readMeta(bot.suggestedQuestionsMeta);
  meta.byLanguage[lang] = verified;
  meta.lastRejected = rejected.slice(0, 20);

  await db.bot.update({
    where: { id: botId },
    data: {
      ...(isDefault
        ? { draftSuggestedQuestions: questions, draftSuggestedQuestionsUpdatedAt: new Date() }
        : {}),
      suggestedQuestionsMeta: JSON.parse(JSON.stringify(meta)),
    },
  });

  console.log(`[suggested-questions] bot=${botId} lang=${lang} saved ${questions.length} verified questions (${rejected.length} rejected)`);
  return questions;
}

/**
 * Returns cached questions if fresh, otherwise generates new ones.
 * Auto-regenerates if the bot has new completed sources since last generation.
 * Non-default languages are generated lazily and cached per language.
 */
export async function getSuggestedQuestions(
  botId: string,
  forceRefresh = false,
  useDraft = true,
  language?: string
): Promise<string[]> {
  const bot = await db.bot.findUnique({ where: { id: botId } });
  if (!bot) throw new Error("Bot not found");

  const lang = language && bot.supportedLocales.includes(language) ? language : bot.defaultLocale;

  // Non-default languages come from the per-language verified sets, generated
  // lazily on first request (both draft preview and published widget).
  if (lang !== bot.defaultLocale) {
    const meta = readMeta(bot.suggestedQuestionsMeta);
    const langSet = meta.byLanguage[lang];
    if (!forceRefresh && langSet?.length) return langSet.map((v) => v.text);
    return generateSuggestedQuestions(botId, lang);
  }

  const cachedValue = useDraft ? bot.draftSuggestedQuestions : bot.suggestedQuestions;
  const cached = Array.isArray(cachedValue) ? (cachedValue as string[]) : [];

  if (!useDraft) return cached;

  if (forceRefresh || cached.length === 0) {
    return generateSuggestedQuestions(botId);
  }

  // Stale check: regenerate if newer knowledge has been added since last generation
  if (bot.draftSuggestedQuestionsUpdatedAt) {
    const newerSource = await db.knowledgeSource.findFirst({
      where: {
        botId,
        status: "COMPLETED",
        updatedAt: { gt: bot.draftSuggestedQuestionsUpdatedAt },
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

/** Verification records for the admin UI. */
export async function getVerificationMeta(botId: string): Promise<SuggestedQuestionsMeta> {
  const bot = await db.bot.findUnique({
    where: { id: botId },
    select: { suggestedQuestionsMeta: true },
  });
  return readMeta(bot?.suggestedQuestionsMeta);
}
