import { getSupabaseAdmin } from "./supabase-admin.server";
import { getRuntimeValue } from "./runtime-env.server";
import {
  formatPreorderMoney,
  formatPreorderNumber,
} from "./preorder";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function addressLines(address: Record<string, unknown>) {
  return [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.postal_code,
    address.country,
  ]
    .filter((value): value is string => typeof value === "string" && Boolean(value))
    .map((value) => value.trim());
}

export async function sendPreorderConfirmationEmail(input: {
  origin: string;
  preorderId: string;
  orderNumber: number;
  email: string;
  fullName: string;
  amountTotal: number;
  currency: string;
  quantity: number;
  placedAt: string;
  estimatedDelivery: string;
  shippingAddress: Record<string, unknown>;
}) {
  const supabase = await getSupabaseAdmin();
  const deliveryKey = `preorder-confirmation-${input.preorderId}`;
  const existing = await supabase
    .from("preorder_email_deliveries")
    .select("status")
    .eq("delivery_key", deliveryKey)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data?.status === "sent") return;

  const queued = await supabase.from("preorder_email_deliveries").upsert(
    {
      preorder_id: input.preorderId,
      email_type: "order_confirmation",
      recipient: input.email,
      delivery_key: deliveryKey,
      status: "pending",
      error_message: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "delivery_key" },
  );
  if (queued.error) throw queued.error;

  const apiKey = await getRuntimeValue("RESEND_API_KEY");
  if (!apiKey) {
    await supabase
      .from("preorder_email_deliveries")
      .update({
        status: "failed",
        error_message: "Pre-order confirmation email is not configured yet.",
        updated_at: new Date().toISOString(),
      })
      .eq("delivery_key", deliveryKey);
    throw new Error("Pre-order confirmation email is not configured yet.");
  }

  const from =
    (await getRuntimeValue("PREORDER_FROM_EMAIL")) ??
    "Frame Pre-orders <preorders@framewearable.com>";
  const orderNumber = formatPreorderNumber(input.orderNumber);
  const amount = formatPreorderMoney(input.amountTotal, input.currency);
  const placedAt = new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(
    new Date(input.placedAt),
  );
  const shipping = addressLines(input.shippingAddress);
  const termsUrl = `${input.origin}/preorder/terms`;
  const refundsUrl = `${input.origin}/preorder/refunds`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": deliveryKey,
    },
    body: JSON.stringify({
      from,
      to: [input.email],
      subject: `Frame test pre-order confirmation — ${orderNumber}`,
      text: [
        `Hello ${input.fullName},`,
        "",
        `Your Frame test pre-order is confirmed. Order ${orderNumber}.`,
        `Payment: ${amount}`,
        `Quantity: ${input.quantity}`,
        `Placed: ${placedAt}`,
        `Delivery status: ${input.estimatedDelivery}`,
        "",
        "Shipping address:",
        ...shipping,
        "",
        "This is a local, test-mode implementation. It is not approved for live sales.",
        `Draft pre-order terms: ${termsUrl}`,
        `Draft refund policy: ${refundsUrl}`,
        "",
        "Support: support@framewearable.com",
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#20211e;line-height:1.6">
          <p style="font-size:30px;font-family:Georgia,serif;margin-bottom:32px">Frame</p>
          <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#7b2937">Test pre-order ${orderNumber}</p>
          <h1 style="font-family:Georgia,serif;font-weight:400;font-size:38px;line-height:1.1">Your test pre-order is confirmed.</h1>
          <p>Hello ${escapeHtml(input.fullName)}. Stripe has confirmed your test payment.</p>
          <div style="background:#f3efe6;padding:20px 24px;margin:28px 0">
            <p style="margin:0 0 8px"><strong>Payment:</strong> ${escapeHtml(amount)}</p>
            <p style="margin:0 0 8px"><strong>Quantity:</strong> ${input.quantity}</p>
            <p style="margin:0"><strong>Placed:</strong> ${escapeHtml(placedAt)}</p>
          </div>
          <p><strong>Delivery status:</strong> ${escapeHtml(input.estimatedDelivery)}</p>
          <p><strong>Shipping address</strong><br>${shipping.map(escapeHtml).join("<br>")}</p>
          <p style="padding:16px;border-left:4px solid #7b2937;background:#f7ecee"><strong>Local test only.</strong> This flow and its draft terms are not approved for live sales.</p>
          <p><a href="${termsUrl}">Draft pre-order terms</a> · <a href="${refundsUrl}">Draft refund policy</a></p>
          <p style="color:#686a63">Questions? Contact support@framewearable.com.</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    await supabase
      .from("preorder_email_deliveries")
      .update({
        status: "failed",
        error_message: detail.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq("delivery_key", deliveryKey);
    throw new Error(`Pre-order confirmation email failed: ${detail.slice(0, 240)}`);
  }

  const result = (await response.json().catch(() => ({}))) as { id?: string };
  const sentAt = new Date().toISOString();
  const delivered = await supabase
    .from("preorder_email_deliveries")
    .update({
      status: "sent",
      provider_message_id: result.id ?? null,
      sent_at: sentAt,
      error_message: null,
      updated_at: sentAt,
    })
    .eq("delivery_key", deliveryKey);
  if (delivered.error) throw delivered.error;
}
