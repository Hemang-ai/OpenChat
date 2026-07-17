import type { ToolExecution } from "@prisma/client";
import { db } from "@/lib/db/client";
import { queueWebhookEvent } from "@/lib/integrations/webhooks";

type HandoffPolicy = {
  explicitRequest?: boolean;
  lowEvidence?: boolean;
  repeatedRefusal?: boolean;
  toolFailure?: boolean;
  negativeSentiment?: boolean;
  refusalThreshold?: number;
};

const DEFAULT_POLICY: Required<HandoffPolicy> = {
  explicitRequest: true,
  lowEvidence: true,
  repeatedRefusal: true,
  toolFailure: true,
  negativeSentiment: true,
  refusalThreshold: 2,
};

function explicitHumanRequest(message: string) {
  return /\b(human|person|agent|representative|manager|someone|call me|talk to)\b/i.test(message);
}

function negativeSentiment(message: string) {
  return /\b(angry|frustrated|terrible|awful|unacceptable|complaint|cancel|refund)\b/i.test(message);
}

export async function evaluateHandoff(input: {
  conversationId: string;
  userMessage: string;
  isRefused: boolean;
  evidenceScore: number | null;
  toolCalls: Array<Pick<ToolExecution, "status"> | { status: string }>;
}) {
  const conversation = await db.conversation.findUnique({
    where: { id: input.conversationId },
    include: {
      bot: { select: { id: true, workspaceId: true, handoffPolicy: true, defaultSlaMinutes: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 12 },
      leads: { orderBy: { createdAt: "desc" }, take: 1 },
      toolExecutions: { orderBy: { createdAt: "desc" }, take: 5, select: { id: true, status: true, errorMessage: true } },
    },
  });
  if (!conversation || conversation.status !== "AI_ACTIVE") return null;

  const configured = (conversation.bot.handoffPolicy || {}) as HandoffPolicy;
  const policy = { ...DEFAULT_POLICY, ...configured };
  const refusalCount = conversation.messages.filter((message) => message.isRefused).length;
  const reasons: string[] = [];
  if (policy.explicitRequest && explicitHumanRequest(input.userMessage)) reasons.push("Visitor requested a person");
  if (policy.repeatedRefusal && input.isRefused && refusalCount >= policy.refusalThreshold) reasons.push("Repeated unanswered questions");
  if (policy.lowEvidence && input.evidenceScore !== null && input.evidenceScore < 0.18) reasons.push("Low evidence confidence");
  if (policy.toolFailure && input.toolCalls.some((call) => call.status === "error")) reasons.push("An external action failed");
  if (policy.negativeSentiment && negativeSentiment(input.userMessage)) reasons.push("Potentially negative customer sentiment");
  if (!reasons.length) return null;

  const ordered = [...conversation.messages].reverse();
  const summary = ordered.slice(-6).map((message) => `${message.role === "USER" ? "Visitor" : "Assistant"}: ${message.content}`).join("\n").slice(0, 3_000);
  const requestedAt = new Date();
  const updated = await db.conversation.update({
    where: { id: conversation.id },
    data: {
      status: "HANDOFF_REQUESTED",
      priority: reasons.some((reason) => reason.includes("sentiment")) ? "HIGH" : "NORMAL",
      handoffReason: reasons.join("; "),
      handoffRequestedAt: requestedAt,
      slaDueAt: new Date(requestedAt.getTime() + conversation.bot.defaultSlaMinutes * 60_000),
      summary,
    },
  });

  await queueWebhookEvent({
    workspaceId: conversation.bot.workspaceId,
    botId: conversation.bot.id,
    conversationId: conversation.id,
    event: "conversation.handoff_requested",
    idempotencyKey: `handoff:${conversation.id}:${requestedAt.toISOString()}`,
    payload: {
      conversationId: conversation.id,
      reason: updated.handoffReason,
      priority: updated.priority,
      summary,
      slaDueAt: updated.slaDueAt?.toISOString() || null,
      visitor: conversation.leads[0] ? { name: conversation.leads[0].name, email: conversation.leads[0].email, phone: conversation.leads[0].phone } : null,
      recentMessages: ordered.slice(-12).map((message) => ({ role: message.role, content: message.content, createdAt: message.createdAt.toISOString() })),
      attemptedActions: conversation.toolExecutions,
    },
  });
  return updated;
}
