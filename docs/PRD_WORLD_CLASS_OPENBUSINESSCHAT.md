# OpenBusinessChat: World-Class Product PRD

**Status:** Approved — Phases 0-4 implemented as an open platform foundation; release exit gates pending live validation  
**Version:** 1.4  
**Date:** July 14, 2026  
**Decision gate:** No implementation is authorized until this PRD, its priorities, and its Phase 0 scope are approved.

**Version 1.1 change:** Reconciled against the latest `main` README, Prisma schema, routes, components, and services. Existing shipped features are now an explicit protected baseline. Future implementation must extend or refine that baseline and must not rebuild completed functionality without evidence that a focused replacement is required for security, reliability, accessibility, or maintainability.

**Version 1.2 change:** Added a secure platform-owner control plane at `/admin`, including signup, activation, bot deployment, embed adoption, engagement, AI quality, ingestion, reliability, cost, and security metrics. The platform administrator extends the existing identity system but is isolated from tenant administration. No default password is hardcoded or committed.

**Version 1.3 change:** Product owner approved the plan. Phase 0 work is underway as additive changes to the current product: platform roles and `/admin`, audit events, encrypted credential columns, persistent ingestion-job records, verified embed telemetry, approval/resume controls, and evidence-based refusal classification.

**Version 1.4 change:** Implemented the Phase 1 verified-launch workflow on the existing bot dashboard: guided readiness, draft settings, immutable publish versions and rollback, source extraction preview/lifecycle/conflict signals, per-bot evaluation datasets and release gates, evidence-aware citations and feedback, knowledge-gap tracking, visitor AI/privacy disclosure, origin policy, offline/failure states, and quality analytics. The usability, unsupported-answer escape, and production migration exit gates remain evidence requirements and are not marked complete by implementation alone.

**Version 1.5 change:** Completed the open Phase 2-4 platform contracts and closed Phase 0 implementation gaps with server-enforced workspace role permissions, durable tenant-scoped private upload storage, file signature checks, executable permission/safety tests, and CI dependency/SBOM gates. Production certification, managed infrastructure controls, third-party adapter certification, load evidence, accessibility review, and legal/regulatory evidence remain deployment release gates rather than source-code claims.

## 1. Executive summary

OpenBusinessChat should evolve from an open-source chatbot builder into an **evidence-first customer experience platform**. A business should be able to connect its knowledge, prove that answers are reliable, publish a branded assistant, complete approved business actions, hand conversations to people, and continuously improve performance without needing AI expertise.

The product's defensible position is:

> **Verified business answers, controlled actions, and human handoff, with open-source ownership.**

The current MVP has the necessary foundation: multi-tenant workspaces, multi-provider AI configuration, knowledge ingestion, pgvector retrieval, public embeds, conversations, leads, analytics, and HTTP tools. It is not yet ready to claim world-class reliability or enterprise safety. The most important gaps are durable ingestion, measurable RAG quality, encrypted secrets, defense-in-depth tenant isolation, complete tool approval, auditability, privacy controls, collaboration, and operational reliability.

This PRD prioritizes trust before feature breadth. It avoids promises such as "zero hallucinations." Instead, it requires measurable groundedness, evidence coverage, explicit refusal behavior, human escalation, and regression gates.

### Scope-control rule

The current repository is the implementation baseline. The delivery team must follow these rules:

1. **Preserve completed behavior.** A feature marked shipped in the verified baseline remains in place unless a requirement explicitly says to refine or extend it.
2. **Extend before replacing.** Prefer existing routes, models, provider adapters, loaders, RAG services, components, and design tokens. Add interfaces or migrations only where the target behavior cannot be reached safely through the current boundary.
3. **Do not duplicate flows.** There must be one canonical workspace, bot, provider, knowledge, chat, lead, analytics, embed, and tool workflow. New capabilities attach to those workflows rather than creating parallel pages or APIs.
4. **Refactors require evidence.** A replacement is justified only by a documented security weakness, reliability constraint, accessibility failure, measured performance problem, or unmaintainable contract. The change must include migration, compatibility, and regression coverage.
5. **README is the product inventory; code is proof.** Before each phase, reconcile the README with routes, schema, UI, and tests. A README checkmark alone does not prove production quality, and a completed feature is not reimplemented merely because its hardening work remains.
6. **Backward compatibility is a release gate.** Existing bots, public keys, embeddings, conversations, leads, widgets, provider settings, and tool records must continue to work through migrations or have an explicit, tested upgrade path.

## 2. Product vision

### Vision

Every business can deploy a trustworthy AI representative that knows what the business has approved, explains the evidence behind its answers, takes only permitted actions, and brings in a person when needed.

### Target market

Initial focus:

- Small and mid-market businesses with 5-500 employees.
- Customer support, pre-sales, service operations, agencies, clinics, education providers, local services, and ecommerce teams.
- Teams that need fast deployment, data ownership, bring-your-own-model flexibility, and a credible path to self-hosting.

Not an initial focus:

- Autonomous high-risk decisions in healthcare, employment, credit, insurance, legal outcomes, or public services.
- General-purpose consumer AI.
- Replacing a complete contact-center platform in the first release cycle.

### Strategic differentiation

1. **Evidence first:** every business claim is linked to approved knowledge or an authenticated tool result.
2. **Quality before publish:** each bot has readiness checks and an evaluation scorecard.
3. **Controlled agency:** tools use least privilege, explicit scopes, approvals, audit records, and reversible execution where possible.
4. **Human continuity:** unanswered or sensitive conversations become structured handoffs, not dead ends.
5. **Open ownership:** self-hostable core, portable data, provider choice, and no training on customer data by default.

## 3. Product principles

1. **Trust is visible.** Show source freshness, answer evidence, action status, and clear limitations in language a business owner understands.
2. **Safe defaults win.** New bots start unpublished, grounded, rate-limited, and unable to execute tools automatically.
3. **Progressive disclosure.** A first-time owner sees guided steps; experts can open advanced retrieval, model, and policy controls.
4. **One clear next step.** Empty, loading, failed, and incomplete states always explain what happened and offer the next valid action.
5. **No fake confidence.** Display evidence coverage and evaluation results, not an uncalibrated percentage presented as certainty.
6. **Automation is bounded.** The model cannot grant itself tools, credentials, permissions, or broader network access.
7. **Accessible by default.** Admin and visitor experiences target WCAG 2.2 AA across mobile and desktop.
8. **Portable by design.** Businesses can export sources, bot configuration, conversations, leads, and audit records.

### Current product baseline

This plan builds on the existing product rather than replacing it.

| Area | Current strength | Gap this PRD closes |
|---|---|---|
| Account and workspace | Email/password and Google OAuth; workspace-scoped bots | Membership, roles, invitations, session security, enterprise identity |
| AI providers | OpenAI, Anthropic, Gemini, Groq, Ollama; primary/fallback selection | Encrypted keys, capability validation, policy registry, cost and health controls |
| Knowledge | File, URL, YouTube, and manual ingestion with pgvector | Durable jobs, object storage, extraction QA, malware/OCR, lifecycle and sync |
| Answers | Retrieval, strictness modes, refusals, admin citations | Structured evidence, calibrated evaluation, regression gates, gap workflow |
| Visitor experience | iframe/script widget, suggestions, lead capture | Accessibility, complete failure states, origin policy, privacy and handoff |
| Actions | HTTP tools, provider-native function calls, execution records | Restricted egress, secret references, risk tiers, complete approval/resume |
| Operations | Conversation logs and basic analytics | SLOs, traces, quality/outcome/cost metrics, audit, backup and incident controls |
| Tenancy | Application-level workspace filters | Database-enforced row policies and adversarial isolation testing |
| Platform ownership | No platform role or platform-wide `/admin` console | Isolated owner access, trustworthy aggregate metrics, verified embed telemetry, support and security operations |

