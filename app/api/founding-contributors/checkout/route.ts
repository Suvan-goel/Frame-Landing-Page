import { getSupabaseAdmin } from "@/lib/supabase-admin.server";
import {
  CONTRIBUTOR_TERMS_VERSION,
} from "@/lib/contributor-membership";
import {
  isFoundingContributorSalesRequestEnabled,
  isLocalContributorPreview,
} from "@/lib/runtime-env.server";
import { getStripe, getStripePriceId } from "@/lib/stripe.server";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8_192;
const STRIPE_CHECKOUT_INTEGRATION_IDENTIFIER = "frame_contributor_pzmdwqhs";

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
  if (!(await isFoundingContributorSalesRequestEnabled(request))) {
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
    acknowledged?: unknown;
    marketingOptIn?: unknown;
    source?: unknown;
    utmSource?: unknown;
    utmMedium?: unknown;
    utmCampaign?: unknown;
  };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return jsonResponse({ error: "Review and acknowledge the membership details." }, 400);
  }

  if (payload.acknowledged !== true) {
    return jsonResponse(
      {
        error:
          "Confirm that you are purchasing a membership and not ordering or reserving a Frame device.",
      },
      400,
    );
  }

  if (await isLocalContributorPreview(request)) {
    return jsonResponse({ url: `${requestOrigin}/founding-contributors/success?preview=1` });
  }

  try {
    const now = new Date();
    const marketingOptIn = payload.marketingOptIn === true;
    const supabase = await getSupabaseAdmin();
    const inserted = await supabase
      .from("contributor_checkout_intents")
      .insert({
        status: "created",
        source: cleanAttribution(payload.source) ?? "founding_contributor_page",
        utm_source: cleanAttribution(payload.utmSource),
        utm_medium: cleanAttribution(payload.utmMedium),
        utm_campaign: cleanAttribution(payload.utmCampaign),
        terms_version: CONTRIBUTOR_TERMS_VERSION,
        product_status_acknowledged_at: now.toISOString(),
        marketing_opt_in: marketingOptIn,
        marketing_consent_at: marketingOptIn ? now.toISOString() : null,
      })
      .select("id")
      .single();
    if (inserted.error || !inserted.data) {
      throw inserted.error ?? new Error("Could not create the membership review record.");
    }

    const stripe = await getStripe();
    const priceId = await getStripePriceId();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      integration_identifier: STRIPE_CHECKOUT_INTEGRATION_IDENTIFIER,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: inserted.data.id,
      customer_creation: "always",
      name_collection: {
        individual: { enabled: true, optional: false },
      },
      billing_address_collection: "auto",
      automatic_tax: { enabled: false },
      consent_collection: { terms_of_service: "required" },
      custom_text: {
        submit: {
          message:
            "You are purchasing 12 months of private Frame contributor membership, including updates, Q&As, briefings, and product input. Device pre-orders are separate.",
        },
        terms_of_service_acceptance: {
          message:
            "I agree to the Frame Founding Contributor Membership Terms and Refund Policy.",
        },
      },
      submit_type: "pay",
      allow_promotion_codes: false,
      metadata: {
        checkout_intent_id: inserted.data.id,
        membership: "frame_founding_contributor",
        terms_version: CONTRIBUTOR_TERMS_VERSION,
      },
      payment_intent_data: {
        description: "Frame Founding Contributor Membership - 12 months",
        metadata: {
          checkout_intent_id: inserted.data.id,
          membership: "frame_founding_contributor",
          terms_version: CONTRIBUTOR_TERMS_VERSION,
        },
      },
      success_url: `${requestOrigin}/founding-contributors/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${requestOrigin}/founding-contributors/review?cancelled=1`,
    });

    if (!session.url) throw new Error("Stripe did not return a secure Checkout URL.");
    const updated = await supabase
      .from("contributor_checkout_intents")
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
    console.error("Contributor Checkout creation failed", error);
    return jsonResponse(
      {
        error:
          error instanceof Error && error.message.includes("not configured")
            ? "Stripe test mode is not configured yet. Create a Stripe account and add the test credentials before testing payment."
            : "Secure payment is temporarily unavailable. Please try again shortly.",
      },
      503,
    );
  }
}
