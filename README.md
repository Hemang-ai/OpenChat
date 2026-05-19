# OpenBusinessChat

> Open-source AI chatbot platform — train on your business knowledge, embed anywhere.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-336791)](https://github.com/pgvector/pgvector)

> **🎉 v0.1.0 — Feature complete. All 4 phased commits shipped.**
> Self-hostable in minutes. Bring your own AI keys. MIT licensed.

---

## What is OpenBusinessChat?

OpenBusinessChat lets any business create a custom AI chatbot trained **only on their own knowledge** — and embed it on any website with a single line of code. No hallucinations, no vendor lock-in, no usage limits.

- **Upload knowledge** — PDFs, Word docs, TXT, CSV, Markdown, website URLs, YouTube transcripts, manual text
- **RAG-grounded answers** — pgvector retrieval, configurable strictness, source citations
- **Embed anywhere** — `<iframe>` or one-line `<script>` widget
- **Bring your own AI** — OpenAI, Anthropic, Google Gemini, Groq, or local Ollama (with primary + fallback chain)
- **Multi-tenant** — each business workspace has its own bots, knowledge, and API keys
- **Production-grade** — TypeScript end-to-end, Prisma + PostgreSQL, secure auth, abuse protection

---

## Features

| Feature | Status |
|---|---|
| Email/password auth (JWT + bcrypt, httpOnly cookies) | ✅ |
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
| Admin chat preview with grounding badges + source citations | ✅ |
| Public iframe embed (`/embed/{publicKey}`) | ✅ |
| Drop-in `<script>` widget (`widget.js`) — floating chat bubble | ✅ |
| Conversation logs viewer | ✅ |
| Analytics: totals, unknown-answer rate, top user questions | ✅ |
| Animated end-to-end flow demo on the landing page | ✅ |
| MIT licensed, fully self-hostable | ✅ |

---

## Quick start

### Prerequisites
- Node.js 20+
- Docker Desktop (for local Postgres with pgvector)
- An OpenAI API key (for embeddings) — get one at [platform.openai.com/api-keys](https://platform.openai.com/api-keys). $5 of credit goes a long way with `gpt-4o-mini` + `text-embedding-3-small`.

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
#   OPENAI_API_KEY (your sk-... key)

# 4. Start Postgres + pgvector
docker-compose up -d postgres

# 5. Run migrations
npx prisma generate
npx prisma migrate deploy

# 6. Start the dev server
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)**.

### First-time flow
1. **Register** → an account + workspace are created
2. **AI Settings** → paste your OpenAI API key, click Save
3. **Dashboard → + New bot** → give it a name
4. **Bot → Knowledge tab** → upload a PDF or paste manual text → wait for `COMPLETED`
5. **Bot → Preview tab** → click a starter suggestion or ask a question
6. **Bot → Embed tab** → copy the `<iframe>` or `<script>` snippet → paste into any website

---

## Tech stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Lucide icons
- **Backend**: Next.js Route Handlers, Node.js runtime
- **Database**: PostgreSQL 16 with pgvector extension (cosine similarity)
- **ORM**: Prisma 5
- **AI**: OpenAI / Anthropic / Google Gemini / Groq / Ollama via a unified provider abstraction
- **Auth**: JWT in httpOnly cookies + bcrypt password hashing
- **Validation**: Zod
- **PDF parsing**: pdf-parse v2; DOCX: mammoth; HTML: cheerio; YouTube: youtube-transcript

## Architecture

```
                       ┌──────────────────────────┐
   Customer (browser)  │  Public widget / iframe  │
                       │  /embed/{publicKey}      │
                       └────────────┬─────────────┘
                                    │ POST /api/public/chat
                                    ▼
┌────────────────────────────────────────────────────────────┐
│  Next.js (App Router)                                       │
│                                                             │
│  /api/public/chat  ──► RAG ──► retrieve chunks (pgvector)   │
│                          │  ──► LLM call (provider chain)   │
│                          ▼                                  │
│                    grounding check, source citations        │
│                                                             │
│  /api/admin/*      ──► auth-guarded admin endpoints         │
│  /dashboard/*      ──► admin UI                             │
└────────────────────────────────────────────────────────────┘
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
         PostgreSQL + pgvector                Workspace AI provider
         (User, Workspace, Bot,               (OpenAI / Anthropic /
          KnowledgeSource, Document,           Gemini / Groq / Ollama)
          DocumentChunk[vector],
          Conversation, Message)
```

## Repository structure

```
app/
  (marketing)/        Landing page + animated demo
  (dashboard)/        Admin UI (workspace, bots, AI settings)
  api/auth/           Login, register, logout
  api/admin/          Workspace + bot CRUD, knowledge upload, chat preview,
                      analytics, logs, suggested-questions
  api/public/         Anonymous chat endpoint (keyed by publicKey)
  embed/[publicKey]/  Iframe-embeddable chat widget
  login/, register/   Auth pages

components/
  ui/                 shadcn/ui design system
  chat/               Public-facing chat widget + suggestion bubbles
  dashboard/          Tabs: knowledge, preview, embed, analytics, logs, settings
  marketing/          Landing animations (FlowAnimation, DashboardMockup)

lib/
  ai/                 Provider abstraction + curated model catalog
  auth/               JWT + bcrypt helpers
  db/                 Prisma client singleton
  ingestion/          Chunker + pipeline orchestrator
  loaders/            PDF, DOCX, website, YouTube, Google Drive (placeholder)
  rag/                Chat engine, retrieval, suggested-questions generator
  utils/              Zod helpers, classnames, toast

prisma/
  schema.prisma       All models
  migrations/         4 migrations covering full schema

public/
  widget.js           Drop-in script widget

scripts/seed.ts       Optional seed script
types/index.ts        Shared TypeScript types
```

## Environment variables

```env
# Required
DATABASE_URL="postgresql://postgres:password@localhost:5432/openbusinesschat?schema=public"
JWT_SECRET="your-32-char-random-secret"
OPENAI_API_KEY="sk-..."          # used for embeddings even when chat uses another provider

# Optional — defaults used if unset
OPENAI_MODEL="gpt-4o-mini"
OPENAI_EMBEDDING_MODEL="text-embedding-3-small"
LLM_PROVIDER="openai"            # openai | anthropic | gemini | groq | ollama
APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
MAX_FILE_SIZE_MB="10"

# Provider keys (also editable per-workspace via the AI Settings UI)
ANTHROPIC_API_KEY=""
GEMINI_API_KEY=""
GROQ_API_KEY=""
OLLAMA_BASE_URL="http://localhost:11434"
```

Workspace-level settings (entered via the dashboard) **always override** these defaults.

---

## Deployment

### Vercel + cloud Postgres
1. **Database**: Create a free Postgres on [Neon](https://neon.tech) or [Supabase](https://supabase.com). Enable the `vector` extension.
2. **Vercel**: Import the GitHub repo. Set the env vars above (point `DATABASE_URL` at your cloud DB).
3. After deploy, run `npx prisma migrate deploy` against the cloud DB once.
4. Done — visit your `*.vercel.app` URL.

### Docker (self-host)
```bash
docker-compose up -d           # brings up Postgres
npm run build && npm start     # serves on :3000
```
A production `Dockerfile` is included for one-shot containerization if you prefer that.

---

## Security notes

- All admin routes are guarded by a Next.js `proxy.ts` (formerly middleware) that checks the JWT cookie.
- Public chat endpoints (`/api/public/*` and `/embed/*`) only accept a bot's `publicKey` — internal IDs are never exposed.
- Per-workspace API keys are stored in the database; never sent to the client (masked in UI).
- File uploads are MIME-type checked and size-capped (default 10 MB).
- Basic rate-limiting structure is in place for public chat requests.
- Tenant isolation: every admin query is scoped by `workspace.ownerId = session.userId`.

---

## Roadmap

- [ ] Full multi-page website crawler with depth limit
- [ ] Google Drive integration (scaffold already in `lib/loaders/googledrive.ts`)
- [ ] Slack / Teams bot integrations
- [ ] Human-handoff + lead-capture forms
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
