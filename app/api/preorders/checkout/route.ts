import { getPreorderConfiguration } from "@/lib/preorder-config.server";
import { isPreorderLiveApproved } from "@/lib/preorder-access";
import {
  formatPreorderMoney,
  preorderStripeProductDescription,
  PREORDER_CHECKOUT_SESSION_TTL_SECONDS,
  PREORDER_DEFAULT_PRICE_CENTS,
  PREORDER_FOUNDING_PRICE_CENTS,
  PREORDER_MAX_QUANTITY,
  PREORDER_PRODUCT_STATUS_VERSION,
  PREORDER_REMAINING_BALANCE_CENTS,
  PREORDER_SHIPPING_RATE_CENTS,
  PREORDER_STRIPE_PRODUCT_IMAGE_URL,
  PREORDER_STRIPE_PRODUCT_NAME,
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
import { getStripe, getStripeReservationPriceId } from "@/lib/stripe.server";
import { getSupabaseAdmin } from "@/lib/supabase-admin.server";
import { SITE_URL } from "@/lib/site";
import { verifiedRequestOrigin } from "@/lib/request-origin.server";
import { cleanAttribution } from "@/lib/attribution";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8_192;
const STRIPE_CHECKOUT_INTEGRATION_IDENTIFIER = "frame_reservation_xkqvnjrt";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(request: Request) {
  if (!(await isPreorderSalesRequestEnabled(request))) {
    return jsonResponse({ error: "Not found." }, 404);
  }
  const liveSmokeRequest =
    request.headers.get("x-frame-preorder-live-smoke-request") === "1";

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return jsonResponse({ error: "Request is too large." }, 413);
  }

  const requestOrigin = verifiedRequestOrigin(request);
  if (!requestOrigin) {
    return jsonResponse({ error: "Request origin is not allowed." }, 403);
  }

  let payload: {
    marketingOptIn?: unknown;
    quantity?: unknown;
    source?: unknown;
    utmSource?: unknown;
    utmMedium?: unknown;
    utmCampaign?: unknown;
    requestKey?: unknown;
  };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return jsonResponse({ error: "Review your reservation details and try again." }, 400);
  }

  const quantity = typeof payload.quantity === "number" ? payload.quantity : 1;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > PREORDER_MAX_QUANTITY) {
    return jsonResponse({ error: "Choose a valid reservation quantity." }, 400);
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
      throw new Error("Reservation checkout is disabled.");
    }
    if (liveSmokeRequest && environment !== "live") {
      throw new Error("Private live verification requires the live payment environment.");
    }
    const [approvedTermsVersion, approvedProductStatusVersion] = await Promise.all([
      getRuntimeValue("PREORDER_LEGAL_APPROVED_VERSION"),
      getRuntimeValue("PREORDER_PRODUCT_STATUS_APPROVED_VERSION"),
    ]);
    if (
      mode === "live" &&
      !isPreorderLiveApproved({ mode, approvedTermsVersion, approvedProductStatusVersion })
    ) {
      throw new Error("Live reservation checkout is blocked until approved legal disclosures are active.");
    }
    const config = await getPreorderConfiguration();
    if (config.shippingRateCents !== PREORDER_SHIPPING_RATE_CENTS) {
      throw new Error("Reservation shipping does not match the reviewed offer.");
    }
    if (
      config.priceCents !== PREORDER_DEFAULT_PRICE_CENTS ||
      PREORDER_FOUNDING_PRICE_CENTS - config.priceCents !==
        PREORDER_REMAINING_BALANCE_CENTS
    ) {
      throw new Error("The Frame reservation amount does not match the reviewed offer.");
    }
    const foundingPriceLabel = formatPreorderMoney(
      PREORDER_FOUNDING_PRICE_CENTS,
      config.currency,
    );
    const remainingBalanceLabel = formatPreorderMoney(
      PREORDER_REMAINING_BALANCE_CENTS,
      config.currency,
    );
    const totalBeforeTaxLabel = formatPreorderMoney(
      config.priceCents + config.shippingRateCents,
      config.currency,
    );
    const legalBaseUrl = mode === "test" ? requestOrigin : SITE_URL;
    const stripe = await getStripe(environment);
    const priceId = await getStripeReservationPriceId(environment);
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
      product.name !== PREORDER_STRIPE_PRODUCT_NAME ||
      product.images[0] !== PREORDER_STRIPE_PRODUCT_IMAGE_URL ||
      product.description !== expectedProductDescription ||
      product.tax_code !== PREORDER_STRIPE_PRODUCT_TAX_CODE
    ) {
      throw new Error("The Stripe reservation product and price do not match the reviewed offer.");
    }

    const now = new Date();
    const marketingOptIn = !liveSmokeRequest && payload.marketingOptIn === true;
    reservedIntentId = await reservePreorderCheckout({
      requestKey,
      environment,
      sku: config.sku,
      quantity,
      unitAmount: config.priceCents,
      currency: config.currency,
      estimatedDelivery: config.estimatedShipping,
      source: liveSmokeRequest
        ? "private_live_smoke"
        : cleanAttribution(payload.source) ?? "preorder_review",
      utmSource: cleanAttribution(payload.utmSource),
      utmMedium: cleanAttribution(payload.utmMedium),
      utmCampaign: cleanAttribution(payload.utmCampaign),
      termsVersion: PREORDER_TERMS_VERSION,
      productStatusVersion: PREORDER_PRODUCT_STATUS_VERSION,
      termsAcceptedAt: null,
      productStatusAcknowledgedAt: null,
      marketingOptIn,
      marketingConsentAt: marketingOptIn ? now.toISOString() : null,
      offerType: "reservation",
      reservationAmount: config.priceCents,
      lockedTotalPrice: PREORDER_FOUNDING_PRICE_CENTS,
      remainingBalance: PREORDER_REMAINING_BALANCE_CENTS,
    });

    const supabase = await getSupabaseAdmin();
    const reservedIntent = await supabase
      .from("preorder_checkout_intents")
      .select("stripe_checkout_session_id, updated_at")
      .eq("id", reservedIntentId)
      .maybeSingle();
    if (reservedIntent.error) throw reservedIntent.error;
    if (!reservedIntent.data) {
      throw new Error("The checkout reservation could not be loaded.");
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

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        adaptive_pricing: { enabled: false },
        integration_identifier: STRIPE_CHECKOUT_INTEGRATION_IDENTIFIER,
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
        customer_creation: "always",
        shipping_address_collection: { allowed_countries: ["US"] },
        shipping_options: [
          {
            shipping_rate_data: {
              type: "fixed_amount",
              display_name: "Free standard US shipping",
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
              liveSmokeRequest
                ? `Private live verification: your card will be charged ${totalBeforeTaxLabel} plus applicable tax for a fully refundable Frame reservation. Refund it immediately after verifying the reservation record, confirmation email, and management link.`
                : mode === "test"
                ? `Sandbox payment only. ${totalBeforeTaxLabel} before tax today · Fully refundable · Your price ${foundingPriceLabel} · ${remainingBalanceLabel} due before shipping.`
                : `${totalBeforeTaxLabel} before tax today · Fully refundable · Your price ${foundingPriceLabel} · ${remainingBalanceLabel} due before shipping.`,
          },
          terms_of_service_acceptance: {
            message: `I agree to the [Reservation Terms](${legalBaseUrl}/preorder/terms) and [Refund Policy](${legalBaseUrl}/preorder/refunds), and acknowledge Frame’s [Product Status](${legalBaseUrl}/preorder/product-status) and [Privacy Notice](${legalBaseUrl}/privacy).`,
          },
        },
        submit_type: "pay",
        allow_promotion_codes: false,
        metadata: {
          flow: "frame_reservation",
          checkout_intent_id: reservedIntentId,
          environment,
          offer_type: "reservation",
          reservation_amount: String(config.priceCents),
          locked_total_price: String(PREORDER_FOUNDING_PRICE_CENTS),
          remaining_balance: String(PREORDER_REMAINING_BALANCE_CENTS),
          terms_version: PREORDER_TERMS_VERSION,
          product_status_version: PREORDER_PRODUCT_STATUS_VERSION,
          ...(liveSmokeRequest ? { verification_mode: "live_smoke" } : {}),
        },
        payment_intent_data: {
          description:
            mode === "test"
              ? `${PREORDER_STRIPE_PRODUCT_NAME} (sandbox)`
              : PREORDER_STRIPE_PRODUCT_NAME,
          metadata: {
            flow: "frame_reservation",
            checkout_intent_id: reservedIntentId,
            environment,
            offer_type: "reservation",
            reservation_amount: String(config.priceCents),
            locked_total_price: String(PREORDER_FOUNDING_PRICE_CENTS),
            remaining_balance: String(PREORDER_REMAINING_BALANCE_CENTS),
            terms_version: PREORDER_TERMS_VERSION,
            product_status_version: PREORDER_PRODUCT_STATUS_VERSION,
            ...(liveSmokeRequest ? { verification_mode: "live_smoke" } : {}),
          },
        },
        expires_at: sessionExpiresAt,
        success_url: `${requestOrigin}/preorder/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${requestOrigin}/preorder/review?cancelled=1`,
      },
      { idempotencyKey: `frame-reservation-checkout-${reservedIntentId}` },
    );
    stripeSessionCreated = true;

    if (!session.url) throw new Error("Stripe did not return a secure Checkout URL.");
    const updated = await supabase
      .from("preorder_checkout_intents")
      .update({
        status: "checkout_open",
        stripe_checkout_session_id: session.id,
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
          ? "Reservations are temporarily paused. Please check back soon."
          : error.reason === "sold_out"
            ? "This reservation allocation is currently full."
            : error.reason === "already_completed"
              ? "This checkout request has already been completed. Refresh the page to start again."
              : "Reservation availability is temporarily unavailable. Please try again shortly.";
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
