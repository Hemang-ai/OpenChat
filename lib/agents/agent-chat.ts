import { db } from "@/lib/db/client";
import { getLLMProvider, getAIConfigForBot } from "@/lib/ai/provider";
import { retrieveRelevantChunks, RetrievedChunk } from "@/lib/rag/retrieval";
import { executeTool, toolToFunctionDef } from "./tool-runner";
import type { AgentMessage, ToolCallRequest } from "./types";

const MAX_TOOL_ITERATIONS = 5; // safety cap to prevent runaway loops

export interface AgentChatResult {
  answer: string;
  isGrounded: boolean;
  isRefused: boolean;
  sources: RetrievedChunk[];
  toolCalls: Array<{
    name: string;
    input: Record<string, unknown>;
    output: unknown;
    status: "success" | "error" | "rejected";
    latencyMs: number;
  }>;
}

const REFUSAL = "I don't have enough information to answer that. Please contact the business for more details.";

/**
 * Drop-in agentic variant of chatWithBot.
 * - Retrieves relevant knowledge chunks (RAG, like before)
 * - Loads the bot's active tools
 * - Calls the LLM with tools available; loops while the LLM requests tool use
 * - Returns the final assistant text + execution trace
 */
export async function agenticChat(
  botId: string,
  userMessage: string,
  conversationId: string | null,
  history: { role: "user" | "assistant"; content: string }[] = []
): Promise<AgentChatResult> {
  const bot = await db.bot.findUnique({ where: { id: botId } });
  if (!bot) throw new Error("Bot not found");

  const aiConfig = await getAIConfigForBot(botId);

  // 1. RAG retrieval (unchanged)
  const chunks = await retrieveRelevantChunks(botId, userMessage, 6, aiConfig);
  const SIMILARITY = bot.strictness === "strict" ? 0.30 : bot.strictness === "balanced" ? 0.18 : 0.15;
  const relevant = chunks.filter((c) => c.similarity >= SIMILARITY);

  // 2. Load active tools for this bot
  const tools = await db.tool.findMany({ where: { botId, isActive: true } });
  const toolDefs = tools.map(toolToFunctionDef);

  // Grounding is enforced in code, not delegated only to prompt compliance.
  // Without matching knowledge or an action capable of retrieving live data,
  // the model must never get an opportunity to answer from outside knowledge.
  if (relevant.length === 0 && tools.length === 0) {
    return {
      answer: REFUSAL,
      isGrounded: false,
      isRefused: true,
      sources: [],
      toolCalls: [],
    };
  }

  // 3. Build the system prompt — RAG context + tool guidance
  const context = relevant.length
    ? relevant.map((c, i) => `[Source ${i + 1}]: ${c.content}`).join("\n\n")
    : "(No matching knowledge found for this question.)";

  const toolGuidance = tools.length > 0
    ? `\n\nAVAILABLE ACTIONS:
You have access to ${tools.length} action(s) you may invoke when helpful. Call them when the user's question requires looking up real-time data or performing an external operation that the knowledge base cannot answer alone. After receiving the tool's result, incorporate it into a clear, helpful reply. Do NOT mention tool names to the user — just use the result naturally.`
    : "";

  const systemPrompt = `You are ${bot.name}, a customer-facing AI assistant${bot.businessContext ? ` for ${bot.businessContext}` : ""}.

ANSWERING RULES:
- Primary source: the business knowledge context below.
- Only fall back to refusal phrase "${REFUSAL}" when the question is clearly business-specific and the answer is NOT supported by knowledge or any available action.
- Be concise, helpful, professional.
${toolGuidance}

Business Knowledge Context:
${context}`;

  // 4. Build initial message list
  const messages: AgentMessage[] = [{ role: "system", content: systemPrompt }];
  for (const h of history.slice(-6)) {
    messages.push({ role: h.role, content: h.content });
  }
  messages.push({ role: "user", content: userMessage });

  // 5. Tool-calling loop
  const provider = getLLMProvider(aiConfig);
  const toolCallLog: AgentChatResult["toolCalls"] = [];
  let finalText = "";
  let iterations = 0;

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;
    const turn = await provider.chatAgent(messages, toolDefs);

    if (turn.text) finalText = turn.text; // overwrite each turn; final value is the last text

    if (turn.toolCalls.length === 0) {
      break; // model is done — return final text
    }

    // Push the assistant message that contains the tool calls
    messages.push({ role: "assistant", content: turn.text || "", toolCalls: turn.toolCalls });

    // Execute each tool call serially, append results
    for (const call of turn.toolCalls) {
      const tool = tools.find((t) => t.name === call.name);
      if (!tool) {
        const errMsg = `Tool '${call.name}' is not configured for this bot.`;
        messages.push({ role: "tool", toolCallId: call.id, name: call.name, content: errMsg });
        toolCallLog.push({ name: call.name, input: call.input, output: { error: errMsg }, status: "error", latencyMs: 0 });
        continue;
      }
      const result = await executeTool(tool, call as ToolCallRequest, conversationId);
      const serialized = typeof result.output === "string" ? result.output : JSON.stringify(result.output);
      messages.push({ role: "tool", toolCallId: call.id, name: call.name, content: serialized });
      toolCallLog.push({
        name: call.name,
        input: call.input,
        output: result.output,
        status: result.status,
        latencyMs: result.latencyMs,
      });
    }
  }

  if (iterations >= MAX_TOOL_ITERATIONS && !finalText) {
    finalText = "I tried multiple actions but couldn't reach a final answer. Please contact the business for help.";
  }

  const lower = finalText.toLowerCase();
  const looksRefused =
    relevant.length === 0 &&
    toolCallLog.length === 0 &&
    (lower.includes("don't have enough") || lower.includes("do not have enough") || lower.includes("contact"));

  return {
    answer: finalText || REFUSAL,
    isGrounded: !looksRefused,
    isRefused: looksRefused,
    sources: relevant,
    toolCalls: toolCallLog,
  };
}
