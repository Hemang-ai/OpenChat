import { Prisma, type Bot } from "@prisma/client";
import { db } from "@/lib/db/client";
import { writeAuditEvent } from "@/lib/security/audit";

export interface BotConfig {
  name: string;
  description: string | null;
  welcomeMessage: string;
  systemPrompt: string | null;
  businessContext: string | null;
  tone: string;
  strictness: string;
  fallbackBehavior: string;
  contactInfo: string | null;
  leadCaptureEnabled: boolean;
  leadCapturePrompt: string;
  isActive: boolean;
  allowedOrigins: string[];
  privacyNotice: string;
  industryTemplate: string | null;
  suggestedQuestions: string[];
}

export interface ReadinessCheck {
  id: string;
  label: string;
  detail: string;
  passed: boolean;
  required: boolean;
  tab: "settings" | "knowledge" | "evaluations" | "embed" | "preview";
}

export function liveBotConfig(bot: Bot): BotConfig {
  return {
    name: bot.name,
    description: bot.description,
    welcomeMessage: bot.welcomeMessage,
    systemPrompt: bot.systemPrompt,
    businessContext: bot.businessContext,
    tone: bot.tone,
    strictness: bot.strictness,
    fallbackBehavior: bot.fallbackBehavior,
    contactInfo: bot.contactInfo,
    leadCaptureEnabled: bot.leadCaptureEnabled,
    leadCapturePrompt: bot.leadCapturePrompt,
    isActive: bot.isActive,
    allowedOrigins: bot.allowedOrigins,
    privacyNotice: bot.privacyNotice,
    industryTemplate: bot.industryTemplate,
    suggestedQuestions: Array.isArray(bot.suggestedQuestions) ? bot.suggestedQuestions.filter((value): value is string => typeof value === "string") : [],
  };
}

export function draftAwareBotConfig(bot: Bot): BotConfig {
  const live = liveBotConfig(bot);
  const config = !bot.draftConfig || typeof bot.draftConfig !== "object" || Array.isArray(bot.draftConfig)
    ? live
    : normalizeBotConfig({ ...live, ...(bot.draftConfig as Record<string, unknown>) }, live);
  return {
    ...config,
    suggestedQuestions: Array.isArray(bot.draftSuggestedQuestions)
      ? bot.draftSuggestedQuestions.filter((value): value is string => typeof value === "string")
      : config.suggestedQuestions,
  };
}

function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function normalizeBotConfig(input: Partial<BotConfig>, fallback: BotConfig): BotConfig {
  const origins = Array.isArray(input.allowedOrigins)
    ? Array.from(new Set(input.allowedOrigins.map(normalizeOrigin).filter((value): value is string => Boolean(value)))).slice(0, 25)
    : fallback.allowedOrigins;
  return {
    name: typeof input.name === "string" ? input.name : fallback.name,
    description: typeof input.description === "string" || input.description === null ? input.description : fallback.description,
    welcomeMessage: typeof input.welcomeMessage === "string" ? input.welcomeMessage : fallback.welcomeMessage,
    systemPrompt: typeof input.systemPrompt === "string" || input.systemPrompt === null ? input.systemPrompt : fallback.systemPrompt,
    businessContext: typeof input.businessContext === "string" || input.businessContext === null ? input.businessContext : fallback.businessContext,
    tone: typeof input.tone === "string" ? input.tone : fallback.tone,
    strictness: typeof input.strictness === "string" ? input.strictness : fallback.strictness,
    fallbackBehavior: typeof input.fallbackBehavior === "string" ? input.fallbackBehavior : fallback.fallbackBehavior,
    contactInfo: typeof input.contactInfo === "string" || input.contactInfo === null ? input.contactInfo : fallback.contactInfo,
    leadCaptureEnabled: typeof input.leadCaptureEnabled === "boolean" ? input.leadCaptureEnabled : fallback.leadCaptureEnabled,
    leadCapturePrompt: typeof input.leadCapturePrompt === "string" ? input.leadCapturePrompt : fallback.leadCapturePrompt,
    isActive: typeof input.isActive === "boolean" ? input.isActive : fallback.isActive,
    allowedOrigins: origins,
    privacyNotice: typeof input.privacyNotice === "string" ? input.privacyNotice : fallback.privacyNotice,
    industryTemplate: typeof input.industryTemplate === "string" || input.industryTemplate === null ? input.industryTemplate : fallback.industryTemplate,
    suggestedQuestions: Array.isArray(input.suggestedQuestions) ? input.suggestedQuestions.filter((value): value is string => typeof value === "string").slice(0, 5) : fallback.suggestedQuestions,
  };
}

