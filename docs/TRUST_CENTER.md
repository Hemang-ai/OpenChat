# Trust Center

## Data flow

1. Admin authentication establishes an HTTP-only same-site session.
2. A workspace owner configures a provider using an encrypted credential. Credentials are decrypted only immediately before a provider request.
3. Source ingestion extracts text, records provenance and freshness, chunks content, and stores embeddings in the workspace bot's source graph.
4. Chat retrieval selects only the bot version's published source snapshot. Retrieved text and tool output are marked as untrusted data.
5. Customer messages go to the configured model provider only when needed to answer or execute an approved action. OpenBusinessChat does not use customer content to train a shared model.
6. Conversation, evidence, action, handoff, feedback, and estimated-usage records remain tenant-scoped and retention-controlled.

## Providers and subprocessors

Self-hosters choose and contract with their infrastructure, model, email, queue, and observability providers. OpenAI, Anthropic, Google Gemini, Groq, Ollama, Neon, Supabase, Vercel, and Upstash are supported options, not mandatory subprocessors. Review each selected provider's terms, data region, retention, training, and abuse-monitoring behavior before production use.

## Security controls

- AES-256-GCM application-layer secret encryption with key rotation versioning.
- Hashed service API keys, expiring invitations, server-enforced platform and workspace roles.
- SSRF, redirect, DNS, timeout, response-size, file-type, origin, and public-rate controls.
- Immutable bot versions, evaluated publish gates, explicit environment promotion, audit events, and safe rollback.
- Risk-tiered tools with confirmation, schema validation, idempotency, and redacted testing.
- Signed outbound webhooks with timestamp, delivery ID, retry backoff, and replay-safe idempotency key.
- Privacy export/correction/deletion workflow and scheduled tenant retention.

## Regional and regulated deployments

`dataRegion` and `customerKeyReference` record organization policy. Enforcement still depends on choosing regional database, storage, queue, model, backup, and logging services in the deployment. Legal hold, DPA terms, sector controls, and customer-managed keys must be validated with the selected infrastructure and counsel; these settings are not a compliance certification.

## Vulnerability disclosure

Do not open a public issue for a suspected vulnerability. Send a private report to the repository security contact with affected version, reproduction, impact, and suggested remediation. Rotate exposed credentials immediately. Maintainers should acknowledge reports within three business days and publish a coordinated advisory after a fix is available.
