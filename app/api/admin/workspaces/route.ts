import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/jwt";
import { db } from "@/lib/db/client";
import { workspaceAccessWhere } from "@/lib/auth/workspace-access";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaces = await db.workspace.findMany({
    where: workspaceAccessWhere(session.userId),
    include: {
      bots: { select: { id: true, name: true, isActive: true, publicKey: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ workspaces });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await req.json();
  if (!name || typeof name !== "string" || name.trim().length < 2) {
    return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") +
    "-" + Math.random().toString(36).slice(2, 6);

  const workspace = await db.workspace.create({
    data: { name: name.trim(), slug, ownerId: session.userId },
  });

  return NextResponse.json({ workspace }, { status: 201 });
}
