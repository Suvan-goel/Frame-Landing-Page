import { getPreorderConfiguration } from "@/lib/preorder-config.server";
import { isPreorderLiveApproved } from "@/lib/preorder-access";
import {
  formatPreorderMoney,
  preorderStripeProductDescription,
  PREORDER_CHECKOUT_SESSION_TTL_SECONDS,
  PREORDER_MAX_QUANTITY,
  PREORDER_PRODUCT_STATUS_VERSION,
  PREORDER_RELEASE_PRICE_CENTS,
  PREORDER_SHIPPING_RATE_CENTS,
  PREORDER_STRIPE_PRODUCT_TAX_CODE,
  PREORDER_TERMS_VERSION,
} from "@/lib/preorder";
import {
  PreorderAvailabilityError,
  preorderEnvironmentForMode,
  releasePreorderCheckoutReservation,
  reservePreorderCheckout,
} from "@/lib/preorder-operations.server";
import {
  getPreorderMode,
  getRuntimeValue,
  isLocalPreorderPreview,
  isPreorderSalesRequestEnabled,
} from "@/lib/runtime-env.server";
import { consumePreorderRateLimit } from "@/lib/preorder-rate-limit.server";
import { getStripe, getStripePreorderPriceId } from "@/lib/stripe.server";
import { getSupabaseAdmin } from "@/lib/supabase-admin.server";
import { isAllowedPreorderUsState } from "@/lib/preorder-shipping";
import { SITE_URL } from "@/lib/site";
import { verifiedRequestOrigin } from "@/lib/request-origin.server";
import { cleanAttribution } from "@/lib/attribution";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8_192;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function cleanCustomerField(value: unknown, maximumLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, maximumLength);
}

function reviewedCustomer(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const customer = value as Record<string, unknown>;
  const addressValue = customer.shippingAddress;
  if (!addressValue || typeof addressValue !== "object" || Array.isArray(addressValue)) {
    return null;
  }
  const address = addressValue as Record<string, unknown>;
  const email = cleanCustomerField(customer.email, 254).toLowerCase();
  const fullName = cleanCustomerField(customer.fullName, 120);
  const line1 = cleanCustomerField(address.line1, 200);
  const line2 = cleanCustomerField(address.line2, 200);
  const city = cleanCustomerField(address.city, 100);
  const state = cleanCustomerField(address.state, 2).toUpperCase();
  const postalCode = cleanCustomerField(address.postalCode, 10).toUpperCase();
  const country = cleanCustomerField(address.country, 2).toUpperCase();

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    fullName.length < 2 ||
    line1.length < 3 ||
    city.length < 2 ||
    country !== "US" ||
    !isAllowedPreorderUsState(state) ||
    !/^\d{5}(?:-\d{4})?$/.test(postalCode)
  ) {
    return null;
  }

  return {
    email,
    fullName,
    shippingAddress: {
      line1,
      ...(line2 ? { line2 } : {}),
      city,
      state,
      postal_code: postalCode,
      country: "US" as const,
    },
  };
}