function configUpdate(config: BotConfig): Prisma.BotUpdateInput {
  return {
    name: config.name,
    description: config.description,
    welcomeMessage: config.welcomeMessage,
    systemPrompt: config.systemPrompt,
    businessContext: config.businessContext,
    tone: config.tone,
    strictness: config.strictness,
    fallbackBehavior: config.fallbackBehavior,
    contactInfo: config.contactInfo,
    leadCaptureEnabled: config.leadCaptureEnabled,
    leadCapturePrompt: config.leadCapturePrompt,
    isActive: config.isActive,
    allowedOrigins: config.allowedOrigins,
    privacyNotice: config.privacyNotice,
    industryTemplate: config.industryTemplate,
    suggestedQuestions: config.suggestedQuestions,
    suggestedQuestionsUpdatedAt: new Date(),
  };
}

export async function saveBotDraft(botId: string, changes: Partial<BotConfig>): Promise<Bot> {
  const bot = await db.bot.findUniqueOrThrow({ where: { id: botId } });
  const config = normalizeBotConfig(changes, draftAwareBotConfig(bot));
  return db.bot.update({
    where: { id: botId },
    data: { draftConfig: config as unknown as Prisma.InputJsonValue, draftRevision: { increment: 1 } },
  });
}

export async function touchBotDraft(botId: string): Promise<void> {
  await db.bot.update({ where: { id: botId }, data: { draftRevision: { increment: 1 } } });
}

export async function getBotReadiness(botId: string) {
  const bot = await db.bot.findUniqueOrThrow({
    where: { id: botId },
    include: { workspace: true },
  });
  const now = new Date();
  const [completedSources, staleSources, evaluationCases, latestRun] = await Promise.all([
    db.knowledgeSource.count({ where: { botId, status: "COMPLETED", reviewStatus: "APPROVED" } }),
    db.knowledgeSource.count({ where: { botId, OR: [{ expiresAt: { lt: now } }, { reviewStatus: "NEEDS_REVIEW" }] } }),
    db.evaluationCase.count({ where: { botId } }),
    db.evaluationRun.findFirst({ where: { botId }, orderBy: { createdAt: "desc" } }),
  ]);
  const config = draftAwareBotConfig(bot);
  const provider = bot.workspace.llmProvider || process.env.LLM_PROVIDER || "openai";
  const hasOpenAi = Boolean(bot.workspace.openaiApiKeyEncrypted || bot.workspace.openaiApiKey || process.env.OPENAI_API_KEY);
  const providerKey: Record<string, boolean> = {
    openai: hasOpenAi,
    anthropic: Boolean(bot.workspace.anthropicApiKeyEncrypted || bot.workspace.anthropicApiKey || process.env.ANTHROPIC_API_KEY),
    groq: Boolean(bot.workspace.groqApiKeyEncrypted || bot.workspace.groqApiKey || process.env.GROQ_API_KEY),
    gemini: Boolean(bot.workspace.geminiApiKeyEncrypted || bot.workspace.geminiApiKey || process.env.GEMINI_API_KEY),
    ollama: Boolean(bot.workspace.ollamaBaseUrl || process.env.OLLAMA_BASE_URL),
  };
  const providerReady = Boolean(providerKey[provider]) && (provider === "openai" || provider === "ollama" || hasOpenAi);
  const evaluationCurrent = Boolean(latestRun && latestRun.status === "PASSED" && latestRun.draftRevision === bot.draftRevision);

  const checks: ReadinessCheck[] = [
    { id: "provider", label: "AI connection", detail: providerReady ? `${provider} chat and embeddings are configured.` : "Connect a chat provider and compatible embedding provider.", passed: providerReady, required: true, tab: "settings" },
    { id: "knowledge", label: "Approved knowledge", detail: completedSources ? `${completedSources} approved source${completedSources === 1 ? "" : "s"} ready.` : "Add and approve at least one knowledge source.", passed: completedSources > 0, required: true, tab: "knowledge" },
    { id: "freshness", label: "Knowledge freshness", detail: staleSources ? `${staleSources} source${staleSources === 1 ? "" : "s"} need review.` : "No expired or review-required sources.", passed: staleSources === 0, required: true, tab: "knowledge" },
    { id: "dataset", label: "Evaluation dataset", detail: evaluationCases >= 3 ? `${evaluationCases} launch questions configured.` : `Add ${3 - evaluationCases} more launch test question${3 - evaluationCases === 1 ? "" : "s"}.`, passed: evaluationCases >= 3, required: true, tab: "evaluations" },
    { id: "evaluation", label: "Current evaluation passes", detail: evaluationCurrent ? `${latestRun?.passed}/${latestRun?.total} tests passed for draft ${bot.draftRevision}.` : "Run evaluations after the latest settings or knowledge change.", passed: evaluationCurrent, required: true, tab: "evaluations" },
    { id: "fallback", label: "Human fallback", detail: config.contactInfo ? "Visitors have a clear human contact path." : "Add contact information for questions the bot cannot answer.", passed: Boolean(config.contactInfo), required: false, tab: "settings" },
    { id: "privacy", label: "AI and privacy notice", detail: config.privacyNotice.trim().length >= 20 ? "A visitor-facing notice is configured." : "Add a clear AI and privacy notice.", passed: config.privacyNotice.trim().length >= 20, required: true, tab: "embed" },
    { id: "origins", label: "Approved website domains", detail: config.allowedOrigins.length ? `${config.allowedOrigins.length} approved origin${config.allowedOrigins.length === 1 ? "" : "s"}.` : "Add website origins before public launch.", passed: config.allowedOrigins.length > 0, required: false, tab: "embed" },
  ];
  return {
    bot: { id: bot.id, draftRevision: bot.draftRevision, publishedVersion: bot.publishedVersion, publishedAt: bot.publishedAt, hasDraft: Boolean(bot.draftConfig) },
    checks,
    score: Math.round((checks.filter((check) => check.passed).length / checks.length) * 100),
    readyToPublish: checks.filter((check) => check.required).every((check) => check.passed),
    latestRun,
  };
}

