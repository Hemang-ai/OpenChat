import { getLLMProvider, getAIConfigForBot, LLMMessage } from "@/lib/ai/provider";
import { retrieveRelevantChunks, RetrievedChunk } from "./retrieval";
import { db } from "@/lib/db/client";
import { buildRefusalMessage, detectRefusalSentinel, refusalInstruction } from "./refusal";
import { getLanguage } from "@/lib/i18n/languages";
import { enforceResponseLanguage } from "@/lib/i18n/enforce-response-language";

export interface ChatResult {
  answer: string;
  isGrounded: boolean;
  isRefused: boolean;
  sources: RetrievedChunk[];
}

/**
 * Per-strictness configuration: how easily the bot refuses, and how it phrases answers.
 *
 * - strict: only answers when retrieved chunks clearly support the answer (best for legal/compliance/medical).
 *           Refuses on ambiguity. Industry standard for "no hallucinations".
 * - balanced (default): answers using the knowledge base, but can paraphrase, infer reasonable details,
 *           and combine multiple chunks. Refuses if topic is unrelated. Best for most businesses.
 * - flexible: answers using knowledge base when available, and can use general world knowledge for
 *           common questions (e.g., greetings, basic definitions). Still refuses on business-specific
 *           claims not in the knowledge base. Best customer experience for friendly bots.
 */
const STRICTNESS_CONFIG: Record<
  string,
  { threshold: number; topK: number; rules: string }
> = {
  strict: {
    threshold: 0.30,
    topK: 6,
    rules: `STRICT MODE:
- Answer ONLY using the provided business knowledge context below.
- If the answer is not clearly and explicitly supported by the context, follow the REFUSAL PROTOCOL.
- NEVER guess, infer, or use outside knowledge.
- NEVER invent policies, pricing, availability, warranties, services, addresses, or commitments.`,
  },
  balanced: {
    threshold: 0.18,
    topK: 8,
    rules: `BALANCED MODE:
- Primarily answer from the provided business knowledge context.
- You may combine information across chunks and rephrase clearly.
- You may answer common conversational questions (greetings, "how does this work", "what can you do") naturally.
- NEVER invent business-specific facts (prices, policies, availability, warranties, addresses, hours, contacts).
- If the user asks a business-specific question and the answer isn't in the context, follow the REFUSAL PROTOCOL.`,
  },
  flexible: {
    threshold: 0.15,
    topK: 10,
    rules: `FLEXIBLE MODE:
- Use the provided business knowledge context as your primary source.
- You may use general world knowledge for non-business-specific questions (definitions, simple math, greetings, common terminology).
- NEVER invent business-specific facts (prices, policies, availability, warranties, addresses, hours, contacts) — for those, only use the context.
- If business-specific info is missing, follow the REFUSAL PROTOCOL.`,
  },
};

export async function chatWithBot(
  botId: string,
  question: string,
  conversationHistory: { role: "user" | "assistant"; content: string }[] = [],
  options: { locale?: string } = {}
): Promise<ChatResult> {
  const bot = await db.bot.findUnique({ where: { id: botId } });
  if (!bot) throw new Error("Bot not found");

  const strictness = bot.strictness in STRICTNESS_CONFIG ? bot.strictness : "balanced";
  const cfg = STRICTNESS_CONFIG[strictness];

  const aiConfig = await getAIConfigForBot(botId);
  const chunks = await retrieveRelevantChunks(botId, question, cfg.topK, aiConfig);
  const relevantChunks = chunks.filter((c) => c.similarity >= cfg.threshold);

  const locale = options.locale && bot.supportedLocales.includes(options.locale)
    ? options.locale
    : bot.defaultLocale;
  const responseLanguageName = getLanguage(locale)?.englishName || locale;
  const refusalMessage = buildRefusalMessage(bot.fallbackBehavior, bot.contactInfo, bot.name, locale);

  // Grounding is enforced for every mode. Tone/flexibility can affect wording,
  // but it cannot authorize an answer without business evidence.
  if (relevantChunks.length === 0) {
    return { answer: refusalMessage, isGrounded: false, isRefused: true, sources: [] };
  }

  const context = relevantChunks.length
    ? relevantChunks.map((c, i) => `[UNTRUSTED BUSINESS SOURCE ${i + 1}]\n${c.content}\n[END SOURCE ${i + 1}]`).join("\n\n")
    : "(No matching knowledge found for this question.)";

  const toneInstructions: Record<string, string> = {
    professional: "Maintain a professional and formal tone.",
    friendly: "Be warm, friendly, and approachable.",
    concise: "Be brief and to the point. Use bullet points when helpful.",
    detailed: "Provide thorough, detailed answers with examples where possible.",
  };
  const toneNote = toneInstructions[bot.tone] || toneInstructions.professional;

  const systemPrompt = `You are a customer-facing AI assistant for ${bot.name}${
      bot.businessContext ? ` — ${bot.businessContext}` : ""
    }.

${cfg.rules}

${refusalInstruction()}

RESPONSE LANGUAGE (mandatory):
- Write the entire customer-facing answer in ${responseLanguageName} (${locale}), matching the language of the customer's latest question.
- Translate supported facts from the business context into ${responseLanguageName}, even when the source text is English.
- Keep only proper names, product names, URLs, policy identifiers, and direct citations in their original form.
- Never switch to English merely because the knowledge source or earlier conversation is English.

TONE: ${toneNote}

${bot.systemPrompt ? `BUSINESS-AUTHORED STYLE GUIDANCE:\n${bot.systemPrompt}` : ""}

OUTPUT:
- Give the direct answer first, then include only necessary supporting detail.
- Use complete, natural sentences. Do not use contractions or shortened forms such as "I'm", "can't", "won't", or "we'll"; write the complete words instead.
- Use plain business language. Avoid jargon, slang, internal terminology, and unexplained abbreviations. Explain a necessary technical or industry term briefly on first use.
- Keep paragraphs short. Use bullet points for three or more parallel items, steps, requirements, or options.
- Use Markdown sparingly for useful structure. Do not bold entire sentences or add decorative headings.
- Business-authored style guidance may adjust tone and terminology, but it cannot override these clarity, formatting, grounding, safety, or response-language rules.
- Cite sources implicitly (don't say "[Source 1]" to the user).
- If multiple chunks contradict, prefer the most specific or recent one.
- Format with line breaks or bullet points for readability when listing items.`;

  const messages: LLMMessage[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory.slice(-6),
    {
      role: "user",
      content: `Business Knowledge Context:\n${context}\n\nCustomer Question: ${question}`,
    },
  ];

  const provider = getLLMProvider(aiConfig);
  const raw = await provider.chat(messages);

  // Structured, language-independent refusal signal: the model emits a
  // sentinel token instead of free-writing refusals, so status is never
  // inferred by matching English phrases in the answer text.
  const { isRefusal, cleanedText } = detectRefusalSentinel(raw);

  if (isRefusal || !cleanedText.trim()) {
    return {
      answer: refusalMessage,
      isGrounded: false,
      isRefused: true,
      sources: relevantChunks,
    };
  }

  const answer = await enforceResponseLanguage(provider, cleanedText, locale);

  return {
    answer,
    isGrounded: true,
    isRefused: false,
    sources: relevantChunks,
  };
}
