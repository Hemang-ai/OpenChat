import type { LLMProvider } from "@/lib/ai/provider";
import { getLanguage, responseUsesExpectedScript } from "./languages";

/**
 * Retry only when a non-Latin response is visibly in the wrong script. The
 * correction pass receives the already-grounded answer, not the knowledge
 * base, so it can translate wording without introducing new business facts.
 */
export async function enforceResponseLanguage(
  provider: LLMProvider,
  answer: string,
  locale: string
): Promise<string> {
  if (!answer.trim() || responseUsesExpectedScript(answer, locale)) return answer;

  const language = getLanguage(locale)?.englishName || locale;
  try {
    const corrected = await provider.chat([
      {
        role: "system",
        content: `Translate the supplied customer-facing answer entirely into ${language} (${locale}). Preserve its exact meaning, facts, numbers, product names, policy identifiers, URLs, and formatting. Do not add, remove, explain, or answer independently. Return only the translated answer.`,
      },
      { role: "user", content: answer },
    ]);
    return corrected.trim() || answer;
  } catch (error) {
    console.warn("Response-language correction failed:", error instanceof Error ? error.message : error);
    return answer;
  }
}
