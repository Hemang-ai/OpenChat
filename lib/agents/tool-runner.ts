import type { Tool, ToolExecution } from "@prisma/client";
import { db } from "@/lib/db/client";

/**
 * Normalized representation of a tool call requested by the LLM.
 */
export interface ToolCallRequest {
  id: string; // provider-supplied id (echoed back when sending the tool_result)
  name: string;
  input: Record<string, unknown>;
}

export interface ToolCallResult {
  id: string;
  status: "success" | "error" | "rejected";
  output: unknown;
  errorMessage?: string;
  latencyMs: number;
}

/**
 * Convert a Bot's Tool[] into the JSON-schema function shape the LLM provider expects.
 * (OpenAI/Anthropic/Gemini all use slight variations of the same JSON-schema-driven shape.)
 */
export function toolToFunctionDef(tool: Tool) {
  return {
    name: tool.name,
    description: tool.description,
    parameters: (tool.inputSchema as Record<string, unknown>) || {
      type: "object",
      properties: {},
    },
  };
}

/**
 * Substitute {placeholder} tokens in a string with values from the input object.
 * Used so users can write endpoints like https://api.example.com/orders/{order_id}.
 */
function interpolate(template: string, input: Record<string, unknown>): string {
  return template.replace(/\{([^}]+)\}/g, (match, key) => {
    const value = input[key.trim()];
    return value === undefined || value === null ? match : encodeURIComponent(String(value));
  });
}

/**
 * Execute a single tool call. Records the execution to ToolExecution.
 * Returns the result the LLM should receive as the "tool_result" message.
 */
export async function executeTool(
  tool: Tool,
  call: ToolCallRequest,
  conversationId: string | null
): Promise<ToolCallResult> {
  const started = Date.now();

  // Approval gate
  if (tool.approvalMode === "REQUIRE_CONFIRM") {
    const exec = await db.toolExecution.create({
      data: {
        toolId: tool.id,
        conversationId,
        input: call.input as object,
        status: "PENDING_APPROVAL",
      },
    });
    return {
      id: call.id,
      status: "rejected", // signal to LLM to wait; preview UI surfaces pending state
      output: {
        message: `Tool '${tool.name}' requires user approval before running. Execution id: ${exec.id}`,
      },
      latencyMs: Date.now() - started,
    };
  }

  if (tool.kind !== "HTTP_REQUEST") {
    return failResult(call, "Tool kind not implemented", started);
  }

  if (!tool.endpoint) {
    return failResult(call, "Tool endpoint not configured", started);
  }

  const url = interpolate(tool.endpoint, call.input);
  const method = (tool.method || "POST").toUpperCase();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "OpenChat-Agent/0.1",
    ...((tool.headers as Record<string, string>) || {}),
  };

  let output: unknown = null;
  let errorMessage: string | null = null;
  let status: ToolExecution["status"] = "SUCCESS";

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    const init: RequestInit = { method, headers, signal: controller.signal };

    // GET/DELETE put input in querystring; others in body
    let finalUrl = url;
    if (method === "GET" || method === "DELETE") {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(call.input)) {
        if (v === undefined || v === null) continue;
        params.set(k, typeof v === "string" ? v : JSON.stringify(v));
      }
      const sep = url.includes("?") ? "&" : "?";
      if (params.toString()) finalUrl = `${url}${sep}${params.toString()}`;
    } else {
      init.body = JSON.stringify(call.input);
    }

    const res = await fetch(finalUrl, init);
    clearTimeout(timer);
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // keep as text
    }

    if (!res.ok) {
      status = "ERROR";
      errorMessage = `HTTP ${res.status} ${res.statusText}`;
      output = { error: errorMessage, body: parsed };
    } else {
      output = parsed;
    }
  } catch (err) {
    status = "ERROR";
    errorMessage = err instanceof Error ? err.message : String(err);
    output = { error: errorMessage };
  }

  const latencyMs = Date.now() - started;

  await db.toolExecution.create({
    data: {
      toolId: tool.id,
      conversationId,
      input: call.input as object,
      output: output as object,
      errorMessage,
      status,
      latencyMs,
    },
  });

  return {
    id: call.id,
    status: status === "SUCCESS" ? "success" : "error",
    output,
    errorMessage: errorMessage || undefined,
    latencyMs,
  };
}

function failResult(call: ToolCallRequest, message: string, started: number): ToolCallResult {
  return {
    id: call.id,
    status: "error",
    output: { error: message },
    errorMessage: message,
    latencyMs: Date.now() - started,
  };
}
