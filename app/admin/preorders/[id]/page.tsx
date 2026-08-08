/* eslint-disable @next/next/no-html-link-for-pages */
import { notFound } from "next/navigation";
import { AdminDashboardShell } from "@/app/components/admin-dashboard-shell";
import { PreorderOrderOperations } from "@/app/components/preorder-order-operations";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { formatPreorderAdminStatus } from "@/lib/preorder-admin-dashboard";
import { formatPreorderMoney, formatPreorderNumber } from "@/lib/preorder";
import { isPreorderId } from "@/lib/preorder-admin-api.server";
import { createPreorderManagePath } from "@/lib/preorder-order-access.server";
import type { PreorderEnvironment } from "@/lib/preorder-operations.server";
import {
  isPreorderAdminPageEnabled,
  isPreorderSalesPageEnabled,
} from "@/lib/preorder-sales-page.server";
import { getSupabaseAdmin, isWaitlistAdmin } from "@/lib/supabase-admin.server";

export const dynamic = "force-dynamic";

type OrderDetail = {
  id: string;
  order_number: number;
  environment: PreorderEnvironment;
  manage_token_version: number;
  full_name: string;
  email: string;
  phone: string | null;
  shipping_address: Record<string, unknown>;
  order_status: string;
  payment_status: string;
  fulfillment_status: string;
  cancellation_status: string;
  cancellation_requested_at: string | null;
  cancellation_reason: string | null;
  cancellation_resolved_at: string | null;
  cancellation_resolution_note: string | null;
  amount_subtotal: number;
  amount_shipping: number;
  amount_tax: number;
  amount_total: number;
  amount_refunded: number;
  currency: string;
  estimated_delivery: string;
  current_estimated_delivery: string;
  placed_at: string;
  address_change_status: string;
  address_change_requested_at: string | null;
  requested_shipping_address: Record<string, unknown> | null;
  address_change_reason: string | null;
  address_change_resolved_at: string | null;
  address_change_resolution_note: string | null;
  delivery_update_version: number;
  delivery_update_status: string;
  delivery_update_message: string | null;
  delivery_update_sent_at: string | null;
  delivery_update_acknowledged_at: string | null;
  confirmation_email_sent_at: string | null;
  carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  owner_note: string | null;
};

type OrderItem = { id: string; product_name: string; sku: string; quantity: number; unit_amount: number; currency: string };
type Payment = { id: string; payment_kind: string; stripe_payment_intent_id: string | null; amount_total: number; amount_refunded: number; currency: string; payment_status: string; paid_at: string | null; refunded_at: string | null };
type OrderEvent = { id: string; event_type: string; source: string; detail: Record<string, unknown>; created_at: string };
type EmailDelivery = { id: string; email_type: string; recipient: string; status: string; error_message: string | null; sent_at: string | null; created_at: string };

function dateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value)) + " UTC";
}

function addressLines(address: Record<string, unknown>) {
  return [address.line1, address.line2, address.city, address.state, address.postal_code, address.country]
    .filter((value): value is string => typeof value === "string" && Boolean(value));
}

function emailErrorMessage(value: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as { message?: unknown };
    return typeof parsed.message === "string" ? parsed.message : value;
  } catch {
    return value;
  }
}

export default async function PreorderOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AuthenticatedOrderDetail id={id} />;
}

