# OpenBusinessChat

> Open-source AI chatbot platform — train on your business knowledge, embed anywhere.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://typescriptlang.org)

> **🚧 Phased open-source release — Part 1 of 4 (Foundation) shipped.**
> Currently runnable: auth, multi-tenant schema, landing page, design system, Docker setup.
> Coming in upcoming commits: admin dashboard (Part 2), knowledge ingestion (Part 3), RAG chat + embed widget (Part 4).

## What is OpenBusinessChat?

OpenBusinessChat is a production-ready, self-hostable AI chatbot platform that lets any business:

- **Upload knowledge** — PDFs, Word docs, TXT, CSV, Markdown files
- **Add web knowledge** — Crawl website URLs and YouTube transcripts
- **Create a grounded chatbot** — Answers only from your knowledge, never hallucinates
- **Embed anywhere** — Copy an `<iframe>` or `<script>` tag into any website
- **Track conversations** — See every user interaction and identify knowledge gaps

## Features

| Feature | Status |
|---|---|
| Auth (email/password, JWT + bcrypt) | ✅ Part 1 |
| Multi-tenant data model (User → Workspace → Bot → KnowledgeSource) | ✅ Part 1 |
| PostgreSQL + pgvector schema & migrations | ✅ Part 1 |
| Landing page, login, register | ✅ Part 1 |
| shadcn/ui design system | ✅ Part 1 |
| Docker Compose for local pgvector | ✅ Part 1 |
| Admin dashboard (bot CRUD, AI provider settings) | 🚧 Part 2 |
| Multi-provider LLM abstraction (OpenAI / Anthropic / Gemini / Groq / Ollama) | 🚧 Part 2 |
| File upload (PDF, DOCX, TXT, MD, CSV) | 🚧 Part 3 |
| Website URL ingestion | 🚧 Part 3 |
| YouTube transcript extraction | 🚧 Part 3 |
| Chunking + embeddings + pgvector retrieval | 🚧 Part 3 |
| RAG chat (strict/balanced/flexible modes) | 🚧 Part 4 |
| Auto-generated starter questions | 🚧 Part 4 |
| Public iframe + script embed widget | 🚧 Part 4 |
| Conversation logs + analytics | 🚧 Part 4 |
| JavaScript widget | ✅ |
| Conversation logs | ✅ |
| Analytics | ✅ |
| OpenAI / Anthropic / Groq / Ollama | ✅ |
| Google Drive integration | 🔜 Phase 2 |
| Full site crawler | 🔜 Phase 2 |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js App Router                     │
├──────────────────────┬──────────────────────────────────┤
│   Admin Dashboard    │          Public Embed             │
│  /dashboard/**       │    /embed/[publicKey]             │
│                      │    /api/public/chat               │
├──────────────────────┴──────────────────────────────────┤
│                    API Routes                             │
│  /api/auth/**  /api/admin/**  /api/public/**             │
├─────────────────────────────────────────────────────────┤
│         RAG Pipeline (lib/rag, lib/ingestion)            │
│  Chunker → Embeddings → pgvector → LLM → Response        │
├─────────────────────────────────────────────────────────┤
│              PostgreSQL + pgvector                        │
│         Prisma ORM  ·  Multi-tenant isolation             │
└─────────────────────────────────────────────────────────┘
```

## Tech Stack

- **Frontend**: Next.js 15 App Router, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API routes, Node.js
- **Database**: PostgreSQL + pgvector extension, Prisma ORM
- **AI**: OpenAI / Anthropic / Groq / Ollama (provider abstraction)
- **Auth**: JWT + bcrypt, httpOnly cookies

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL with pgvector extension (or use docker-compose)
- An OpenAI API key (or configure another provider)

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/openbusinesschat.git
cd openbusinesschat
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/openbusinesschat"
JWT_SECRET="your-random-secret-min-32-chars"
OPENAI_API_KEY="sk-..."
APP_URL="http://localhost:3000"
```

### 3. Start the database

Using Docker (recommended):

```bash
docker-compose up -d postgres
```

Or use [Supabase](https://supabase.com), [Neon](https://neon.tech), or any Postgres with pgvector.

### 4. Run database migrations

```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 5. (Optional) Seed demo data

```bash
npx ts-node scripts/seed.ts
# Demo login: admin@example.com / password123
```

### 6. Start the dev server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Random secret for JWT signing (min 32 chars) |
| `OPENAI_API_KEY` | ✅* | OpenAI API key (or use another provider) |
| `OPENAI_MODEL` | — | Default: `gpt-4o-mini` |
| `OPENAI_EMBEDDING_MODEL` | — | Default: `text-embedding-3-small` |
| `LLM_PROVIDER` | — | `openai`, `anthropic`, `groq`, `ollama` |
| `APP_URL` | ✅ | Your app's public URL |
| `MAX_FILE_SIZE_MB` | — | Default: `10` |

*Required unless using another provider.

## pgvector Setup

If not using Docker, enable pgvector on your Postgres:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

On Supabase: pgvector is pre-installed.
On Neon: pgvector is available via the Neon console.

## How to Use

### 1. Create your first bot

1. Register at `/register`
2. Go to Dashboard → "New bot"
3. Give it a name and business description

### 2. Upload knowledge

In your bot's **Knowledge** tab:
- Drag & drop files (PDF, DOCX, TXT, MD, CSV)
- Add a website URL to scrape
- Add a YouTube URL for transcript extraction
- Type manual knowledge directly

Watch status change from `pending` → `processing` → `completed`.

### 3. Test in preview

Go to the **Preview** tab to chat with your bot. You'll see:
- Whether the answer is grounded (from your knowledge)
- Which source chunks were retrieved
- If the bot refused to answer

### 4. Embed on your website

Go to the **Embed** tab and copy either:

**iframe** (inline):
```html
<iframe src="https://yourapp.com/embed/YOUR_BOT_KEY" width="400" height="600"></iframe>
```

**Script widget** (floating button):
```html
<script src="https://yourapp.com/widget.js" data-bot-id="YOUR_BOT_KEY" async></script>
```

## Deployment

### Vercel + Neon (recommended)

1. Push to GitHub
2. Import repo in Vercel
3. Create a Neon PostgreSQL database
4. Enable pgvector in Neon console
5. Set all environment variables in Vercel
6. Deploy and run migrations:
   ```bash
   npx prisma migrate deploy
   ```

### Docker

```bash
docker-compose up -d
```

Then run migrations inside the container:
```bash
docker exec obc_app npx prisma migrate deploy
```

### Supabase

1. Create a Supabase project
2. Enable pgvector: Database → Extensions → vector
3. Use the connection string as `DATABASE_URL`

## LLM Provider Configuration

Switch providers with the `LLM_PROVIDER` environment variable:

```env
# OpenAI (default)
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...

# Anthropic
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Groq (fast, free tier)
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_...

# Ollama (local, free)
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

Note: All providers fall back to OpenAI for embeddings. Use the same embedding model throughout for consistent vector dimensions.

## Security Notes

- All admin routes require valid JWT session cookie
- Public chatbot routes use public keys only (no internal IDs exposed)
- File uploads are validated for type and size
- Each workspace's data is fully isolated
- Rate limiting on public chat API (30 req/min per IP)
- No secrets in client-side code

## Roadmap

### Phase 1 — MVP ✅
- File upload & ingestion
- Website URL crawling
- YouTube transcript extraction
- iframe & script widget embed
- Admin dashboard with preview

### Phase 2 — Growth
- Full multi-page website crawler
- Google Drive integration
- Slack / Teams integration
- Human handoff to live agent
- Lead capture form in widget

### Phase 3 — Scale
- Multi-language chatbot
- Advanced analytics dashboard
- White-label branding
- SaaS billing (Stripe)
- Organization roles & permissions
- REST API access

### Phase 4 — Enterprise
- Marketplace of chatbot templates
- Open-source plugin system
- Self-hosted enterprise version
- Fine-grained audit logs
- SOC 2 compliance helpers

## GitHub Push

```bash
git init
git add .
git commit -m "Initial open-source chatbot platform"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/openbusinesschat.git
git push -u origin main
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT License — see [LICENSE](./LICENSE)

---

Built with Next.js, Prisma, pgvector, and OpenAI.
