# OpenBusinessChat

> Open-source AI chatbot platform — train on your business knowledge, embed anywhere.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-336791)](https://github.com/pgvector/pgvector)

> **Current main:** Google OAuth, lead capture, and agentic HTTP actions are live. Tools use native function-calling with OpenAI and Anthropic.
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
| Primary + fallback provider chain with auto-failover | ✅ |
| Curated model catalog with "Auto (recommended)" defaults | ✅ |
| File upload (PDF, DOCX, TXT, MD, CSV — up to 10 MB) | ✅ |
| Website URL ingestion (single-page with noise stripping) | ✅ |
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
| Animated end-to-end flow demo on the landing page | ✅ |
| **Agentic tools** — bot calls HTTP APIs via function-calling (OpenAI + Anthropic) | ✅ |
| **Tool execution log** with input/output, latency, status per invocation | ✅ |
| **Approval gating foundation** — records pending approvals; approval/resume UI is next | 🟡 |
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
npx prisma migrate deploy

# 6. Start the dev server
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)**.

### First-time flow
1. **Register** with Google or email/password → an account + workspace are created
2. **AI Settings** → paste your OpenAI API key, click Save
3. **Dashboard → + New bot** → give it a name
4. **Bot → Knowledge tab** → upload a PDF or paste manual text → wait for `COMPLETED`
5. **Bot → Preview tab** → click a starter suggestion or ask a question
6. **Bot → Settings tab** → optionally enable lead capture for human follow-up
7. **Bot → Embed tab** → copy the `<iframe>` or `<script>` snippet → paste into any website

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
npx prisma migrate deploy
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
  api/admin/          Workspace + bot CRUD, knowledge upload, chat preview,
                      analytics, leads, logs, suggested-questions
  api/public/         Anonymous chat + lead capture endpoints (keyed by publicKey)
  embed/[publicKey]/  Iframe-embeddable chat widget
  login/, register/   Auth pages

components/
  ui/                 shadcn/ui design system
  chat/               Public-facing chat widget, lead form, suggestion bubbles
  dashboard/          Tabs: knowledge, preview, embed, analytics, leads, logs, settings
  marketing/          Landing animations (FlowAnimation, DashboardMockup)

lib/
  agents/             Tool-calling loop, HTTP execution, execution records
  ai/                 Provider abstraction + curated model catalog
  auth/               JWT, bcrypt, and Google OAuth helpers
  db/                 Prisma client singleton
  ingestion/          Chunker + pipeline orchestrator
  loaders/            PDF, DOCX, website, YouTube, Google Drive (placeholder)
  rag/                Chat engine, retrieval, suggested-questions generator
  security/           Upstash/in-memory rate limiting
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
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""
PUBLIC_CHAT_RATE_LIMIT_REQUESTS="30"
PUBLIC_CHAT_RATE_LIMIT_WINDOW_SECONDS="60"
RATE_LIMIT_FAIL_OPEN="false"
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
2. **Core secrets**: Set `JWT_SECRET`, `APP_URL`, and `NEXT_PUBLIC_APP_URL` in Vercel. A Neon Marketplace connection supplies `DATABASE_URL` automatically.
3. **Google login**: Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then add the exact production callback in Google Cloud.
4. **Public chat rate limiting**: Configure Upstash Redis with `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Production fails closed when Redis is absent unless `RATE_LIMIT_FAIL_OPEN=true` is deliberately enabled.
5. **Deploy**: `npm run build` generates Prisma, applies committed migrations with `prisma migrate deploy`, and builds Next.js.
6. Visit the production URL and test registration, bot creation, ingestion, preview chat, and the public embed separately.

The reference deployment uses Vercel at [open-chat1.vercel.app](https://open-chat1.vercel.app) with a Vercel Marketplace Neon database.

> **Storage note:** file uploads currently use local filesystem storage and ingestion starts from the request process. That works in local Docker and conventional long-running Node deployments, but Vercel filesystems are ephemeral. Before relying on file ingestion in production, connect durable object storage (Vercel Blob/S3) and a durable ingestion worker or queue. URL, manual-text, and YouTube sources do not require persisted upload files, but durable background execution is still recommended.

### Docker (self-host)
```bash
docker compose up -d           # brings up Postgres
npm run build && npm start     # serves on :3000
```
A production `Dockerfile` is included for one-shot containerization if you prefer that.

---

## Security notes

- All admin routes are guarded by a Next.js `proxy.ts` (formerly middleware) that checks the JWT cookie.
- Google OAuth uses a short-lived state cookie, verifies Google ID tokens and verified email addresses, and links provider identities through `OAuthAccount` rather than storing OAuth users with fake passwords.
- Public chat endpoints (`/api/public/*` and `/embed/*`) only accept a bot's `publicKey` — internal IDs are never exposed.
- Public lead submissions are validated, rate-limited, and only accepted when lead capture is enabled for an active bot.
- Per-workspace API keys are stored in the database; never sent to the client (masked in UI).
- File uploads are MIME-type checked and size-capped (default 10 MB).
- Public chat and lead endpoints support distributed Upstash rate limiting; local development uses an in-memory limiter.
- Google client secrets and downloaded `client_secret_*.json` files must never be committed. Rotate any credential exposed in chat, screenshots, logs, or public history.
- Tenant isolation: every admin query is scoped by `workspace.ownerId = session.userId`.

---

## Roadmap

- [ ] Full multi-page website crawler with depth limit
- [ ] Google Drive integration (scaffold already in `lib/loaders/googledrive.ts`)
- [ ] Slack / Teams bot integrations
- [ ] Human-handoff notifications and CRM exports
- [ ] Complete approval/resume UI for tools marked `REQUIRE_CONFIRM`
- [ ] Durable object storage and queued ingestion for serverless deployments
- [ ] Multi-language chatbots
- [ ] Advanced moderation + custom blocklists
- [ ] White-label branding (custom domains, theme colors, fonts)
- [ ] Optional managed cloud tier with SaaS billing
- [ ] API access + webhooks
- [ ] Marketplace of chatbot templates
- [ ] Self-hosted enterprise build with SSO + audit logs

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