async function AuthenticatedOrderDetail({ id }: { id: string }) {
  if (!(await isPreorderAdminPageEnabled()) || !isPreorderId(id)) notFound();
  const user = await requireChatGPTUser(`/admin/preorders/${id}`);
  if (!(await isWaitlistAdmin(user.email))) notFound();
  const publicSalesPageEnabled = await isPreorderSalesPageEnabled();

  const supabase = await getSupabaseAdmin();
  const [orderResult, itemsResult, paymentsResult, eventsResult, emailsResult] = await Promise.all([
    supabase
      .from("preorders")
      .select("id,order_number,environment,manage_token_version,full_name,email,phone,shipping_address,order_status,payment_status,fulfillment_status,cancellation_status,cancellation_requested_at,cancellation_reason,cancellation_resolved_at,cancellation_resolution_note,amount_subtotal,amount_shipping,amount_tax,amount_total,amount_refunded,currency,estimated_delivery,current_estimated_delivery,placed_at,address_change_status,address_change_requested_at,requested_shipping_address,address_change_reason,address_change_resolved_at,address_change_resolution_note,delivery_update_version,delivery_update_status,delivery_update_message,delivery_update_sent_at,delivery_update_acknowledged_at,confirmation_email_sent_at,carrier,tracking_number,tracking_url,shipped_at,delivered_at,owner_note")
      .eq("id", id)
      .maybeSingle<OrderDetail>(),
    supabase.from("preorder_order_items").select("id,product_name,sku,quantity,unit_amount,currency").eq("preorder_id", id).returns<OrderItem[]>(),
    supabase.from("preorder_payments").select("id,payment_kind,stripe_payment_intent_id,amount_total,amount_refunded,currency,payment_status,paid_at,refunded_at").eq("preorder_id", id).order("created_at", { ascending: true }).returns<Payment[]>(),
    supabase.from("preorder_events").select("id,event_type,source,detail,created_at").eq("preorder_id", id).order("created_at", { ascending: false }).limit(100).returns<OrderEvent[]>(),
    supabase.from("preorder_email_deliveries").select("id,email_type,recipient,status,error_message,sent_at,created_at").eq("preorder_id", id).order("created_at", { ascending: false }).limit(50).returns<EmailDelivery[]>(),
  ]);
  if (orderResult.error) throw new Error("The pre-order is temporarily unavailable.");
  if (!orderResult.data) notFound();
  if (
    itemsResult.error ||
    paymentsResult.error ||
    eventsResult.error ||
    emailsResult.error
  ) {
    throw new Error("The pre-order history is temporarily unavailable.");
  }
  const order = orderResult.data;
  const payments = paymentsResult.data ?? [];
  const amountRemaining = Math.max(order.amount_total - order.amount_refunded, 0);
  let managePath: string | null = null;
  try {
    managePath = publicSalesPageEnabled
      ? await createPreorderManagePath({ orderId: order.id, tokenVersion: order.manage_token_version })
      : null;
  } catch (error) {
    console.error("Owner order-management link creation failed", error);
  }
  const stripePaymentUrl = (payment: Payment) => payment.stripe_payment_intent_id
    ? `https://dashboard.stripe.com/${order.environment === "test" ? "test/" : ""}payments/${payment.stripe_payment_intent_id}`
    : null;
  const cancellationActive = ["requested", "processing"].includes(order.cancellation_status);
  const addressChangeActive = ["requested", "processing"].includes(order.address_change_status);
  const isClosed = order.order_status === "cancelled" || order.payment_status === "refunded";
  const paymentNeedsReview = ["refund_failed", "disputed"].includes(order.payment_status);
  const confirmationNeedsReview = !isClosed && !order.confirmation_email_sent_at;
  const canUpdateFulfillment = !isClosed;
  const canSendDeliveryUpdate =
    order.order_status === "placed" &&
    ["paid", "partially_refunded"].includes(order.payment_status) &&
    ["on_hold", "ready", "processing"].includes(order.fulfillment_status) &&
    !cancellationActive;
  const nextStep = cancellationActive
    ? {
        title: "Complete the customer’s cancellation refund.",
        copy: "The order must remain out of fulfilment until the remaining balance has been refunded.",
        tone: "attention",
      }
    : addressChangeActive
      ? {
          title: "Review the requested shipping address.",
          copy: "Approve or decline the request before this order is marked as shipped.",
          tone: "attention",
        }
      : paymentNeedsReview
        ? {
            title: "Review the payment before continuing.",
            copy: "Stripe has reported a payment state that requires an owner decision.",
            tone: "attention",
          }
        : confirmationNeedsReview
          ? {
              title: "Send the missing order confirmation.",
              copy: "The payment is recorded, but no successful confirmation email is attached to this order.",
              tone: "attention",
            }
          : isClosed
            ? {
                title: "No operational action is required.",
                copy: "This order is closed and has no remaining refundable balance or fulfilment work.",
                tone: "closed",
              }
            : order.fulfillment_status === "delivered"
              ? {
                  title: "Delivery is complete.",
                  copy: "The order has reached its customer and is retained here for its operational history.",
                  tone: "clear",
                }
              : {
                  title: "Continue fulfilment when the order is ready.",
                  copy: "Customer communication is clear. Update fulfilment as the device moves toward dispatch.",
                  tone: "clear",
                };

  return (
    <AdminDashboardShell
      activeSection="preorders"
      actions={
        <>
          <a className="button button--light" href={`/admin/preorders?environment=${order.environment}`}>All pre-orders</a>
          {managePath ? <a className="button button--dark" href={managePath} target="_blank" rel="noreferrer">Customer view</a> : null}
        </>
      }
      className="preorder-order-detail"
      description={<>{order.full_name} · placed {dateTime(order.placed_at)}</>}
      eyebrow={`${order.environment === "test" ? "Sandbox" : "Live"} order`}
      title={formatPreorderNumber(order.order_number)}
      userEmail={user.email}
    >
        <section className="preorder-order-statuses" aria-label="Order statuses">
          <div><span>Order</span><strong>{formatPreorderAdminStatus(order.order_status)}</strong></div>
          <div><span>Payment</span><strong>{formatPreorderAdminStatus(order.payment_status)}</strong></div>
          <div><span>Fulfilment</span><strong>{formatPreorderAdminStatus(order.fulfillment_status)}</strong></div>
          <div><span>Cancellation</span><strong>{formatPreorderAdminStatus(order.cancellation_status)}</strong></div>
        </section>

        <section className={`preorder-next-step preorder-next-step--${nextStep.tone}`} aria-labelledby="preorder-next-step-heading">
          <div>
            <p className="eyebrow">Recommended next step</p>
            <h2 id="preorder-next-step-heading">{nextStep.title}</h2>
            <p>{nextStep.copy}</p>
          </div>
          <span className={`admin-status ${nextStep.tone === "attention" ? "admin-status--refund_failed" : "admin-status--paid"}`}>
            {nextStep.tone === "attention" ? "Action needed" : nextStep.tone === "closed" ? "Closed" : "On track"}
          </span>
        </section>

        {order.cancellation_status !== "none" ? (
          <section className="preorder-order-cancellation-summary">
            <p className="eyebrow">Cancellation request</p>
            <h2>{formatPreorderAdminStatus(order.cancellation_status)}</h2>
            <p>{order.cancellation_reason || "No reason provided."}</p>
            <small>Requested {dateTime(order.cancellation_requested_at)}{order.cancellation_resolution_note ? ` · Resolution: ${order.cancellation_resolution_note}` : ""}</small>
          </section>
        ) : null}

        {order.address_change_status !== "none" ? (
          <section className="preorder-order-cancellation-summary">
            <p className="eyebrow">Shipping-address request</p>
            <h2>{formatPreorderAdminStatus(order.address_change_status)}</h2>
            {order.requested_shipping_address ? (
              <p>{addressLines(order.requested_shipping_address).join(" · ")}</p>
            ) : null}
            <small>
              Requested {dateTime(order.address_change_requested_at)}
              {order.address_change_reason ? ` · Customer note: ${order.address_change_reason}` : ""}
              {order.address_change_resolution_note ? ` · Resolution: ${order.address_change_resolution_note}` : ""}
            </small>
          </section>
        ) : null}

        <div className="preorder-order-layout">
          <div className="preorder-order-primary">
            <PreorderOrderOperations
              orderId={order.id}
              environment={order.environment}
              amountRemainingLabel={formatPreorderMoney(amountRemaining, order.currency)}
              orderStatus={order.order_status}
              paymentStatus={order.payment_status}
              fulfillmentStatus={order.fulfillment_status}
              cancellationStatus={order.cancellation_status}
              addressChangeStatus={order.address_change_status}
              requestedShippingAddress={order.requested_shipping_address}
              addressChangeReason={order.address_change_reason}
              currentEstimatedDelivery={order.current_estimated_delivery}
              deliveryUpdateStatus={order.delivery_update_status}
              deliveryUpdateMessage={order.delivery_update_message}
              carrier={order.carrier}
              trackingNumber={order.tracking_number}
              trackingUrl={order.tracking_url}
              ownerNote={order.owner_note}
              canUpdateFulfillment={canUpdateFulfillment}
              canSendDeliveryUpdate={canSendDeliveryUpdate}
              canRefund={amountRemaining > 0 && ["paid", "partially_refunded", "refund_failed"].includes(order.payment_status)}
            />
          </div>

          <aside>
            <section className="preorder-owner-card preorder-order-summary-card">
              <p className="eyebrow">Customer</p>
              <h2>{order.full_name}</h2>
              <p><a href={`mailto:${order.email}`}>{order.email}</a>{order.phone ? <><br />{order.phone}</> : null}</p>
              <address>
                {addressLines(order.shipping_address).map((line, index) => <span key={`${line}-${index}`}>{line}</span>)}
              </address>
            </section>

            <section className="preorder-owner-card preorder-order-summary-card">
              <p className="eyebrow">Payment summary</p>
              <h2>{formatPreorderMoney(order.amount_total, order.currency)}</h2>
              <dl className="preorder-payment-breakdown">
                <div><dt>Device subtotal</dt><dd>{formatPreorderMoney(order.amount_subtotal, order.currency)}</dd></div>
                <div><dt>Shipping</dt><dd>{formatPreorderMoney(order.amount_shipping, order.currency)}</dd></div>
                <div><dt>Tax</dt><dd>{formatPreorderMoney(order.amount_tax, order.currency)}</dd></div>
                <div className="is-total"><dt>Order total</dt><dd>{formatPreorderMoney(order.amount_total, order.currency)}</dd></div>
                <div><dt>Refunded</dt><dd>{formatPreorderMoney(order.amount_refunded, order.currency)}</dd></div>
                <div><dt>Balance retained</dt><dd>{formatPreorderMoney(amountRemaining, order.currency)}</dd></div>
              </dl>
              <div className="preorder-payment-records">
                {payments.map((payment, index) => {
                  const paymentUrl = stripePaymentUrl(payment);
                  return (
                    <article key={payment.id}>
                      <div>
                        <strong>{payments.length > 1 ? `Payment ${index + 1} · ` : ""}{formatPreorderAdminStatus(payment.payment_kind)}</strong>
                        <span>{formatPreorderAdminStatus(payment.payment_status)} · {formatPreorderMoney(payment.amount_total, payment.currency)} · {dateTime(payment.paid_at)}</span>
                      </div>
                      {paymentUrl ? <a href={paymentUrl} target="_blank" rel="noreferrer">View in Stripe</a> : null}
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="preorder-owner-card preorder-order-summary-card">
              <p className="eyebrow">Items &amp; delivery</p>
              {(itemsResult.data ?? []).length ? (itemsResult.data ?? []).map((item) => (
                <div className="preorder-owner-line-item" key={item.id}>
                  <div><h2>{item.product_name}</h2><p>{item.sku} · quantity {item.quantity}</p></div>
                  <strong>{formatPreorderMoney(item.unit_amount * item.quantity, item.currency)}</strong>
                </div>
              )) : <p>No order items are recorded.</p>}
              <dl className="preorder-delivery-estimate-facts">
                <div><dt>Current estimate</dt><dd>{order.current_estimated_delivery}</dd></div>
                {order.current_estimated_delivery !== order.estimated_delivery ? (
                  <div><dt>Original estimate</dt><dd>{order.estimated_delivery}</dd></div>
                ) : null}
              </dl>
            </section>

            <section className="preorder-owner-card">
              <p className="eyebrow">Email delivery</p>
              <h2>{order.confirmation_email_sent_at ? "Confirmation sent" : "Needs attention"}</h2>
              <p>{order.confirmation_email_sent_at ? dateTime(order.confirmation_email_sent_at) : "No successful confirmation is recorded."}</p>
              <ul className="preorder-owner-timeline">
                {(emailsResult.data ?? []).length ? (emailsResult.data ?? []).map((email) => <li key={email.id}><strong>{formatPreorderAdminStatus(email.email_type)}</strong><span>{formatPreorderAdminStatus(email.status)} · {dateTime(email.sent_at ?? email.created_at)}</span>{email.error_message ? <small>{emailErrorMessage(email.error_message)}</small> : null}</li>) : <li><span>No customer emails are recorded.</span></li>}
              </ul>
            </section>

            <section className="preorder-owner-card">
              <p className="eyebrow">Order history</p>
              <ul className="preorder-owner-timeline">
                {(eventsResult.data ?? []).length ? (eventsResult.data ?? []).map((event) => <li key={event.id}><strong>{formatPreorderAdminStatus(event.event_type)}</strong><span>{formatPreorderAdminStatus(event.source)} · {dateTime(event.created_at)}</span></li>) : <li><span>No operational events are recorded.</span></li>}
              </ul>
            </section>
          </aside>
        </div>
    </AdminDashboardShell>
  );
}
