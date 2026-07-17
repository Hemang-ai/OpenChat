import { Metadata } from "next";
import EmbedChat from "@/components/chat/embed-chat";
import { getSuggestedQuestions } from "@/lib/rag/suggested-questions";
import { resolvePublicBotKey } from "@/lib/bots/public-key";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicKey: string }>;
}): Promise<Metadata> {
  const { publicKey } = await params;
  const bot = (await resolvePublicBotKey(publicKey))?.bot;
  return {
    title: bot ? `${bot.name} — Chat` : "Chat",
  };
}

export default async function EmbedPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicKey: string }>;
  searchParams: Promise<{ origin?: string }>;
}) {
  const { publicKey } = await params;
  const { origin } = await searchParams;

  const resolved = await resolvePublicBotKey(publicKey);
  const bot = resolved?.bot;

  if (!bot || !resolved || !bot.isActive || resolved.version < 1) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 text-sm">This chatbot is not available.</p>
        </div>
      </div>
    );
  }

  let suggestedQuestions = Array.isArray(bot.suggestedQuestions)
    ? (bot.suggestedQuestions as string[])
    : [];

  // Lazy-generate on first request if missing (e.g. bot created before this feature)
  if (suggestedQuestions.length === 0) {
    try {
      suggestedQuestions = await getSuggestedQuestions(bot.id, false, false);
    } catch (err) {
      console.warn("Failed to load suggested questions for embed:", err);
    }
  }

  return (
    <div className="h-screen bg-white">
      <EmbedChat
        publicKey={publicKey}
        botName={bot.name}
        welcomeMessage={bot.welcomeMessage}
        suggestedQuestions={suggestedQuestions}
        leadCaptureEnabled={bot.leadCaptureEnabled}
        leadCapturePrompt={bot.leadCapturePrompt}
        privacyNotice={bot.privacyNotice}
        initialOrigin={origin}
        defaultLocale={bot.defaultLocale}
        supportedLocales={bot.supportedLocales}
      />
    </div>
  );
}
