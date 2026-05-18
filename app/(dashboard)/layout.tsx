import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/jwt";
import DashboardShell from "@/components/dashboard/shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  return <DashboardShell>{children}</DashboardShell>;
}
