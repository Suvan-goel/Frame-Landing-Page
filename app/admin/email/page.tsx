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

  const {
    recipients,
    unsubscribedCount,
    deliverySuppressedCount,
    campaigns,
    draft,
    capacityExceeded,
    readiness,
  } = await getMailingListAdminData(user.email);

  return (
    <AdminDashboardShell
      activeSection="email"
      className="admin-email-shell admin-email-page"
      description="Write the update, choose the audience, then complete a final safety review."
      title="Campaigns"
      userEmail={user.email}
    >
      <AdminEmailComposer
        recipients={recipients}
        unsubscribedCount={unsubscribedCount}
        deliverySuppressedCount={deliverySuppressedCount}
        campaigns={campaigns}
        initialDraft={draft}
        capacityExceeded={capacityExceeded}
        readiness={readiness}
        ownerEmail={user.email}
      />
    </AdminDashboardShell>
  );
}
