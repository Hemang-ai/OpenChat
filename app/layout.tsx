import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "OpenBusinessChat – AI Chatbot Platform for Businesses",
  description:
    "Create and embed an AI chatbot trained on your business knowledge. Open-source, self-hostable, and production-ready.",
  openGraph: {
    title: "OpenBusinessChat",
    description: "AI chatbot platform trained on your business knowledge.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body className="min-h-screen bg-background antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
