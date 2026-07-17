# OpenBusinessChat

> Open-source AI chatbot platform — train on your business knowledge, embed anywhere.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-336791)](https://github.com/pgvector/pgvector)

> **Current main:** PRD Phases 0-4 are implemented as an open platform foundation: verified publishing, service operations and handoff, enterprise governance, versioned APIs/SCIM, multilingual and channel contracts, templates, reviewed plugins, and stable-session experiments.
> Self-hostable, bring-your-own-key, and MIT licensed. Live deployment: [open-chat1.vercel.app](https://open-chat1.vercel.app).

---

## What is OpenBusinessChat?

OpenBusinessChat lets a business create a custom AI chatbot grounded in its own knowledge and embed it on a website with a single line of code. Retrieval thresholds and refusal controls reduce unsupported answers without pretending that any LLM can guarantee zero hallucinations.

- **Upload knowledge** — PDFs, Word docs, TXT, CSV, Markdown, website URLs, YouTube transcripts, manual text
- **Take action with tools** — call your APIs, look up orders, create tickets, send emails — your bot decides when to use them
- **RAG-grounded answers** — pgvector retrieval, configurable strictness, source citations
- **Embed anywhere** — `<iframe>` or one-line `<script>` widget
- **Capture leads from chat** — optional visitor follow-up form plus a dashboard lead inbox
- **Bring your own AI** — OpenAI, Anthropic, Google Gemini, Groq, or local Ollama (with primary + fallback chain)
- **Multi-tenant** — each business workspace has its own bots, knowledge, and API keys
- **Production-oriented foundation** — TypeScript end-to-end, Prisma + PostgreSQL, tenant isolation, secure auth, and abuse-protection hooks

---

## Features

| Feature | Status |
|---|---|
| Email/password auth (JWT + bcrypt, httpOnly cookies) | ✅ |
| Google OAuth (verified email, CSRF state, account linking) | ✅ |
| Multi-tenant data model (User → Workspace → Bot → KnowledgeSource → Document → DocumentChunk) | ✅ |
| PostgreSQL + pgvector with prepared migrations | ✅ |
| Admin dashboard (workspace selector, bot CRUD, settings) | ✅ |
| Per-workspace AI provider config (OpenAI / Anthropic / Gemini / Groq / Ollama) | ✅ |
| AES-256-GCM encrypted workspace provider keys and tool headers | ✅ |
| Primary + fallback provider chain with auto-failover | ✅ |
| Curated model catalog with "Auto (recommended)" defaults | ✅ |
| File upload (PDF with local scanned-page OCR, DOCX, TXT, MD, CSV — up to 10 MB) | ✅ |
| Website crawler (same-origin depth/page/path limits, noise stripping, scheduled refresh) | ✅ |
| YouTube transcript extraction | ✅ |
| Manual text knowledge entry | ✅ |
| Sliding-window chunking + batched embeddings | ✅ |
| RAG retrieval over pgvector cosine similarity | ✅ |
| Three answer modes: **Strict** / **Balanced** / **Flexible** | ✅ |
| Configurable fallback behavior + contact info | ✅ |
| Auto-generated starter questions from your knowledge | ✅ |
| Animated suggestion bubbles in the chat widget | ✅ |
| Lead capture form + dashboard lead inbox | ✅ |
| Admin chat preview with grounding badges + source citations | ✅ |
| Public iframe embed (`/embed/{publicKey}`) | ✅ |
| Drop-in `<script>` widget (`widget.js`) — floating chat bubble | ✅ |
| Conversation logs viewer | ✅ |
| Analytics: totals, unknown-answer rate, top user questions | ✅ |
| Platform-owner `/admin` dashboard: signups, activation, installs, usage, ingestion, tool, and security metrics | ✅ |
| Animated end-to-end flow demo on the landing page | ✅ |
| **Agentic tools** — bot calls HTTP APIs via function-calling (OpenAI + Anthropic) | ✅ |
| **Tool execution log** with input/output, latency, status per invocation | ✅ |
| **Approval-required tool actions** — review, reject, approve, and execute from the existing tool log | ✅ |
| Persistent ingestion job records with retry/error lifecycle | ✅ |
| Guided launch readiness with required and recommended checks | ✅ |
| Draft settings, immutable publish versions, and rollback | ✅ |
| Per-bot evaluation datasets with publish quality gates | ✅ |
| Extraction preview, source ownership, tags, freshness, conflicts, and citation controls | ✅ |
| Verified starter questions, public citations, answer feedback, and knowledge-gap inbox | ✅ |
| Widget AI disclosure, privacy notice, origin restrictions, and offline states | ✅ |
| Quality analytics: evidence coverage, feedback, latency, refusals, and gaps | ✅ |
| Shared service workflow: escalation, packets, assignment, notes, priority, business hours, and SLA | ✅ |
| Signed/idempotent webhook delivery with logs, retries, and helpdesk/CRM contract | ✅ |
| Risk-tiered tool test console with immutable test executions | ✅ |
| Outcome, containment, action, provider/model, token, and estimated-cost analytics | ✅ |
| Workspace roles/invitations, scoped service accounts, stable `/api/v1`, and SCIM | ✅ |
| Environments, policy, domains, retention/privacy jobs, and audit export | ✅ |
| Locale-aware chat/evaluations, channels, templates, plugin manifest, and experiments | ✅ |
| MIT licensed, fully self-hostable | ✅ |

---

## Quick start

### Prerequisites
- Node.js 20.9+
- Docker Desktop (for local Postgres with pgvector)
- An OpenAI API key for cloud embeddings, or a local Ollama model that supports embeddings. Anthropic, Gemini, and Groq chat currently use OpenAI for embeddings.

### Setup
```bash
# 1. Clone
git clone https://github.com/Hemang-ai/OpenChat.git
cd OpenChat

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Open .env and set:
#   DATABASE_URL   (the docker-compose default already matches)
#   JWT_SECRET     (any random 32+ char string)
#   APP_URL         (http://localhost:3000)
#   OPENAI_API_KEY  (your sk-... key, unless using Ollama)

# 4. Start Postgres + pgvector
docker compose up -d postgres

# 5. Run migrations
npx prisma generate
npm run db:deploy

# 6. Start the dev server
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)**.

### First-time flow
1. **Register** with Google or email/password → an account + workspace are created
2. **AI Settings** → paste your OpenAI API key, click Save
3. **Dashboard → + New bot** → choose a workflow template and create an unpublished draft
4. **Bot → Knowledge** → add business content, inspect extraction, and approve any conflict or freshness warnings
5. **Bot → Evaluations** → add at least three launch questions with expected facts or expected refusals, then run the suite
6. **Bot → Preview** → test the same draft answer path with full evidence traces
7. **Bot → Settings / Embed** → add human fallback, privacy notice, and approved website origins
8. **Bot → Launch** → resolve required checks and publish an immutable version
9. **Bot → Embed** → copy the `<iframe>` or `<script>` snippet into an approved website

Published visitors stay on the last known-good version while settings or knowledge changes remain in draft. Rollback creates a new immutable version from an earlier snapshot, preserving the audit trail.

### Platform administrator

The platform-owner dashboard is separate from customer workspaces at **`/admin`**. It shows signups, activation, bots, verified embeds, conversations, leads, ingestion health, tool activity, and recorded security events.

After running the latest migrations, create the one-time local administrator. The username defaults to `admin`; do not place a real password in Git or `.env.example`.

```bash
# Generate a durable workspace encryption key first.
openssl rand -base64 32

# Put the resulting value in WORKSPACE_SECRETS_KEY in your uncommitted .env.
# Set a unique 15+ character PLATFORM_ADMIN_INITIAL_PASSWORD in .env, then:
npm run admin:bootstrap
```

Sign in using the configured email or `admin`, open [http://localhost:3000/admin](http://localhost:3000/admin), and replace the bootstrap password when prompted. Bootstrap can only create the first platform administrator.

To protect existing workspace keys after setting `WORKSPACE_SECRETS_KEY`, run:

```bash
npm run secrets:migrate
```

### Processing pending ingestion jobs

Knowledge submissions run immediately for a responsive dashboard experience and are also recorded as durable jobs. For a production worker, set a strong `INGESTION_WORKER_SECRET` and invoke the protected endpoint from a queue consumer or scheduler:

```bash
curl -X POST "$APP_URL/api/internal/ingestion-jobs" \
  -H "Authorization: Bearer $INGESTION_WORKER_SECRET"
```

The worker processes every source type, including uploaded files. Development stores uploads under ignored `.data/uploads`; production uses the configured private S3-compatible bucket, so retries survive deployments and request timeouts.

Run webhook and governance maintenance workers on the same schedule (five minutes recommended):

```bash
curl -X POST "$APP_URL/api/internal/webhooks" -H "Authorization: Bearer $WEBHOOK_WORKER_SECRET"
curl -X POST "$APP_URL/api/internal/maintenance" -H "Authorization: Bearer $MAINTENANCE_WORKER_SECRET"
```

See [Production Operations](docs/OPERATIONS.md) for SLOs, backup/restore, migration, worker, and rollback procedures.

---

## Lead capture

OpenBusinessChat now includes a built-in lead capture workflow so the bot can turn anonymous website conversations into follow-up opportunities.

### Why it matters

Many business chatbots answer questions but lose the visitor when the conversation ends. Lead capture closes that gap: after a visitor engages with the embedded chat, the widget can invite them to leave contact details for a human follow-up. This makes the product more valuable for agencies, service businesses, sales teams, clinics, local businesses, and any company that wants support conversations to become pipeline.

### Visitor experience

When lead capture is enabled for a bot:

1. The visitor asks a question in the public iframe or script widget.
2. The chat shows a compact **Human follow-up** card after the first real user message.
3. The visitor can submit name, email, phone, company, and a short request.
4. The widget confirms that the details were sent.

The form is intentionally optional and appears after engagement, so the bot still feels helpful before it asks for contact information.

### Admin workflow

Inside **Dashboard → Bot → Settings**, turn on **Lead capture** and customize the prompt shown in the widget.

Inside **Dashboard → Bot → Leads**, owners can:

- View captured leads with email, phone, company, request, and the latest related chat question.
- Filter by status: **New**, **Contacted**, **Qualified**, or **Dismissed**.
- Update status from the lead inbox.
- Track lead totals, new leads, and qualified leads.

Lead counts also appear in bot cards and analytics, including lead conversion rate from conversations to captured leads.

### Data and API surface

Lead capture adds:

- `Lead` model with `NEW`, `CONTACTED`, `QUALIFIED`, and `DISMISSED` statuses.
- Bot settings: `leadCaptureEnabled` and `leadCapturePrompt`.
- Public endpoint: `POST /api/public/leads`.
- Admin endpoint: `GET/PATCH /api/admin/bots/{botId}/leads`.
- Migration: `prisma/migrations/20260528120000_add_lead_capture`.

After pulling the latest `main`, run:

```bash
npx prisma generate
npm run db:deploy
```

---

## Tech stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Lucide icons
- **Backend**: Next.js Route Handlers, Node.js runtime
- **Database**: PostgreSQL 16 with pgvector extension (cosine similarity)
- **ORM**: Prisma 5
- **AI**: OpenAI / Anthropic / Google Gemini / Groq / Ollama via a unified provider abstraction
- **Auth**: Google OAuth or email/password, with JWT sessions in httpOnly cookies
- **Validation**: Zod
- **PDF parsing**: pdf-parse v2; DOCX: mammoth; HTML: cheerio; YouTube: youtube-transcript

## Architecture

```
                       ┌──────────────────────────┐
   Customer (browser)  │  Public widget / iframe  │
                       │  /embed/{publicKey}      │
                       └────────────┬─────────────┘
                                    │ POST /api/public/chat
                                    │ POST /api/public/leads
                                    ▼
┌────────────────────────────────────────────────────────────┐
│  Next.js (App Router)                                       │
│                                                             │
│  /api/public/chat  ──► RAG ──► retrieve chunks (pgvector)   │
│                          │  ──► LLM + optional tool loop    │
│                          ▼                                  │
│                    grounding check, source citations        │
│                                                             │
│  /api/public/leads ──► validated lead capture               │
│                                                             │
│  /api/auth/google  ──► Google OAuth + local JWT session     │
│  /api/admin/*      ──► auth-guarded admin endpoints         │
│  /dashboard/*      ──► admin UI, analytics, lead inbox       │
└────────────────────────────────────────────────────────────┘
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
         PostgreSQL + pgvector                Workspace AI provider
         (User, OAuthAccount,                 (OpenAI / Anthropic /
          Workspace, Bot, Tool,
          KnowledgeSource, Document,           Gemini / Groq / Ollama)
          DocumentChunk[vector],
          Conversation, Message,
          Lead)
```

## Repository structure

```
app/
  (marketing)/        Landing page + animated demo
  (dashboard)/        Admin UI (workspace, bots, AI settings)
  api/auth/           Email/password + Google OAuth, logout
  api/admin/          Workspace + bot CRUD, knowledge, evaluations, launch/versioning,
                      analytics, gaps, leads, logs, and tools
  api/public/         Chat, citations, feedback, leads, and verified embed events
  embed/[publicKey]/  Iframe-embeddable chat widget
  login/, register/   Auth pages

components/
  ui/                 shadcn/ui design system
  chat/               Public-facing chat widget, lead form, suggestion bubbles
  dashboard/          Tabs: launch, knowledge, evaluations, preview, embed,
                      analytics, gaps, leads, logs, tools, and settings
  marketing/          Landing animations (FlowAnimation, DashboardMockup)

lib/
  agents/             Tool-calling loop, HTTP execution, execution records
  ai/                 Provider abstraction + curated model catalog
  auth/               JWT, bcrypt, and Google OAuth helpers
  db/                 Prisma client singleton
  bots/               Draft config, readiness, publish/version, rollback, origin policy
  evaluations/        Deterministic launch evaluation runner
  ingestion/          Chunker, quality checks, jobs, and pipeline orchestrator
  loaders/            PDF/OCR, DOCX, crawler, YouTube, and incremental Google Drive contract
  rag/                Chat, retrieval, verified suggestions, and knowledge gaps
  security/           Rate limiting, audit events, safe fetch, encrypted secrets
  utils/              Zod helpers, classnames, toast

prisma/
  schema.prisma       All models
  migrations/         Prepared migrations covering full schema

public/
  widget.js           Drop-in script widget

scripts/seed.ts       Optional seed script
types/index.ts        Shared TypeScript types
```

## Environment variables

```env
# Core application
DATABASE_URL="postgresql://postgres:password@localhost:5432/openbusinesschat?schema=public"
JWT_SECRET="your-32-char-random-secret"
APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
WORKSPACE_SECRETS_KEY="" # 32-byte base64 or 64-character hex; required for encrypted workspace secrets
AUDIT_HASH_SALT=""       # optional, separate privacy salt for audit/event identifiers

# Google sign-in (optional)
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"

# AI defaults (workspace settings override these)
LLM_PROVIDER="openai"            # openai | anthropic | gemini | groq | ollama
LLM_FALLBACK_PROVIDER=""
OPENAI_API_KEY="sk-..."          # embeddings for OpenAI/Anthropic/Gemini/Groq
OPENAI_MODEL="gpt-4o-mini"
OPENAI_EMBEDDING_MODEL="text-embedding-3-small"
ANTHROPIC_API_KEY=""
ANTHROPIC_MODEL=""
GEMINI_API_KEY=""
GEMINI_MODEL=""
GROQ_API_KEY=""
GROQ_MODEL=""
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL=""

# Uploads and public API protection
MAX_FILE_SIZE_MB="10"
OBJECT_STORAGE_BUCKET=""             # required in production; S3, R2, MinIO, or compatible
OBJECT_STORAGE_REGION="auto"
OBJECT_STORAGE_ENDPOINT=""           # required for R2/MinIO; omit for AWS S3
OBJECT_STORAGE_ACCESS_KEY_ID=""
OBJECT_STORAGE_SECRET_ACCESS_KEY=""
OBJECT_STORAGE_FORCE_PATH_STYLE="false"
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""
PUBLIC_CHAT_RATE_LIMIT_REQUESTS="30"
PUBLIC_CHAT_RATE_LIMIT_WINDOW_SECONDS="60"
RATE_LIMIT_FAIL_OPEN="false"

# One-time platform admin bootstrap. Keep the real password only in a secret manager or local .env.
PLATFORM_ADMIN_USERNAME="admin"
PLATFORM_ADMIN_EMAIL="admin@localhost"
PLATFORM_ADMIN_INITIAL_PASSWORD=""
INGESTION_WORKER_SECRET=""
WEBHOOK_WORKER_SECRET=""
MAINTENANCE_WORKER_SECRET=""
```

Workspace-level settings (entered via the dashboard) **always override** these defaults.

### Google OAuth

Create a **Web application** OAuth client in Google Cloud.

Authorized JavaScript origins:

```text
http://localhost:3000
https://YOUR_DOMAIN
```

Authorized redirect URIs:

```text
http://localhost:3000/api/auth/google/callback
https://YOUR_DOMAIN/api/auth/google/callback
```

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env` locally and in your deployment environment. Never commit the downloaded Google credential JSON file.

The callback must match exactly, including scheme, hostname, port, path, and trailing slash. Adding only a JavaScript origin causes Google error `400: redirect_uri_mismatch`. After saving changes in Google Cloud, allow a few minutes for propagation.

---

## Deployment

### Vercel + cloud Postgres
1. **Database**: Provision Neon from the Vercel Marketplace or use another PostgreSQL host with pgvector. The initial migration enables the `vector` extension.
2. **Core secrets**: Set `JWT_SECRET`, `APP_URL`, `NEXT_PUBLIC_APP_URL`, `WORKSPACE_SECRETS_KEY`, and preferably `AUDIT_HASH_SALT` in Vercel. A Neon Marketplace connection supplies `DATABASE_URL` automatically.
3. **Private uploads**: Attach an S3-compatible private bucket and set the `OBJECT_STORAGE_*` variables. Uploaded documents are encrypted at rest, tenant-scoped, and read by retryable ingestion workers.
4. **Google login**: Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then add the exact production callback in Google Cloud.
5. **Public chat rate limiting**: Upstash Redis is recommended for distributed enforcement. Without it, the app uses a bounded per-instance limiter so public chat remains available. Set `RATE_LIMIT_REQUIRE_DISTRIBUTED=true` if your deployment must fail closed when Redis is absent. `RATE_LIMIT_FAIL_OPEN=true` applies only when a configured Redis service becomes unavailable.
6. **Apply migrations**: From a trusted CI job or a machine with the production `DATABASE_URL`, run `npm run db:deploy`. Apply this before the Vercel deployment so the running application always sees the expected schema.
7. **Deploy**: Vercel runs `npm run build`, which generates Prisma and builds Next.js without coupling the build to a live database connection.
8. Configure authenticated five-minute jobs for `/api/internal/ingestion-jobs`, `/api/internal/webhooks`, and `/api/internal/maintenance`.
9. Visit `/api/health`, then test registration, bot creation, ingestion, preview, publish/promotion, public embed, handoff, webhook delivery, `/admin` authorization, service API, and a tool approval separately.

The reference deployment uses Vercel at [open-chat1.vercel.app](https://open-chat1.vercel.app) with a Vercel Marketplace Neon database.

> **Serverless ingestion:** uploads are written to private S3-compatible storage before a durable ingestion job is executed. The same persisted job can be retried by `/api/internal/ingestion-jobs` after a timeout or deployment. Development uses the ignored local object store; production deliberately fails upload setup when no private bucket is configured.

### Docker (self-host)
```bash
docker compose up -d           # brings up Postgres
npm run build && npm start     # serves on :3000
```
A production `Dockerfile` is included for one-shot containerization if you prefer that.

---

## Security notes

- The Next.js `proxy.ts` performs an early session redirect, while every admin route handler and server page independently revalidates authorization and tenant ownership.
- Google OAuth uses a short-lived state cookie, verifies Google ID tokens and verified email addresses, and links provider identities through `OAuthAccount` rather than storing OAuth users with fake passwords.
- Public chat endpoints (`/api/public/*` and `/embed/*`) only accept a bot's `publicKey` — internal IDs are never exposed.
- Public lead submissions are validated, rate-limited, and only accepted when lead capture is enabled for an active bot.
- Published widgets enforce configured website origins for chat, lead, and telemetry requests. Empty origin lists remain available for local setup and must be tightened before production launch.
- Published bot versions pin both settings and approved source IDs. Draft knowledge changes do not affect visitor retrieval until publish; rollback restores the selected settings and source snapshot.
- Per-workspace provider keys and new tool headers are AES-256-GCM encrypted with `WORKSPACE_SECRETS_KEY`, never returned to the client, and masked in UI. After deploying the migration, run `npm run secrets:migrate` to encrypt legacy workspace keys and clear their plaintext fields.
- File uploads are extension/MIME/signature checked, size-capped (default 10 MB), stored in tenant-scoped private object storage, and removed with their source lifecycle.
- Website ingestion validates every redirect target, blocks local/private network addresses, and caps pages at 5 MB to reduce SSRF and memory-abuse risk.
- Public chat and lead endpoints support distributed Upstash rate limiting and use a bounded per-instance fallback when Redis is not configured.
- `/admin` is separate from `/dashboard` and requires a platform role checked in route handlers and server components. The bootstrap administrator must change its password before accessing platform metrics.
- The platform dashboard uses aggregate records and privacy-minimized embed events. It never exposes provider keys or raw customer content by default.
- Google client secrets and downloaded `client_secret_*.json` files must never be committed. Rotate any credential exposed in chat, screenshots, logs, or public history.
- Tenant isolation: workspace ownership and membership are server-scoped; governance changes require Admin/Owner access, service identities require explicit scopes, and platform roles remain separate.
- Organization policy can restrict providers/models, external tools, production promotion, retention, region, and customer-managed key references.
- See [Trust Center](docs/TRUST_CENTER.md), [Plugin Manifest](docs/PLUGIN_MANIFEST.md), and [Production Operations](docs/OPERATIONS.md).

Run `npm run verify` before opening a pull request. GitHub Actions repeats Prisma validation, type-checking, lint, authorization/upload safety tests, production build, high-severity dependency blocking, and CycloneDX SBOM generation.

---

## Roadmap

The core contracts for the original four phases are present. Next releases focus on production adapters and certification evidence rather than duplicate product flows:

- [ ] Durable object storage, malware scanning, isolated OCR worker, and queue adapters for large/high-volume files (local inline OCR covers the first 10 scanned PDF pages)
- [ ] Google Drive incremental sync and reviewed Slack/Teams/WhatsApp channel packages
- [ ] Certified OIDC/SAML profiles, passkeys/MFA, managed KMS adapters, and regional deployment evidence
- [ ] Community security review and signed distribution for plugin/template catalog entries
- [ ] Statistical experiment reporting, locale benchmark packs, and human-agent response assist
- [ ] Managed cloud billing, white-label domains, advanced moderation, legal hold, and sector profiles

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow. Quick version:
1. Fork the repo
2. Branch off `main`
3. Make your change with a clear commit message
4. Open a pull request

---

## License

MIT — see [LICENSE](LICENSE). Free to use, modify, and ship commercially.

---

## Acknowledgements

Built with Next.js, Prisma, pgvector, and shadcn/ui. Inspired by the broader RAG community (LangChain, LlamaIndex, ChatGPT-style assistants) but designed to be a self-contained, focused product for non-technical business owners.