### Protected shipped-feature inventory

The following capabilities are already present on the latest audited `main` and are **not new-build scope**:

| Existing capability | Existing implementation to retain | Allowed follow-on work |
|---|---|---|
| Email/password authentication | JWT session cookie, bcrypt password hashing, register/login/logout routes | Session rotation/revocation, CSRF, throttling, passkeys/MFA, clearer error UX |
| Google sign-in | OAuth state validation, verified email, account linking through `OAuthAccount` | Security-policy controls, session management, enterprise identity later |
| Workspace and bot administration | Workspace selector, bot CRUD, bot settings, owner-scoped admin queries | Add membership/RBAC and database policy without recreating workspace or bot CRUD |
| AI provider settings | OpenAI, Anthropic, Gemini, Groq, Ollama; curated models; Auto; primary/fallback | Encrypt secrets, test chat/embedding separately, provider health/cost/policy controls |
| File ingestion | PDF, DOCX, TXT, MD, CSV upload up to configured limit; serverless-safe buffer parsing | Wrap loaders in durable jobs/object storage; improve extraction QA, safety, OCR, retry UX |
| URL, YouTube, and manual ingestion | Single-page readable-text loader with SSRF controls, transcript loader, manual text | Extend existing source contract to crawler, refresh, connectors, and richer diagnostics |
| Chunking and vector retrieval | Sliding-window chunks, batched embeddings, pgvector cosine retrieval | Add evaluation, hybrid/reranked tuning, metadata/freshness, and regression controls |
| Grounded chat behavior | Strict/Balanced/Flexible modes, fallback behavior, contact information | Replace phrase-only status inference with structured evidence validation; retain modes |
| Suggested questions | Knowledge-generated questions and animated widget bubbles | Validate coverage, refresh on source version, improve layout/accessibility; do not build a second generator |
| Admin preview | Shared answer path, grounding/refusal badges, retrieved source display | Add evaluation traces, evidence quality, feedback, and version comparison in the same preview |
| Public embeds | iframe route and drop-in floating script widget | Harden origin policy, accessibility, states, branding, and observability without changing public keys |
| Lead capture | Optional visitor form, status workflow, lead inbox, analytics | Add consent, routing, assignment, CRM/handoff continuity; preserve existing leads |
| Conversations and analytics | Conversation logs, messages, refusal/grounding flags, totals and top questions | Extend definitions and drill-downs; do not create a parallel analytics data model without need |
| Agentic HTTP tools | Provider function calling, HTTP execution, execution records, pending-approval foundation | Harden egress/secrets/idempotency and finish approval/resume in the existing tool workflow |
| Landing and responsive foundation | Marketing page, animated flow, dashboard/mobile improvements, Tailwind/shadcn system | Refine against accessibility and usability findings; retain visual system and component patterns |
| Open-source deployment | MIT license, Docker, Vercel/Neon guidance, Prisma migrations, Upstash option | Add deployment diagnostics, durable adapters, backup/restore, and secure self-hosting guidance |

Any implementation plan must cite the existing file, route, model, or component it will modify for each item above. Creating a second implementation requires product-owner approval.

### Existing implementation anchors

These are the canonical extension points verified on the audited `main` branch:

| Product area | Canonical implementation anchors |
|---|---|
| Authentication | `lib/auth/jwt.ts`, `lib/auth/password.ts`, `lib/auth/google.ts`, `app/api/auth/*`, `components/auth/google-sign-in.tsx` |
| Workspace and bot administration | `app/api/admin/workspaces/*`, `app/api/admin/bots/*`, `app/(dashboard)/dashboard/page.tsx`, `app/(dashboard)/dashboard/bots/[botId]/page.tsx` |
| Provider configuration | `lib/ai/provider.ts`, `app/(dashboard)/dashboard/settings/page.tsx`, `app/api/admin/workspaces/[workspaceId]/route.ts` |
| Knowledge UI and API | `components/dashboard/knowledge-tab.tsx`, `app/api/admin/bots/[botId]/knowledge/route.ts` |
| Ingestion pipeline | `lib/ingestion/pipeline.ts`, `lib/ingestion/chunker.ts`, `lib/loaders/pdf.ts`, `docx.ts`, `website.ts`, `youtube.ts`, `googledrive.ts` |
| RAG and suggested questions | `lib/rag/chat.ts`, `lib/rag/retrieval.ts`, `lib/rag/suggested-questions.ts`, existing admin chat/suggestion routes |
| Visitor chat and embeds | `components/chat/embed-chat.tsx`, `components/chat/suggested-bubbles.tsx`, `app/embed/[publicKey]/page.tsx`, `app/api/public/chat/route.ts`, `public/widget.js` |
| Leads and conversations | `components/dashboard/leads-tab.tsx`, `app/api/public/leads/route.ts`, existing admin lead/log routes, `Conversation`, `Message`, and `Lead` models |
| Analytics | `components/dashboard/analytics-tab.tsx`, `app/api/admin/bots/[botId]/analytics/route.ts` |
| Agentic tools | `lib/agents/agent-chat.ts`, `lib/agents/tool-runner.ts`, `components/dashboard/tools-tab.tsx`, existing tool and execution routes/models |
| Network and abuse safety | `lib/security/safe-fetch.ts`, `lib/security/rate-limit.ts` |
| Data model | `prisma/schema.prisma` and committed migrations; changes must be additive or include a tested data migration |

File moves may be proposed during technical design, but the behavior and data contracts remain canonical unless the replacement is explicitly approved.

## 4. Personas and jobs to be done

### Business owner / operator

**Job:** Launch a useful assistant without understanding embeddings, prompts, or model catalogs.

Needs guided setup, plain-language quality indicators, predictable cost, safe defaults, and a publish checklist.

### Knowledge manager / support lead

**Job:** Keep answers accurate as products, policies, and operations change.

Needs source ownership, freshness, conflict detection, versioning, evaluations, feedback, and searchable conversation insights.

### Customer support agent

**Job:** Take over when the assistant cannot or should not continue.

Needs a concise summary, customer context, cited source trail, assignment, status, internal notes, and return-to-bot controls.

### Developer / integrator

**Job:** Embed, customize, integrate, monitor, and self-host the platform safely.

Needs stable APIs, webhooks, SDK examples, environment separation, logs, idempotency, documented security boundaries, and upgrade-safe migrations.

### Security / IT administrator

**Job:** Approve and govern the platform without creating unmanaged data or identity risk.

Needs roles, SSO options, audit logs, retention, secret management, tenant isolation, data flow documentation, and incident controls.

### Platform owner / operator

**Job:** Understand adoption, product health, customer outcomes, platform risk, and where users need help across the hosted OpenBusinessChat service.

Needs a secure `/admin` control plane with acquisition and activation funnels, bot/embed adoption, usage and quality trends, ingestion/provider health, cost and capacity, security alerts, privacy-aware account drill-downs, and auditable support access. This is a platform role, not a customer-workspace role.

### Website visitor

**Job:** Get a fast, accurate answer or reach the right person without repeating information.

