import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import FlowAnimation from "@/components/marketing/flow-animation";
import DashboardMockup from "@/components/marketing/dashboard-mockup";
import {
  Bot, Upload, Globe, Play, Code, MessageSquare,
  Shield, Zap, GitBranch, Check, ChevronRight, Star
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-lg">OpenBusinessChat</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <Link href="#features" className="hover:text-gray-900 transition-colors">Features</Link>
            <Link href="#how-it-works" className="hover:text-gray-900 transition-colors">How it works</Link>
            <Link href="#open-source" className="hover:text-gray-900 transition-colors">Open source</Link>
            <a
              href="https://github.com/Hemang-ai/OpenChat"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-gray-900 transition-colors"
            >
              <GitBranch className="w-4 h-4" /> GitHub
            </a>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm">Log in</Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Get started free</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 text-center">
        <div className="max-w-4xl mx-auto">
          <Badge variant="secondary" className="mb-4 text-xs font-medium">
            <Star className="w-3 h-3 mr-1" /> Open Source · MIT License
          </Badge>
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight mb-6">
            Your Business Knowledge,{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              Powered by AI
            </span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
            Create a custom AI chatbot trained on your business documents, website, and knowledge.
            Embed it on any website in minutes. No hallucinations — answers only from your data.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register">
              <Button size="lg" className="gap-2 text-base px-8">
                Create your chatbot <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
            <a
              href="https://github.com/Hemang-ai/OpenChat"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="lg" variant="outline" className="gap-2 text-base">
                <GitBranch className="w-4 h-4" /> View on GitHub
              </Button>
            </a>
          </div>
          <p className="text-sm text-gray-500 mt-4">Free forever · Self-hostable · No vendor lock-in</p>
        </div>
      </section>

      {/* Animated dashboard mockup */}
      <section className="pb-20 px-4">
        <div className="max-w-5xl mx-auto">
          <DashboardMockup />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Everything you need</h2>
            <p className="text-gray-600 max-w-xl mx-auto">Build a production-ready AI chatbot for your business without writing a single line of AI code.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <Card key={f.title} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center mb-4">
                    <f.icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{f.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">How it works — end to end</h2>
            <p className="text-gray-600">Watch knowledge become a live chatbot in real time.</p>
          </div>

          {/* Animated end-to-end flow */}
          <div className="mb-16">
            <FlowAnimation />
          </div>

          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Get started in 4 steps</h3>
            <p className="text-gray-600">From signup to embedded chatbot in under 10 minutes.</p>
          </div>
          <div className="space-y-8">
            {steps.map((step, i) => (
              <div key={i} className="flex gap-6 items-start">
                <div className="w-10 h-10 bg-gray-900 text-white rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 pt-1">
                  <h3 className="font-semibold text-gray-900 mb-1">{step.title}</h3>
                  <p className="text-gray-600 text-sm">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open Source */}
      <section id="open-source" className="py-20 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="secondary" className="mb-3 text-xs font-medium">
              <GitBranch className="w-3 h-3 mr-1" /> 100% Open Source
            </Badge>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Free forever. Yours forever.</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              No paywall. No usage limits. No vendor lock-in. Self-host on your own infrastructure,
              fork it, modify it, ship it. MIT licensed.
            </p>
          </div>
          <Card className="border-2 border-gray-200 max-w-2xl mx-auto">
            <CardContent className="p-8">
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 mb-8">
                {[
                  "Unlimited chatbots",
                  "Unlimited knowledge sources",
                  "Full source code access",
                  "No usage limits, ever",
                  "Bring your own AI keys",
                  "Self-host anywhere",
                  "MIT License",
                  "Community-driven",
                ].map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="w-4 h-4 text-green-500 shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="https://github.com/Hemang-ai/OpenChat"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Button className="w-full gap-2" variant="outline">
                    <GitBranch className="w-4 h-4" /> View on GitHub
                  </Button>
                </a>
                <Link href="/register" className="flex-1">
                  <Button className="w-full gap-2">
                    Get started free <ChevronRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-gray-900 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-4">Ready to build your AI chatbot?</h2>
          <p className="text-gray-400 mb-8">Open source, self-hostable, and production-ready. Start in minutes.</p>
          <Link href="/register">
            <Button size="lg" className="bg-white text-gray-900 hover:bg-gray-100 gap-2">
              Create free account <ChevronRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t text-center text-sm text-gray-500">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4" />
            <span>OpenBusinessChat — MIT License</span>
          </div>
          <div className="flex gap-6">
            <a href="https://github.com/Hemang-ai/OpenChat" target="_blank" rel="noopener noreferrer" className="hover:text-gray-900">GitHub</a>
            <Link href="/login" className="hover:text-gray-900">Login</Link>
            <Link href="/register" className="hover:text-gray-900">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

const features = [
  { icon: Upload, title: "Multi-source Knowledge", description: "Upload PDFs, Word docs, TXT, CSV, Markdown files or add website URLs and YouTube transcripts." },
  { icon: Bot, title: "RAG-powered Chat", description: "Answers only from your business knowledge. Never hallucinates or uses outside information." },
  { icon: Globe, title: "Website Crawling", description: "Extract content from any public webpage and use it as knowledge for your chatbot." },
  { icon: Play, title: "YouTube Transcripts", description: "Add YouTube videos and automatically extract their transcripts as knowledge." },
  { icon: Code, title: "Easy Embedding", description: "Copy a single iframe tag or script snippet and paste it on any website in seconds." },
  { icon: MessageSquare, title: "Conversation Logs", description: "See every conversation, identify knowledge gaps, and improve your chatbot over time." },
  { icon: Shield, title: "Secure & Multi-tenant", description: "Full workspace isolation. Each business's data is completely separated and secure." },
  { icon: Zap, title: "LLM Agnostic", description: "Works with OpenAI, Anthropic, Groq, and local Ollama models. Switch providers anytime." },
  { icon: GitBranch, title: "Open Source", description: "Full MIT License. Self-host for free, audit the code, and contribute on GitHub." },
];

const steps = [
  { title: "Create an account & workspace", description: "Sign up and create a workspace for your business in under 30 seconds." },
  { title: "Create your chatbot", description: "Give it a name, set the tone, add a welcome message, and describe your business." },
  { title: "Upload your knowledge", description: "Add PDFs, Word docs, website URLs, YouTube videos, or type knowledge manually." },
  { title: "Embed on your website", description: "Copy the iframe or script snippet and paste it into any website. Done." },
];
