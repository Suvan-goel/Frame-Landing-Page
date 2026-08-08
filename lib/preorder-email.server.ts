import { getSupabaseAdmin } from "./supabase-admin.server";
import { getRuntimeValue } from "./runtime-env.server";
import { formatPreorderMoney, formatPreorderNumber } from "./preorder";
import type {
  PreorderDeliveryNoticeType,
  PreorderDeliveryResponseMode,
} from "./preorder-delivery-policy";
import type { PreorderEnvironment } from "./preorder-operations.server";

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

async function sendPreorderEmail(input: {
  preorderId: string;
  emailType:
    | "order_confirmation"
    | "shipping_update"
    | "owner_action_required"
    | "cancellation_declined"
    | "address_change_resolved"
    | "delivery_update"
    | "refund_update"
    | "email_change_verification"
    | "email_change_notice";
  recipient: string;
  deliveryKey: string;
  subject: string;
  text: string;
  html: string;
}) {
  const supabase = await getSupabaseAdmin();
  const now = new Date().toISOString();
  const queued = await supabase
    .from("preorder_email_deliveries")
    .insert({
      preorder_id: input.preorderId,
      email_type: input.emailType,
      recipient: input.recipient,
      delivery_key: input.deliveryKey,
      status: "pending",
      error_message: null,
      updated_at: now,
    })
    .select("id")
    .maybeSingle();
  if (queued.error && queued.error.code !== "23505") throw queued.error;

  let providerIdempotencyKey = input.deliveryKey;
  if (!queued.data) {
    const existing = await supabase
      .from("preorder_email_deliveries")
      .select("status,sent_at,updated_at")
      .eq("delivery_key", input.deliveryKey)
      .single();
    if (existing.error) throw existing.error;
    if (existing.data.status === "sent") return existing.data.sent_at as string;
    if (existing.data.status === "pending") return existing.data.sent_at as string | null;

    const retryQueued = await supabase
      .from("preorder_email_deliveries")
      .update({
        status: "pending",
        error_message: null,
        updated_at: now,
      })
      .eq("delivery_key", input.deliveryKey)
      .eq("status", "failed")
      .eq("updated_at", existing.data.updated_at)
      .select("id")
      .maybeSingle();
    if (retryQueued.error) throw retryQueued.error;
    if (!retryQueued.data) return existing.data.sent_at as string | null;

    providerIdempotencyKey = `${input.deliveryKey}-retry-${crypto.randomUUID()}`;
  }

  const apiKey = await getRuntimeValue("RESEND_API_KEY");
  if (!apiKey) {
    await supabase
      .from("preorder_email_deliveries")
      .update({
        status: "failed",
        error_message: "Pre-order email delivery is not configured yet.",
        updated_at: new Date().toISOString(),
      })
      .eq("delivery_key", input.deliveryKey);
    throw new Error("Pre-order email delivery is not configured yet.");
  }

  const from =
    (await getRuntimeValue("PREORDER_FROM_EMAIL")) ??
    "Frame Pre-orders <preorders@framewearable.com>";
  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": providerIdempotencyKey,
      },
      body: JSON.stringify({
        from,
        to: [input.recipient],
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Email provider request failed.";
    await supabase
      .from("preorder_email_deliveries")
      .update({
        status: "failed",
        error_message: detail.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq("delivery_key", input.deliveryKey);
    throw error;
  }

  if (!response.ok) {
    const detail = await response.text();
    await supabase
      .from("preorder_email_deliveries")
      .update({
        status: "failed",
        error_message: detail.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq("delivery_key", input.deliveryKey);
    throw new Error(`Pre-order email failed: ${detail.slice(0, 240)}`);
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
    .eq("delivery_key", input.deliveryKey);
  if (delivered.error) throw delivered.error;
  return sentAt;
}

async function preorderOperationsRecipient() {
  const dedicated = await getRuntimeValue("PREORDER_OPERATIONS_EMAIL");
  if (dedicated?.trim()) return dedicated.trim().toLowerCase();
  const adminEmails = await getRuntimeValue("WAITLIST_ADMIN_EMAILS");
  return adminEmails
    ?.split(",")
    .map((email) => email.trim().toLowerCase())
    .find(Boolean) ?? null;
}

export type PreorderConfirmationEmailInput = {
  origin: string;
  preorderId: string;
  orderNumber: number;
  environment: PreorderEnvironment;
  email: string;
  fullName: string;
  amountSubtotal: number;
  amountShipping: number;
  amountTax: number;
  amountTotal: number;
  currency: string;
  quantity: number;
  placedAt: string;
  estimatedShipping: string;
  shippingAddress: Record<string, unknown>;
  managePath?: string | null;
  deliveryKey?: string;
};

export function renderPreorderConfirmationEmail(
  input: PreorderConfirmationEmailInput,
) {
  const orderNumber = formatPreorderNumber(input.orderNumber);
  const subtotal = formatPreorderMoney(input.amountSubtotal, input.currency);
  const shippingAmount = formatPreorderMoney(input.amountShipping, input.currency);
  const taxAmount = formatPreorderMoney(input.amountTax, input.currency);
  const amount = formatPreorderMoney(input.amountTotal, input.currency);
  const placedAt = new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(
    new Date(input.placedAt),
  );
  const shipping = addressLines(input.shippingAddress);
  const termsUrl = `${input.origin}/preorder/terms`;
  const refundsUrl = `${input.origin}/preorder/refunds`;
  const productStatusUrl = `${input.origin}/preorder/product-status`;
  const manageUrl = input.managePath ? `${input.origin}${input.managePath}` : null;
  const sandbox = input.environment === "test";
  const subject = `${sandbox ? "[Sandbox] " : ""}Frame pre-order confirmation | ${orderNumber}`;
  const sandboxText = sandbox
    ? ["", "Sandbox order: no live charge was made."]
    : [];
  const text = [
      `Hello ${input.fullName},`,
      "",
      `Your Frame pre-order is confirmed. Order ${orderNumber}.`,
      `Product subtotal: ${subtotal}`,
      `Shipping: ${shippingAmount}`,
      `Sales tax: ${taxAmount}`,
      `Total paid: ${amount}`,
      `Quantity: ${input.quantity}`,
      `Placed: ${placedAt}`,
      `Estimated shipping: ${input.estimatedShipping}`,
      "Frame remains under development and is not currently FDA cleared or approved. It is not for medical decisions.",
      "",
      "Shipping address:",
      ...shipping,
      ...sandboxText,
      "",
      ...(manageUrl ? [`Manage your pre-order: ${manageUrl}`] : []),
      `Product status disclosure: ${productStatusUrl}`,
      `Pre-order terms: ${termsUrl}`,
      `Cancellation and refunds: ${refundsUrl}`,
      "",
      "Support: support@framewearable.com",
    ].join("\n");
  const safeOrigin = escapeHtml(input.origin);
  const safeOrderNumber = escapeHtml(orderNumber);
  const safeManageUrl = manageUrl ? escapeHtml(manageUrl) : null;
  const shippingHtml = shipping.length
    ? shipping.map(escapeHtml).join("<br>")
    : "Address provided at checkout";
  const preheader = `Payment received for Frame pre-order ${orderNumber}. Estimated shipping: ${input.estimatedShipping}.`;
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${escapeHtml(subject)}</title>
    <style>
      body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
      table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
      table { border-collapse: collapse !important; }
      img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
      a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
      @media only screen and (max-width: 620px) {
        .email-outer { padding: 0 !important; }
        .email-card { width: 100% !important; border-left: 0 !important; border-right: 0 !important; }
        .email-header { padding: 24px !important; }
        .email-content { padding: 38px 24px 42px !important; }
        .email-footer { padding: 28px 24px !important; }
        .email-heading { font-size: 36px !important; line-height: 1.03 !important; }
        .email-summary { padding: 24px 20px !important; }
        .email-delivery { padding: 22px 20px !important; }
        .email-secondary-column { width: 100% !important; display: block !important; padding: 24px 0 0 !important; }
        .email-primary-column { width: 100% !important; display: block !important; }
        .email-mobile-left { text-align: left !important; }
        .email-button-link { display: block !important; text-align: center !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#eee9df;color:#20211e">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;line-height:1px">${escapeHtml(preheader)}&#847;&nbsp;&zwnj;&nbsp;&#847;&nbsp;&zwnj;&nbsp;&#847;&nbsp;&zwnj;&nbsp;&#847;</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#eee9df" style="width:100%;background:#eee9df">
      <tr>
        <td class="email-outer" align="center" style="padding:40px 16px">
          <table class="email-card" role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" bgcolor="#fffdf8" style="width:100%;max-width:600px;background:#fffdf8;border:1px solid #dcd6cc">
            <tr>
              <td height="5" bgcolor="#8d3e46" style="height:5px;background:#8d3e46;font-size:0;line-height:0">&nbsp;</td>
            </tr>
            <tr>
              <td class="email-header" style="padding:25px 42px;border-bottom:1px solid #e5dfd5">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="left" valign="middle">
                      <a href="${safeOrigin}" style="color:#20211e;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:400;letter-spacing:-1px;line-height:1;text-decoration:none">Frame<span style="color:#8d3e46">.</span></a>
                    </td>
                    <td align="right" valign="middle" style="color:#66645e;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:.12em;line-height:1.4;text-transform:uppercase">
                      <span style="color:#8d3e46;font-size:15px;vertical-align:-1px">&#10003;</span>&nbsp;&nbsp;Order confirmed
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="email-content" style="padding:50px 42px 48px">
                <p style="margin:0 0 15px;color:#8d3e46;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:.16em;line-height:1.4;text-transform:uppercase">${sandbox ? "Sandbox &middot; " : ""}Pre-order ${safeOrderNumber}</p>
                <h1 class="email-heading" style="margin:0;color:#20211e;font-family:Georgia,'Times New Roman',serif;font-size:44px;font-weight:400;letter-spacing:-1.3px;line-height:1.04">Your Frame pre-order is confirmed.</h1>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:25px 0 25px"><tr><td width="42" height="2" bgcolor="#8d3e46" style="width:42px;height:2px;background:#8d3e46;font-size:0;line-height:0">&nbsp;</td></tr></table>
                <p style="margin:0 0 34px;color:#4f504b;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.7">Hello ${escapeHtml(input.fullName)}. We’ve received your payment and reserved your place in the pre-order queue. We’ll keep you informed as Frame moves toward shipping.</p>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f3efe6" style="width:100%;background:#f3efe6;border:1px solid #e4ddd1">
                  <tr>
                    <td class="email-summary" style="padding:28px 28px 26px">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td style="padding:0 0 20px;border-bottom:1px solid #d8d1c5">
                            <p style="margin:0 0 5px;color:#74716a;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:.14em;line-height:1.4;text-transform:uppercase">Order summary</p>
                            <p style="margin:0;color:#20211e;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.2">Frame wearable</p>
                          </td>
                          <td align="right" valign="bottom" style="padding:0 0 20px;border-bottom:1px solid #d8d1c5;color:#4f504b;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.4">Qty ${input.quantity}</td>
                        </tr>
                        <tr>
                          <td style="padding:20px 0 7px;color:#5d5d57;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.45">Product subtotal</td>
                          <td align="right" style="padding:20px 0 7px;color:#20211e;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.45">${escapeHtml(subtotal)}</td>
                        </tr>
                        <tr>
                          <td style="padding:7px 0;color:#5d5d57;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.45">Shipping</td>
                          <td align="right" style="padding:7px 0;color:#20211e;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.45">${escapeHtml(shippingAmount)}</td>
                        </tr>
                        <tr>
                          <td style="padding:7px 0 20px;color:#5d5d57;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.45">Sales tax</td>
                          <td align="right" style="padding:7px 0 20px;color:#20211e;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.45">${escapeHtml(taxAmount)}</td>
                        </tr>
                        <tr>
                          <td style="padding:18px 0 0;border-top:1px solid #d8d1c5;color:#20211e;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;line-height:1.45">Total paid</td>
                          <td align="right" style="padding:18px 0 0;border-top:1px solid #d8d1c5;color:#20211e;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.2">${escapeHtml(amount)}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:16px 0 0;border:1px solid #ded8ce">
                  <tr>
                    <td class="email-delivery" style="padding:24px 28px">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td class="email-primary-column" width="56%" valign="top">
                            <p style="margin:0 0 7px;color:#74716a;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:.14em;line-height:1.4;text-transform:uppercase">Estimated shipping</p>
                            <p style="margin:0;color:#8d3e46;font-family:Georgia,'Times New Roman',serif;font-size:29px;line-height:1.15">${escapeHtml(input.estimatedShipping)}</p>
                          </td>
                          <td class="email-secondary-column email-mobile-left" width="44%" align="right" valign="top">
                            <p style="margin:0 0 7px;color:#74716a;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:.14em;line-height:1.4;text-transform:uppercase">Order placed</p>
                            <p style="margin:0;color:#20211e;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5">${escapeHtml(placedAt)}</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                ${sandbox ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f8ebed" style="width:100%;margin:16px 0 0;background:#f8ebed;border-left:3px solid #8d3e46"><tr><td style="padding:14px 17px;color:#4f504b;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.55"><strong style="color:#20211e">Sandbox order.</strong> No live charge was made.</td></tr></table>` : ""}

                ${safeManageUrl ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:30px 0 37px"><tr><td bgcolor="#20211e" style="background:#20211e"><a class="email-button-link" href="${safeManageUrl}" style="display:inline-block;padding:15px 22px;color:#fffdf8;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;letter-spacing:.01em;line-height:1.4;text-decoration:none">Manage your pre-order&nbsp;&nbsp;&rarr;</a></td></tr></table>` : '<div style="height:37px;line-height:37px">&nbsp;</div>'}

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-top:1px solid #e0dbd1">
                  <tr>
                    <td class="email-primary-column" width="50%" valign="top" style="padding:28px 18px 0 0">
                      <p style="margin:0 0 9px;color:#20211e;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:.08em;line-height:1.4;text-transform:uppercase">Shipping address</p>
                      <p style="margin:0;color:#5e5e58;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.65">${shippingHtml}</p>
                    </td>
                    <td class="email-secondary-column email-mobile-left" width="50%" align="right" valign="top" style="padding:28px 0 0 18px">
                      <p style="margin:0 0 9px;color:#20211e;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:.08em;line-height:1.4;text-transform:uppercase">What happens next</p>
                      <p style="margin:0;color:#5e5e58;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.65">We’ll email you if the shipping estimate or product status changes.</p>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f7f4ee" style="width:100%;margin:36px 0 0;background:#f7f4ee;border-left:3px solid #a8a39a">
                  <tr>
                    <td style="padding:18px 20px;color:#5c5c56;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.65"><strong style="color:#20211e">Product status.</strong> Frame remains under development. It is not currently FDA cleared or approved and is not for medical decisions. You may cancel for a full refund before fulfilment begins. <a href="${escapeHtml(productStatusUrl)}" style="color:#8d3e46;text-decoration:underline">Read the product status</a>.</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="email-footer" bgcolor="#20211e" style="padding:30px 42px;background:#20211e;color:#b9b8b1;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.7">
                <p style="margin:0 0 11px;color:#fffdf8;font-family:Georgia,'Times New Roman',serif;font-size:20px;line-height:1">Frame<span style="color:#bd6871">.</span></p>
                <p style="margin:0 0 8px">Questions? <a href="mailto:support@framewearable.com" style="color:#fffdf8;text-decoration:underline">support@framewearable.com</a></p>
                <p style="margin:0"><a href="${escapeHtml(termsUrl)}" style="color:#b9b8b1;text-decoration:underline">Pre-order terms</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;<a href="${escapeHtml(refundsUrl)}" style="color:#b9b8b1;text-decoration:underline">Cancellation &amp; refunds</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;<a href="${escapeHtml(productStatusUrl)}" style="color:#b9b8b1;text-decoration:underline">Product status</a></p>
                <p style="margin:14px 0 0;color:#8f8f89">This is a transactional email about pre-order ${safeOrderNumber}.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}

export async function sendPreorderConfirmationEmail(
  input: PreorderConfirmationEmailInput,
) {
  const deliveryKey =
    input.deliveryKey ?? `preorder-confirmation-${input.preorderId}`;
  const email = renderPreorderConfirmationEmail(input);

  return sendPreorderEmail({
    preorderId: input.preorderId,
    emailType: "order_confirmation",
    recipient: input.email,
    deliveryKey,
    ...email,
  });
}

export async function sendPreorderShippingEmail(input: {
  origin: string;
  preorderId: string;
  orderNumber: number;
  environment: PreorderEnvironment;
  email: string;
  fullName: string;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  managePath?: string | null;
}) {
  const orderNumber = formatPreorderNumber(input.orderNumber);
  const sandbox = input.environment === "test";
  const manageUrl = input.managePath ? `${input.origin}${input.managePath}` : null;
  const deliveryKey = `preorder-shipping-${input.preorderId}-${input.trackingNumber ?? "no-tracking"}`;
  const trackingText = [
    input.carrier ? `Carrier: ${input.carrier}` : null,
    input.trackingNumber ? `Tracking number: ${input.trackingNumber}` : null,
    input.trackingUrl ? `Track your shipment: ${input.trackingUrl}` : null,
  ].filter((value): value is string => Boolean(value));

  return sendPreorderEmail({
    preorderId: input.preorderId,
    emailType: "shipping_update",
    recipient: input.email,
    deliveryKey,
    subject: `${sandbox ? "[Sandbox] " : ""}Your Frame pre-order has shipped | ${orderNumber}`,
    text: [
      `Hello ${input.fullName},`,
      "",
      `Your Frame pre-order ${orderNumber} has shipped.`,
      ...trackingText,
      ...(manageUrl ? ["", `View your order: ${manageUrl}`] : []),
      "",
      "Support: support@framewearable.com",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#20211e;line-height:1.6">
        <p style="font-size:30px;font-family:Georgia,serif;margin-bottom:32px">Frame</p>
        <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#7b2937">${sandbox ? "Sandbox · " : ""}${escapeHtml(orderNumber)}</p>
        <h1 style="font-family:Georgia,serif;font-weight:400;font-size:38px;line-height:1.1">Your Frame has shipped.</h1>
        <p>Hello ${escapeHtml(input.fullName)}. Your pre-order is on its way.</p>
        <div style="background:#f3efe6;padding:20px 24px;margin:28px 0">
          ${input.carrier ? `<p style="margin:0 0 8px"><strong>Carrier:</strong> ${escapeHtml(input.carrier)}</p>` : ""}
          ${input.trackingNumber ? `<p style="margin:0"><strong>Tracking number:</strong> ${escapeHtml(input.trackingNumber)}</p>` : ""}
        </div>
        ${input.trackingUrl ? `<p style="margin:30px 0"><a href="${escapeHtml(input.trackingUrl)}" style="display:inline-block;background:#20211e;color:#faf8f2;padding:13px 20px;text-decoration:none">Track shipment</a></p>` : ""}
        ${manageUrl ? `<p><a href="${escapeHtml(manageUrl)}">View your order</a></p>` : ""}
        <p style="color:#686a63">Questions? Contact support@framewearable.com.</p>
      </div>
    `,
  });
}

export async function sendPreorderOwnerActionEmail(input: {
  origin: string;
  preorderId: string;
  orderNumber: number;
  environment: PreorderEnvironment;
  fullName: string;
  customerEmail: string;
  requestType: "cancellation" | "address_change";
  reason: string | null;
  requestedAddress?: Record<string, unknown> | null;
  deliveryKey: string;
}) {
  const recipient = await preorderOperationsRecipient();
  if (!recipient) {
    throw new Error("Pre-order operations email is not configured yet.");
  }
  const orderNumber = formatPreorderNumber(input.orderNumber);
  const sandbox = input.environment === "test";
  const requestLabel =
    input.requestType === "cancellation"
      ? "cancellation request"
      : "shipping-address change";
  const ownerUrl = `${input.origin}/admin/preorders/${input.preorderId}`;
  const requestedAddress = input.requestedAddress
    ? addressLines(input.requestedAddress)
    : [];

  return sendPreorderEmail({
    preorderId: input.preorderId,
    emailType: "owner_action_required",
    recipient,
    deliveryKey: input.deliveryKey,
    subject: `${sandbox ? "[Sandbox] " : ""}Action required: ${requestLabel} | ${orderNumber}`,
    text: [
      `Customer action required for ${orderNumber}.`,
      `Request: ${requestLabel}`,
      `Customer: ${input.fullName} (${input.customerEmail})`,
      ...(input.reason ? [`Reason: ${input.reason}`] : []),
      ...(requestedAddress.length ? ["", "Requested address:", ...requestedAddress] : []),
      ...(input.requestType === "cancellation"
        ? ["", "Policy deadline: submit the full refund within seven working days of cancellation."]
        : []),
      "",
      `Review order: ${ownerUrl}`,
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#20211e;line-height:1.6">
        <p style="font-size:30px;font-family:Georgia,serif;margin-bottom:32px">Frame</p>
        <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#7b2937">${sandbox ? "Sandbox · " : ""}${escapeHtml(orderNumber)}</p>
        <h1 style="font-family:Georgia,serif;font-weight:400;font-size:38px;line-height:1.1">Customer action required.</h1>
        <p><strong>${escapeHtml(input.fullName)}</strong> submitted a ${escapeHtml(requestLabel)}.</p>
        ${input.reason ? `<p><strong>Reason:</strong> ${escapeHtml(input.reason)}</p>` : ""}
        ${requestedAddress.length ? `<p><strong>Requested address</strong><br>${requestedAddress.map(escapeHtml).join("<br>")}</p>` : ""}
        ${input.requestType === "cancellation" ? '<p style="padding:16px;border-left:4px solid #7b2937;background:#f7ecee"><strong>Refund required.</strong> Submit the full remaining refund within seven working days of cancellation.</p>' : ""}
        <p style="margin:30px 0"><a href="${escapeHtml(ownerUrl)}" style="display:inline-block;background:#20211e;color:#faf8f2;padding:13px 20px;text-decoration:none">Review order</a></p>
      </div>
    `,
  });
}

export async function sendPreorderAddressChangeResolutionEmail(input: {
  origin: string;
  preorderId: string;
  orderNumber: number;
  environment: PreorderEnvironment;
  email: string;
  fullName: string;
  approved: boolean;
  resolutionNote: string | null;
  shippingAddress: Record<string, unknown>;
  managePath: string;
  resolutionVersion: string;
}) {
  const orderNumber = formatPreorderNumber(input.orderNumber);
  const sandbox = input.environment === "test";
  const manageUrl = `${input.origin}${input.managePath}`;
  const shipping = addressLines(input.shippingAddress);
  return sendPreorderEmail({
    preorderId: input.preorderId,
    emailType: "address_change_resolved",
    recipient: input.email,
    deliveryKey: `preorder-address-change-${input.approved ? "approved" : "declined"}-${input.preorderId}-${input.resolutionVersion}`,
    subject: `${sandbox ? "[Sandbox] " : ""}Shipping-address update | ${orderNumber}`,
    text: [
      `Hello ${input.fullName},`,
      "",
      input.approved
        ? `The shipping address for ${orderNumber} has been updated.`
        : `We could not apply the requested shipping-address change for ${orderNumber}.`,
      ...(input.resolutionNote ? [`Note: ${input.resolutionNote}`] : []),
      ...(input.approved ? ["", "Shipping address:", ...shipping] : []),
      "",
      `View your order: ${manageUrl}`,
      "Support: support@framewearable.com",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#20211e;line-height:1.6">
        <p style="font-size:30px;font-family:Georgia,serif;margin-bottom:32px">Frame</p>
        <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#7b2937">${sandbox ? "Sandbox · " : ""}${escapeHtml(orderNumber)}</p>
        <h1 style="font-family:Georgia,serif;font-weight:400;font-size:38px;line-height:1.1">${input.approved ? "Your shipping address is updated." : "Your address request needs another step."}</h1>
        <p>Hello ${escapeHtml(input.fullName)}. ${input.approved ? "We’ve applied the address you requested." : "We could not apply the requested change."}</p>
        ${input.resolutionNote ? `<p><strong>Note:</strong> ${escapeHtml(input.resolutionNote)}</p>` : ""}
        ${input.approved ? `<p><strong>Shipping address</strong><br>${shipping.map(escapeHtml).join("<br>")}</p>` : ""}
        <p style="margin:30px 0"><a href="${escapeHtml(manageUrl)}" style="display:inline-block;background:#20211e;color:#faf8f2;padding:13px 20px;text-decoration:none">View your order</a></p>
        <p style="color:#686a63">Questions? Contact support@framewearable.com.</p>
      </div>
    `,
  });
}

export async function sendPreorderDeliveryUpdateEmail(input: {
  origin: string;
  preorderId: string;
  orderNumber: number;
  environment: PreorderEnvironment;
  email: string;
  fullName: string;
  previousEstimate: string;
  currentEstimate: string;
  message: string;
  noticeType: PreorderDeliveryNoticeType;
  responseMode: PreorderDeliveryResponseMode;
  responseDeadline: string | null;
  managePath: string;
  deliveryUpdateVersion: number;
}) {
  const orderNumber = formatPreorderNumber(input.orderNumber);
  const sandbox = input.environment === "test";
  const manageUrl = `${input.origin}${input.managePath}`;
  const materialChange = input.noticeType === "material_product_change";
  const responseDeadline = input.responseDeadline
    ? new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "UTC",
        timeZoneName: "short",
      }).format(new Date(input.responseDeadline))
    : null;
  const responseInstruction =
    input.responseMode === "silence_is_consent"
      ? "This is the first delay and the definite revised shipping date is no more than 30 days later. If you do not respond before we ship, we will treat your silence as consent to this short delay. You may cancel before fulfilment begins."
      : `Please affirmatively accept by ${responseDeadline}. If you do not accept by that deadline, we will automatically cancel the unshipped order and refund the full amount to your original payment method.`;
  const heading = materialChange
    ? "A proposed change to your Frame pre-order."
    : "An update to your estimated shipping.";
  return sendPreorderEmail({
    preorderId: input.preorderId,
    emailType: "delivery_update",
    recipient: input.email,
    deliveryKey: `preorder-delivery-update-${input.preorderId}-${input.deliveryUpdateVersion}`,
    subject: `${sandbox ? "[Sandbox] " : ""}${materialChange ? "Action required: proposed Frame product change" : "Shipping estimate update for your Frame pre-order"} | ${orderNumber}`,
    text: [
      `Hello ${input.fullName},`,
      "",
      materialChange
        ? `We are proposing a material change to ${orderNumber}.`
        : `The estimated shipping timing for ${orderNumber} has changed.`,
      ...(materialChange
        ? []
        : [
            `Previous estimate: ${input.previousEstimate}`,
            `Current estimate: ${input.currentEstimate}`,
          ]),
      `Update: ${input.message}`,
      "",
      materialChange
        ? "You can accept the proposed product change or cancel for a full refund of the unshipped order."
        : "You can accept the updated estimate or cancel for a full refund of the unshipped order.",
      responseInstruction,
      `Review and respond: ${manageUrl}`,
      "Support: support@framewearable.com",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#20211e;line-height:1.6">
        <p style="font-size:30px;font-family:Georgia,serif;margin-bottom:32px">Frame</p>
        <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#7b2937">${sandbox ? "Sandbox · " : ""}${escapeHtml(orderNumber)}</p>
        <h1 style="font-family:Georgia,serif;font-weight:400;font-size:38px;line-height:1.1">${escapeHtml(heading)}</h1>
        <p>Hello ${escapeHtml(input.fullName)}. ${materialChange ? "We are proposing a material change to your Frame pre-order." : "The estimated shipping timing for your Frame pre-order has changed."}</p>
        ${materialChange ? "" : `<div style="background:#f3efe6;padding:20px 24px;margin:28px 0"><p style="margin:0 0 8px"><strong>Previous:</strong> ${escapeHtml(input.previousEstimate)}</p><p style="margin:0"><strong>Current:</strong> ${escapeHtml(input.currentEstimate)}</p></div>`}
        <p>${escapeHtml(input.message)}</p>
        <p style="padding:16px;border-left:4px solid #7b2937;background:#f7ecee">${escapeHtml(responseInstruction)}</p>
        <p style="margin:30px 0"><a href="${escapeHtml(manageUrl)}" style="display:inline-block;background:#20211e;color:#faf8f2;padding:13px 20px;text-decoration:none">Review and respond</a></p>
        <p style="color:#686a63">You can accept the change or cancel for a full refund of the unshipped order from your order page.</p>
      </div>
    `,
  });
}

export async function sendPreorderRefundUpdateEmail(input: {
  origin: string;
  preorderId: string;
  orderNumber: number;
  environment: PreorderEnvironment;
  email: string;
  fullName: string;
  amountRefunded: number;
  currency: string;
  status: "processing" | "completed";
  managePath: string;
}) {
  const orderNumber = formatPreorderNumber(input.orderNumber);
  const amount = formatPreorderMoney(input.amountRefunded, input.currency);
  const sandbox = input.environment === "test";
  const manageUrl = `${input.origin}${input.managePath}`;
  const completed = input.status === "completed";
  return sendPreorderEmail({
    preorderId: input.preorderId,
    emailType: "refund_update",
    recipient: input.email,
    deliveryKey: `preorder-refund-${input.status}-${input.preorderId}-${input.amountRefunded}`,
    subject: `${sandbox ? "[Sandbox] " : ""}${completed ? "Refund completed" : "Refund started"} | ${orderNumber}`,
    text: [
      `Hello ${input.fullName},`,
      "",
      completed
        ? `Your ${amount} refund for ${orderNumber} has been completed in Stripe.`
        : `We have started a ${amount} refund for ${orderNumber}.`,
      ...(completed ? [] : ["Your bank may take additional time to display the credit."]),
      "",
      `View your order: ${manageUrl}`,
      "Support: support@framewearable.com",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#20211e;line-height:1.6">
        <p style="font-size:30px;font-family:Georgia,serif;margin-bottom:32px">Frame</p>
        <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#7b2937">${sandbox ? "Sandbox · " : ""}${escapeHtml(orderNumber)}</p>
        <h1 style="font-family:Georgia,serif;font-weight:400;font-size:38px;line-height:1.1">${completed ? "Your refund is complete." : "Your refund has started."}</h1>
        <p>Hello ${escapeHtml(input.fullName)}. ${completed ? `Stripe has completed a refund of ${escapeHtml(amount)}.` : `We’ve started a refund of ${escapeHtml(amount)}.`}</p>
        ${completed ? "" : '<p style="color:#686a63">Your bank may take additional time to display the credit.</p>'}
        <p style="margin:30px 0"><a href="${escapeHtml(manageUrl)}" style="display:inline-block;background:#20211e;color:#faf8f2;padding:13px 20px;text-decoration:none">View your order</a></p>
        <p style="color:#686a63">Questions? Contact support@framewearable.com.</p>
      </div>
    `,
  });
}

export async function sendPreorderEmailChangeVerificationEmail(input: {
  origin: string;
  preorderId: string;
  orderNumber: number;
  environment: PreorderEnvironment;
  fullName: string;
  newEmail: string;
  verificationToken: string;
  deliveryKey: string;
}) {
  const orderNumber = formatPreorderNumber(input.orderNumber);
  const sandbox = input.environment === "test";
  const verificationUrl = `${input.origin}/api/preorders/manage/email-change?token=${encodeURIComponent(input.verificationToken)}`;
  return sendPreorderEmail({
    preorderId: input.preorderId,
    emailType: "email_change_verification",
    recipient: input.newEmail,
    deliveryKey: input.deliveryKey,
    subject: `${sandbox ? "[Sandbox] " : ""}Verify your Frame order email | ${orderNumber}`,
    text: [
      `Hello ${input.fullName},`,
      "",
      `Use the secure link below within 30 minutes to make this the order email for ${orderNumber}:`,
      verificationUrl,
      "",
      "If you did not request this change, ignore this email. Your order email will stay the same.",
      "Support: support@framewearable.com",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#20211e;line-height:1.6">
        <p style="font-size:30px;font-family:Georgia,serif;margin-bottom:32px">Frame</p>
        <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#7b2937">${sandbox ? "Sandbox · " : ""}${escapeHtml(orderNumber)}</p>
        <h1 style="font-family:Georgia,serif;font-weight:400;font-size:38px;line-height:1.1">Verify your new order email.</h1>
        <p>Hello ${escapeHtml(input.fullName)}. Confirm this address within 30 minutes to use it for essential updates about ${escapeHtml(orderNumber)}.</p>
        <p style="margin:30px 0"><a href="${escapeHtml(verificationUrl)}" style="display:inline-block;background:#20211e;color:#faf8f2;padding:13px 20px;text-decoration:none">Verify email address</a></p>
        <p style="color:#686a63">If you did not request this change, ignore this email. Your order email will stay the same.</p>
      </div>
    `,
  });
}

export async function sendPreorderEmailChangeNotice(input: {
  origin: string;
  preorderId: string;
  orderNumber: number;
  environment: PreorderEnvironment;
  fullName: string;
  recipient: string;
  previousEmail: string;
  newEmail: string;
  managePath: string | null;
  audience: "previous" | "new";
  deliveryKey: string;
}) {
  const orderNumber = formatPreorderNumber(input.orderNumber);
  const sandbox = input.environment === "test";
  const isPrevious = input.audience === "previous";
  const manageUrl = input.managePath ? `${input.origin}${input.managePath}` : null;
  const heading = isPrevious
    ? "Your Frame order email was changed."
    : "Your order email is verified.";
  const detail = isPrevious
    ? `The order email for ${orderNumber} was changed from ${input.previousEmail} to ${input.newEmail}.`
    : `${input.newEmail} will now receive essential updates for ${orderNumber}.`;
  return sendPreorderEmail({
    preorderId: input.preorderId,
    emailType: "email_change_notice",
    recipient: input.recipient,
    deliveryKey: input.deliveryKey,
    subject: `${sandbox ? "[Sandbox] " : ""}${heading} | ${orderNumber}`,
    text: [
      `Hello ${input.fullName},`,
      "",
      detail,
      ...(isPrevious
        ? ["If you did not make this change, contact support immediately."]
        : manageUrl
          ? [`Manage your order: ${manageUrl}`]
          : []),
      "",
      "Support: support@framewearable.com",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#20211e;line-height:1.6">
        <p style="font-size:30px;font-family:Georgia,serif;margin-bottom:32px">Frame</p>
        <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#7b2937">${sandbox ? "Sandbox · " : ""}${escapeHtml(orderNumber)}</p>
        <h1 style="font-family:Georgia,serif;font-weight:400;font-size:38px;line-height:1.1">${escapeHtml(heading)}</h1>
        <p>Hello ${escapeHtml(input.fullName)}. ${escapeHtml(detail)}</p>
        ${isPrevious ? '<p style="padding:16px;border-left:4px solid #7b2937;background:#f7ecee"><strong>Didn’t make this change?</strong> Contact support@framewearable.com immediately.</p>' : manageUrl ? `<p style="margin:30px 0"><a href="${escapeHtml(manageUrl)}" style="display:inline-block;background:#20211e;color:#faf8f2;padding:13px 20px;text-decoration:none">Manage your pre-order</a></p>` : ""}
      </div>
    `,
  });
}
