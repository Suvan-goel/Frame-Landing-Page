/* eslint-disable @next/next/no-html-link-for-pages */
import { notFound } from "next/navigation";
import { AdminDashboardShell } from "@/app/components/admin-dashboard-shell";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { getSupabaseAdmin, isWaitlistAdmin } from "@/lib/supabase-admin.server";

export const dynamic = "force-dynamic";

type ContributorAdminRow = {
  id: string;
  contributor_number: number;
  full_name: string;
  preferred_name: string | null;
  email: string;
  membership_status: string;
  paid_at: string;
  access_expires_at: string;
  onboarding_completed_at: string | null;
  future_discount_eligible: boolean;
};

type ContributorPaymentAdminRow = {
  contributor_id: string;
  amount_total: number;
  currency: string;
  paid_at: string | null;
};

export default async function ContributorAdminPage() {
  const user = await requireChatGPTUser("/admin/contributors");
  if (!(await isWaitlistAdmin(user.email))) notFound();

  const supabase = await getSupabaseAdmin();
  const members = await supabase
    .from("contributors")
    .select("id,contributor_number,full_name,preferred_name,email,membership_status,paid_at,access_expires_at,onboarding_completed_at,future_discount_eligible")
    .order("contributor_number", { ascending: false })
    .limit(500)
    .returns<ContributorAdminRow[]>();
  if (members.error) throw new Error("The contributor dashboard is temporarily unavailable.");

  const rows = members.data ?? [];
  const contributorIds = rows.map((member) => member.id);
  const paymentQuery = contributorIds.length
    ? supabase
        .from("contributor_payments")
        .select("contributor_id,amount_total,currency,paid_at")
        .in("contributor_id", contributorIds)
        .not("payment_status", "like", "duplicate_%")
        .order("paid_at", { ascending: true })
        .returns<ContributorPaymentAdminRow[]>()
    : Promise.resolve({ data: [] as ContributorPaymentAdminRow[], error: null });
  const [payments, questions, updates, votes, events, research] = await Promise.all([
    paymentQuery,
    supabase.from("contributor_questions").select("id", { count: "exact", head: true }).is("answered_at", null),
    supabase.from("contributor_updates").select("id", { count: "exact", head: true }).eq("is_published", true),
    supabase.from("contributor_votes").select("id", { count: "exact", head: true }).eq("is_published", true),
    supabase.from("contributor_events").select("id", { count: "exact", head: true }).eq("is_published", true),
    supabase.from("contributor_research_opportunities").select("id", { count: "exact", head: true }).eq("is_published", true),
  ]);
  if (payments.error) throw new Error("Contributor payment records are temporarily unavailable.");

  const paymentByContributor = new Map<string, ContributorPaymentAdminRow>();
  for (const payment of payments.data ?? []) {
    if (!paymentByContributor.has(payment.contributor_id)) {
      paymentByContributor.set(payment.contributor_id, payment);
    }
  }
  const activeMembers = rows.filter((member) => member.membership_status === "active");
  const grossCents = rows.reduce(
    (total, member) => total + (paymentByContributor.get(member.id)?.amount_total ?? 0),
    0,
  );

  return (
    <AdminDashboardShell
      activeSection="contributors"
      className="admin-contributors"
      description="Review historic contributor payments, access, profile completion, and member-content readiness."
      eyebrow="Private archive"
      title="Founding Contributors"
      userEmail={user.email}
    >
        <section className="admin-metrics" aria-label="Contributor programme metrics">
          <article><span>Active members</span><strong>{activeMembers.length}</strong><small>Current access</small></article>
          <article><span>Gross payments</span><strong>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(grossCents / 100)}</strong><small>Recorded payments</small></article>
          <article><span>Profiles complete</span><strong>{rows.filter((member) => member.onboarding_completed_at).length}</strong><small>Onboarding finished</small></article>
          <article><span>Open questions</span><strong>{questions.count ?? 0}</strong><small>Awaiting a response</small></article>
        </section>
        <section className="admin-content-status">
          <p className="eyebrow">Published member content</p>
          <div><span>Updates <strong>{updates.count ?? 0}</strong></span><span>Votes <strong>{votes.count ?? 0}</strong></span><span>Events <strong>{events.count ?? 0}</strong></span><span>Research <strong>{research.count ?? 0}</strong></span></div>
          <p>Content records can be prepared in Supabase while this flow remains private. Only records marked published appear in the hub.</p>
        </section>

        <div className="admin-section-heading">
          <div><p className="eyebrow">Member directory</p><h2>Contributor records</h2></div>
          <span>{rows.length} shown</span>
        </div>

        {rows.length ? (
          <div className="admin-table-shell"><table className="admin-table"><thead><tr><th>Contributor</th><th>Status</th><th>Payment</th><th>Access ends</th><th>Profile</th><th>Discount</th></tr></thead><tbody>
            {rows.map((member) => <tr key={member.id}>
              <td className="admin-lead"><strong>#{String(member.contributor_number).padStart(4, "0")} · {member.preferred_name || member.full_name}</strong><a href={`mailto:${member.email}`}>{member.email}</a></td>
              <td><span className={`admin-status admin-status--${member.membership_status}`}>{member.membership_status}</span></td>
              <td>{(() => {
                const payment = paymentByContributor.get(member.id);
                if (!payment) return "Missing payment record";
                return <>{new Intl.NumberFormat("en-US", { style: "currency", currency: payment.currency.toUpperCase(), maximumFractionDigits: 0 }).format(payment.amount_total / 100)}<br /><small>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(payment.paid_at ?? member.paid_at))}</small></>;
              })()}</td>
              <td>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(member.access_expires_at))}</td>
              <td>{member.onboarding_completed_at ? "Complete" : "Pending"}</td><td>{member.future_discount_eligible ? "Eligible" : "No"}</td>
            </tr>)}
          </tbody></table></div>
        ) : <div className="admin-empty"><h2>No contributors yet.</h2><p>Completed test purchases will appear here after Stripe and Supabase are configured.</p></div>}
    </AdminDashboardShell>
  );
}
