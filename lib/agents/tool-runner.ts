import type { Tool, ToolExecution } from "@prisma/client";
import { randomUUID } from "crypto";
import { db } from "@/lib/db/client";
import { writeAuditEvent } from "@/lib/security/audit";
import { decryptSecret } from "@/lib/security/secrets";
import { fetchPublicWebsite } from "@/lib/security/safe-fetch";

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
  conversationId: string | null,
  options: { approvalExecutionId?: string; isTest?: boolean; idempotencyKey?: string } = {}
): Promise<ToolCallResult> {
  const started = Date.now();
  const idempotencyKey = options.idempotencyKey || (conversationId ? `tool:${conversationId}:${call.id}` : undefined);
  if (idempotencyKey) {
    const existing = await db.toolExecution.findUnique({ where: { idempotencyKey } });
    if (existing && existing.status !== "PENDING_APPROVAL" && existing.status !== "PROCESSING") return {
      id: call.id,
      status: existing.status === "SUCCESS" ? "success" : existing.status === "REJECTED" ? "rejected" : "error",
      output: existing.output,
      errorMessage: existing.errorMessage || undefined,
      latencyMs: existing.latencyMs || 0,
    };
  }

  // Approval gate
  if (tool.approvalMode === "REQUIRE_CONFIRM" && !options.approvalExecutionId) {
    const exec = await db.toolExecution.create({
      data: {
        toolId: tool.id,
        conversationId,
        input: call.input as object,
        status: "PENDING_APPROVAL",
        approvalToken: randomUUID(),
        isTest: options.isTest || false,
        riskTier: tool.riskTier,
        idempotencyKey,
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

  const validationError = validateToolInput(tool.inputSchema as Record<string, unknown>, call.input);
  if (validationError) return failResult(call, validationError, started);

  const url = interpolate(tool.endpoint, call.input);
  const endpointHost = safeEndpointHost(tool.endpoint);
  const finalHost = safeEndpointHost(url);
  if (!endpointHost || !finalHost || endpointHost !== finalHost) {
    return failResult(call, "Tool endpoint must use a fixed public hostname", started);
  }
  if (tool.allowedDomains.length && !tool.allowedDomains.map((domain) => domain.toLowerCase()).includes(finalHost)) return failResult(call, "Tool destination is not in the configured domain allowlist", started);
  const method = (tool.method || "POST").toUpperCase();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "OpenChat-Agent/0.1",
    ...toolHeaders(tool),
  };

  let output: unknown = null;
  let errorMessage: string | null = null;
  let status: ToolExecution["status"] = "SUCCESS";

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(Math.max(tool.timeoutMs, 1000), 30_000));
    try {
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

      const res = await fetchPublicWebsite(finalUrl, init);
      const contentLength = Number(res.headers.get("content-length") || 0);
      if (contentLength > 1_000_000) throw new Error("Tool response exceeded the 1 MB limit");
      const text = await res.text();
      if (text.length > 1_000_000) throw new Error("Tool response exceeded the 1 MB limit");
      let parsed: unknown = text;
      try {
        parsed = JSON.parse(text);
      } catch {
        // Keep non-JSON API responses as text.
      }

      if (!res.ok) {
        status = "ERROR";
        errorMessage = `HTTP ${res.status} ${res.statusText}`;
        output = { error: errorMessage, body: parsed };
      } else {
        output = parsed;
      }
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    status = "ERROR";
    errorMessage = err instanceof Error ? err.message : String(err);
    output = { error: errorMessage };
  }

  const latencyMs = Date.now() - started;

  if (options.approvalExecutionId) {
    await db.toolExecution.update({
      where: { id: options.approvalExecutionId },
      data: {
        output: output as object,
        errorMessage,
        status,
        latencyMs,
        approvedAt: new Date(),
        completedAt: new Date(),
        isTest: options.isTest || false,
        riskTier: tool.riskTier,
        idempotencyKey,
      },
    });
  } else {
    await db.toolExecution.create({
      data: {
        toolId: tool.id,
        conversationId,
        input: call.input as object,
        output: output as object,
        errorMessage,
        status,
        latencyMs,
        completedAt: new Date(),
      },
    });
  }

  await writeAuditEvent({
    type: status === "SUCCESS" ? "tool.executed" : "tool.failed",
    targetType: "tool",
    targetId: tool.id,
    metadata: { conversationId, status, latencyMs, approved: Boolean(options.approvalExecutionId) },
  });

  return {
    id: call.id,
    status: status === "SUCCESS" ? "success" : "error",
    output,
    errorMessage: errorMessage || undefined,
    latencyMs,
  };
}

export async function approveToolExecution(executionId: string): Promise<ToolCallResult> {
  // Claim first so simultaneous approvers cannot execute a side-effecting tool twice.
  const claim = await db.toolExecution.updateMany({
    where: { id: executionId, status: "PENDING_APPROVAL" },
    data: { status: "PROCESSING", approvedAt: new Date() },
  });
  if (claim.count === 0) {
    throw new Error("This tool action is no longer awaiting approval.");
  }

  const execution = await db.toolExecution.findUniqueOrThrow({
    where: { id: executionId },
    include: { tool: true },
  });

  const result = await executeTool(
    execution.tool,
    { id: execution.approvalToken || execution.id, name: execution.tool.name, input: execution.input as Record<string, unknown> },
    execution.conversationId,
    { approvalExecutionId: execution.id }
  );

  // Validation failures return before executeTool persists a result. Resolve the
  // claimed row so it cannot remain in a permanent processing state.
  if (result.status === "error") {
    await db.toolExecution.updateMany({
      where: { id: executionId, status: "PROCESSING" },
      data: {
        status: "ERROR",
        errorMessage: result.errorMessage || "Tool execution failed",
        completedAt: new Date(),
        latencyMs: result.latencyMs,
      },
    });
  }

  return result;
}

export async function rejectToolExecution(executionId: string): Promise<void> {
  const rejected = await db.toolExecution.updateMany({
    where: { id: executionId, status: "PENDING_APPROVAL" },
    data: { status: "REJECTED", completedAt: new Date(), errorMessage: "Rejected by an authorized user" },
  });
  if (rejected.count === 0) {
    throw new Error("This tool action is no longer awaiting approval.");
  }
  await writeAuditEvent({ type: "tool.rejected", targetType: "toolExecution", targetId: executionId });
}

function toolHeaders(tool: Tool): Record<string, string> {
  if (tool.headersEncrypted) {
    try {
      const decoded = JSON.parse(decryptSecret(tool.headersEncrypted)) as unknown;
      if (decoded && typeof decoded === "object" && !Array.isArray(decoded)) {
        return Object.fromEntries(
          Object.entries(decoded as Record<string, unknown>).filter(([, value]) => typeof value === "string") as Array<[string, string]>
        );
      }
    } catch (error) {
      throw new Error(`Tool credentials could not be decrypted: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }
  return (tool.headers as Record<string, string>) || {};
}

function safeEndpointHost(value: string): string | null {
  try {
    const url = new URL(value.replace(/\{[^}]+\}/g, "placeholder"));
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function validateToolInput(schema: Record<string, unknown>, input: Record<string, unknown>): string | null {
  const required = Array.isArray(schema.required) ? schema.required.filter((key): key is string => typeof key === "string") : [];
  for (const key of required) {
    if (input[key] === undefined || input[key] === null || input[key] === "") {
      return `Missing required tool input: ${key}`;
    }
  }

  const properties = schema.properties;
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) return null;
  for (const [key, definition] of Object.entries(properties as Record<string, unknown>)) {
    const value = input[key];
    if (value === undefined || value === null || !definition || typeof definition !== "object") continue;
    const expected = (definition as Record<string, unknown>).type;
    if (expected === "string" && typeof value !== "string") return `Tool input ${key} must be a string`;
    if (expected === "number" && typeof value !== "number") return `Tool input ${key} must be a number`;
    if (expected === "integer" && (!Number.isInteger(value))) return `Tool input ${key} must be an integer`;
    if (expected === "boolean" && typeof value !== "boolean") return `Tool input ${key} must be a boolean`;
  }
  return null;
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