Needs accessible chat, useful starter questions, transparent AI identity, privacy notice, citations where appropriate, action confirmation, and graceful escalation.

## 5. End-to-end target journey

1. **Create workspace:** choose business type, purpose, region, and initial team members.
2. **Connect AI:** select managed credentials or bring a key; validate chat and embedding capability separately.
3. **Add knowledge:** upload, paste, connect, or crawl; see extraction preview, status, errors, ownership, and freshness.
4. **Build the bot:** select support/sales/operations template; configure identity, tone, escalation, privacy, and action policy.
5. **Prove readiness:** run generated and curated evaluations; resolve missing, stale, conflicting, or low-quality knowledge.
6. **Preview safely:** test answers, sources, refusals, prompt-injection resistance, tools, and handoff.
7. **Publish a version:** promote a tested draft to production with a change summary and rollback point.
8. **Embed or integrate:** use iframe, script, API, or approved channel connector with domain restrictions.
9. **Operate:** monitor quality, latency, cost, feedback, incidents, leads, handoffs, and tool executions.
10. **Improve:** convert failed questions into knowledge tasks, rerun evaluations, and publish the next version.

## 6. Goals and success measures

### North-star metric

**Weekly verified resolutions:** unique customer conversations that end in either:

- a grounded answer supported by sufficient evidence,
- a successfully completed approved action, or
- a successful human handoff,

without a negative correction or reopen event within the measurement window.

### Product targets after Phase 2

| Metric | Definition | Target |
|---|---|---:|
| Time to first verified answer | Registration to first evaluation-passing answer | Median under 15 minutes |
| Activation | New workspaces that ingest knowledge, pass minimum readiness, and publish | At least 45% in 7 days |
| Grounded answer precision | Supported business claims divided by evaluated business claims | At least 95% on approved evaluation sets |
| Refusal precision | Correct refusals divided by all refusals | At least 90% |
| Unsupported-answer escape rate | Unsupported answers reaching production visitors | Under 1% on evaluation suite |
| Evidence coverage | Answers with sufficient cited evidence | At least 95% for business-fact answers |
| P95 visitor response latency | End-to-end response, excluding approved long-running actions | Under 6 seconds |
| Handoff continuity | Handoffs with summary, transcript, and assigned destination | At least 95% |
| Accessibility | Automated checks plus critical-flow manual audit | WCAG 2.2 AA |
| Availability | Public chat API monthly availability | 99.9% after reliability phase |
| Security | Open critical/high exploitable findings at release | Zero |

Targets must be measured per provider, model, bot version, and channel. Early baselines will replace assumptions after telemetry is available.

## 7. Scope and requirements

Priority definitions:

- **P0:** Required before positioning the platform as production-ready.
- **P1:** Required for a differentiated, commercially useful product.
- **P2:** Scale, ecosystem, or advanced enterprise capability.

### Delivery classification

Requirement IDs are classified to prevent repeated development:

| Classification | Meaning | Requirement IDs |
|---|---|---|
| **Refine existing** | Improve UX, correctness, accessibility, security, or observability inside a shipped workflow | ONB-02, ONB-06, KNW-03, KNW-04, KNW-05, RAG-01, RAG-05, RAG-06, RAG-09, CHT-01, CHT-02, CHT-03, CHT-04, CHT-05, CHT-06, CHT-08, ACT-01, ACT-03, ACT-04, ACT-05, ACT-06, ANL-01, ANL-02, ANL-03, ANL-04, SEC-02, SEC-03, SEC-04, SEC-07, SEC-08, REL-02, REL-03, REL-05, REL-08 |
| **Extend existing** | Add capability through an established model/service/component contract | ONB-01, ONB-03, ONB-05, KNW-01, KNW-02, KNW-06, KNW-07, KNW-08, KNW-09, KNW-10, RAG-02, RAG-03, RAG-07, RAG-08, RAG-10, RAG-11, CHT-07, CHT-09, HOF-01, HOF-02, HOF-05, HOF-06, ACT-02, ACT-07, ACT-08, ACT-09, ANL-05, ANL-06, ADM-01, ADM-02, ADM-03, ADM-05, SEC-01, SEC-05, SEC-06, SEC-09, SEC-10, SEC-11, REL-01, REL-04, REL-06, REL-07, PAD-02, PAD-03, PAD-05, PAD-06, PAD-07, PAD-11, PAD-13 |
| **Net new** | No equivalent shipped workflow exists; integrate it into the canonical product navigation and data model | ONB-04, KNW-11, RAG-04, HOF-03, HOF-04, ADM-04, ADM-06, ADM-07, SEC-12, PAD-01, PAD-04, PAD-08, PAD-09, PAD-10, PAD-12, PAD-14 |

Classification does not reduce acceptance criteria. It defines how the work must relate to the current codebase.

### 7.1 Guided onboarding and workspace readiness

| ID | Pri. | Requirement | Acceptance criteria |
|---|---:|---|---|
| ONB-01 | P0 | Guided setup checklist | Workspace shows Connect AI, Add knowledge, Test, Customize, and Publish; progress persists; each step deep-links to the correct action. |
| ONB-02 | P0 | Provider connection test | Chat and embedding credentials are validated independently without persisting a failed configuration; errors explain credential, quota, model, and network failures distinctly. |
| ONB-03 | P0 | Bot readiness score | Score is based on explicit checks: working provider, completed sources, fresh embeddings, evaluation pass rate, fallback contact, privacy notice, domain policy, and rate limiting. It is not marketed as model confidence. |
| ONB-04 | P0 | Draft and publish lifecycle | Configuration changes remain draft until published; production keeps the last known-good version; owner can view change summary and roll back. |
| ONB-05 | P1 | Industry templates | Support, product discovery, lead qualification, and service booking templates configure suggested defaults without inserting unverified business facts. |
| ONB-06 | P1 | Contextual education | Plain-language help explains grounding, refusal, source freshness, provider fallback, and tool approval at the point of decision. |

### 7.2 Knowledge ingestion and management

| ID | Pri. | Requirement | Acceptance criteria |
|---|---:|---|---|
| KNW-01 | P0 | Durable asynchronous ingestion | Upload/crawl requests create idempotent jobs; work survives request timeout and deployment; retry uses bounded exponential backoff; cancellation and retry are visible. |
| KNW-02 | P0 | Secure object storage | Original uploads use private object storage, signed access, tenant-scoped paths, file-size limits, MIME and signature validation, and lifecycle deletion. Database is not used as the primary binary store. |
| KNW-03 | P0 | Extraction quality preview | Before or after processing, owner can inspect extracted text, page/section metadata, warnings, chunk count, and excluded content. Failed pages identify the exact stage and remediation. |
| KNW-04 | P0 | Safe website ingestion | Enforce SSRF protections on every redirect and network connection, DNS/IP validation, response limits, timeouts, content-type allowlist, robots policy, canonical URL handling, and user-agent identification. |
| KNW-05 | P0 | File safety pipeline | Malware scanning, archive-bomb protection, parser sandbox/isolation, page and token limits, and safe deletion are release-gated controls. |
| KNW-06 | P1 | Source lifecycle | Owners can assign source owner, tags, refresh schedule, expiry date, and review status; stale sources trigger alerts and are filterable. |
| KNW-07 | P1 | Conflict and duplicate detection | Semantically duplicate or contradictory passages are flagged with side-by-side resolution and no silent overwrite. |
| KNW-08 | P1 | Crawler and connectors | Scoped multi-page crawler supports depth/page limits and include/exclude patterns; Google Drive and additional connectors use the same source contract and job system. |
| KNW-09 | P1 | OCR and structured extraction | Scanned PDFs, tables, headings, and metadata retain usable structure; extraction quality is reported. |
| KNW-10 | P1 | Incremental synchronization | Changed documents re-embed only affected content; deleted source content is removed from retrieval deterministically. |
| KNW-11 | P2 | Knowledge governance | Approval workflow, source-level access rules, legal hold, and regional storage policies are available for enterprise workspaces. |

