import { resolveModel } from "./models";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMProvider {
  chat(messages: LLMMessage[]): Promise<string>;
  embed(text: string): Promise<number[]>;
}

export interface AIConfig {
  provider?: string | null;
  fallbackProvider?: string | null;
  openaiApiKey?: string | null;
  openaiModel?: string | null;
  openaiEmbeddingModel?: string | null;
  anthropicApiKey?: string | null;
  anthropicModel?: string | null;
  groqApiKey?: string | null;
  groqModel?: string | null;
  ollamaBaseUrl?: string | null;
  ollamaModel?: string | null;
  geminiApiKey?: string | null;
  geminiModel?: string | null;
}

function resolve<T>(workspaceVal: T | null | undefined, envVal: T | undefined, fallback?: T): T | undefined {
  if (workspaceVal !== null && workspaceVal !== undefined && workspaceVal !== "") return workspaceVal;
  if (envVal !== undefined && envVal !== "") return envVal;
  return fallback;
}

class OpenAIProvider implements LLMProvider {
  constructor(private apiKey: string, private model: string, private embeddingModel: string) {}
  async chat(messages: LLMMessage[]): Promise<string> {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.model, messages }),
    });
    if (!res.ok) throw new Error(`OpenAI error: ${await res.text()}`);
    const data = await res.json();
    return data.choices[0].message.content;
  }
  async embed(text: string): Promise<number[]> {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.embeddingModel, input: text }),
    });
    if (!res.ok) throw new Error(`OpenAI embed error: ${await res.text()}`);
    const data = await res.json();
    return data.data[0].embedding;
  }
}

class AnthropicProvider implements LLMProvider {
  constructor(private apiKey: string, private model: string, private embedFallback: LLMProvider) {}
  async chat(messages: LLMMessage[]): Promise<string> {
    const system = messages.find((m) => m.role === "system")?.content;
    const userMessages = messages.filter((m) => m.role !== "system");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": this.apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.model, max_tokens: 1024, system, messages: userMessages }),
    });
    if (!res.ok) throw new Error(`Anthropic error: ${await res.text()}`);
    const data = await res.json();
    return data.content[0].text;
  }
  embed(text: string): Promise<number[]> { return this.embedFallback.embed(text); }
}

class GroqProvider implements LLMProvider {
  constructor(private apiKey: string, private model: string, private embedFallback: LLMProvider) {}
  async chat(messages: LLMMessage[]): Promise<string> {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.model, messages }),
    });
    if (!res.ok) throw new Error(`Groq error: ${await res.text()}`);
    const data = await res.json();
    return data.choices[0].message.content;
  }
  embed(text: string): Promise<number[]> { return this.embedFallback.embed(text); }
}

class GeminiProvider implements LLMProvider {
  constructor(private apiKey: string, private model: string, private embedFallback: LLMProvider) {}
  async chat(messages: LLMMessage[]): Promise<string> {
    const system = messages.find((m) => m.role === "system")?.content;
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
    const body: Record<string, unknown> = { contents };
    if (system) body.systemInstruction = { parts: [{ text: system }] };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Gemini error: ${await res.text()}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }
  embed(text: string): Promise<number[]> { return this.embedFallback.embed(text); }
}

class OllamaProvider implements LLMProvider {
  constructor(private baseUrl: string, private model: string) {}
  async chat(messages: LLMMessage[]): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.model, messages, stream: false }),
    });
    if (!res.ok) throw new Error(`Ollama error: ${await res.text()}`);
    const data = await res.json();
    return data.message.content;
  }
  async embed(text: string): Promise<number[]> {
    const res = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.model, prompt: text }),
    });
    if (!res.ok) throw new Error(`Ollama embed error: ${await res.text()}`);
    const data = await res.json();
    return data.embedding;
  }
}

/**
 * Wrap two providers so the fallback runs if the primary throws.
 * Embeddings always come from the primary chain (no point trying both).
 */
class FallbackProvider implements LLMProvider {
  constructor(private primary: LLMProvider, private fallback: LLMProvider) {}
  async chat(messages: LLMMessage[]): Promise<string> {
    try {
      return await this.primary.chat(messages);
    } catch (err) {
      console.warn("Primary LLM failed, using fallback:", err instanceof Error ? err.message : err);
      return this.fallback.chat(messages);
    }
  }
  embed(text: string): Promise<number[]> {
    return this.primary.embed(text);
  }
}

