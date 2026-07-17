import { redirect } from "next/navigation";
import { getPlatformActor } from "@/lib/auth/platform-admin";
import AdminOverview from "@/components/platform-admin/admin-overview";

export default async function PlatformAdminPage() {
  const actor = await getPlatformActor();
  if (!actor) redirect("/login?redirect=/admin");
  if (actor.mustChangePassword) redirect("/admin/change-password");
  return <AdminOverview />;
}
