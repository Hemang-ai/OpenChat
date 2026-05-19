import { getLLMProvider, getAIConfigForBot, LLMMessage } from "@/lib/ai/provider";
import { retrieveRelevantChunks, RetrievedChunk } from "./retrieval";
import { db } from "@/lib/db/client";

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
- If the answer is not clearly and explicitly supported by the context, refuse politely.
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
- If the user asks a business-specific question and the answer isn't in the context, say you don't have that information and suggest contacting the business.`,
  },
  flexible: {
    threshold: 0.15,
    topK: 10,
    rules: `FLEXIBLE MODE:
- Use the provided business knowledge context as your primary source.
- You may use general world knowledge for non-business-specific questions (definitions, simple math, greetings, common terminology).
- NEVER invent business-specific facts (prices, policies, availability, warranties, addresses, hours, contacts) — for those, only use the context.
- If business-specific info is missing, say so and offer to connect them with the business.`,
  },
};

function fallbackPhrase(behavior: string, contactInfo: string | null | undefined, businessName: string): string {
  switch (behavior) {
    case "general_knowledge":
      return `I don't have that specific information in ${businessName}'s knowledge base, but here's general information I can share. For specifics, please contact the business directly${contactInfo ? `: ${contactInfo}` : ""}.`;
    case "ask_clarify":
      return `I want to make sure I give you accurate information. Could you tell me more about what you're looking for? I have information about ${businessName} and may be able to help if you rephrase the question.`;
    case "contact":
    default:
      return contactInfo
        ? `I don't have that information in our knowledge base. Please contact us directly: ${contactInfo}`
        : `I don't have that information in our knowledge base. Please contact the business directly for help with that.`;
  }
}

export async function chatWithBot(
  botId: string,
  question: string,
  conversationHistory: { role: "user" | "assistant"; content: string }[] = []
): Promise<ChatResult> {
  const bot = await db.bot.findUnique({ where: { id: botId } });
  if (!bot) throw new Error("Bot not found");

  const strictness = bot.strictness in STRICTNESS_CONFIG ? bot.strictness : "balanced";
  const cfg = STRICTNESS_CONFIG[strictness];

  const aiConfig = await getAIConfigForBot(botId);
  const chunks = await retrieveRelevantChunks(botId, question, cfg.topK, aiConfig);
  const relevantChunks = chunks.filter((c) => c.similarity >= cfg.threshold);

  const refusalMessage = fallbackPhrase(bot.fallbackBehavior, bot.contactInfo, bot.name);

  // STRICT mode with zero matches → immediate refusal (no LLM call wasted)
  if (strictness === "strict" && relevantChunks.length === 0) {
    return { answer: refusalMessage, isGrounded: false, isRefused: true, sources: [] };
  }

  const context = relevantChunks.length
    ? relevantChunks.map((c, i) => `[Source ${i + 1}]: ${c.content}`).join("\n\n")
    : "(No matching knowledge found for this question.)";

  const toneInstructions: Record<string, string> = {
    professional: "Maintain a professional and formal tone.",
    friendly: "Be warm, friendly, and approachable.",
    concise: "Be brief and to the point. Use bullet points when helpful.",
    detailed: "Provide thorough, detailed answers with examples where possible.",
  };
  const toneNote = toneInstructions[bot.tone] || toneInstructions.professional;

  const systemPrompt =
    bot.systemPrompt ||
    `You are a customer-facing AI assistant for ${bot.name}${
      bot.businessContext ? ` — ${bot.businessContext}` : ""
    }.

${cfg.rules}

REFUSAL FORMAT (use exactly when you cannot answer):
"${refusalMessage}"

TONE: ${toneNote}

OUTPUT:
- Keep answers clear and helpful.
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
  const answer = await provider.chat(messages);

  const refusalIndicators = [
    "don't have that information",
    "do not have that information",
    "don't have enough information",
    "do not have enough information",
    "no information in",
    "knowledge base",
    "contact the business",
    "contact us directly",
  ];
  const lower = answer.toLowerCase();
  const looksLikeRefusal = refusalIndicators.some((p) => lower.includes(p)) && relevantChunks.length === 0;

  return {
    answer,
    isGrounded: !looksLikeRefusal,
    isRefused: looksLikeRefusal,
    sources: relevantChunks,
  };
}
