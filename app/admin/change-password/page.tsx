"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function PlatformPasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true); setError(null);
    const response = await fetch("/api/platform-admin/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword }) });
    const body = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) { setError(body.error || "Could not change password"); return; }
    router.replace("/admin");
  }

  return <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4"><Card className="w-full max-w-md"><CardHeader><div className="mb-2 w-fit rounded-md bg-gray-100 p-2"><KeyRound className="h-5 w-5" /></div><CardTitle>Set a new administrator password</CardTitle><CardDescription>Your bootstrap password can only be used once. Choose a unique password with at least 15 characters.</CardDescription></CardHeader><CardContent><form className="space-y-4" onSubmit={submit}><div className="space-y-1"><Label htmlFor="current">Current password</Label><Input id="current" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></div><div className="space-y-1"><Label htmlFor="next">New password</Label><Input id="next" type="password" autoComplete="new-password" minLength={15} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /><p className="text-xs text-gray-500">Use a password manager to generate and save it.</p></div>{error && <p className="text-sm text-red-600" role="alert">{error}</p>}<Button className="w-full" disabled={saving}>{saving ? "Saving..." : "Save and continue"}</Button></form></CardContent></Card></main>;
}
