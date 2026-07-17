import type { AIConfig } from "@/lib/ai/provider";
import { resolveModel } from "@/lib/ai/models";

export const PRICE_CATALOG_VERSION = "2026-07-01";

const prices: Record<string, { input: number; output: number }> = {
  "openai:gpt-4o-mini": { input: 0.15, output: 0.60 },
  "openai:gpt-4.1-mini": { input: 0.40, output: 1.60 },
  "anthropic:claude-3-5-haiku-latest": { input: 0.80, output: 4.00 },
  "groq:llama-3.3-70b-versatile": { input: 0.59, output: 0.79 },
  "gemini:gemini-2.0-flash": { input: 0.10, output: 0.40 },
};

export function configuredModel(config: AIConfig) {
  const candidate = config.provider || process.env.LLM_PROVIDER || "openai";
  const provider = (["openai", "anthropic", "groq", "ollama", "gemini"] as const).find((item) => item === candidate) || "openai";
  const configured = provider === "anthropic" ? config.anthropicModel : provider === "groq" ? config.groqModel : provider === "gemini" ? config.geminiModel : provider === "ollama" ? config.ollamaModel : config.openaiModel;
  return { provider, model: resolveModel(provider, configured || undefined, "chat") };
}

export function estimateUsage(input: string, output: string, provider: string, model: string) {
  const inputTokens = Math.max(1, Math.ceil(input.length / 4));
  const outputTokens = Math.max(1, Math.ceil(output.length / 4));
  const price = prices[`${provider}:${model}`];
  const estimatedCostUsd = price ? (inputTokens * price.input + outputTokens * price.output) / 1_000_000 : 0;
  return { inputTokens, outputTokens, estimatedCostUsd, priceCatalogVersion: PRICE_CATALOG_VERSION };
}