### 7.3 Answer quality, RAG, and evaluations

| ID | Pri. | Requirement | Acceptance criteria |
|---|---:|---|---|
| RAG-01 | P0 | Evidence-based answer contract | Business-fact answers must return structured claim/evidence metadata internally; insufficient evidence produces the configured safe response or handoff. |
| RAG-02 | P0 | Evaluation datasets | Each bot supports owner-authored and generated test questions with expected answer, required sources, acceptable refusal, and risk label. |
| RAG-03 | P0 | Automated evaluation run | Before publish, run retrieval recall, groundedness, citation correctness, answer correctness, refusal precision/recall, safety, latency, and cost checks. Results are versioned. |
| RAG-04 | P0 | Release quality gates | Production publish is blocked for critical safety failures and warned for configurable quality thresholds; privileged override requires reason and audit event. |
| RAG-05 | P0 | Prompt-injection defense | Retrieved content and tool output are treated as untrusted data, clearly delimited from instructions, scanned for attack indicators, and unable to change system policy or permissions. |
| RAG-06 | P0 | Deterministic refusal classification | Refusal/grounded status is not inferred only from phrase matching. Use structured model output plus evidence validation and test coverage. |
| RAG-07 | P1 | Retrieval tuning workbench | Advanced users can compare chunking, hybrid search, reranking, filters, thresholds, and models against the same evaluation set before publishing. |
| RAG-08 | P1 | Feedback loop | Visitors and agents can rate/correct answers; feedback links to bot version, sources, model, retrieval trace, and a knowledge improvement task. |
| RAG-09 | P1 | Source-aware citations | Citation UI shows source title, relevant excerpt, freshness, and link/page when safe; hidden/private source metadata is never exposed publicly. |
| RAG-10 | P1 | Knowledge gap inbox | Cluster unanswered and negatively rated questions, estimate frequency and impact, and let owners create or assign a source update. |
| RAG-11 | P2 | Multilingual quality | Language detection, locale-specific prompts, translated UI, cross-language retrieval evaluation, and per-language quality gates. |

### 7.4 Visitor chat and mobile experience

| ID | Pri. | Requirement | Acceptance criteria |
|---|---:|---|---|
| CHT-01 | P0 | Responsive accessible widget | Works at 320 CSS px and above, keyboard and screen-reader navigable, visible focus, no content overlap, reduced-motion support, and touch targets meeting WCAG 2.2 AA. |
| CHT-02 | P0 | Transparent AI identity | Header or first message identifies the experience as AI unless context makes it unambiguous; privacy and human-help links are available. |
| CHT-03 | P0 | Complete chat states | Sending, queued, streaming, retry, offline, rate-limited, unavailable, refused, action pending, and handoff states use actionable language and stable layout. |
| CHT-04 | P0 | Conversation continuity | Stable anonymous session token, deduplicated sends, safe retry, history limits, and optional consented cross-device identity. |
| CHT-05 | P1 | Dynamic starter questions | Questions are generated from verified source coverage, fit the widget, remain keyboard accessible, refresh after major knowledge changes, and are validated through the same answer path. |
| CHT-06 | P1 | Brand controls | Safe color/contrast validation, logo, position, greeting, launcher, locale, and custom CSS tokens without arbitrary script injection. |
| CHT-07 | P1 | Domain and channel policy | Public key can be restricted to approved origins; embed diagnostics explain CSP, domain, token, and configuration failures. |
| CHT-08 | P1 | Rich but safe content | Links, lists, tables, files, and action cards render through an allowlisted schema with output sanitization; no raw model HTML execution. |
| CHT-09 | P2 | Omnichannel adapters | API and channel connectors share conversation, identity, policy, analytics, and handoff contracts. |

### 7.5 Human handoff and service workflow

| ID | Pri. | Requirement | Acceptance criteria |
|---|---:|---|---|
| HOF-01 | P1 | Escalation policy | Owner configures triggers for explicit request, low evidence, repeated refusal, negative sentiment, high-risk topic, VIP, and tool failure. |
| HOF-02 | P1 | Handoff packet | Assigned person receives transcript, concise AI summary, visitor details/consent, sources used, attempted actions, and reason for escalation. |
| HOF-03 | P1 | Shared inbox | Agents can assign, prioritize, comment internally, resolve, reopen, and return a conversation to AI; customer is told when control changes. |
| HOF-04 | P1 | Routing and service levels | Business hours, queues, team routing, SLA timers, fallback contact method, and after-hours expectations are configurable. |
| HOF-05 | P1 | Helpdesk integrations | Initial integrations use signed, retryable webhooks and idempotency; failures are visible and replayable. |
| HOF-06 | P2 | Agent assist | Suggest responses and knowledge updates to human agents, but require human send by default. |

### 7.6 Agentic actions and integrations

| ID | Pri. | Requirement | Acceptance criteria |
|---|---:|---|---|
| ACT-01 | P0 | Complete approval flow | Pending action displays purpose, parameters, data sent, destination, side effects, and expiry; user can approve/reject; approved execution resumes exactly once. |
| ACT-02 | P0 | Least-privilege tools | Each tool declares allowed domains, methods, input/output schema, secret references, permissions, timeout, data classification, and approval policy. |
| ACT-03 | P0 | Safe egress | Tool execution uses the same or stronger SSRF, redirect, DNS rebinding, size, content-type, timeout, and private-network defenses as crawling. |
| ACT-04 | P0 | Secret isolation | Credentials are secret references, never model-visible values or plaintext JSON headers; logs redact configured and detected secrets. |
| ACT-05 | P0 | Execution integrity | Validate model arguments against schema, use idempotency keys for side effects, bound retries, record immutable status transitions, and prevent replay. |
| ACT-06 | P0 | Risk-tiered autonomy | Read-only tools may be automatic after owner approval; write, financial, destructive, identity, and external-communication actions require stronger confirmation by default. |
| ACT-07 | P1 | Integration test console | Owners can run redacted test inputs, inspect request/response mapping, validate auth, and promote a tested tool version. |
| ACT-08 | P1 | Webhook platform | Signed inbound/outbound webhooks, replay protection, delivery logs, retries, and endpoint rotation. |
| ACT-09 | P2 | Integration catalog | Open plugin contract, reviewed manifests, scoped permissions, compatibility versioning, and community security guidance. |

### 7.7 Analytics and continuous improvement

| ID | Pri. | Requirement | Acceptance criteria |
|---|---:|---|---|
| ANL-01 | P0 | Trusted metric definitions | Metrics have documented formulas, time zone, filters, sampling, and bot-version dimensions; dashboards do not mix visitors, conversations, and messages. |
| ANL-02 | P1 | Outcome dashboard | Show verified resolution, containment, handoff, CSAT, lead conversion, action success, refusal, evidence coverage, latency, token cost, and provider errors. |
| ANL-03 | P1 | Quality drill-down | Every aggregate links to redacted conversations, retrieval traces, feedback, source versions, and evaluation results. |
| ANL-04 | P1 | Cost and budget controls | Track usage by workspace/bot/provider/model; configurable alerts and hard/soft limits protect against unbounded consumption. |
| ANL-05 | P1 | Privacy-aware exports | CSV/API exports honor role, retention, redaction, and deletion policies and create audit events. |
| ANL-06 | P2 | Experiments | Compare published prompt/retrieval/widget variants with assignment integrity, guardrails, and statistically responsible reporting. |

