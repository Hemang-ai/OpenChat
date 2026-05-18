import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/jwt";
import { db } from "@/lib/db/client";

const settingsSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  llmProvider: z.enum(["openai", "anthropic", "groq", "ollama", "gemini"]).optional().nullable(),
  fallbackLlmProvider: z.enum(["openai", "anthropic", "groq", "ollama", "gemini", "none"]).optional().nullable(),
  openaiApiKey: z.string().optional().nullable(),
  openaiModel: z.string().optional().nullable(),
  openaiEmbeddingModel: z.string().optional().nullable(),
  anthropicApiKey: z.string().optional().nullable(),
  anthropicModel: z.string().optional().nullable(),
  groqApiKey: z.string().optional().nullable(),
  groqModel: z.string().optional().nullable(),
  ollamaBaseUrl: z.string().optional().nullable(),
  ollamaModel: z.string().optional().nullable(),
  geminiApiKey: z.string().optional().nullable(),
  geminiModel: z.string().optional().nullable(),
});

function maskKey(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key.length < 10) return "•••";
  return key.slice(0, 4) + "•••••••••" + key.slice(-4);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workspaceId } = await params;
  const workspace = await db.workspace.findFirst({
    where: { id: workspaceId, ownerId: session.userId },
  });
  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Return masked keys so the form can show "saved" state without exposing secrets
  return NextResponse.json({
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description,
      llmProvider: workspace.llmProvider || "openai",
      fallbackLlmProvider: workspace.fallbackLlmProvider || "none",
      openaiApiKeyMasked: maskKey(workspace.openaiApiKey),
      openaiApiKeySet: !!workspace.openaiApiKey,
      openaiModel: workspace.openaiModel,
      openaiEmbeddingModel: workspace.openaiEmbeddingModel,
      anthropicApiKeyMasked: maskKey(workspace.anthropicApiKey),
      anthropicApiKeySet: !!workspace.anthropicApiKey,
      anthropicModel: workspace.anthropicModel,
      groqApiKeyMasked: maskKey(workspace.groqApiKey),
      groqApiKeySet: !!workspace.groqApiKey,
      groqModel: workspace.groqModel,
      ollamaBaseUrl: workspace.ollamaBaseUrl,
      ollamaModel: workspace.ollamaModel,
      geminiApiKeyMasked: maskKey(workspace.geminiApiKey),
      geminiApiKeySet: !!workspace.geminiApiKey,
      geminiModel: workspace.geminiModel,
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workspaceId } = await params;
  const workspace = await db.workspace.findFirst({
    where: { id: workspaceId, ownerId: session.userId },
  });
  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await req.json();
    const data = settingsSchema.parse(body);

    // Treat empty strings as "no change" so users don't blank a key by accident.
    const updateData: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      if (typeof v === "string" && v.trim() === "") continue;
      // Allow user to clear fallbackLlmProvider via sentinel "none"
      if (k === "fallbackLlmProvider" && v === "none") {
        updateData[k] = null;
        continue;
      }
      updateData[k] = v;
    }

    const updated = await db.workspace.update({
      where: { id: workspaceId },
      data: updateData,
    });

    return NextResponse.json({ success: true, workspaceId: updated.id });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || "Invalid input" }, { status: 400 });
    }
    console.error("Workspace update error:", err);
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
