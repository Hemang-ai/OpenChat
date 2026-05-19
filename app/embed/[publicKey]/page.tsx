import { Metadata } from "next";
import { db } from "@/lib/db/client";
import EmbedChat from "@/components/chat/embed-chat";
import { getSuggestedQuestions } from "@/lib/rag/suggested-questions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicKey: string }>;
}): Promise<Metadata> {
  const { publicKey } = await params;
  const bot = await db.bot.findUnique({
    where: { publicKey },
    select: { name: true },
  });
  return {
    title: bot ? `${bot.name} — Chat` : "Chat",
  };
}

export default async function EmbedPage({
  params,
}: {
  params: Promise<{ publicKey: string }>;
}) {
  const { publicKey } = await params;

  const bot = await db.bot.findUnique({
    where: { publicKey },
    select: { id: true, name: true, welcomeMessage: true, isActive: true, suggestedQuestions: true },
  });

  if (!bot || !bot.isActive) {
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
      suggestedQuestions = await getSuggestedQuestions(bot.id);
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
      />
    </div>
  );
}