### 7.8 Collaboration and enterprise administration

| ID | Pri. | Requirement | Acceptance criteria |
|---|---:|---|---|
| ADM-01 | P0 | Workspace membership model | Owner, Admin, Builder, Analyst, Support Agent, and Viewer roles use server-enforced permissions; invitations expire and can be revoked. |
| ADM-02 | P0 | Tenant defense in depth | All tenant-owned tables use PostgreSQL row-level security or an equivalent database-enforced policy, plus application authorization and automated cross-tenant tests. |
| ADM-03 | P0 | Audit log | Append-only records cover authentication, membership, secrets, data access/export/delete, bot publish, policy override, tools, integrations, and admin changes. |
| ADM-04 | P1 | Environment separation | Development, staging, and production configurations and keys are separated; promotion is explicit and auditable. |
| ADM-05 | P1 | API and service identities | Scoped API keys/service accounts have expiry, rotation, last-used data, rate limits, and revocation. |
| ADM-06 | P2 | Enterprise identity | OIDC/SAML SSO, SCIM provisioning, domain claim, group mapping, and enforced authentication policy. |
| ADM-07 | P2 | Policy administration | Organization administrators control allowed providers/models, data regions, retention, external tools, and publish requirements. |

### 7.9 Security, privacy, and responsible AI

| ID | Pri. | Requirement | Acceptance criteria |
|---|---:|---|---|
| SEC-01 | P0 | Secrets protection | Provider keys, OAuth secrets, and tool credentials use envelope encryption with managed KMS/secret manager; key versioning and rotation are supported; plaintext migration is one-way and verified. |
| SEC-02 | P0 | Modern authentication | Secure session rotation/revocation, CSRF protection, login throttling, breached-password screening, password-manager support, and passkey/phishing-resistant MFA path. |
| SEC-03 | P0 | Application security baseline | Meet OWASP ASVS 5.0 Level 2 for production scope; threat model admin, public chat, ingestion, RAG, tools, OAuth, and webhooks. |
| SEC-04 | P0 | AI security baseline | Test and mitigate OWASP LLM/GenAI risks including prompt injection, disclosure, poisoning, output handling, excessive agency, vector weaknesses, misinformation, and unbounded consumption. |
| SEC-05 | P0 | Data minimization and retention | Workspace configures conversation, lead, source, upload, and audit retention within safe policy bounds; scheduled deletion is verifiable. |
| SEC-06 | P0 | Privacy rights workflow | Export, correction, and deletion cover derived data such as embeddings, logs, backups policy, and connector copies; status and audit evidence are recorded. |
| SEC-07 | P0 | Public disclosure and consent | Widget supports AI disclosure, privacy link, configurable notice/consent, lead consent, and a no-training-on-customer-data default statement. |
| SEC-08 | P0 | Secure development gates | CI runs type/lint/test, dependency and secret scanning, SAST, migration checks, SBOM generation, and critical vulnerability blocking. |
| SEC-09 | P1 | PII controls | Detect and optionally redact sensitive data before model calls/logging; configurable rules distinguish conversation, source, analytics, and tool data. |
| SEC-10 | P1 | Session and security center | Users can inspect active sessions, recent security events, authenticators, API keys, and revoke access. |
| SEC-11 | P1 | Trust documentation | Publish data flow, subprocessors, model-provider behavior, retention, vulnerability disclosure, security contacts, and deployment hardening guidance. |
| SEC-12 | P2 | Regional and regulated controls | Data residency, customer-managed keys, legal hold, DPA tooling, and sector-specific deployment profiles. |

### 7.10 Reliability, observability, and developer experience

| ID | Pri. | Requirement | Acceptance criteria |
|---|---:|---|---|
| REL-01 | P0 | Production SLOs | Define availability, latency, ingestion completion, and action success SLOs with alert thresholds and error budgets. |
| REL-02 | P0 | Structured observability | Correlation IDs connect request, conversation, job, retrieval, model call, and tool execution; sensitive content is off by default and redacted when enabled. |
| REL-03 | P0 | Distributed abuse protection | Production public endpoints fail closed or degrade safely when distributed rate limiting is unavailable; limits apply by IP, bot, workspace budget, and abuse signal. |
| REL-04 | P0 | Backup and recovery | Automated backups, point-in-time recovery, restore drills, documented RPO/RTO, and tested tenant export/deletion behavior. |
| REL-05 | P0 | Failure isolation | Provider timeouts, circuit breakers, bounded retries, fallback policy, queue backpressure, and per-tenant quotas prevent cascading failure. |
| REL-06 | P1 | Operational console | Health by provider, model, job type, connector, and bot version; safe replay for eligible failed jobs; incident annotations. |
| REL-07 | P1 | Stable public APIs | Versioned API, typed SDK, webhook contract, idempotency, pagination, rate-limit headers, deprecation policy, and examples. |
| REL-08 | P1 | Self-hosting assurance | Automated install validation, upgrade guide, migration backup check, health endpoint, configuration diagnostics, and supported deployment matrix. |

### 7.11 Platform-owner admin control plane

The `/admin` route is for the OpenBusinessChat platform owner and authorized platform staff. Existing `/dashboard` and `/api/admin/*` routes remain customer-workspace administration. Platform APIs use a distinct namespace such as `/api/platform-admin/*` and require platform-role authorization on every request.

