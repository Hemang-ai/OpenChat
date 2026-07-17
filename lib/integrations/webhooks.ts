import { createHmac, randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { decryptSecret } from "@/lib/security/secrets";
import { fetchPublicWebsite } from "@/lib/security/safe-fetch";

export async function queueWebhookEvent(input: {
  workspaceId: string;
  botId?: string;
  conversationId?: string;
  event: string;
  payload: Prisma.InputJsonValue;
  idempotencyKey?: string;
}) {
  const endpoints = await db.webhookEndpoint.findMany({
    where: {
      workspaceId: input.workspaceId,
      isActive: true,
      events: { has: input.event },
      OR: [{ botId: input.botId }, { botId: null }],
    },
    select: { id: true },
  });

  if (!endpoints.length) return [];
  const rootKey = input.idempotencyKey || randomUUID();
  return Promise.all(endpoints.map((endpoint) => db.webhookDelivery.upsert({
    where: { idempotencyKey: `${rootKey}:${endpoint.id}` },
    update: {},
    create: {
      endpointId: endpoint.id,
      conversationId: input.conversationId,
      event: input.event,
      payload: input.payload,
      idempotencyKey: `${rootKey}:${endpoint.id}`,
    },
  })));
}

export async function deliverWebhook(deliveryId: string) {
  const claimed = await db.webhookDelivery.updateMany({
    where: {
      id: deliveryId,
      status: { in: ["PENDING", "FAILED"] },
      runAfter: { lte: new Date() },
      attempts: { lt: 5 },
    },
    data: { status: "PROCESSING", attempts: { increment: 1 } },
  });
  if (!claimed.count) return db.webhookDelivery.findUnique({ where: { id: deliveryId } });

  const delivery = await db.webhookDelivery.findUniqueOrThrow({
    where: { id: deliveryId },
    include: { endpoint: true },
  });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify({
    id: delivery.id,
    event: delivery.event,
    createdAt: delivery.createdAt.toISOString(),
    data: delivery.payload,
  });
  const secret = decryptSecret(delivery.endpoint.secretEncrypted);
  const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");

  try {
    const response = await fetchPublicWebsite(delivery.endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "OpenBusinessChat-Webhooks/1.0",
        "X-OBC-Delivery": delivery.id,
        "X-OBC-Event": delivery.event,
        "X-OBC-Timestamp": timestamp,
        "X-OBC-Signature": `v1=${signature}`,
        "Idempotency-Key": delivery.idempotencyKey,
      },
      body,
      signal: AbortSignal.timeout(12_000),
    });
    const responseBody = (await response.text()).slice(0, 4_000);
    if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { responseCode: response.status, responseBody });
    return db.webhookDelivery.update({
      where: { id: delivery.id },
      data: { status: "DELIVERED", responseCode: response.status, responseBody, deliveredAt: new Date(), errorMessage: null },
    });
  } catch (error) {
    const attempts = delivery.attempts;
    const terminal = attempts >= delivery.maxAttempts;
    const retryDelay = Math.min(60 * 60_000, 30_000 * 2 ** Math.max(0, attempts - 1));
    return db.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "FAILED",
        responseCode: typeof error === "object" && error && "responseCode" in error ? Number(error.responseCode) : null,
        responseBody: typeof error === "object" && error && "responseBody" in error ? String(error.responseBody) : null,
        errorMessage: error instanceof Error ? error.message : "Webhook delivery failed",
        runAfter: terminal ? delivery.runAfter : new Date(Date.now() + retryDelay),
      },
    });
  }
}

export async function processWebhookBatch(limit = 20) {
  const deliveries = await db.webhookDelivery.findMany({
    where: { status: { in: ["PENDING", "FAILED"] }, runAfter: { lte: new Date() }, attempts: { lt: 5 } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: Math.min(Math.max(limit, 1), 50),
  });
  const results = await Promise.allSettled(deliveries.map((delivery) => deliverWebhook(delivery.id)));
  return { claimed: deliveries.length, completed: results.filter((result) => result.status === "fulfilled").length };
}
