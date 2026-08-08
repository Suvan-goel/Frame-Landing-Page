/* eslint-disable @next/next/no-html-link-for-pages */
import { notFound } from "next/navigation";
import { AdminDashboardShell } from "@/app/components/admin-dashboard-shell";
import { AdminEmailComposer } from "@/app/components/admin-email-composer";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { getMailingListAdminData } from "@/lib/admin-email.server";
import { isWaitlistAdmin } from "@/lib/supabase-admin.server";

export const dynamic = "force-dynamic";

export default async function EmailAdminPage() {
  const user = await requireChatGPTUser("/admin/email");
  if (!(await isWaitlistAdmin(user.email))) notFound();

  const { recipients, suppressedCount, campaigns } =
    await getMailingListAdminData();

  return (
    <AdminDashboardShell
      activeSection="email"
      className="admin-email-shell admin-email-page"
      description="Compose thoughtful updates, preview every message, and choose exactly who should receive it."
      title="Email"
      userEmail={user.email}
    >
      <AdminEmailComposer
        recipients={recipients}
        suppressedCount={suppressedCount}
        campaigns={campaigns}
      />
    </AdminDashboardShell>
  );
}
