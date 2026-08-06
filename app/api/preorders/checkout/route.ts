import type Stripe from "stripe";
import { getPreorderConfiguration } from "@/lib/preorder-config.server";
import { isPreorderLiveApproved } from "@/lib/preorder-access";
import {
  PREORDER_MAX_QUANTITY,
  PREORDER_PRODUCT_STATUS_VERSION,
  PREORDER_TERMS_VERSION,
} from "@/lib/preorder";
import {
  getPreorderMode,
  getRuntimeValue,
  isLocalPreorderPreview,
  isPreorderSalesRequestEnabled,
} from "@/lib/runtime-env.server";
import { getStripe, getStripePreorderPriceId } from "@/lib/stripe.server";
import { getSupabaseAdmin } from "@/lib/supabase-admin.server";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8_192;

function cleanAttribution(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\s+/g, " ").slice(0, 100);
  return cleaned || null;
}

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

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return jsonResponse({ error: "Request is too large." }, 413);
  }

  const origin = request.headers.get("origin");
  const requestOrigin = new URL(request.url).origin;
  if (origin && origin !== requestOrigin) {
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

  const quantity = typeof payload.quantity === "number" ? payload.quantity : 1;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > PREORDER_MAX_QUANTITY) {
    return jsonResponse({ error: "Choose a valid pre-order quantity." }, 400);
  }

  if (await isLocalPreorderPreview(request)) {
    return jsonResponse({ url: `${requestOrigin}/preorder/success?preview=1` });
  }

  try {
    const mode = await getPreorderMode();
    if (mode !== "test" && mode !== "live") {
      throw new Error("Pre-order Checkout is disabled.");
    }
    const approvedTermsVersion = await getRuntimeValue("PREORDER_LEGAL_APPROVED_VERSION");
    if (mode === "live" && !isPreorderLiveApproved({ mode, approvedTermsVersion })) {
      throw new Error("Live pre-order Checkout is blocked until approved terms are active.");
    }
    const secretKey = await getRuntimeValue("STRIPE_SECRET_KEY");
    if (mode === "test" && !secretKey?.startsWith("sk_test_")) {
      throw new Error("Stripe test mode is required for the local pre-order funnel.");
    }
    if (mode === "live" && !secretKey?.startsWith("sk_live_")) {
      throw new Error("Stripe live mode is not configured for approved pre-orders.");
    }

    const config = await getPreorderConfiguration();
    const stripe = await getStripe();
    const priceId = await getStripePreorderPriceId();
    const price = await stripe.prices.retrieve(priceId);
    if (
      !price.active ||
      price.type !== "one_time" ||
      price.unit_amount !== config.priceCents ||
      price.currency !== config.currency
    ) {
      throw new Error("The Stripe pre-order price does not match the reviewed test offer.");
    }

    const now = new Date();
    const marketingOptIn = payload.marketingOptIn === true;
    const supabase = await getSupabaseAdmin();
    const inserted = await supabase
      .from("preorder_checkout_intents")
      .insert({
        status: "created",
        sku: config.sku,
        quantity,
        unit_amount: config.priceCents,
        currency: config.currency,
        estimated_delivery: config.estimatedDelivery,
        source: cleanAttribution(payload.source) ?? "preorder_review",
        utm_source: cleanAttribution(payload.utmSource),
        utm_medium: cleanAttribution(payload.utmMedium),
        utm_campaign: cleanAttribution(payload.utmCampaign),
        terms_version: PREORDER_TERMS_VERSION,
        product_status_version: PREORDER_PRODUCT_STATUS_VERSION,
        terms_accepted_at: now.toISOString(),
        product_status_acknowledged_at: now.toISOString(),
        marketing_opt_in: marketingOptIn,
        marketing_consent_at: marketingOptIn ? now.toISOString() : null,
      })
      .select("id")
      .single();
    if (inserted.error || !inserted.data) {
      throw inserted.error ?? new Error("Could not create the pre-order review record.");
    }

    const allowedCountries = config.allowedCountries as Array<
      Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry
    >;
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity }],
        client_reference_id: inserted.data.id,
        customer_creation: "always",
        name_collection: {
          individual: { enabled: true, optional: false },
        },
        billing_address_collection: "required",
        shipping_address_collection: { allowed_countries: allowedCountries },
        automatic_tax: { enabled: false },
        consent_collection: { terms_of_service: "required" },
        custom_text: {
          submit: {
            message: `Local test only. Frame is unfinished. Delivery is currently estimated for ${config.estimatedDelivery} and may change. This flow must not be used for a live sale before legal and regulatory approval.`,
          },
          terms_of_service_acceptance: {
            message:
              "I agree to the draft Frame Pre-order Terms and Refund Policy used for this local test.",
          },
        },
        submit_type: "pay",
        allow_promotion_codes: false,
        metadata: {
          flow: "frame_preorder",
          checkout_intent_id: inserted.data.id,
          terms_version: PREORDER_TERMS_VERSION,
          product_status_version: PREORDER_PRODUCT_STATUS_VERSION,
        },
        payment_intent_data: {
          description: "Frame device pre-order — local test flow",
          metadata: {
            flow: "frame_preorder",
            checkout_intent_id: inserted.data.id,
            terms_version: PREORDER_TERMS_VERSION,
            product_status_version: PREORDER_PRODUCT_STATUS_VERSION,
          },
        },
        success_url: `${requestOrigin}/preorder/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${requestOrigin}/preorder/review?cancelled=1`,
      },
      { idempotencyKey: `frame-preorder-checkout-${inserted.data.id}` },
    );

    if (!session.url) throw new Error("Stripe did not return a secure Checkout URL.");
    const updated = await supabase
      .from("preorder_checkout_intents")
      .update({
        status: "checkout_open",
        stripe_checkout_session_id: session.id,
        expires_at: new Date(session.expires_at * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", inserted.data.id);
    if (updated.error) throw updated.error;

    return jsonResponse({ url: session.url });
  } catch (error) {
    console.error("Pre-order Checkout creation failed", error);
    return jsonResponse(
      {
        error:
          error instanceof Error &&
          (error.message.includes("configured") ||
            error.message.includes("disabled") ||
            error.message.includes("test mode") ||
            error.message.includes("reviewed test offer"))
            ? error.message
            : "Secure test payment is temporarily unavailable. Please try again shortly.",
      },
      503,
    );
  }
}
