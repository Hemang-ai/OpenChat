import { createHash } from "crypto";
import { NextRequest } from "next/server";

type RateLimitBackend = "upstash" | "memory" | "fail-open";

export interface RateLimitOptions {
  key: string;
  limit: number;
  windowSeconds: number;
  namespace?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
  backend: RateLimitBackend;
}

interface MemoryEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, MemoryEntry>();

function hashKey(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 40);
}

function getUpstashConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  return {
    url: url.replace(/\/$/, ""),
    token,
  };
}

function shouldUseMemoryFallback(): boolean {
  return process.env.NODE_ENV !== "production";
}

function shouldFailOpen(): boolean {
  return process.env.RATE_LIMIT_FAIL_OPEN === "true";
}

function buildRedisKey(options: RateLimitOptions): string {
  const namespace = options.namespace || "rate-limit";
  return `${namespace}:${hashKey(options.key)}`;
}

async function rateLimitWithUpstash(
  options: RateLimitOptions,
  config: { url: string; token: string }
): Promise<RateLimitResult> {
  const redisKey = buildRedisKey(options);

  const response = await fetch(`${config.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["SET", redisKey, "0", "EX", options.windowSeconds, "NX"],
      ["INCR", redisKey],
      ["TTL", redisKey],
    ]),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Upstash rate-limit request failed: ${response.status} ${body}`);
  }

  const data = (await response.json()) as Array<{
    result?: unknown;
    error?: string;
  }>;

  const pipelineError = data.find((item) => item.error);
  if (pipelineError?.error) {
    throw new Error(`Upstash rate-limit pipeline failed: ${pipelineError.error}`);
  }

  const count = Number(data[1]?.result || 0);
  const ttl = Number(data[2]?.result || options.windowSeconds);
  const safeTtl = ttl > 0 ? ttl : options.windowSeconds;

  const remaining = Math.max(options.limit - count, 0);
  const allowed = count <= options.limit;
  const retryAfterSeconds = allowed ? 0 : safeTtl;

  return {
    allowed,
    limit: options.limit,
    remaining,
    resetAt: Date.now() + safeTtl * 1000,
    retryAfterSeconds,
    backend: "upstash",
  };
}

function rateLimitWithMemory(options: RateLimitOptions): RateLimitResult {
  const key = buildRedisKey(options);
  const now = Date.now();
  const existing = memoryStore.get(key);

  if (!existing || now > existing.resetAt) {
    const resetAt = now + options.windowSeconds * 1000;

    memoryStore.set(key, {
      count: 1,
      resetAt,
    });

    return {
      allowed: true,
      limit: options.limit,
      remaining: options.limit - 1,
      resetAt,
      retryAfterSeconds: 0,
      backend: "memory",
    };
  }

  existing.count += 1;
  memoryStore.set(key, existing);

  const allowed = existing.count <= options.limit;
  const retryAfterSeconds = allowed
    ? 0
    : Math.max(Math.ceil((existing.resetAt - now) / 1000), 1);

  return {
    allowed,
    limit: options.limit,
    remaining: Math.max(options.limit - existing.count, 0),
    resetAt: existing.resetAt,
    retryAfterSeconds,
    backend: "memory",
  };
}

export async function rateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const config = getUpstashConfig();

  try {
    if (config) {
      return await rateLimitWithUpstash(options, config);
    }

    if (shouldUseMemoryFallback()) {
      return rateLimitWithMemory(options);
    }

    throw new Error(
      "Distributed rate limiting is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN."
    );
  } catch (error) {
    if (shouldFailOpen()) {
      console.warn(
        "Rate limiter failed open:",
        error instanceof Error ? error.message : error
      );

      return {
        allowed: true,
        limit: options.limit,
        remaining: options.limit,
        resetAt: Date.now() + options.windowSeconds * 1000,
        retryAfterSeconds: 0,
        backend: "fail-open",
      };
    }

    throw error;
  }
}

export function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-client-ip") ||
    "unknown"
  );
}

export function getPublicChatRateLimitConfig() {
  return {
    limit: Number(process.env.PUBLIC_CHAT_RATE_LIMIT_REQUESTS || 30),
    windowSeconds: Number(process.env.PUBLIC_CHAT_RATE_LIMIT_WINDOW_SECONDS || 60),
  };
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };

  if (!result.allowed) {
    headers["Retry-After"] = String(result.retryAfterSeconds);
  }

  return headers;
}
