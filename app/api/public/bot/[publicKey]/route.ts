import { NextRequest, NextResponse } from "next/server";
import { getSuggestedQuestions } from "@/lib/rag/suggested-questions";
import { isOriginAllowed } from "@/lib/bots/origin-policy";
import { isProductionVersionApproved } from "@/lib/bots/production-policy";
import { resolvePublicBotKey } from "@/lib/bots/public-key";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ publicKey: string }> }
) {
  const { publicKey } = await params;

  const resolved = await resolvePublicBotKey(publicKey);
  const bot = resolved?.bot;

  if (!bot || !bot.isActive || bot.publishedVersion < 1) {
    return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  }
  if (!resolved.environment && !(await isProductionVersionApproved(bot.id, bot.publishedVersion))) return NextResponse.json({ error: "This chatbot version is awaiting production approval." }, { status: 503 });
  if (!isOriginAllowed(bot.allowedOrigins, req.nextUrl.searchParams.get("origin"))) {
    return NextResponse.json({ error: "This chatbot is not approved for this website." }, { status: 403 });
  }

  // Language-aware starter questions: verified sets are kept per language;
  // an unsupported language falls back to the bot's default-locale set.
  const requestedLang = req.nextUrl.searchParams.get("lang");
  const language = requestedLang && bot.supportedLocales.includes(requestedLang)
    ? requestedLang
    : bot.defaultLocale;

  let suggestedQuestions: string[] = [];
  try {
    suggestedQuestions = await getSuggestedQuestions(bot.id, false, false, language);
  } catch (err) {
    console.error("Failed to load suggested questions:", err);
  }

  return NextResponse.json({
    bot: {
      name: bot.name,
      welcomeMessage: bot.welcomeMessage,
      isActive: bot.isActive,
      tone: bot.tone,
      suggestedQuestions,
      leadCaptureEnabled: bot.leadCaptureEnabled,
      leadCapturePrompt: bot.leadCapturePrompt,
      privacyNotice: bot.privacyNotice,
      aiDisclosure: "AI assistant",
      defaultLocale: bot.defaultLocale,
      supportedLocales: bot.supportedLocales,
      language,
    },
  });
}
