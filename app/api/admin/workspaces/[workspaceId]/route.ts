import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/jwt";
import { db } from "@/lib/db/client";
import { encryptSecret, maskSecret, resolveWorkspaceSecret } from "@/lib/security/secrets";
import { writeAuditEvent } from "@/lib/security/audit";
import { getWorkspaceAccess, hasWorkspacePermission } from "@/lib/auth/workspace-access";

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

const secretFieldMap = {
  openaiApiKey: "openaiApiKeyEncrypted",
  anthropicApiKey: "anthropicApiKeyEncrypted",
  groqApiKey: "groqApiKeyEncrypted",
  geminiApiKey: "geminiApiKeyEncrypted",
} as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workspaceId } = await params;
  const access = await getWorkspaceAccess(workspaceId, session.userId);
  if (!access || !hasWorkspacePermission(access.role, "workspace:manage")) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const workspace = await db.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const openaiApiKey = resolveWorkspaceSecret(workspace.openaiApiKeyEncrypted, workspace.openaiApiKey);
  const anthropicApiKey = resolveWorkspaceSecret(workspace.anthropicApiKeyEncrypted, workspace.anthropicApiKey);
  const groqApiKey = resolveWorkspaceSecret(workspace.groqApiKeyEncrypted, workspace.groqApiKey);
  const geminiApiKey = resolveWorkspaceSecret(workspace.geminiApiKeyEncrypted, workspace.geminiApiKey);

  // Return masked keys so the form can show "saved" state without exposing secrets
  return NextResponse.json({
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description,
      llmProvider: workspace.llmProvider || "openai",
      fallbackLlmProvider: workspace.fallbackLlmProvider || "none",
      openaiApiKeyMasked: maskSecret(openaiApiKey),
      openaiApiKeySet: !!openaiApiKey,
      openaiModel: workspace.openaiModel,
      openaiEmbeddingModel: workspace.openaiEmbeddingModel,
      anthropicApiKeyMasked: maskSecret(anthropicApiKey),
      anthropicApiKeySet: !!anthropicApiKey,
      anthropicModel: workspace.anthropicModel,
      groqApiKeyMasked: maskSecret(groqApiKey),
      groqApiKeySet: !!groqApiKey,
      groqModel: workspace.groqModel,
      ollamaBaseUrl: workspace.ollamaBaseUrl,
      ollamaModel: workspace.ollamaModel,
      geminiApiKeyMasked: maskSecret(geminiApiKey),
      geminiApiKeySet: !!geminiApiKey,
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
  const access = await getWorkspaceAccess(workspaceId, session.userId);
  if (!access || !hasWorkspacePermission(access.role, "workspace:manage")) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const workspace = await db.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await req.json();
    const data = settingsSchema.parse(body);
    const policy = (workspace.policy || {}) as { allowedProviders?: string[]; allowedModels?: string[] };
    if (data.llmProvider && policy.allowedProviders?.length && !policy.allowedProviders.includes(data.llmProvider)) return NextResponse.json({ error: `${data.llmProvider} is not allowed by workspace policy.` }, { status: 403 });
    const selectedModels = [data.openaiModel, data.anthropicModel, data.groqModel, data.geminiModel, data.ollamaModel].filter((value): value is string => Boolean(value));
    if (policy.allowedModels?.length && selectedModels.some((model) => !policy.allowedModels!.includes(model))) return NextResponse.json({ error: "One or more selected models are not allowed by workspace policy." }, { status: 403 });

    // Treat empty strings as "no change" so users don't blank a key by accident.
    const updateData: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      if (typeof v === "string" && v.trim() === "") continue;
      if (k in secretFieldMap) {
        const encryptedField = secretFieldMap[k as keyof typeof secretFieldMap];
        updateData[encryptedField] = v === null ? null : encryptSecret(v as string);
        // Clear the legacy plaintext column after a successful encrypted update.
        updateData[k] = null;
        continue;
      }
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

    await writeAuditEvent({
      type: "workspace.settings.updated",
      actorId: session.userId,
      workspaceId: updated.id,
      targetType: "workspace",
      targetId: updated.id,
      metadata: { updatedFields: Object.keys(updateData).filter((key) => !key.toLowerCase().includes("apikey")) },
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
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
