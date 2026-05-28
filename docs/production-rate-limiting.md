# Production Rate Limiting

OpenBusinessChat uses distributed rate limiting for the public chat endpoint.

## Why this is needed

The public chat endpoint is anonymous and can be embedded on any website. Without distributed rate limiting, bad actors can abuse the endpoint, increase LLM costs, and degrade service for real users.

## Backend

Production rate limiting uses Upstash Redis REST.

## Required environment variables

UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""
PUBLIC_CHAT_RATE_LIMIT_REQUESTS="30"
PUBLIC_CHAT_RATE_LIMIT_WINDOW_SECONDS="60"
RATE_LIMIT_FAIL_OPEN="false"

## Behavior

- In production, Upstash Redis must be configured.
- In local development, the app falls back to an in-memory limiter if Upstash is not configured.
- Rate-limit keys are hashed before being stored in Redis.
- Rate-limit response headers are returned:
  - X-RateLimit-Limit
  - X-RateLimit-Remaining
  - X-RateLimit-Reset
  - Retry-After when blocked

## Default limit

30 public chat messages per bot/publicKey and IP per 60 seconds.

## Security recommendation

Keep RATE_LIMIT_FAIL_OPEN=false in production unless availability is more important than abuse protection.
