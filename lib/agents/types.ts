/**
 * Shared types for the agent / tool-calling layer.
 * Designed to be provider-agnostic — each LLMProvider adapter maps to/from
 * its native API (OpenAI tool_calls, Anthropic tool_use blocks, etc.).
 */

export interface ToolDef {
  name: string;
  description: string;
  /** JSON Schema for the tool's input. Matches OpenAI's `parameters` shape. */
  parameters: Record<string, unknown>;
}

export interface ToolCallRequest {
  id: string;          // provider-assigned correlation id
  name: string;
  input: Record<string, unknown>;
}

export interface ToolCallResultPayload {
  id: string;          // must echo the ToolCallRequest.id
  output: unknown;     // serializable
  isError?: boolean;
}

export type AgentMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: ToolCallRequest[] }
  | { role: "tool"; toolCallId: string; name: string; content: string };

export interface AgentTurn {
  /** True when the LLM has nothing more to say — the loop should end. */
  done: boolean;
  /** Free-text portion of the assistant's reply (may be empty if only tool calls). */
  text: string;
  /** Tool calls requested by the LLM in this turn (empty when done). */
  toolCalls: ToolCallRequest[];
}