| ID | Pri. | Requirement | Acceptance criteria |
|---|---:|---|---|
| PAD-01 | P0 | Isolated `/admin` control plane | `/admin` has a separate layout, route guard, and platform-role check. Customer workspace owners receive 404 or 403 and cannot infer platform data. Platform roles are `SUPER_ADMIN`, `PLATFORM_ADMIN`, `SUPPORT`, `ANALYST`, and `SECURITY_AUDITOR`, with least-privilege permissions. |
| PAD-02 | P0 | Executive overview | Selected period shows total/new users, verified signups, active users, workspaces, bots created, active/published bots, completed sources, conversations, messages, leads, tool executions, and period-over-period change. Every metric has a definition and drill-down. |
| PAD-03 | P0 | Activation funnel | Measure signup, provider connected, bot created, first source completed, first successful preview answer, embed verified, and first visitor conversation. Show conversion, median time between steps, and drop-off by signup cohort. |
| PAD-04 | P0 | Embed adoption telemetry | Record privacy-minimized iframe/widget load and first-chat events so admin can see bots with generated embed code, verified installs, active installations, unique approved domains, first/last seen, install method, and blocked/misconfigured attempts. Do not claim an integration from code generation alone. |
| PAD-05 | P0 | Chat and AI quality | Show conversations, unique anonymous sessions, messages, grounded/refused rate, unsupported-answer evaluation rate, lead conversion, action success, suggested-question selection, top knowledge gaps, model/provider, latency, and trend. Clearly distinguish measured production events from offline evaluations. |
| PAD-06 | P0 | Ingestion and provider operations | Show ingestion volume and success/failure by file/URL/YouTube/manual type, failure stage/reason, processing latency, embedding errors, provider error/fallback rate, and affected workspaces. Link to redacted operational traces rather than exposing source content by default. |
| PAD-07 | P1 | Cost and capacity | Track tokens and estimated model cost by provider/model/workspace, vector chunks, storage, queue depth, rate-limit consumption, and budget alerts. Estimated cost must be labeled and based on a versioned price catalog. No provider key is displayed. |
| PAD-08 | P0 | Security operations | Show failed and suspicious logins, rate-limit blocks, origin-policy violations, cross-tenant authorization denials, secret rotations, privileged changes, tool approval anomalies, and unresolved security alerts. High-risk events link to immutable audit records. |
| PAD-09 | P0 | Privacy-aware customer directory | Search users/workspaces and view account status, signup/last activity, bots, source/job health, usage, and support history. Conversation/source content and PII are hidden by default. Break-glass access requires reason, bounded duration, prominent banner, least privilege, and audit trail; passwords and API keys are never viewable. |
| PAD-10 | P0 | Admin authentication and session security | Require phishing-resistant MFA/passkey for privileged production roles, short idle timeout, session rotation, reauthentication for sensitive actions, active-session revocation, IP/device context, and alerting for unusual access. |
| PAD-11 | P1 | Filters and exports | Support date range, comparison period, timezone, cohort, provider, model, source type, bot state, and workspace filters. Exports are role-controlled, redacted, size-limited, asynchronous when large, retention-bound, and audited. |
| PAD-12 | P0 | Accessible responsive UX | `/admin` works at 320 CSS px and 200% zoom, uses WCAG 2.2 AA contrast/focus/keyboard behavior, converts dense tables to usable mobile summaries, and never relies on color alone for status. Charts include text summaries and accessible data tables. |
| PAD-13 | P1 | Alerts and operational workflow | Threshold and anomaly alerts cover signup/activation drops, ingestion failures, provider outages, latency/SLO burn, unusual cost, abuse, and security events. Alerts have owner, severity, status, acknowledgement, notes, and incident links. |
| PAD-14 | P0 | Secure administrator bootstrap | Reuse existing password hashing and session primitives. A local bootstrap command may create the requested `admin` login from environment/interactive input exactly once. No username/password pair is committed, seeded by default, returned by an API, or displayed after creation. Initial password must meet policy, is forced to change at first login, and production access requires MFA. Bootstrap is disabled after the first platform owner exists. |

#### Platform metrics definitions

| Metric | Definition |
|---|---|
| Signup | A persisted user account created successfully; separate email/password, Google, verified, invited, and deleted accounts. |
| Active user | A user completing an authenticated meaningful action in the selected period; login alone is reported separately. |
| Bot created | A persisted bot; separately report active, evaluated, published, embed-generated, verified-installed, and visitor-active bots. |
| Verified integration | A valid widget/iframe load from an allowed domain in the selected recency window. Generating or copying code is not an integration. |
| Active installation | A verified integration with a valid load or visitor chat inside the configured active window. |
| Activated workspace | Provider connected, at least one completed source, one successful preview answer, and one published bot. |
| Engaged workspace | An activated workspace with a verified integration or API/channel visitor conversation. |
| Verified resolution | The north-star outcome defined in Section 6; grounded, action, and human-handoff outcomes remain separate dimensions. |

#### Administrator credential policy

- The requested local login name `admin` is supported as a bootstrap identity.
- The password supplied in conversation is treated as exposed and must not be stored in this PRD, committed to Git, placed in `.env.example`, or used as a production default.
- Local setup accepts `PLATFORM_ADMIN_USERNAME` and a one-time `PLATFORM_ADMIN_INITIAL_PASSWORD` through a non-committed environment or interactive command. Production should use a secret manager or interactive bootstrap.
- The password policy follows the modern authentication requirement in SEC-02; privileged accounts must enroll MFA/passkey and change the initial password before entering `/admin`.
- Recovery uses verified recovery codes or a separately authorized platform owner. There is no hidden master password.

## 8. UX and accessibility standard

### Information architecture

Use a task-oriented navigation model:

- **Home:** setup progress, readiness, urgent failures, quality trend, usage.
- **Bots:** identity, behavior, knowledge, test, actions, channels, versions.
- **Inbox:** live/handoff conversations and leads.
- **Knowledge:** reusable sources, freshness, ownership, failures, gaps.
- **Analytics:** outcomes, quality, cost, operations.
- **Workspace settings:** members, AI providers, security, privacy, integrations, billing placeholder only when monetization exists.

Avoid exposing implementation terms such as vector thresholds in the default path. Advanced controls remain available with consequences and recommended values explained.

### Content design

- Use customer language: "Needs review" instead of raw enum names; "Could not reach this page" before technical abort details.
- Every failure states what failed, whether data was saved, and what the user can do next.
- Destructive actions name the affected object and recovery behavior.
- Grounding is explained as "supported by your approved knowledge," with source evidence accessible.
- The assistant never claims an action succeeded until the tool returns verified success.

### Responsive typography and layout

- Root/body text defaults to **16 CSS px** with at least **1.5 line height**; secondary text should generally remain at least 14 px and never carry essential instructions at low contrast.
- Do not scale font size directly with viewport width. Use a fixed token scale and responsive layout changes.
- Support browser text zoom to 200% and WCAG reflow at 320 CSS px without horizontal page scrolling, except necessary data tables which receive their own accessible scroll region.
- Keep text containers readable (approximately 45-75 characters for long-form copy).
- Minimum interactive target is 24 by 24 CSS px under WCAG 2.2 AA; product default should target 44 by 44 px for primary touch controls.
- Mobile uses a compact header, drawer navigation, bottom-safe-area padding, stable chat composer, and no hover-only action.
- Motion honors `prefers-reduced-motion`; animation never blocks setup or obscures status.

### Accessibility release gate

Critical journeys must pass:

1. Keyboard-only registration, setup, ingestion, preview, publish, visitor chat, approval, and handoff.
2. Screen-reader checks with semantic names, roles, values, status announcements, and logical order.
3. Contrast, focus visibility, target size, text resize, zoom, reflow, and error association checks.
4. Automated accessibility tests plus manual testing; automated success alone is insufficient.

## 9. Target architecture

```text
Admin / Widget / API / Channels
            |
      Edge and API layer
   auth, policy, rate limits
            |
  ---------------------------
  |          |              |
Control    Chat/RAG       Ingestion API
plane      service        + job producer
  |          |              |
  |     model gateway    Durable queue
  |     retrieval/eval        |
  |          |            Sandboxed workers
  |          |              |
PostgreSQL + pgvector   Private object storage
+ tenant RLS           + malware/OCR/parsers
  |
Secret manager/KMS --- tool executor with restricted egress
  |
Audit events + OpenTelemetry + metrics/logs/traces
```

Architectural rules:

- The database is the source of truth for policy, versions, status, and audit references.
- Large binaries live in private object storage, not database request payloads.
- Ingestion and long-running actions use durable jobs with idempotency and leases.
- Secrets are resolved only in the server-side component that needs them.
- Public keys identify a bot but do not authorize admin access.
- Tenant isolation is enforced at API and database layers.
- Model/provider adapters return a normalized structured response and trace contract.
- Model input/output content is not placed in telemetry unless explicitly enabled with redaction and retention.
- `/admin` queries an aggregate/operational read model and audited support services; it does not bypass tenant policy or read raw secrets.
- Product events use a versioned schema with deduplication, consent/privacy classification, retention, and server-side validation. Security/audit events are stored separately from product analytics.

