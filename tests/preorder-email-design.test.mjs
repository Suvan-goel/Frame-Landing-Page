import assert from "node:assert/strict";
import test from "node:test";
import { renderPreorderConfirmationEmail } from "../lib/preorder-email.server.ts";

const confirmation = {
  origin: "https://framewearable.com",
  preorderId: "preorder-preview",
  orderNumber: 1042,
  environment: "live",
  email: "alex@example.com",
  fullName: "Alex Morgan",
  amountSubtotal: 49900,
  amountShipping: 1500,
  amountTax: 4117,
  amountTotal: 55517,
  currency: "usd",
  quantity: 1,
  placedAt: "2026-08-08T10:30:00.000Z",
  estimatedShipping: "Q2 2027",
  shippingAddress: {
    line1: "123 Mercer Street",
    line2: "Apt 4B",
    city: "New York",
    state: "NY",
    postal_code: "10012",
    country: "US",
  },
  managePath: "/preorder/manage/example-token",
};

test("renders the pre-order confirmation as a responsive transactional receipt", () => {
  const rendered = renderPreorderConfirmationEmail(confirmation);

  assert.equal(
    rendered.subject,
    "Frame pre-order confirmation | FR-001042",
  );
  assert.match(rendered.html, /^<!doctype html>/);
  assert.match(rendered.html, /Payment received for Frame pre-order FR-001042/);
  assert.match(rendered.html, /@media only screen and \(max-width: 620px\)/);
  assert.match(rendered.html, /class="email-card"/);
  assert.match(rendered.html, /Order confirmed/);
  assert.match(rendered.html, />Order summary</);
  assert.match(rendered.html, />Total paid</);
  assert.match(rendered.html, />\$555\.17</);
  assert.match(rendered.html, />Q2 2027</);
  assert.match(rendered.html, /Manage your pre-order/);
  assert.match(rendered.html, /This is a transactional email/);
  assert.match(rendered.text, /Shipping address:\n123 Mercer Street/);
});

test("escapes customer-controlled confirmation details", () => {
  const rendered = renderPreorderConfirmationEmail({
    ...confirmation,
    fullName: "Alex <script>alert('name')</script>",
    estimatedShipping: "Q2 <img src=x onerror=alert(1)>",
    shippingAddress: {
      line1: "<script>alert('address')</script>",
      city: "New York",
    },
    managePath: '/preorder/manage/token?value="><script>alert(1)</script>',
  });

  assert.doesNotMatch(rendered.html, /<script>alert/);
  assert.doesNotMatch(rendered.html, /<img src=x/);
  assert.match(rendered.html, /Alex &lt;script&gt;alert\(&#039;name&#039;\)&lt;\/script&gt;/);
  assert.match(rendered.html, /&lt;script&gt;alert\(&#039;address&#039;\)&lt;\/script&gt;/);
  assert.match(rendered.html, /value=&quot;&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test("labels sandbox confirmations without changing the receipt structure", () => {
  const rendered = renderPreorderConfirmationEmail({
    ...confirmation,
    environment: "test",
  });

  assert.match(rendered.subject, /^\[Sandbox\]/);
  assert.match(rendered.html, /Sandbox &middot;/);
  assert.match(rendered.html, /No live charge was made/);
  assert.match(rendered.text, /Sandbox order: no live charge was made/);
});
