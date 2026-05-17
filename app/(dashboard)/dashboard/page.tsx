import Link from "next/link";
import { getSession } from "@/lib/auth/jwt";
import { db } from "@/lib/db/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, LogOut, GitBranch, Sparkles } from "lucide-react";

/**
 * Phase 1 placeholder dashboard. The full multi-tenant admin UI
 * (bot CRUD, knowledge ingestion, RAG preview, embed code, analytics)
 * ships in subsequent commits.
 */
export default async function DashboardPage() {
  const session = await getSession();
  const user = session
    ? await db.user.findUnique({
        where: { id: session.userId },
        include: { workspaces: { select: { id: true, name: true } } },
      })
    : null;

  return (
    <div className="max-w-3xl mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-gray-900">OpenBusinessChat</span>
        </div>
        <Link href="/login">
          <Button variant="ghost" size="sm">
            <LogOut className="w-4 h-4 mr-1" /> Sign out
          </Button>
        </Link>
      </div>

      <Card className="border-2 border-dashed">
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">Phase 1 release</span>
          </div>
          <CardTitle className="text-2xl">Welcome{user?.name ? `, ${user.name}` : ""}!</CardTitle>
          <CardDescription>
            Your account and workspace ({user?.workspaces[0]?.name || "—"}) are ready.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600 leading-relaxed">
            This is the foundation release of <strong>OpenBusinessChat</strong> — the open-source
            platform for businesses to build AI chatbots trained on their own knowledge.
            The full admin dashboard, knowledge ingestion (PDF/DOCX/website/YouTube), RAG chat
            engine, and embeddable widget are coming in the next releases.
          </p>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="border rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Coming in Part 2</div>
              <div className="text-sm font-medium">Admin dashboard + AI provider settings</div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Coming in Part 3</div>
              <div className="text-sm font-medium">Knowledge ingestion pipeline</div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Coming in Part 4</div>
              <div className="text-sm font-medium">RAG chat + public embed widget</div>
            </div>
            <div className="border rounded-lg p-3 bg-green-50 border-green-200">
              <div className="text-xs text-green-700 mb-1">Available now</div>
              <div className="text-sm font-medium text-green-900">Auth, schema, design system</div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <a
              href="https://github.com/Hemang-ai/OpenChat"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1"
            >
              <Button variant="outline" className="w-full gap-2">
                <GitBranch className="w-4 h-4" /> Star on GitHub
              </Button>
            </a>
            <Link href="/" className="flex-1">
              <Button className="w-full">Back to landing</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
