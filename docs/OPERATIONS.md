# Production Operations

## Service objectives

| Path | Target | Alert threshold |
|---|---:|---:|
| Public bot configuration | 99.9% monthly availability | 5-minute error rate > 1% |
| Public chat API | 99.5% monthly availability | 5-minute error rate > 2% |
| Chat latency | p95 < 8 seconds | p95 > 12 seconds for 15 minutes |
| File/URL/YouTube/manual ingestion | 95% complete within 10 minutes | oldest ready job > 15 minutes |
| Webhook delivery | 99% delivered within 15 minutes | failure rate > 5% or oldest delivery > 15 minutes |
| Approved tool execution | 99% terminal state within 30 seconds | processing state > 2 minutes |
| Source deletion/refresh | removed from next published retrieval immediately; scheduled refresh within one interval + 15 minutes | stale job exceeds window |

Use provider, model, bot version, job type, connector, and workspace dimensions without recording message/source content by default. Correlation should use request, conversation, job, delivery, and execution IDs.

## Workers

Run these authenticated endpoints from Vercel Cron, a queue consumer, or another scheduler:

- `POST /api/internal/ingestion-jobs`: schedule due source refreshes and process retryable ingestion jobs.
- `POST /api/internal/webhooks`: deliver pending/retryable signed webhooks.
- `POST /api/internal/maintenance`: enforce retention and process verified privacy workflows.

Use `Authorization: Bearer <worker secret>`. Invoke at least every five minutes. Concurrent invocations are safe because records are claimed atomically and side effects use idempotency keys.

## Backup and recovery

- Enable managed PostgreSQL point-in-time recovery and daily logical backups.
- Enable versioning, encryption, lifecycle deletion, and access logging on the private `OBJECT_STORAGE_BUCKET`; block all public access. Include object restoration in quarterly drills.
- Target RPO: 15 minutes with PITR; RTO: 4 hours for the hosted reference deployment.
- Before migration: record backup/PITR evidence, run `prisma migrate status`, and test migration on a restored staging copy.
- Quarterly: restore to an isolated project, run `/api/health`, sample tenant counts, test a bot answer, and verify privacy deletion/export behavior.
- Never restore production secrets into developer environments; rotate webhook/service/provider credentials after a suspected exposure.

## Upgrade and rollback

1. Back up the database and capture current deployment SHA.
2. Run `npm ci`, `npm run verify`, and `npx prisma validate`.
3. Apply `npm run db:deploy` before promoting code that depends on new columns.
4. Verify `/api/health`, registration, provider settings, ingestion, preview, publish, public chat, handoff, webhook delivery, and service API.
5. Roll code back only when the migration is backward compatible. Otherwise forward-fix; never edit an applied migration.
