"use client";
import { useState } from "react";
import { Copy, Check, Code, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/utils/use-toast";

interface Props {
  bot: { id: string; name: string; publicKey: string };
}

export default function EmbedTab({ bot }: Props) {
  const [copiedIframe, setCopiedIframe] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const iframeCode = `<iframe
  src="${appUrl}/embed/${bot.publicKey}"
  width="400"
  height="600"
  frameborder="0"
  allow="clipboard-write"
  title="${bot.name} Chat"
></iframe>`;

  const scriptCode = `<script
  src="${appUrl}/widget.js"
  data-bot-id="${bot.publicKey}"
  data-position="bottom-right"
  async
></script>`;

  const copy = async (text: string, which: "iframe" | "script") => {
    await navigator.clipboard.writeText(text);
    if (which === "iframe") {
      setCopiedIframe(true);
      setTimeout(() => setCopiedIframe(false), 2000);
    } else {
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2000);
    }
    toast({ title: "Copied to clipboard!" });
  };

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 text-sm text-amber-700">
        Your bot&apos;s public key: <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-xs">{bot.publicKey}</code>
        — This is safe to share publicly. It does not expose your account or workspace.
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* iframe */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-gray-500" />
              <CardTitle className="text-base">iframe embed</CardTitle>
            </div>
            <CardDescription>
              Embed the chatbot as an inline iframe on any page. Best for embedding in a specific section of your website.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <pre className="bg-gray-950 text-gray-100 text-xs p-4 rounded-lg overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap break-all">
                {iframeCode}
              </pre>
              <Button
                size="sm"
                variant="ghost"
                className="absolute top-2 right-2 text-gray-400 hover:text-white hover:bg-gray-800"
                onClick={() => copy(iframeCode, "iframe")}
              >
                {copiedIframe ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
            <Button className="w-full mt-3" variant="outline" onClick={() => copy(iframeCode, "iframe")}>
              {copiedIframe ? "Copied!" : "Copy iframe code"}
            </Button>
          </CardContent>
        </Card>

        {/* Script widget */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Code className="w-5 h-5 text-gray-500" />
              <CardTitle className="text-base">Script widget</CardTitle>
              <Badge variant="secondary" className="text-xs">Recommended</Badge>
            </div>
            <CardDescription>
              A floating chat bubble widget. Add the script tag before &lt;/body&gt; on any page. Works on any website.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <pre className="bg-gray-950 text-gray-100 text-xs p-4 rounded-lg overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap break-all">
                {scriptCode}
              </pre>
              <Button
                size="sm"
                variant="ghost"
                className="absolute top-2 right-2 text-gray-400 hover:text-white hover:bg-gray-800"
                onClick={() => copy(scriptCode, "script")}
              >
                {copiedScript ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
            <Button className="w-full mt-3" variant="outline" onClick={() => copy(scriptCode, "script")}>
              {copiedScript ? "Copied!" : "Copy script code"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Test the embed</CardTitle>
          <CardDescription>Preview how your chatbot looks when embedded</CardDescription>
        </CardHeader>
        <CardContent>
          <a href={`/embed/${bot.publicKey}`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="gap-2">
              <Globe className="w-4 h-4" /> Open embed page
            </Button>
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
