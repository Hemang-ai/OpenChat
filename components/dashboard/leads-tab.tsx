"use client";
import { useEffect, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Clock,
  Inbox,
  Mail,
  MessageSquare,
  Phone,
  Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/lib/utils/use-toast";

type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "DISMISSED";
type StatusFilter = LeadStatus | "all";

interface Lead {
  id: string;
  name?: string | null;
  email: string;
  phone?: string | null;
  company?: string | null;
  message?: string | null;
  status: LeadStatus;
  createdAt: string;
  conversation?: {
    sessionId: string;
    createdAt: string;
    messages: { content: string; createdAt: string }[];
  } | null;
}

interface LeadsResponse {
  leads: Lead[];
  total: number;
  page: number;
  totalPages: number;
  countsByStatus: Record<LeadStatus, number>;
}

const statusLabels: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  DISMISSED: "Dismissed",
};

const statusBadgeClass: Record<LeadStatus, string> = {
  NEW: "bg-blue-100 text-blue-800",
  CONTACTED: "bg-gray-100 text-gray-700",
  QUALIFIED: "bg-green-100 text-green-800",
  DISMISSED: "bg-red-100 text-red-700",
};

const filterOptions: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All leads" },
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "DISMISSED", label: "Dismissed" },
];

export default function LeadsTab({ botId }: { botId: string }) {
  const [data, setData] = useState<LeadsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ page: page.toString() });
    if (statusFilter !== "all") params.set("status", statusFilter);

    fetch(`/api/admin/bots/${botId}/leads?${params.toString()}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load leads");
        return json as LeadsResponse;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) {
          toast({
            title: "Could not load leads",
            description: err instanceof Error ? err.message : "Please try again.",
            variant: "destructive",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [botId, page, statusFilter]);

  const updateStatus = async (leadId: string, status: LeadStatus) => {
    setUpdatingLeadId(leadId);
    try {
      const res = await fetch(`/api/admin/bots/${botId}/leads`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not update lead");
      setData((prev) => {
        if (!prev) return prev;

        const currentLead = prev.leads.find((lead) => lead.id === leadId);
        const previousStatus = currentLead?.status;
        const countsByStatus = { ...prev.countsByStatus };

        if (previousStatus && previousStatus !== status) {
          countsByStatus[previousStatus] = Math.max(countsByStatus[previousStatus] - 1, 0);
          countsByStatus[status] = countsByStatus[status] + 1;
        }

        const leads = prev.leads
          .map((lead) => (lead.id === leadId ? { ...lead, status } : lead))
          .filter((lead) => statusFilter === "all" || lead.status === statusFilter);
        const total = statusFilter === "all" || previousStatus === status ? prev.total : Math.max(prev.total - 1, 0);

        return { ...prev, leads, countsByStatus, total };
      });
      toast({ title: "Lead updated" });
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdatingLeadId(null);
    }
  };

  const counts = data?.countsByStatus || {
    NEW: 0,
    CONTACTED: 0,
    QUALIFIED: 0,
    DISMISSED: 0,
  };
  const totalLeads = Object.values(counts).reduce((sum, count) => sum + count, 0);

  const stats = [
    { label: "Total leads", value: totalLeads, icon: Inbox, color: "text-blue-600" },
    { label: "New", value: counts.NEW, icon: Clock, color: "text-orange-500" },
    { label: "Contacted", value: counts.CONTACTED, icon: CheckCircle2, color: "text-gray-600" },
    { label: "Qualified", value: counts.QUALIFIED, icon: Target, color: "text-green-600" },
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

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Lead inbox</h2>
          <p className="text-sm text-gray-500">{data?.total || 0} leads in this view</p>
        </div>
        <select
          value={statusFilter}
          onChange={(event) => {
            setLoading(true);
            setPage(1);
            setStatusFilter(event.target.value as StatusFilter);
          }}
          className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm"
        >
          {filterOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="h-28 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !data || data.leads.length === 0 ? (
        <div className="text-center py-16">
          <Inbox className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No leads yet</p>
          <p className="text-gray-400 text-xs mt-1">Captured contact requests will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.leads.map((lead) => {
            const lastQuestion = lead.conversation?.messages[0]?.content;

            return (
              <div key={lead.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {lead.name || lead.email}
                      </h3>
                      <Badge className={statusBadgeClass[lead.status]}>
                        {statusLabels[lead.status]}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(lead.createdAt).toLocaleString()}
                    </p>

                    <div className="grid sm:grid-cols-2 gap-2 mt-3 text-sm text-gray-600">
                      <a href={`mailto:${lead.email}`} className="flex items-center gap-2 min-w-0 hover:text-gray-900">
                        <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className="truncate">{lead.email}</span>
                      </a>
                      {lead.phone && (
                        <a href={`tel:${lead.phone}`} className="flex items-center gap-2 min-w-0 hover:text-gray-900">
                          <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                          <span className="truncate">{lead.phone}</span>
                        </a>
                      )}
                      {lead.company && (
                        <div className="flex items-center gap-2 min-w-0">
                          <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                          <span className="truncate">{lead.company}</span>
                        </div>
                      )}
                      {lastQuestion && (
                        <div className="flex items-center gap-2 min-w-0">
                          <MessageSquare className="w-4 h-4 text-gray-400 shrink-0" />
                          <span className="truncate">{lastQuestion}</span>
                        </div>
                      )}
                    </div>

                    {lead.message && (
                      <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                        {lead.message}
                      </p>
                    )}
                  </div>

                  <div className="w-full lg:w-44">
                    <label className="text-xs font-medium text-gray-500">Status</label>
                    <select
                      value={lead.status}
                      disabled={updatingLeadId === lead.id}
                      onChange={(event) => updateStatus(lead.id, event.target.value as LeadStatus)}
                      className="mt-1 h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm disabled:opacity-60"
                    >
                      {filterOptions.slice(1).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => {
              setLoading(true);
              setPage((value) => value - 1);
            }}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-500">Page {page} of {data.totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.totalPages}
            onClick={() => {
              setLoading(true);
              setPage((value) => value + 1);
            }}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
