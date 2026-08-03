/* eslint-disable @next/next/no-html-link-for-pages */
import { notFound } from "next/navigation";
import { BrandWordmark } from "@/app/components/brand-wordmark";
import { chatGPTSignOutPath, requireChatGPTUser } from "@/app/chatgpt-auth";
import { getSupabaseAdmin, isWaitlistAdmin } from "@/lib/supabase-admin.server";

export const dynamic = "force-dynamic";

type ContributorAdminRow = {
  id: string;
  contributor_number: number;
  full_name: string;
  preferred_name: string | null;
  email: string;
  membership_status: string;
  amount_paid_cents: number;
  currency: string;
  paid_at: string;
  access_expires_at: string;
  onboarding_completed_at: string | null;
  future_discount_eligible: boolean;
};

export default async function ContributorAdminPage() {
  const user = await requireChatGPTUser("/admin/contributors");
  if (!(await isWaitlistAdmin(user.email))) notFound();

  const supabase = await getSupabaseAdmin();
  const [members, questions, updates, votes, events, research] = await Promise.all([
    supabase.from("contributors").select("id,contributor_number,full_name,preferred_name,email,membership_status,amount_paid_cents,currency,paid_at,access_expires_at,onboarding_completed_at,future_discount_eligible").order("contributor_number", { ascending: false }).limit(500).returns<ContributorAdminRow[]>(),
    supabase.from("contributor_questions").select("id", { count: "exact", head: true }).is("answered_at", null),
    supabase.from("contributor_updates").select("id", { count: "exact", head: true }).eq("is_published", true),
    supabase.from("contributor_votes").select("id", { count: "exact", head: true }).eq("is_published", true),
    supabase.from("contributor_events").select("id", { count: "exact", head: true }).eq("is_published", true),
    supabase.from("contributor_research_opportunities").select("id", { count: "exact", head: true }).eq("is_published", true),
  ]);
  if (members.error) throw new Error("The contributor dashboard is temporarily unavailable.");
  const rows = members.data ?? [];
  const activeMembers = rows.filter((member) => member.membership_status === "active");
  const grossCents = rows.reduce((total, member) => total + member.amount_paid_cents, 0);

  return (
    <main className="admin-page">
      <div className="admin-shell admin-contributors">
        <header className="admin-header">
          <div>
            <a className="wordmark" href="/" aria-label="Frame home"><BrandWordmark /></a>
            <p className="eyebrow">Owner view</p><h1>Founding Contributors</h1>
            <p>Payments, access, onboarding, and member-content readiness.</p>
          </div>
          <div className="admin-actions"><a href="/admin/waitlist">Waitlist</a><a className="text-link" href={chatGPTSignOutPath("/")}>Sign out</a></div>
        </header>

        <section className="admin-metrics" aria-label="Contributor programme metrics">
          <article><span>Active members</span><strong>{activeMembers.length}</strong></article>
          <article><span>Gross payments</span><strong>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(grossCents / 100)}</strong></article>
          <article><span>Onboarded</span><strong>{rows.filter((member) => member.onboarding_completed_at).length}</strong></article>
          <article><span>Open questions</span><strong>{questions.count ?? 0}</strong></article>
        </section>
        <section className="admin-content-status">
          <p className="eyebrow">Published member content</p>
          <div><span>Updates <strong>{updates.count ?? 0}</strong></span><span>Votes <strong>{votes.count ?? 0}</strong></span><span>Events <strong>{events.count ?? 0}</strong></span><span>Research <strong>{research.count ?? 0}</strong></span></div>
          <p>Content records can be prepared in Supabase while this flow remains private. Only records marked published appear in the hub.</p>
        </section>

        {rows.length ? (
          <div className="admin-table-shell"><table className="admin-table"><thead><tr><th>Contributor</th><th>Status</th><th>Payment</th><th>Access ends</th><th>Onboarding</th><th>Discount</th></tr></thead><tbody>
            {rows.map((member) => <tr key={member.id}>
              <td className="admin-lead"><strong>#{String(member.contributor_number).padStart(4, "0")} · {member.preferred_name || member.full_name}</strong><a href={`mailto:${member.email}`}>{member.email}</a></td>
              <td><span className={`admin-status admin-status--${member.membership_status}`}>{member.membership_status}</span></td>
              <td>{new Intl.NumberFormat("en-US", { style: "currency", currency: member.currency.toUpperCase(), maximumFractionDigits: 0 }).format(member.amount_paid_cents / 100)}<br /><small>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(member.paid_at))}</small></td>
              <td>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(member.access_expires_at))}</td>
              <td>{member.onboarding_completed_at ? "Complete" : "Pending"}</td><td>{member.future_discount_eligible ? "Eligible" : "No"}</td>
            </tr>)}
          </tbody></table></div>
        ) : <div className="admin-empty"><h2>No contributors yet.</h2><p>Completed test purchases will appear here after Stripe and Supabase are configured.</p></div>}
      </div>
    </main>
  );
}
