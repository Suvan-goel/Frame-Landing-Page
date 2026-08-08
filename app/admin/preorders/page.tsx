/* eslint-disable @next/next/no-html-link-for-pages */
import { notFound } from "next/navigation";
import { BrandWordmark } from "@/app/components/brand-wordmark";
import { PreorderSalesControls } from "@/app/components/preorder-sales-controls";
import {
  PreorderWebhookRecovery,
  type FailedWebhook,
} from "@/app/components/preorder-webhook-recovery";
import { chatGPTSignOutPath, requireChatGPTUser } from "@/app/chatgpt-auth";
import { evaluatePreorderLaunchReadiness } from "@/lib/preorder-launch-readiness.server";
import {
  getPreorderSalesSnapshot,
  type PreorderEnvironment,
} from "@/lib/preorder-operations.server";
import { formatPreorderMoney, formatPreorderNumber } from "@/lib/preorder";
import {
  isPreorderAdminPageEnabled,
  isPreorderSalesPageEnabled,
} from "@/lib/preorder-sales-page.server";
import { isStripeWebhookRecoveryEligible } from "@/lib/stripe-webhook-recovery";
import { getSupabaseAdmin, isWaitlistAdmin } from "@/lib/supabase-admin.server";

export const dynamic = "force-dynamic";

type PreorderAdminRow = {
  id: string;
  order_number: number;
  environment: PreorderEnvironment;
  full_name: string;
  email: string;
  shipping_address: { country?: string } | null;
  order_status: string;
  payment_status: string;
  fulfillment_status: string;
  cancellation_status: string;
  amount_total: number;
  amount_refunded: number;
  currency: string;
  estimated_delivery: string;
  placed_at: string;
  confirmation_email_sent_at: string | null;
};

type FailedWebhookRow = {
  event_id: string;
  event_type: string;
  status: string;
  error_message: string | null;
  processing_attempts: number;
  last_attempted_at: string | null;
};

