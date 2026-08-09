import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { renderContributorWelcomeEmail } from "../lib/contributor-email.server.ts";
import {
  renderPreorderAddressChangeResolutionEmail,
  renderPreorderDeliveryUpdateEmail,
  renderPreorderOwnerActionEmail,
  renderPreorderRefundUpdateEmail,
  renderPreorderShippingEmail,
} from "../lib/preorder-email-preview-renderers.server.ts";

const preorder = {
  origin: "https://framewearable.com",
  preorderId: "preview-order",
  orderNumber: 1042,
  environment: "live",
  email: "alex.morgan@example.com",
  fullName: "Alex Morgan",
  managePath: "/preorder/manage?token=preview",
};

const address = {
  line1: "24 High Street",
  line2: "Flat 3",
  city: "London",
  state: "Greater London",
  postal_code: "SW1A 1AA",
  country: "GB",
};

function automatedEmails() {
  return [
    renderPreorderShippingEmail({
      ...preorder,
      carrier: "Royal Mail",
      trackingNumber: "FRM83920471GB",
      trackingUrl: "https://www.royalmail.com/track-your-item",
    }),
    renderPreorderOwnerActionEmail({
      ...preorder,
      customerEmail: preorder.email,
      requestType: "address_change",
      reason: "Moving before the expected shipping date.",
      requestedAddress: address,
      deliveryKey: "preview-owner-action",
    }),
    renderPreorderAddressChangeResolutionEmail({
      ...preorder,
      approved: true,
      resolutionNote: "The new address is now saved to your order.",
      shippingAddress: address,
      resolutionVersion: "preview-approved",
    }),
    renderPreorderAddressChangeResolutionEmail({
      ...preorder,
      approved: false,
      resolutionNote: "Please contact support so we can verify the new address.",
      shippingAddress: address,
      resolutionVersion: "preview-declined",
    }),
    renderPreorderDeliveryUpdateEmail({
      ...preorder,
      previousEstimate: "Q2 2027",
      currentEstimate: "Q3 2027",
      message: "Component validation is taking longer than planned.",
      deliveryUpdateVersion: 1,
    }),
    renderPreorderRefundUpdateEmail({
      ...preorder,
      amountRefunded: 32292,
      currency: "usd",
      status: "processing",
    }),
    renderPreorderRefundUpdateEmail({
      ...preorder,
      amountRefunded: 32292,
      currency: "usd",
      status: "completed",
    }),
    renderContributorWelcomeEmail({
      origin: preorder.origin,
      email: "jamie.lee@example.com",
      fullName: "Jamie Lee",
      contributorNumber: 117,
      paidAt: "2026-08-08T09:36:00.000Z",
      accessExpiresAt: "2027-08-08T09:36:00.000Z",
    }),
  ];
}

test("gives every automated email the Frame transactional design system", () => {
  for (const rendered of automatedEmails()) {
    assert.match(rendered.html, /^<!doctype html>/);
    assert.match(rendered.html, /class="email-card"/);
    assert.match(rendered.html, /class="email-header"/);
    assert.match(rendered.html, /class="email-heading"/);
    assert.match(rendered.html, /class="email-footer"/);
    assert.match(rendered.html, /@media only screen and \(max-width: 620px\)/);
    assert.match(rendered.html, /background:#eee9df/);
    assert.match(rendered.html, /Frame<span style="color:#8d3e46">\.<\/span>/);
    assert.match(rendered.html, /support@framewearable\.com/);
  }
});
test("escapes customer-controlled content in the shared email layout", () => {
  const rendered = renderPreorderShippingEmail({
    ...preorder,
    fullName: "Alex <script>alert('name')</script>",
    carrier: "<img src=x onerror=alert(1)>",
    trackingNumber: "FRM<unsafe>",
    trackingUrl: "https://example.com/track?value=\"unsafe\"",
  });

  assert.doesNotMatch(rendered.html, /<script>alert/);
  assert.doesNotMatch(rendered.html, /<img src=x/);
  assert.match(rendered.html, /Alex &lt;script&gt;alert\(&#039;name&#039;\)&lt;\/script&gt;/);
  assert.match(rendered.html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(rendered.html, /FRM&lt;unsafe&gt;/);
  assert.match(rendered.html, /value=&quot;unsafe&quot;/);
});

test("uses the shared design for every live automated preorder delivery", async () => {
  const source = await readFile(
    new URL("../lib/preorder-email.server.ts", import.meta.url),
    "utf8",
  );
  const functions = [
    "sendPreorderShippingEmail",
    "sendPreorderOwnerActionEmail",
    "sendPreorderAddressChangeResolutionEmail",
    "sendPreorderDeliveryUpdateEmail",
    "sendPreorderRefundUpdateEmail",
    "sendPreorderEmailChangeVerificationEmail",
    "sendPreorderEmailChangeNotice",
  ];

  for (const [index, name] of functions.entries()) {
    const start = source.indexOf(`export async function ${name}`);
    const next =
      index === functions.length - 1
        ? source.length
        : source.indexOf(`export async function ${functions[index + 1]}`);
    assert.notEqual(start, -1, `${name} should exist`);
    assert.match(source.slice(start, next), /renderFrameTransactionalEmail\(/);
  }
});
