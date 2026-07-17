import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/jwt";
import { db } from "@/lib/db/client";
import { canAccessBot } from "@/lib/auth/workspace-access";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId } = await params;
  if (!await canAccessBot(botId, session.userId, "conversation:read")) return NextResponse.json({ error: "Bot not found" }, { status: 404 });

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = 20;
  const skip = (page - 1) * pageSize;

  const status = url.searchParams.get("status");
  const validStatuses = ["AI_ACTIVE", "HANDOFF_REQUESTED", "HUMAN_ACTIVE", "RESOLVED"] as const;
  const workflowStatus = validStatuses.includes(status as typeof validStatuses[number]) ? status as typeof validStatuses[number] : undefined;
  const where = workflowStatus ? { botId, status: workflowStatus } : { botId };

  const [total, conversations] = await Promise.all([
    db.conversation.count({ where }),
    db.conversation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          select: { id: true, role: true, content: true, isGrounded: true, isRefused: true, createdAt: true },
        },
        notes: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true, email: true } } } },
        leads: { orderBy: { createdAt: "desc" }, take: 1, select: { name: true, email: true, phone: true, company: true } },
        toolExecutions: { orderBy: { createdAt: "desc" }, take: 5, select: { id: true, status: true, errorMessage: true, tool: { select: { name: true } } } },
      },
    }),
  ]);

  return NextResponse.json({
    conversations,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}
