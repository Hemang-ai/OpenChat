import { getMessages } from "@/lib/i18n/messages";

/**
 * Structured refusal contract.
 *
 * The model never free-writes a refusal message. When the evidence in
 * context does not support an answer, it must emit the sentinel below; the
 * application strips it and substitutes an authored, localized three-part
 * message: warm acknowledgment, honest reason, one concrete next step. This
 * replaces matching English substrings in the model's answer text, which
 * breaks the moment a bot answers in a non-English `defaultLocale`.
 */
export const REFUSAL_SENTINEL = "[[NO_ANSWER]]";

export interface RefusalCheck {
  isRefusal: boolean;
  /** Model text with the sentinel removed (may be empty). */
  cleanedText: string;
}

export function detectRefusalSentinel(text: string): RefusalCheck {
  if (!text.includes(REFUSAL_SENTINEL)) {
    return { isRefusal: false, cleanedText: text };
  }
  return { isRefusal: true, cleanedText: text.split(REFUSAL_SENTINEL).join("").trim() };
}

/**
 * Build the localized three-part refusal message.
 * `behavior` mirrors Bot.fallbackBehavior: "contact" | "general_knowledge" | "ask_clarify".
 */
export function buildRefusalMessage(
  behavior: string,
  contactInfo: string | null | undefined,
  businessName: string,
  locale = "en"
): string {
  const m = getMessages(locale);
  const ack = m.refusalAck;
  const reason = m.refusalReason.replace("{business}", businessName);

  let next: string;
  switch (behavior) {
    case "ask_clarify":
      next = m.refusalNextClarify;
      break;
    case "general_knowledge":
      next = m.refusalNextGeneral.replace("{contactSuffix}", contactInfo ? ` (${contactInfo})` : "");
      break;
    case "contact":
    default:
      next = contactInfo
        ? m.refusalNextContact.replace("{contact}", contactInfo)
        : m.refusalNextContactGeneric;
      break;
  }

  return `${ack} ${reason} ${next}`;
}

/** System-prompt fragment instructing the model to use the sentinel instead of writing its own refusal. */
export function refusalInstruction(): string {
  return `REFUSAL PROTOCOL:
- If the answer to a business-specific question is NOT supported by the provided context (or by a tool result), respond with EXACTLY this token and nothing else: ${REFUSAL_SENTINEL}
- Do not apologize, explain, or write your own refusal message — the application shows the customer an appropriate message in their language.
- Never use the token when the context does support an answer.`;
}