## 10. Delivery plan

Estimates assume a focused team of 3-5 engineers plus product/design and part-time security/QA. They are planning ranges, not commitments, and should be refined during technical planning.

### Phase 0: Trust and reliability foundation (6-8 weeks)

**Goal:** Remove current production blockers and high-risk architecture gaps.

Deliver:

- **Extend workspace ownership:** add membership/RBAC and cross-tenant tests around the existing workspace and bot routes; retain current registration, Google OAuth, workspace selection, and bot CRUD.
- **Harden provider and tool settings:** encrypt existing stored credentials with a one-way migration; retain provider adapters, model catalog, Auto selection, and primary/fallback behavior.
- **Operationalize ingestion:** place the existing loaders, chunker, embeddings, and source statuses behind a durable job/object-storage contract; retain current file types, URL, YouTube, manual text, and pgvector records.
- **Complete tools safely:** add restricted egress, secret references, idempotency, and approve/reject/resume to the existing tool runner, tools tab, and execution log.
- **Refine the RAG result contract:** keep current retrieval and Strict/Balanced/Flexible product behavior while replacing phrase-only grounded/refused inference with structured evidence validation.
- **Harden abuse and failure controls:** build on the existing Upstash/in-memory limiter and provider fallback with production policy, quotas, timeouts, and circuit breakers.
- **Add cross-cutting controls:** introduce audit events, correlation IDs, security headers, and CI security gates without creating parallel business workflows.
- **Add the platform-owner foundation:** implement isolated `/admin` authorization, one-time secure bootstrap, executive metrics, activation funnel, verified embed telemetry, operational health, and security events by extending existing user/workspace/bot/source/conversation/lead/tool records.
- **Refine responsive UX:** remediate registration, setup, knowledge, preview, and widget using the current Tailwind/shadcn components and design language.

Exit gate:

- No critical/high exploitable findings in scoped threat model.
- Cross-tenant test suite cannot read or mutate another workspace.
- Secrets are not stored in plaintext or emitted to logs/model context.
- Ingestion and approved actions survive request/deployment interruption.
- Critical flows pass WCAG 2.2 AA review.
- Non-platform users cannot access `/admin`; privileged access requires first-login reset and MFA in production; no default credential exists in source, build artifacts, seed data, or documentation.
- Signup, activation, bot state, verified integration, usage, quality, ingestion, and security metrics reconcile against source records and documented definitions.

### Phase 1: Verified launch experience (4-6 weeks)

**Goal:** Make the fastest path to a trustworthy published bot the core experience.

**Implementation status (July 14, 2026):** Complete in the repository. Existing bots are migrated as immutable version 1; new bots start as unpublished drafts. Release validation still requires applying migrations to the target database, running representative evaluation suites, measuring the 15-minute usability goal, and confirming the unsupported-answer escape target on production-like data.

Deliver:

- Add guided setup and readiness to the existing dashboard and bot detail navigation.
- Add bot draft/publish/version/rollback around current bot settings and public keys; migrate existing bots as their initial published version.
- Extend the current knowledge tab and source records with extraction preview, freshness, ownership, conflicts, and actionable retry states.
- Add per-bot evaluation datasets and publish gates around the existing preview and RAG path.
- Extend current source citations, conversation logs, and suggested questions into evidence quality, feedback, and a knowledge-gap inbox.
- Refine the existing iframe/script widget with AI disclosure, privacy notice, complete failure/offline states, and origin policy.
- Extend the existing analytics tab and conversation records into outcome and quality metrics.

Exit gate:

- A nontechnical user can reach a verified first answer in under 15 minutes in usability testing.
- Publish creates an immutable evaluated version and rollback restores it.
- Unsupported-answer escape target is met on the release evaluation suite.

### Phase 2: Customer experience operations (6-8 weeks)

**Implementation status (July 14, 2026):** Implemented in the repository. Handoff policies and packets extend Conversation Logs; signed webhooks, retry records, service operations, crawler settings, scheduled refresh, risk-tiered tool testing, and outcome/cost analytics use the existing product records. Exit metrics still require production-like load and delivery validation after migration deployment.

**Goal:** Turn the chatbot into an operational support and growth product.

Deliver:

- Evolve the existing lead inbox and conversation logs into handoff policies, assignments, summaries, business hours, and SLAs; do not create an unrelated second inbox.
- Extend lead and conversation workflows through an initial helpdesk/CRM integration and signed webhook platform.
- Expand current analytics with quality, outcome, cost, and knowledge-improvement drill-downs.
- Extend the existing website/Google Drive loader contracts with crawler, incremental sync, OCR, and source refresh schedules.
- Extend the existing tools tab and execution records with an integration test console and risk-tiered action policies.

Exit gate:

- Handoff packet completeness at least 95%.
- Integration and webhook retries are idempotent and observable.
- Knowledge refresh and deletion update production retrieval within documented SLO.

### Phase 3: Enterprise control plane (8-12 weeks)

**Implementation status (July 14, 2026):** Implemented as the open enterprise control-plane foundation. Workspace membership, expiring invitations, scoped service identities, SCIM provisioning, encrypted OIDC/SAML configuration records, DNS domain claims, organization policy, environment promotion, retention/privacy workers, audit export, region/customer-key policy, health diagnostics, and trust/operations documentation are included. External IdP certification, managed-KMS enforcement, residency evidence, and legal templates remain deployment-specific release validation.

**Goal:** Support governed multi-team adoption.

Deliver:

- SSO/SCIM, domain claim, organization policies, service identities.
- Environment promotion, approval workflows, data retention/deletion center.
- Enterprise audit export, regional controls, customer-managed key option.
- Privacy workflow, trust center, and vendor/security documentation package.

### Phase 4: Ecosystem and scale

**Implementation status (July 14, 2026):** Implemented as extensible contracts and product workflows. The repository includes a reviewed plugin manifest/catalog contract, shared channel records and versioned API, locale-aware widget/chat and evaluation records, workspace templates, governance scope on sources, and stable-session experiments over immutable bot versions. Additional third-party adapters and community-reviewed catalog entries are installed independently through these contracts.

**Goal:** Build extensibility without weakening trust.

Deliver:

- Reviewed plugin/integration catalog and open manifest specification.
- Multilingual quality program and additional channels.
- Organization-wide knowledge governance, template marketplace, and advanced experiments.

## 11. Prioritized initiative scorecard

Score: 1-10. Priority favors customer impact and risk reduction over feature novelty.

| Rank | Initiative | Impact | Confidence | Effort efficiency | Strategic score |
|---:|---|---:|---:|---:|---:|
| 1 | Guided readiness and RAG evaluation gates | 10 | 9 | 8 | **9.4** |
| 2 | Trust foundation: secrets, RBAC/RLS, audit, safe tools | 10 | 9 | 7 | **9.3** |
| 3 | Durable ingestion and source quality workspace | 9 | 9 | 8 | **8.9** |
| 4 | Platform-owner administration and operations | 9 | 9 | 8 | **8.8** |
| 5 | Human handoff and shared inbox | 10 | 8 | 7 | **8.8** |
| 6 | Versioned publish and rollback | 9 | 9 | 8 | **8.8** |
| 7 | Knowledge gap and feedback improvement loop | 9 | 8 | 8 | **8.5** |
| 8 | Outcome, quality, and cost analytics | 8 | 8 | 8 | **8.0** |
| 9 | Safe action and integration platform | 9 | 8 | 6 | **8.0** |
| 10 | Enterprise identity and policy | 8 | 8 | 6 | **7.5** |
| 11 | Omnichannel and integration marketplace | 8 | 7 | 5 | **6.9** |

