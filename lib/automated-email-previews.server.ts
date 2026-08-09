import {
  renderPreorderConfirmationEmail,
} from "./preorder-email.server";
import {
  renderPreorderAddressChangeResolutionEmail,
  renderPreorderDeliveryUpdateEmail,
  renderPreorderOwnerActionEmail,
  renderPreorderRefundUpdateEmail,
  renderPreorderShippingEmail,
  type RenderedAutomatedEmail,
} from "./preorder-email-preview-renderers.server";
import { renderContributorWelcomeEmail } from "./contributor-email.server";
import { SUPPORT_EMAIL } from "./company";
import { getRuntimeValue } from "./runtime-env.server";
import type {
  AutomatedEmailPreview,
  AutomatedEmailPreviewId,
} from "./automated-email-previews";

const SAMPLE_PREORDER = {
  origin: "https://framewearable.com",
  preorderId: "preview-order",
  orderNumber: 1042,
  environment: "live" as const,
  email: "alex.morgan@example.com",
  fullName: "Alex Morgan",
  managePath: "/preorder/manage?token=preview",
};

function extractLinks(html: string) {
  const links = [...html.matchAll(/href=["']([^"']+)["']/g)].map(
    (match) => match[1],
  );
  return [...new Set(links)];
}

function operationsRecipient(value: string | null, admins: string | null) {
  if (value?.trim()) return value.trim().toLowerCase();
  return (
    admins
      ?.split(",")
      .map((email) => email.trim().toLowerCase())
      .find(Boolean) ?? null
  );
}

function preview(input: {
  id: AutomatedEmailPreviewId;
  name: string;
  category: AutomatedEmailPreview["category"];
  categoryLabel: string;
  description: string;
  trigger: string;
  audience: string;
  recipientExample: string;
  from: string;
  email: RenderedAutomatedEmail;
  configured: boolean;
  configurationLabel: string;
}): AutomatedEmailPreview {
  return {
    id: input.id,
    name: input.name,
    category: input.category,
    categoryLabel: input.categoryLabel,
    description: input.description,
    trigger: input.trigger,
    audience: input.audience,
    recipientExample: input.recipientExample,
    from: input.from,
    replyTo: SUPPORT_EMAIL,
    subject: input.email.subject,
    text: input.email.text,
    html: input.email.html,
    links: extractLinks(input.email.html),
    configured: input.configured,
    configurationLabel: input.configurationLabel,
  };
}

