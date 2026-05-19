import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/jwt";
import { db } from "@/lib/db/client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId } = await params;

  const bot = await db.bot.findFirst({
    where: { id: botId, workspace: { ownerId: session.userId } },
  });
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = 20;
  const skip = (page - 1) * pageSize;

  const [total, conversations] = await Promise.all([
    db.conversation.count({ where: { botId } }),
    db.conversation.findMany({
      where: { botId },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          select: { id: true, role: true, content: true, isGrounded: true, isRefused: true, createdAt: true },
        },
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