Recommendation: approve initiatives 1-6 as the first product program. They turn existing capabilities into a trustworthy operating system, give the platform owner measurable operational control, and avoid adding marketplace breadth before safety and quality are proven.

## 12. Security threat model summary

| Trust boundary | Primary threats | Required controls |
|---|---|---|
| Anonymous visitor to public API | Abuse, enumeration, injection, PII leakage, cost exhaustion | Distributed limits, bot/origin policy, input bounds, privacy controls, budgets, safe rendering |
| Admin to tenant data | Broken access control, session theft, CSRF, unsafe export | RBAC, RLS, MFA/passkeys path, session controls, CSRF, audit, export authorization |
| Uploaded/crawled content to RAG | Malware, poisoning, prompt injection, secrets, stale/contradictory data | Scanning, parser isolation, untrusted-content boundary, provenance, review/freshness, evaluation |
| Model to application | Malformed output, policy bypass, secret request, hallucinated success | Structured schemas, policy engine, output validation, evidence checks, no direct authority |
| Model to tools | Excessive agency, SSRF, privilege abuse, replay, destructive action | Scopes, allowlists, secret isolation, approval, idempotency, egress controls, immutable logs |
| Platform to providers/connectors | Credential leakage, retention mismatch, supply-chain compromise | KMS, provider policy inventory, minimum data, timeouts, version pinning, SBOM, vendor review |
| Tenant to tenant | IDOR, query omission, cache/vector leakage | Database RLS, app filters, tenant-scoped caches/storage, automated adversarial isolation tests |

## 13. Data and AI governance

Every bot version records:

- owner and approver,
- intended purpose and prohibited uses,
- system and fallback policy version,
- model and embedding provider/model,
- retrieval/chunking/reranking configuration,
- source versions and freshness,
- enabled tools and approval policies,
- evaluation results and approved overrides,
- privacy/retention/domain/channel policy,
- publish and rollback events.

Provider terms and retention differ. The platform must maintain a provider capability/data-policy registry and show the effect of a selection before saving. Customer data must not be used to train shared models by OpenBusinessChat. Self-hosters remain responsible for their selected provider and deployment policy.

## 14. Definition of done and release gates

A requirement is done only when:

1. User-facing behavior and failure states meet acceptance criteria.
2. Tenant authorization and negative security tests exist.
3. Accessibility is tested for changed critical journeys.
4. Telemetry measures success without logging secrets or content by default.
5. Data retention/deletion behavior is defined.
6. Documentation, migration, rollback, and self-hosting impact are complete.
7. Unit, integration, and end-to-end tests pass in CI.
8. Threat model and abuse cases are reviewed for security-sensitive changes.
9. The implementation plan identifies the existing code path being refined or extended and confirms that no duplicate route, model, UI flow, or service was introduced.
10. Regression tests prove existing README-listed behavior still works, including migrations for current user, workspace, bot, source, conversation, lead, public-key, provider, and tool data.
11. Platform metrics reconcile to authoritative source records, exclude test/deleted data according to documented policy, and distinguish generated embed code from a verified installation.
12. Privileged `/admin` tests cover route/API denial, role boundaries, MFA/session policy, export limits, break-glass access, secret redaction, audit completeness, and mobile/accessibility behavior.

Production release additionally requires:

- no critical/high exploitable security findings,
- successful backup/restore evidence for data-model changes,
- evaluation regression within approved thresholds,
- SLO dashboards and alerts for the changed path,
- documented rollback or forward-fix plan.

## 15. Key risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Scope becomes an enterprise feature checklist | Delayed value and weak usability | Phase gates; prioritize verified launch journey and measurable outcomes. |
| Quality metrics appear precise but are not predictive | False trust | Use labeled evaluation sets, human review, per-domain baselines, and disclose metric limits. |
| Provider/model changes regress answers | Customer harm | Version provider configuration, nightly regression suite, canary, rollback. |
| Open-source and hosted architectures diverge | Maintenance burden | One core contract; adapters for queue, storage, KMS, rate limiting, and observability. |
| Security controls make onboarding difficult | Activation loss | Secure defaults, managed option, progressive disclosure, actionable diagnostics. |
| Tool actions cause irreversible side effects | Financial/reputation harm | Risk tiers, explicit approval, idempotency, previews, least privilege, reversible workflows. |
| Conversation data creates privacy exposure | Legal/trust harm | Minimize collection, configurable retention, redaction, access controls, rights workflow. |

## 16. Decisions requested from the product owner

Approve or revise these decisions before implementation:

1. **Positioning:** Evidence-first customer experience platform, not a general chatbot builder.
2. **Initial segment:** SMB and mid-market support/pre-sales/service operations.
3. **First program:** Trust foundation, durable ingestion, RAG evaluation/readiness, publish/versioning, then human handoff.
4. **Open-source boundary:** Keep core bot, ingestion, evaluation, embed, security controls, and self-hosting open source; future hosted convenience may be monetized without withholding baseline safety.
5. **Security bar:** OWASP ASVS 5.0 Level 2 baseline, OWASP GenAI threat coverage, database tenant policies, encrypted secrets, and WCAG 2.2 AA as release gates.
6. **Product claim:** Do not claim zero hallucinations. Claim measurable, evidence-backed answers with controlled refusal and human fallback.
7. **Phase 0 authorization:** Approve the Phase 0 scope before engineering begins.
8. **Platform administration:** Approve `/admin` as an isolated platform-owner control plane with secure one-time `admin` bootstrap, not a hardcoded shared password.

## 17. Approval record

Product owner should respond with one of:

- **Approved as written. Begin Phase 0 planning and implementation.**
- **Approved with changes:** list requirement IDs or decisions to change.
- **Not approved:** explain the positioning, segment, sequence, or scope that should be reconsidered.

Implementation remains paused until this approval is recorded.

## 18. Standards and primary references

- [NIST AI Risk Management Framework and Generative AI Profile](https://www.nist.gov/itl/ai-risk-management-framework)
- [NIST AI 600-1: Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
- [OWASP Top 10 for LLM and Generative AI](https://genai.owasp.org/initiatives/top-10-for-llm-and-genai/)
- [OWASP Agentic Applications Top 10](https://genai.owasp.org/2025/12/09/owasp-genai-security-project-releases-top-10-risks-and-mitigations-for-agentic-ai-security/)
- [OWASP ASVS 5.0](https://owasp.org/www-project-application-security-verification-standard/)
- [W3C Web Content Accessibility Guidelines 2.2](https://www.w3.org/TR/WCAG22/)
- [NIST SP 800-63-4 Digital Identity Guidelines](https://pages.nist.gov/800-63-4/)
- [OAuth 2.0 Security Best Current Practice, RFC 9700](https://datatracker.ietf.org/doc/html/rfc9700)
- [PostgreSQL Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [NIST Privacy Framework](https://www.nist.gov/privacy-framework)
- [EU Artificial Intelligence Act, Regulation (EU) 2024/1689](https://eur-lex.europa.eu/eli/reg/2024/1689/oj)
- [OpenTelemetry Generative AI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/)

This PRD describes a product and engineering direction, not a certification or legal-compliance guarantee. Applicable legal obligations must be reviewed for each customer, deployment region, and intended use.
