import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/jwt";
import { db } from "@/lib/db/client";

const createBotSchema = z.object({
  workspaceId: z.string().cuid(),
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  welcomeMessage: z.string().max(500).optional(),
  businessContext: z.string().max(2000).optional(),
  tone: z.enum(["professional", "friendly", "concise", "detailed"]).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const data = createBotSchema.parse(body);

    // Verify workspace ownership
    const workspace = await db.workspace.findFirst({
      where: { id: data.workspaceId, ownerId: session.userId },
    });
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const bot = await db.bot.create({
      data: {
        name: data.name,
        description: data.description,
        welcomeMessage: data.welcomeMessage || "Hello! How can I help you today?",
        businessContext: data.businessContext,
        tone: data.tone || "professional",
        workspaceId: data.workspaceId,
      },
    });

    return NextResponse.json({ bot }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create bot" }, { status: 500 });
  }
}
