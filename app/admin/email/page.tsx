/* eslint-disable @next/next/no-html-link-for-pages */
import { notFound } from "next/navigation";
import { AdminEmailComposer } from "@/app/components/admin-email-composer";
import { BrandWordmark } from "@/app/components/brand-wordmark";
import { chatGPTSignOutPath, requireChatGPTUser } from "@/app/chatgpt-auth";
import { getMailingListAdminData } from "@/lib/admin-email.server";
import { isWaitlistAdmin } from "@/lib/supabase-admin.server";

export const dynamic = "force-dynamic";

export default async function EmailAdminPage() {
  const user = await requireChatGPTUser("/admin/email");
  if (!(await isWaitlistAdmin(user.email))) notFound();

  const { recipients, suppressedCount, campaigns } =
    await getMailingListAdminData();

  return (
    <main className="admin-page admin-email-page">
      <div className="admin-shell admin-email-shell">
        <header className="admin-header">
          <div>
            <a className="wordmark" href="/" aria-label="Frame home">
              <BrandWordmark />
            </a>
            <p className="eyebrow">Owner view · Email studio</p>
            <h1>Email campaigns</h1>
            <p>Create a Frame update, check every detail, then choose exactly who receives it.</p>
          </div>
          <div className="admin-actions">
            <a href="/admin/waitlist">Waitlist</a>
            <a href="/admin/preorders">Pre-orders</a>
            <a className="text-link" href={chatGPTSignOutPath("/")}>Sign out</a>
          </div>
        </header>

        <AdminEmailComposer
          recipients={recipients}
          suppressedCount={suppressedCount}
          campaigns={campaigns}
        />
      </div>
    </main>
  );
}