async function sourceSnapshot(botId: string): Promise<{ json: Prisma.InputJsonValue; sourceIds: string[] }> {
  const sources = await db.knowledgeSource.findMany({
    where: { botId, status: "COMPLETED", reviewStatus: "APPROVED" },
    orderBy: { id: "asc" },
    select: { id: true, name: true, type: true, contentHash: true, updatedAt: true },
  });
  return {
    json: sources.map((source) => ({ ...source, updatedAt: source.updatedAt.toISOString() })) as unknown as Prisma.InputJsonValue,
    sourceIds: sources.map((source) => source.id),
  };
}

export async function publishBot(botId: string, userId: string) {
  const readiness = await getBotReadiness(botId);
  if (!readiness.readyToPublish || !readiness.latestRun) {
    throw new Error("This draft is not ready to publish. Resolve all required launch checks first.");
  }
  const bot = await db.bot.findUniqueOrThrow({ where: { id: botId } });
  const config = draftAwareBotConfig(bot);
  const version = bot.publishedVersion + 1;
  const snapshot = await sourceSnapshot(botId);
  await db.$transaction([
    db.botVersion.create({
      data: {
        botId,
        version,
        config: config as unknown as Prisma.InputJsonValue,
        sourceSnapshot: snapshot.json,
        evaluationSummary: { passed: readiness.latestRun.passed, total: readiness.latestRun.total, runId: readiness.latestRun.id },
        evaluationRunId: readiness.latestRun.id,
        createdById: userId,
      },
    }),
    db.bot.update({
      where: { id: botId },
      data: { ...configUpdate(config), draftConfig: Prisma.JsonNull, draftSuggestedQuestions: Prisma.JsonNull, draftSuggestedQuestionsUpdatedAt: null, publishedVersion: version, publishedSourceIds: snapshot.sourceIds, publishedAt: new Date() },
    }),
    db.evaluationRun.update({ where: { id: readiness.latestRun.id }, data: { botVersion: version } }),
  ]);
  await writeAuditEvent({ type: "bot.published", actorId: userId, workspaceId: bot.workspaceId, targetType: "bot", targetId: botId, metadata: { version } });
  return { version };
}

export async function rollbackBot(botId: string, targetVersion: number, userId: string) {
  const [bot, target] = await Promise.all([
    db.bot.findUniqueOrThrow({ where: { id: botId } }),
    db.botVersion.findUnique({ where: { botId_version: { botId, version: targetVersion } } }),
  ]);
  if (!target) throw new Error("Published version not found.");
  const config = normalizeBotConfig(target.config as Partial<BotConfig>, liveBotConfig(bot));
  const targetSources = Array.isArray(target.sourceSnapshot)
    ? target.sourceSnapshot.flatMap((source) => source && typeof source === "object" && !Array.isArray(source) && typeof source.id === "string" ? [source.id] : [])
    : [];
  const version = bot.publishedVersion + 1;
  await db.$transaction([
    db.botVersion.create({
      data: {
        botId,
        version,
        config: config as unknown as Prisma.InputJsonValue,
        sourceSnapshot: target.sourceSnapshot as Prisma.InputJsonValue,
        evaluationSummary: target.evaluationSummary === null ? undefined : target.evaluationSummary as Prisma.InputJsonValue,
        evaluationRunId: target.evaluationRunId,
        rollbackFromVersion: targetVersion,
        createdById: userId,
      },
    }),
    db.bot.update({
      where: { id: botId },
      data: { ...configUpdate(config), draftConfig: Prisma.JsonNull, draftSuggestedQuestions: Prisma.JsonNull, draftSuggestedQuestionsUpdatedAt: null, draftRevision: { increment: 1 }, publishedVersion: version, publishedSourceIds: targetSources, publishedAt: new Date() },
    }),
  ]);
  await writeAuditEvent({ type: "bot.rolled_back", actorId: userId, workspaceId: bot.workspaceId, targetType: "bot", targetId: botId, metadata: { targetVersion, version } });
  return { version, restoredFrom: targetVersion };
}
