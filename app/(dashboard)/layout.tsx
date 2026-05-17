import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/jwt";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  return <div className="min-h-screen bg-gray-50">{children}</div>;
}
