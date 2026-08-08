/* eslint-disable @next/next/no-html-link-for-pages */
import { notFound } from "next/navigation";
import { AdminDashboardShell } from "@/app/components/admin-dashboard-shell";
import { PreorderSalesControls } from "@/app/components/preorder-sales-controls";
import {
  PreorderWebhookRecovery,
  type FailedWebhook,
} from "@/app/components/preorder-webhook-recovery";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import {
  formatPreorderAdminStatus,
  summarizePreorderAttention,
  type PreorderEmailHealth,
} from "@/lib/preorder-admin-dashboard";
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

type EmailDeliveryHealthRow = PreorderEmailHealth & {
  preorders: { environment: PreorderEnvironment };
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
    emailDeliveries,
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
      .select("preorder_id,email_type,status,created_at,preorders!inner(environment)")
      .eq("preorders.environment", environment)
      .order("created_at", { ascending: false })
      .limit(2_000)
      .returns<EmailDeliveryHealthRow[]>(),
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
  if (orders.error || emailDeliveries.error || failedWebhooks.error) {
    throw new Error("The pre-order owner view is temporarily unavailable.");
  }

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
  const attention = summarizePreorderAttention(
    rows,
    emailDeliveries.data ?? [],
    failedWebhookRows.length,
  );

  return (
    <AdminDashboardShell
      activeSection="preorders"
      actions={
        <a className="button button--dark" href={`/api/admin/preorders.csv?environment=${environment}`}>
          Export orders
        </a>
      }
      className="admin-preorders"
      description="Monitor payments, capacity, customer communication, and fulfilment from one operational view."
      eyebrow={`Owner workspace · ${environmentLabel}`}
      title="Pre-orders"
      userEmail={user.email}
    >
      <section className="admin-control-panel admin-control-panel--compact preorder-environment-panel" aria-label="Payment environment">
        <div className="admin-control-panel__heading">
          <div>
            <p className="eyebrow">Payment environment</p>
            <h2>{environmentLabel} operations</h2>
          </div>
          <p>Choose the payment data and controls you want to work with.</p>
        </div>

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
          You are viewing <strong>{environmentLabel.toLowerCase()}</strong> records. Orders, capacity, Stripe events, and exports stay separate between environments.
        </p>
      </section>

      <section className="admin-metrics preorder-admin-metrics" aria-label={`${environmentLabel} pre-order metrics`}>
        <article><span>Active paid orders</span><strong>{paidRows.length}</strong><small>Currently paid and not refunded</small></article>
        <article><span>Gross payments</span><strong>{moneySummary(grossByCurrency)}</strong><small>All captured payments before refunds</small></article>
        <article><span>Refunded</span><strong>{moneySummary(refundedByCurrency)}</strong><small>Returned to customers</small></article>
        <article className={attention.total ? "admin-metric--attention" : undefined}>
          <span>Review queue</span>
          <strong>{attention.total}</strong>
          <small>{attention.affectedOrderCount} order{attention.affectedOrderCount === 1 ? "" : "s"} · {attention.webhookCount} webhook{attention.webhookCount === 1 ? "" : "s"}</small>
        </article>
      </section>

      <div className="preorder-admin-operations-grid">
        <PreorderSalesControls
          snapshot={snapshot}
          liveGateReady={liveGateReady}
        />

        <div className="preorder-admin-health-stack">
          <section className={`admin-content-status preorder-admin-readiness ${liveGateReady ? "is-ready" : "is-blocked"}`}>
            <div className="preorder-admin-readiness__heading">
              <div>
                <p className="eyebrow">Go-live readiness</p>
                <h2>{liveGateReady ? "Launch safeguards are ready." : `${launchReadiness.blockers.length} launch check${launchReadiness.blockers.length === 1 ? "" : "s"} remaining.`}</h2>
              </div>
              <span className={`admin-status ${liveGateReady ? "admin-status--paid" : "admin-status--refund_failed"}`}>
                {liveGateReady ? "Ready" : "Locked"}
              </span>
            </div>
            <dl className="preorder-readiness-facts">
              <div><dt>Public pre-orders</dt><dd>{liveGateReady ? "Eligible to open" : "Blocked"}</dd></div>
              <div><dt>Live checkout</dt><dd>{environment === "live" ? formatPreorderAdminStatus(snapshot.salesStatus) : "Managed separately"}</dd></div>
            </dl>
            <p>
              Sandbox checkout can remain available for testing without making public pre-orders live.
            </p>
            {launchReadiness.blockers.length ? (
              <details className="preorder-readiness-details" open={environment === "live"}>
                <summary>Review launch blockers</summary>
                <ul>{launchReadiness.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>
              </details>
            ) : null}
          </section>

          <PreorderWebhookRecovery
            environment={environment}
            events={failedWebhookRows}
          />
        </div>
      </div>

      <section className={`preorder-review-summary ${attention.total ? "has-attention" : "is-clear"}`} aria-label="Operational review summary">
        <div>
          <p className="eyebrow">Operational review</p>
          <h2>{attention.total ? `${attention.total} item${attention.total === 1 ? "" : "s"} to review` : "No outstanding issues"}</h2>
          <p>
            {attention.total
              ? `${attention.orderIssueCount} order-status issue${attention.orderIssueCount === 1 ? "" : "s"}, ${attention.emailOrderCount} order${attention.emailOrderCount === 1 ? "" : "s"} with a failed latest email, and ${attention.webhookCount} recoverable Stripe event${attention.webhookCount === 1 ? "" : "s"}.`
              : "Every order, latest customer email, and recoverable Stripe event is clear in this environment."}
          </p>
        </div>
        <a href="#preorder-orders">Review orders</a>
      </section>

        <div className="admin-section-heading" id="preorder-orders">
          <div>
            <p className="eyebrow">Order directory</p>
            <h2>{environmentLabel} orders</h2>
          </div>
          <span>{rows.length} shown</span>
        </div>

        {rows.length ? (
          <div className="admin-table-shell">
            <table className="admin-table preorder-orders-table">
              <thead><tr><th>Customer &amp; order</th><th>Payment</th><th>Fulfilment</th><th>Total</th><th>Delivery</th><th>Email</th><th>Placed</th><th><span className="sr-only">Review</span></th></tr></thead>
              <tbody>
                {rows.map((order) => (
                  <tr key={order.id}>
                    <td className="admin-lead" data-label="Order">
                      <span className="preorder-order-number">{environment === "test" ? "TEST · " : ""}{formatPreorderNumber(order.order_number)}</span>
                      <strong><a href={`/admin/preorders/${order.id}`}>{order.full_name}</a></strong>
                      <a href={`mailto:${order.email}`}>{order.email}</a>
                      <small>{formatPreorderAdminStatus(order.order_status)}{order.cancellation_status !== "none" ? ` · Cancellation ${formatPreorderAdminStatus(order.cancellation_status).toLowerCase()}` : ""}</small>
                    </td>
                    <td data-label="Payment"><span className={`admin-status admin-status--${order.payment_status}`}>{formatPreorderAdminStatus(order.payment_status)}</span></td>
                    <td data-label="Fulfilment"><span className={`admin-status admin-status--${order.fulfillment_status}`}>{formatPreorderAdminStatus(order.fulfillment_status)}</span></td>
                    <td data-label="Total"><strong>{formatPreorderMoney(order.amount_total, order.currency)}</strong>{order.amount_refunded ? <><br /><small>{formatPreorderMoney(order.amount_refunded, order.currency)} refunded</small></> : null}</td>
                    <td data-label="Delivery"><strong>{order.shipping_address?.country ?? "—"}</strong><br /><small>{order.estimated_delivery}</small></td>
                    <td data-label="Email"><span className={`preorder-email-state ${order.confirmation_email_sent_at ? "is-sent" : "needs-review"}`}>{order.confirmation_email_sent_at ? "Sent" : "Needs review"}</span></td>
                    <td data-label="Placed"><time dateTime={order.placed_at}>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(order.placed_at))}</time><small className="preorder-time-zone">UTC</small></td>
                    <td className="preorder-order-action"><a href={`/admin/preorders/${order.id}`} aria-label={`Review ${formatPreorderNumber(order.order_number)}`}>Review <span aria-hidden="true">→</span></a></td>
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
    </AdminDashboardShell>
  );
}