export default async function PreorderAdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ environment?: string | string[] }>;
}) {
  if (!(await isPreorderAdminPageEnabled())) notFound();
  const user = await requireChatGPTUser("/admin/preorders");
  if (!(await isWaitlistAdmin(user.email))) notFound();
  const publicSalesPageEnabled = await isPreorderSalesPageEnabled();

  const requestedEnvironment = (await searchParams)?.environment;
  const environment: PreorderEnvironment =
    requestedEnvironment === "live" ? "live" : "test";
  const supabase = await getSupabaseAdmin();
  const [
    orders,
    failedEmails,
    failedWebhooks,
    snapshot,
    launchReadiness,
  ] = await Promise.all([
    supabase
      .from("preorders")
      .select("id,order_number,environment,full_name,email,shipping_address,order_status,payment_status,fulfillment_status,cancellation_status,amount_total,amount_refunded,currency,estimated_delivery,placed_at,confirmation_email_sent_at")
      .eq("environment", environment)
      .order("order_number", { ascending: false })
      .limit(500)
      .returns<PreorderAdminRow[]>(),
    supabase
      .from("preorder_email_deliveries")
      .select("id,preorders!inner(environment)", { count: "exact", head: true })
      .eq("status", "failed")
      .eq("preorders.environment", environment),
    supabase
      .from("stripe_webhook_events")
      .select("event_id,event_type,status,error_message,processing_attempts,last_attempted_at")
      .in("status", ["failed", "processing"])
      .eq("livemode", environment === "live")
      .order("last_attempted_at", { ascending: false })
      .limit(100)
      .returns<FailedWebhookRow[]>(),
    getPreorderSalesSnapshot(environment),
    evaluatePreorderLaunchReadiness(),
  ]);
  if (orders.error) throw new Error("The pre-order owner view is temporarily unavailable.");

  const rows = orders.data ?? [];
  const paidRows = rows.filter((order) => order.payment_status === "paid");
  const grossByCurrency = new Map<string, number>();
  const refundedByCurrency = new Map<string, number>();
  for (const order of rows) {
    grossByCurrency.set(
      order.currency,
      (grossByCurrency.get(order.currency) ?? 0) + order.amount_total,
    );
    refundedByCurrency.set(
      order.currency,
      (refundedByCurrency.get(order.currency) ?? 0) + order.amount_refunded,
    );
  }
  const moneySummary = (values: Map<string, number>) =>
    [...values.entries()]
      .map(([currency, cents]) => formatPreorderMoney(cents, currency))
      .join(" + ") || formatPreorderMoney(0, "usd");
  const liveGateReady = launchReadiness.ready;
  const environmentLabel = environment === "test" ? "Sandbox" : "Live";
  const orderAttentionCount = rows.filter(
    (order) =>
      !order.confirmation_email_sent_at ||
      ["requested", "processing"].includes(order.cancellation_status) ||
      ["refund_failed", "disputed"].includes(order.payment_status),
  ).length;
  const failedWebhookRows: FailedWebhook[] = (failedWebhooks.data ?? [])
    .filter((event) =>
      isStripeWebhookRecoveryEligible({
        status: event.status,
        lastAttemptedAt: event.last_attempted_at,
      }),
    )
    .map((event) => ({
      eventId: event.event_id,
      eventType: event.event_type,
      status: event.status === "processing" ? "stalled" : "failed",
      errorMessage: event.error_message,
      processingAttempts: event.processing_attempts,
      lastAttemptedAt: event.last_attempted_at,
    }));

  return (
    <main className="admin-page">
      <div className="admin-shell admin-preorders">
        <header className="admin-header">
          <div>
            <a className="wordmark" href="/" aria-label="Frame home"><BrandWordmark /></a>
            <p className="eyebrow">Owner view · {environmentLabel}</p>
            <h1>Frame Pre-orders</h1>
            <p>Availability, payments, email delivery and fulfilment in one place.</p>
          </div>
          <div className="admin-actions">
            <a href={`/api/admin/preorders.csv?environment=${environment}`}>Download CSV</a>
            <a href="/admin/email">Email</a>
            <a href="/admin/waitlist">Subscribers</a>
            <a className="text-link" href={chatGPTSignOutPath("/")}>Sign out</a>
          </div>
        </header>

        <nav className="admin-tabs" aria-label="Pre-order payment environments">
          <a
            className={environment === "test" ? "is-active" : undefined}
            href="/admin/preorders?environment=test"
            aria-current={environment === "test" ? "page" : undefined}
          >
            Sandbox orders
          </a>
          <a
            className={environment === "live" ? "is-active" : undefined}
            href="/admin/preorders?environment=live"
            aria-current={environment === "live" ? "page" : undefined}
          >
            Live orders
          </a>
        </nav>
        <p className="admin-tabs__note">
          Sandbox and live commerce records are kept separate. Changes here affect only the selected environment.
        </p>

        <section className="admin-metrics" aria-label={`${environmentLabel} pre-order metrics`}>
          <article><span>Paid orders</span><strong>{paidRows.length}</strong></article>
          <article><span>Gross payments</span><strong>{moneySummary(grossByCurrency)}</strong></article>
          <article><span>Refunded</span><strong>{moneySummary(refundedByCurrency)}</strong></article>
          <article><span>Needs attention</span><strong>{orderAttentionCount + (failedEmails.count ?? 0) + failedWebhookRows.length}</strong></article>
        </section>

        <PreorderSalesControls
          snapshot={snapshot}
          liveGateReady={liveGateReady}
          launchBlockers={launchReadiness.blockers}
        />

        <section className="admin-content-status preorder-admin-readiness">
          <p className="eyebrow">Launch lock</p>
          <div>
            <span>Live route gate <strong>{liveGateReady ? "Ready" : "Blocked"}</strong></span>
            <span>Live allocation <strong>{environment === "live" ? snapshot.salesStatus.replaceAll("_", " ") : "Separate"}</strong></span>
            <span>Current view <strong>{environmentLabel}</strong></span>
          </div>
          <p>
            Live checkout requires approved terms, verified live payments, signed webhooks, email delivery, dedicated security secrets and an open live allocation. The sandbox can remain open for testing without exposing public sales.
          </p>
        </section>

        <PreorderWebhookRecovery
          environment={environment}
          events={failedWebhookRows}
        />

        {rows.length ? (
          <div className="admin-table-shell">
            <table className="admin-table">
              <thead><tr><th>Order</th><th>Payment</th><th>Fulfilment</th><th>Amount</th><th>Ship to</th><th>Confirmation</th><th>Placed</th></tr></thead>
              <tbody>
                {rows.map((order) => (
                  <tr key={order.id}>
                    <td className="admin-lead">
                      <strong><a href={`/admin/preorders/${order.id}`}>{environment === "test" ? "TEST · " : ""}{formatPreorderNumber(order.order_number)} · {order.full_name}</a></strong>
                      <a href={`mailto:${order.email}`}>{order.email}</a>
                      <small>{order.order_status}{order.cancellation_status !== "none" ? ` · cancellation ${order.cancellation_status}` : ""}</small>
                    </td>
                    <td><span className={`admin-status admin-status--${order.payment_status}`}>{order.payment_status.replaceAll("_", " ")}</span></td>
                    <td><span className={`admin-status admin-status--${order.fulfillment_status}`}>{order.fulfillment_status.replaceAll("_", " ")}</span></td>
                    <td>{formatPreorderMoney(order.amount_total, order.currency)}{order.amount_refunded ? <><br /><small>{formatPreorderMoney(order.amount_refunded, order.currency)} refunded</small></> : null}</td>
                    <td>{order.shipping_address?.country ?? "—"}</td>
                    <td>{order.confirmation_email_sent_at ? "Sent" : "Pending / failed"}</td>
                    <td><time dateTime={order.placed_at}>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(order.placed_at))}</time></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="admin-empty">
            <h2>No {environmentLabel.toLowerCase()} pre-orders yet.</h2>
            <p>{environment === "test" ? "Complete a Stripe sandbox payment to exercise the order pipeline." : "Live orders will appear here after launch."}</p>
            {environment === "test" && publicSalesPageEnabled ? <a className="button button--dark" href="/preorder/review?source=admin_empty">Open pre-order review</a> : null}
          </div>
        )}
      </div>
    </main>
  );
}
