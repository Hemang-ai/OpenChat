"use client";
import { useEffect, useState } from "react";
import { MessageSquare, Users, ThumbsDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Analytics {
  totalConversations: number;
  totalMessages: number;
  refusedMessages: number;
  topQuestions: string[];
}

export default function AnalyticsTab({ botId }: { botId: string }) {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/bots/${botId}/analytics`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [botId]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="h-8 bg-gray-100 rounded animate-pulse mb-2" />
              <div className="h-4 bg-gray-100 rounded animate-pulse w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) return <p className="text-gray-500 text-sm">Failed to load analytics.</p>;

  const groundRate = data.totalMessages > 0
    ? Math.round(((data.totalMessages - data.refusedMessages) / data.totalMessages) * 100)
    : 0;

  const stats = [
    { label: "Conversations", value: data.totalConversations, icon: Users, color: "text-blue-600" },
    { label: "Total messages", value: data.totalMessages, icon: MessageSquare, color: "text-green-600" },
    { label: "Refused answers", value: data.refusedMessages, icon: ThumbsDown, color: "text-orange-500" },
    { label: "Grounded rate", value: `${groundRate}%`, icon: TrendingUp, color: "text-purple-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-6">
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="flex items-center gap-1.5 mt-1">
                <stat.icon className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-sm text-gray-500">{stat.label}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {data.topQuestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent user questions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.topQuestions.slice(0, 10).map((q, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-gray-300 font-mono text-xs mt-0.5 w-5 shrink-0">{i + 1}.</span>
                  <span className="text-gray-700">{q}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