function buildSingleProvider(name: string, config: AIConfig, openaiProvider: OpenAIProvider | null): LLMProvider {
  switch (name) {
    case "anthropic": {
      const key = resolve(config.anthropicApiKey, process.env.ANTHROPIC_API_KEY);
      const model = resolveModel("anthropic", resolve(config.anthropicModel, process.env.ANTHROPIC_MODEL));
      if (!key) throw new Error("Anthropic API key not configured.");
      if (!openaiProvider) throw new Error("OpenAI key required for embeddings.");
      return new AnthropicProvider(key, model, openaiProvider);
    }
    case "groq": {
      const key = resolve(config.groqApiKey, process.env.GROQ_API_KEY);
      const model = resolveModel("groq", resolve(config.groqModel, process.env.GROQ_MODEL));
      if (!key) throw new Error("Groq API key not configured.");
      if (!openaiProvider) throw new Error("OpenAI key required for embeddings.");
      return new GroqProvider(key, model, openaiProvider);
    }
    case "gemini": {
      const key = resolve(config.geminiApiKey, process.env.GEMINI_API_KEY);
      const model = resolveModel("gemini", resolve(config.geminiModel, process.env.GEMINI_MODEL));
      if (!key) throw new Error("Gemini API key not configured.");
      if (!openaiProvider) throw new Error("OpenAI key required for embeddings.");
      return new GeminiProvider(key, model, openaiProvider);
    }
    case "ollama": {
      const baseUrl = resolve(config.ollamaBaseUrl, process.env.OLLAMA_BASE_URL, "http://localhost:11434")!;
      const model = resolveModel("ollama", resolve(config.ollamaModel, process.env.OLLAMA_MODEL));
      return new OllamaProvider(baseUrl, model);
    }
    case "openai":
    default: {
      if (!openaiProvider) throw new Error("OpenAI API key not configured.");
      return openaiProvider;
    }
  }
}

export function getLLMProvider(config: AIConfig = {}): LLMProvider {
  const providerName = resolve(config.provider, process.env.LLM_PROVIDER, "openai") || "openai";
  const fallbackName = resolve(config.fallbackProvider, process.env.LLM_FALLBACK_PROVIDER);

  const openaiKey = resolve(config.openaiApiKey, process.env.OPENAI_API_KEY);
  const openaiModel = resolveModel("openai", resolve(config.openaiModel, process.env.OPENAI_MODEL), "chat");
  const openaiEmbed = resolveModel("openai", resolve(config.openaiEmbeddingModel, process.env.OPENAI_EMBEDDING_MODEL), "embedding");
  const openaiProvider = openaiKey ? new OpenAIProvider(openaiKey, openaiModel, openaiEmbed) : null;

  const primary = buildSingleProvider(providerName, config, openaiProvider);

  if (fallbackName && fallbackName !== providerName) {
    try {
      const fallback = buildSingleProvider(fallbackName, config, openaiProvider);
      return new FallbackProvider(primary, fallback);
    } catch (err) {
      // Fallback isn't configured — silently use primary alone
      console.warn("Fallback provider not configured, using primary only:", err instanceof Error ? err.message : err);
    }
  }
  return primary;
}

export async function getAIConfigForBot(botId: string): Promise<AIConfig> {
  const { db } = await import("@/lib/db/client");
  const bot = await db.bot.findUnique({ where: { id: botId }, include: { workspace: true } });
  if (!bot) return {};
  const w = bot.workspace;
  return {
    provider: w.llmProvider,
    fallbackProvider: w.fallbackLlmProvider,
    openaiApiKey: w.openaiApiKey,
    openaiModel: w.openaiModel,
    openaiEmbeddingModel: w.openaiEmbeddingModel,
    anthropicApiKey: w.anthropicApiKey,
    anthropicModel: w.anthropicModel,
    groqApiKey: w.groqApiKey,
    groqModel: w.groqModel,
    ollamaBaseUrl: w.ollamaBaseUrl,
    ollamaModel: w.ollamaModel,
    geminiApiKey: w.geminiApiKey,
    geminiModel: w.geminiModel,
  };
}
