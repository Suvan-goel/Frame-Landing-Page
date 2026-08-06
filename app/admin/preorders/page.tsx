/* eslint-disable @next/next/no-html-link-for-pages */
import { notFound } from "next/navigation";
import { BrandWordmark } from "@/app/components/brand-wordmark";
import { chatGPTSignOutPath, requireChatGPTUser } from "@/app/chatgpt-auth";
import { formatPreorderMoney, formatPreorderNumber } from "@/lib/preorder";
import { isPreorderSalesPageEnabled } from "@/lib/preorder-sales-page.server";
import { getSupabaseAdmin, isWaitlistAdmin } from "@/lib/supabase-admin.server";

export const dynamic = "force-dynamic";

type PreorderAdminRow = {
  id: string;
  order_number: number;
  full_name: string;
  email: string;
  shipping_address: { country?: string } | null;
  order_status: string;
  payment_status: string;
  fulfillment_status: string;
  amount_total: number;
  amount_refunded: number;
  currency: string;
  estimated_delivery: string;
  placed_at: string;
  confirmation_email_sent_at: string | null;
};

export default async function PreorderAdminPage() {
  if (!(await isPreorderSalesPageEnabled())) notFound();
  const user = await requireChatGPTUser("/admin/preorders");
  if (!(await isWaitlistAdmin(user.email))) notFound();

  const supabase = await getSupabaseAdmin();
  const [orders, failedEmails, failedWebhooks] = await Promise.all([
    supabase
      .from("preorders")
      .select("id,order_number,full_name,email,shipping_address,order_status,payment_status,fulfillment_status,amount_total,amount_refunded,currency,estimated_delivery,placed_at,confirmation_email_sent_at")
      .order("order_number", { ascending: false })
      .limit(500)
      .returns<PreorderAdminRow[]>(),
    supabase.from("preorder_email_deliveries").select("id", { count: "exact", head: true }).eq("status", "failed"),
    supabase.from("stripe_webhook_events").select("event_id", { count: "exact", head: true }).eq("status", "failed"),
  ]);
  if (orders.error) throw new Error("The pre-order owner view is temporarily unavailable.");

  const rows = orders.data ?? [];
  const paidRows = rows.filter((order) => order.payment_status === "paid");
  const grossByCurrency = new Map<string, number>();
  const refundedByCurrency = new Map<string, number>();
  for (const order of rows) {
    grossByCurrency.set(order.currency, (grossByCurrency.get(order.currency) ?? 0) + order.amount_total);
    refundedByCurrency.set(order.currency, (refundedByCurrency.get(order.currency) ?? 0) + order.amount_refunded);
  }
  const moneySummary = (values: Map<string, number>) =>
    [...values.entries()].map(([currency, cents]) => formatPreorderMoney(cents, currency)).join(" + ") || "£0";

  return (
    <main className="admin-page">
      <div className="admin-shell admin-preorders">
        <header className="admin-header">
          <div>
            <a className="wordmark" href="/" aria-label="Frame home"><BrandWordmark /></a>
            <p className="eyebrow">Owner view · local test</p>
            <h1>Frame Pre-orders</h1>
            <p>Payment, email, fulfilment and refund readiness for the test funnel.</p>
          </div>
          <div className="admin-actions">
            <a href="/admin/waitlist">Waitlist</a>
            <a href="/admin/contributors">Contributors</a>
            <a className="text-link" href={chatGPTSignOutPath("/")}>Sign out</a>
          </div>
        </header>

        <section className="admin-metrics" aria-label="Pre-order test metrics">
          <article><span>Paid test orders</span><strong>{paidRows.length}</strong></article>
          <article><span>Gross test payments</span><strong>{moneySummary(grossByCurrency)}</strong></article>
          <article><span>Refunded</span><strong>{moneySummary(refundedByCurrency)}</strong></article>
          <article><span>Needs attention</span><strong>{(failedEmails.count ?? 0) + (failedWebhooks.count ?? 0)}</strong></article>
        </section>

        <section className="admin-content-status preorder-admin-readiness">
          <p className="eyebrow">Launch lock</p>
          <div><span>Public sales <strong>Blocked</strong></span><span>Legal documents <strong>Draft</strong></span><span>Default amount <strong>$299 test</strong></span></div>
          <p>Live mode remains unavailable while the active legal version is marked draft. Failed email or webhook deliveries appear in “Needs attention.”</p>
        </section>

        {rows.length ? (
          <div className="admin-table-shell"><table className="admin-table"><thead><tr><th>Order</th><th>Payment</th><th>Fulfilment</th><th>Amount</th><th>Ship to</th><th>Confirmation</th><th>Placed</th></tr></thead><tbody>
            {rows.map((order) => (
              <tr key={order.id}>
                <td className="admin-lead"><strong>{formatPreorderNumber(order.order_number)} · {order.full_name}</strong><a href={`mailto:${order.email}`}>{order.email}</a><small>{order.order_status}</small></td>
                <td><span className={`admin-status admin-status--${order.payment_status}`}>{order.payment_status.replaceAll("_", " ")}</span></td>
                <td><span className={`admin-status admin-status--${order.fulfillment_status}`}>{order.fulfillment_status.replaceAll("_", " ")}</span></td>
                <td>{formatPreorderMoney(order.amount_total, order.currency)}{order.amount_refunded ? <><br /><small>{formatPreorderMoney(order.amount_refunded, order.currency)} refunded</small></> : null}</td>
                <td>{order.shipping_address?.country ?? "—"}</td>
                <td>{order.confirmation_email_sent_at ? "Sent" : "Pending / failed"}</td>
                <td><time dateTime={order.placed_at}>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(order.placed_at))}</time></td>
              </tr>
            ))}
          </tbody></table></div>
        ) : (
          <div className="admin-empty"><h2>No test pre-orders yet.</h2><p>Complete the local preview or a Stripe test payment to exercise the order pipeline.</p><a className="button button--dark" href="/preorder/review?source=admin_empty">Open pre-order review</a></div>
        )}
      </div>
    </main>
  );
}
