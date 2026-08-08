import { notFound } from "next/navigation";
import { AdminAutomatedEmailPreviews } from "@/app/components/admin-automated-email-previews";
import { AdminDashboardShell } from "@/app/components/admin-dashboard-shell";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { getAutomatedEmailPreviews } from "@/lib/automated-email-previews.server";
import { isWaitlistAdmin } from "@/lib/supabase-admin.server";

export const dynamic = "force-dynamic";

export default async function AutomatedEmailsAdminPage() {
  const user = await requireChatGPTUser("/admin/automated-emails");
  if (!(await isWaitlistAdmin(user.email))) notFound();
  const previews = await getAutomatedEmailPreviews();

  return (
    <AdminDashboardShell
      activeSection="automated_emails"
      actions={<a className="button button--dark" href="/admin/email">Create campaign</a>}
      className="admin-automated-emails"
      description="Inspect every system-triggered email, verify its delivery setup, and send safe tests to yourself."
      title="Automated emails"
      userEmail={user.email}
    >
      <AdminAutomatedEmailPreviews previews={previews} ownerEmail={user.email} />
    </AdminDashboardShell>
  );
}
