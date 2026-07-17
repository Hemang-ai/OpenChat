import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/jwt";
import { db } from "@/lib/db/client";
import { canAccessBot } from "@/lib/auth/workspace-access";

const leadStatuses = ["NEW", "CONTACTED", "QUALIFIED", "DISMISSED"] as const;
type LeadStatus = (typeof leadStatuses)[number];

const updateLeadSchema = z.object({
  leadId: z.string().cuid(),
  status: z.enum(leadStatuses),
});

function isLeadStatus(value: string | null): value is LeadStatus {
  return leadStatuses.includes(value as LeadStatus);
}

async function getOwnedBot(botId: string, userId: string) {
  return canAccessBot(botId, userId, "conversation:write");
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { botId } = await params;
  const bot = await getOwnedBot(botId, session.userId);
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });

  const url = new URL(req.url);
  const requestedPage = parseInt(url.searchParams.get("page") || "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const status = isLeadStatus(url.searchParams.get("status"))
    ? (url.searchParams.get("status") as LeadStatus)
    : undefined;
  const pageSize = 20;
  const skip = (page - 1) * pageSize;
  const where = status ? { botId, status } : { botId };

  const [total, leads, ...statusCounts] = await Promise.all([
    db.lead.count({ where }),
    db.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        conversation: {
          select: {
            sessionId: true,
            createdAt: true,
            messages: {
              where: { role: "USER" },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { content: true, createdAt: true },
            },
          },
        },
      },
    }),
    ...leadStatuses.map((leadStatus) =>
      db.lead.count({ where: { botId, status: leadStatus } })
    ),
  ]);

  const countsByStatus = leadStatuses.reduce<Record<LeadStatus, number>>((acc, leadStatus, index) => {
    acc[leadStatus] = statusCounts[index] || 0;
    return acc;
  }, {
    NEW: 0,
    CONTACTED: 0,
    QUALIFIED: 0,
    DISMISSED: 0,
  });

  return NextResponse.json({
    leads,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    countsByStatus,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { botId } = await params;
  const bot = await getOwnedBot(botId, session.userId);
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });

  try {
    const body = await req.json();
    const data = updateLeadSchema.parse(body);

    const lead = await db.lead.findFirst({
      where: { id: data.leadId, botId },
      select: { id: true },
    });
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    const updated = await db.lead.update({
      where: { id: lead.id },
      data: { status: data.status },
    });

    return NextResponse.json({ lead: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Lead update failed" }, { status: 500 });
  }
}