export async function getAutomatedEmailPreviews(
  origin = "https://framewearable.com",
): Promise<AutomatedEmailPreview[]> {
  const [apiKey, preorderFromValue, contributorFromValue, operationsValue, admins] =
    await Promise.all([
      getRuntimeValue("RESEND_API_KEY"),
      getRuntimeValue("PREORDER_FROM_EMAIL"),
      getRuntimeValue("CONTRIBUTOR_FROM_EMAIL"),
      getRuntimeValue("PREORDER_OPERATIONS_EMAIL"),
      getRuntimeValue("WAITLIST_ADMIN_EMAILS"),
    ]);
  const preorderFrom =
    preorderFromValue ?? "Frame Pre-orders <preorders@framewearable.com>";
  const contributorFrom =
    contributorFromValue ??
    "Frame Contributors <contributors@framewearable.com>";
  const operationsEmail = operationsRecipient(operationsValue, admins);
  const deliveryConfigured = Boolean(apiKey);
  const deliveryLabel = deliveryConfigured
    ? "Delivery configured"
    : "Resend API key missing";

  const preorderBase = { ...SAMPLE_PREORDER, origin };
  const address = {
    line1: "24 High Street",
    line2: "Flat 3",
    city: "London",
    state: "Greater London",
    postal_code: "SW1A 1AA",
    country: "GB",
  };

  return [
    preview({
      id: "preorder-confirmation",
      name: "Pre-order confirmation",
      category: "preorders",
      categoryLabel: "Pre-orders",
      description: "Receipt, shipping estimate, disclosures, and order-management link.",
      trigger: "A successful pre-order payment is recorded",
      audience: "Customer",
      recipientExample: preorderBase.email,
      from: preorderFrom,
      configured: deliveryConfigured,
      configurationLabel: deliveryLabel,
      email: renderPreorderConfirmationEmail({
        ...preorderBase,
        amountSubtotal: 29900,
        amountShipping: 0,
        amountTax: 2392,
        amountTotal: 32292,
        currency: "usd",
        quantity: 1,
        placedAt: "2026-08-08T09:36:00.000Z",
        estimatedShipping: "Q2 2027",
        shippingAddress: address,
      }),
    }),
    preview({
      id: "preorder-shipped",
      name: "Order shipped",
      category: "preorders",
      categoryLabel: "Pre-orders",
      description: "Carrier and tracking details after fulfilment begins.",
      trigger: "An administrator marks the order as shipped",
      audience: "Customer",
      recipientExample: preorderBase.email,
      from: preorderFrom,
      configured: deliveryConfigured,
      configurationLabel: deliveryLabel,
      email: renderPreorderShippingEmail({
        ...preorderBase,
        carrier: "Royal Mail",
        trackingNumber: "FRM83920471GB",
        trackingUrl: "https://www.royalmail.com/track-your-item",
      }),
    }),
    preview({
      id: "owner-action-required",
      name: "Customer action alert",
      category: "customer-actions",
      categoryLabel: "Customer actions",
      description: "Internal alert when a customer requests cancellation or an address change.",
      trigger: "A customer submits a cancellation or address-change request",
      audience: "Frame operations",
      recipientExample: operationsEmail ?? "Operations email not configured",
      from: preorderFrom,
      configured: deliveryConfigured && Boolean(operationsEmail),
      configurationLabel: !deliveryConfigured
        ? deliveryLabel
        : operationsEmail
          ? "Delivery configured"
          : "Operations recipient missing",
      email: renderPreorderOwnerActionEmail({
        ...preorderBase,
        customerEmail: preorderBase.email,
        requestType: "address_change",
        reason: "Moving before the expected shipping date.",
        requestedAddress: address,
        deliveryKey: "preview-owner-action",
      }),
    }),
    preview({
      id: "address-change-approved",
      name: "Address change approved",
      category: "customer-actions",
      categoryLabel: "Customer actions",
      description: "Confirms that the requested shipping address was updated.",
      trigger: "An administrator approves an address-change request",
      audience: "Customer",
      recipientExample: preorderBase.email,
      from: preorderFrom,
      configured: deliveryConfigured,
      configurationLabel: deliveryLabel,
      email: renderPreorderAddressChangeResolutionEmail({
        ...preorderBase,
        approved: true,
        resolutionNote: "The new address is now saved to your order.",
        shippingAddress: address,
        resolutionVersion: "preview-approved",
      }),
    }),
    preview({
      id: "address-change-declined",
      name: "Address change needs another step",
      category: "customer-actions",
      categoryLabel: "Customer actions",
      description: "Explains that a requested address change could not be applied.",
      trigger: "An administrator declines an address-change request",
      audience: "Customer",
      recipientExample: preorderBase.email,
      from: preorderFrom,
      configured: deliveryConfigured,
      configurationLabel: deliveryLabel,
      email: renderPreorderAddressChangeResolutionEmail({
        ...preorderBase,
        approved: false,
        resolutionNote: "Please contact support so we can verify the new address.",
        shippingAddress: address,
        resolutionVersion: "preview-declined",
      }),
    }),
    preview({
      id: "delivery-estimate-updated",
      name: "Shipping estimate changed",
      category: "preorders",
      categoryLabel: "Pre-orders",
      description: "Shows the previous and revised shipping estimate with response options.",
      trigger: "An administrator publishes a delivery-timing change",
      audience: "Customer",
      recipientExample: preorderBase.email,
      from: preorderFrom,
      configured: deliveryConfigured,
      configurationLabel: deliveryLabel,
      email: renderPreorderDeliveryUpdateEmail({
        ...preorderBase,
        previousEstimate: "Q2 2027",
        currentEstimate: "Q3 2027",
        message: "Component validation is taking longer than planned. We will update you again before production begins.",
        deliveryUpdateVersion: 1,
      }),
    }),
    preview({
      id: "refund-started",
      name: "Refund started",
      category: "preorders",
      categoryLabel: "Pre-orders",
      description: "Confirms the refunded amount while the bank processes the credit.",
      trigger: "A refund is submitted to Stripe",
      audience: "Customer",
      recipientExample: preorderBase.email,
      from: preorderFrom,
      configured: deliveryConfigured,
      configurationLabel: deliveryLabel,
      email: renderPreorderRefundUpdateEmail({
        ...preorderBase,
        amountRefunded: 32292,
        currency: "usd",
        status: "processing",
      }),
    }),
    preview({
      id: "refund-completed",
      name: "Refund completed",
      category: "preorders",
      categoryLabel: "Pre-orders",
      description: "Confirms that Stripe completed the customer refund.",
      trigger: "Stripe reports that the refund completed",
      audience: "Customer",
      recipientExample: preorderBase.email,
      from: preorderFrom,
      configured: deliveryConfigured,
      configurationLabel: deliveryLabel,
      email: renderPreorderRefundUpdateEmail({
        ...preorderBase,
        amountRefunded: 32292,
        currency: "usd",
        status: "completed",
      }),
    }),
    preview({
      id: "contributor-welcome",
      name: "Contributor welcome",
      category: "contributors",
      categoryLabel: "Contributors",
      description: "Membership confirmation, contributor number, access dates, and sign-in link.",
      trigger: "A Founding Contributor membership payment is recorded",
      audience: "Contributor",
      recipientExample: "jamie.lee@example.com",
      from: contributorFrom,
      configured: deliveryConfigured,
      configurationLabel: deliveryLabel,
      email: renderContributorWelcomeEmail({
        origin,
        email: "jamie.lee@example.com",
        fullName: "Jamie Lee",
        contributorNumber: 117,
        paidAt: "2026-08-08T09:36:00.000Z",
        accessExpiresAt: "2027-08-08T09:36:00.000Z",
      }),
    }),
  ];
}

export async function sendAutomatedEmailPreviewTest(input: {
  previewId: AutomatedEmailPreviewId;
  recipient: string;
  origin?: string;
}) {
  const [apiKey, previews] = await Promise.all([
    getRuntimeValue("RESEND_API_KEY"),
    getAutomatedEmailPreviews(input.origin),
  ]);
  if (!apiKey) throw new Error("Automated email delivery is not configured yet.");
  const selected = previews.find((item) => item.id === input.previewId);
  if (!selected) throw new Error("That automated email preview does not exist.");

  const banner = `
    <div style="max-width:640px;margin:0 auto 12px;padding:12px 16px;background:#20211e;color:#fff;font-family:Arial,sans-serif;font-size:12px;line-height:1.5">
      <strong>Administrator preview</strong><br>This test was sent only to ${input.recipient}. No customer event was created.
    </div>
  `;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: selected.from,
      to: [input.recipient],
      reply_to: SUPPORT_EMAIL,
      subject: `[TEST PREVIEW] ${selected.subject}`,
      text: `ADMINISTRATOR PREVIEW: no customer event was created.\n\n${selected.text}`,
      html: `${banner}${selected.html}`,
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Preview email failed: ${detail.slice(0, 240)}`);
  }
}