export async function POST(request: Request) {
  if (!(await isPreorderSalesRequestEnabled(request))) {
    return jsonResponse({ error: "Not found." }, 404);
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return jsonResponse({ error: "Request is too large." }, 413);
  }

  const requestOrigin = verifiedRequestOrigin(request);
  if (!requestOrigin) {
    return jsonResponse({ error: "Request origin is not allowed." }, 403);
  }

  let payload: {
    termsAcknowledged?: unknown;
    productStatusAcknowledged?: unknown;
    marketingOptIn?: unknown;
    quantity?: unknown;
    source?: unknown;
    utmSource?: unknown;
    utmMedium?: unknown;
    utmCampaign?: unknown;
    requestKey?: unknown;
    customer?: unknown;
  };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return jsonResponse({ error: "Review and acknowledge the pre-order details." }, 400);
  }

  if (payload.productStatusAcknowledged !== true) {
    return jsonResponse(
      { error: "Confirm that you understand Frame is still in development." },
      400,
    );
  }
  if (payload.termsAcknowledged !== true) {
    return jsonResponse({ error: "Accept the Pre-order Terms to continue." }, 400);
  }

  const customer = reviewedCustomer(payload.customer);
  if (!customer) {
    return jsonResponse(
      { error: "Enter a valid delivery address in one of the 50 states or Washington, DC." },
      400,
    );
  }

  const quantity = typeof payload.quantity === "number" ? payload.quantity : 1;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > PREORDER_MAX_QUANTITY) {
    return jsonResponse({ error: "Choose a valid pre-order quantity." }, 400);
  }

  if (await isLocalPreorderPreview(request)) {
    return jsonResponse({ url: `${requestOrigin}/preorder/success?preview=1` });
  }

  const requestKey =
    typeof payload.requestKey === "string" ? payload.requestKey.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestKey)) {
    return jsonResponse({ error: "Refresh the page and try again." }, 400);
  }

  try {
    const rateLimit = await consumePreorderRateLimit({
      request,
      scope: "preorder_checkout",
      limit: 8,
      windowSeconds: 10 * 60,
    });
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          error: "Too many checkout attempts. Please wait a few minutes and try again.",
        }),
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "Content-Type": "application/json; charset=utf-8",
            "Retry-After": String(rateLimit.retryAfterSeconds),
            "X-Content-Type-Options": "nosniff",
          },
        },
      );
    }
  } catch (error) {
    console.error("Pre-order checkout protection failed", error);
    return jsonResponse(
      { error: "Secure checkout is temporarily unavailable. Please try again shortly." },
      503,
    );
  }

  let reservedIntentId: string | null = null;
  let stripeSessionCreated = false;
  try {
    const mode = await getPreorderMode();
    const environment = preorderEnvironmentForMode(mode);
    if (!environment) {
      throw new Error("Pre-order Checkout is disabled.");
    }
    const [approvedTermsVersion, approvedProductStatusVersion] = await Promise.all([
      getRuntimeValue("PREORDER_LEGAL_APPROVED_VERSION"),
      getRuntimeValue("PREORDER_PRODUCT_STATUS_APPROVED_VERSION"),
    ]);
    if (
      mode === "live" &&
      !isPreorderLiveApproved({ mode, approvedTermsVersion, approvedProductStatusVersion })
    ) {
      throw new Error("Live pre-order Checkout is blocked until approved legal disclosures are active.");
    }
    const config = await getPreorderConfiguration();
    if (config.shippingRateCents !== PREORDER_SHIPPING_RATE_CENTS) {
      throw new Error("Pre-order shipping does not match the reviewed offer.");
    }
    const productPriceLabel = formatPreorderMoney(config.priceCents, config.currency);
    const releasePriceLabel = formatPreorderMoney(PREORDER_RELEASE_PRICE_CENTS, config.currency);
    const preorderSavingsLabel = formatPreorderMoney(
      PREORDER_RELEASE_PRICE_CENTS - config.priceCents,
      config.currency,
    );
    const shippingPriceLabel = formatPreorderMoney(config.shippingRateCents, config.currency);
    const totalBeforeTaxLabel = formatPreorderMoney(
      config.priceCents + config.shippingRateCents,
      config.currency,
    );
    const legalBaseUrl = mode === "test" ? requestOrigin : SITE_URL;
    const stripe = await getStripe(environment);
    const priceId = await getStripePreorderPriceId(environment);
    const price = await stripe.prices.retrieve(priceId, { expand: ["product"] });
    const product =
      typeof price.product === "string" || !price.product || price.product.deleted
        ? null
        : price.product;
    const expectedProductDescription = preorderStripeProductDescription({
      estimatedShipping: config.estimatedShipping,
      sandbox: mode === "test",
    });
    if (
      !price.active ||
      price.livemode !== (environment === "live") ||
      price.type !== "one_time" ||
      price.unit_amount !== config.priceCents ||
      price.currency !== config.currency ||
      price.tax_behavior !== "exclusive" ||
      !product?.active ||
      product.description !== expectedProductDescription ||
      product.tax_code !== PREORDER_STRIPE_PRODUCT_TAX_CODE
    ) {
      throw new Error("The Stripe pre-order product and price do not match the reviewed offer.");
    }

    const now = new Date();
    const marketingOptIn = payload.marketingOptIn === true;
    reservedIntentId = await reservePreorderCheckout({
      requestKey,
      environment,
      sku: config.sku,
      quantity,
      unitAmount: config.priceCents,
      currency: config.currency,
      estimatedDelivery: config.estimatedShipping,
      source: cleanAttribution(payload.source) ?? "preorder_review",
      utmSource: cleanAttribution(payload.utmSource),
      utmMedium: cleanAttribution(payload.utmMedium),
      utmCampaign: cleanAttribution(payload.utmCampaign),
      termsVersion: PREORDER_TERMS_VERSION,
      productStatusVersion: PREORDER_PRODUCT_STATUS_VERSION,
      termsAcceptedAt: now.toISOString(),
      productStatusAcknowledgedAt: now.toISOString(),
      marketingOptIn,
      marketingConsentAt: marketingOptIn ? now.toISOString() : null,
    });

    const supabase = await getSupabaseAdmin();
    const reservedIntent = await supabase
      .from("preorder_checkout_intents")
      .select("stripe_checkout_session_id, updated_at")
      .eq("id", reservedIntentId)
      .maybeSingle();
    if (reservedIntent.error) throw reservedIntent.error;
    if (!reservedIntent.data) {
      throw new Error("The pre-order checkout reservation could not be loaded.");
    }

    const existingSessionId = reservedIntent.data.stripe_checkout_session_id;
    if (typeof existingSessionId === "string" && existingSessionId) {
      stripeSessionCreated = true;
      const existingSession = await stripe.checkout.sessions.retrieve(existingSessionId);
      if (existingSession.status === "open" && existingSession.url) {
        return jsonResponse({ url: existingSession.url });
      }
      throw new Error("The existing Stripe Checkout session is no longer available.");
    }

    const reservationUpdatedAt = Date.parse(reservedIntent.data.updated_at);
    const sessionExpiresAt =
      Math.floor(
        (Number.isFinite(reservationUpdatedAt) ? reservationUpdatedAt : Date.now()) /
          1_000,
      ) + PREORDER_CHECKOUT_SESSION_TTL_SECONDS;

    const stripeCustomer = await stripe.customers.create(
      {
        email: customer.email,
        name: customer.fullName,
        shipping: {
          name: customer.fullName,
          address: customer.shippingAddress,
        },
        metadata: {
          flow: "frame_preorder",
          checkout_intent_id: reservedIntentId,
          environment,
        },
      },
      { idempotencyKey: `frame-preorder-customer-${reservedIntentId}` },
    );

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        adaptive_pricing: { enabled: false },
        payment_method_types: ["card"],
        branding_settings: {
          background_color: "#FAF8F2",
          border_style: "rectangular",
          button_color: "#20211E",
          display_name: mode === "test" ? "Frame sandbox" : "Frame",
          font_family: "inter",
          icon: { type: "url", url: `${SITE_URL}/favicon.png` },
        },
        line_items: [{ price: priceId, quantity }],
        client_reference_id: reservedIntentId,
        customer: stripeCustomer.id,
        customer_update: { address: "auto" },
        billing_address_collection: "required",
        shipping_options: [
          {
            shipping_rate_data: {
              type: "fixed_amount",
              display_name: "Standard US shipping & handling",
              fixed_amount: {
                amount: config.shippingRateCents,
                currency: config.currency,
              },
              tax_behavior: "exclusive",
            },
          },
        ],
        automatic_tax: { enabled: true },
        consent_collection: { terms_of_service: "required" },
        custom_text: {
          submit: {
            message:
              mode === "test"
                ? `Sandbox payment only. Your ${totalBeforeTaxLabel} total before tax includes the ${productPriceLabel} pre-order price and ${shippingPriceLabel} standard US shipping. The pre-order price is ${preorderSavingsLabel} below the planned ${releasePriceLabel} release price. Frame is still in development; shipping is estimated for ${config.estimatedShipping}.`
                : `Your ${totalBeforeTaxLabel} total before tax includes the ${productPriceLabel} pre-order price and ${shippingPriceLabel} standard US shipping. The pre-order price is ${preorderSavingsLabel} below the planned ${releasePriceLabel} release price. Frame is still in development; shipping is estimated for ${config.estimatedShipping}.`,
          },
          terms_of_service_acceptance: {
            message: `I agree to the [Frame Pre-order Terms](${legalBaseUrl}/preorder/terms) and [Cancellation and Refund Policy](${legalBaseUrl}/preorder/refunds).`,
          },
        },
        submit_type: "pay",
        allow_promotion_codes: false,
        metadata: {
          flow: "frame_preorder",
          checkout_intent_id: reservedIntentId,
          environment,
          terms_version: PREORDER_TERMS_VERSION,
          product_status_version: PREORDER_PRODUCT_STATUS_VERSION,
        },
        payment_intent_data: {
          description:
            mode === "test"
              ? "Frame device pre-order — sandbox"
              : "Frame device pre-order",
          metadata: {
            flow: "frame_preorder",
            checkout_intent_id: reservedIntentId,
            environment,
            terms_version: PREORDER_TERMS_VERSION,
            product_status_version: PREORDER_PRODUCT_STATUS_VERSION,
          },
        },
        expires_at: sessionExpiresAt,
        success_url: `${requestOrigin}/preorder/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${requestOrigin}/preorder/review?cancelled=1`,
      },
      { idempotencyKey: `frame-preorder-checkout-${reservedIntentId}` },
    );
    stripeSessionCreated = true;

    if (!session.url) throw new Error("Stripe did not return a secure Checkout URL.");
    const updated = await supabase
      .from("preorder_checkout_intents")
      .update({
        status: "checkout_open",
        stripe_checkout_session_id: session.id,
        stripe_customer_id: stripeCustomer.id,
        expires_at: new Date(session.expires_at * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", reservedIntentId);
    if (updated.error) throw updated.error;

    return jsonResponse({ url: session.url });
  } catch (error) {
    if (reservedIntentId && !stripeSessionCreated) {
      await releasePreorderCheckoutReservation(reservedIntentId);
    }
    console.error("Pre-order Checkout creation failed", error);
    if (error instanceof PreorderAvailabilityError) {
      const message =
        error.reason === "paused"
          ? "Pre-orders are temporarily paused. Please check back soon."
          : error.reason === "sold_out"
            ? "This pre-order allocation is currently full."
            : error.reason === "already_completed"
              ? "This checkout request has already been completed. Refresh the page to start again."
              : "Pre-order availability is temporarily unavailable. Please try again shortly.";
      return jsonResponse({ error: message }, 409);
    }
    return jsonResponse(
      {
        error:
          error instanceof Error &&
          (error.message.includes("configured") ||
            error.message.includes("disabled") ||
            error.message.includes("test mode") ||
            error.message.includes("reviewed offer"))
            ? error.message
            : "Secure payment is temporarily unavailable. Please try again shortly.",
      },
      503,
    );
  }
}
