import { contributorPreviewDashboard } from "@/lib/contributor-preview";
import { formatContributorNumber } from "@/lib/contributor-membership";
import { isLocalContributorPreview } from "@/lib/runtime-env.server";
import { getStripe } from "@/lib/stripe.server";
import { getSupabaseAdmin } from "@/lib/supabase-admin.server";

export const dynamic = "force-dynamic";

function response(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("preview") === "1" && (await isLocalContributorPreview(request))) {
    const membership = contributorPreviewDashboard.membership;
    return response({
      status: "active",
      membership: {
        contributorNumber: formatContributorNumber(membership.contributorNumber),
        fullName: membership.fullName,
        paidAt: membership.paidAt,
        accessExpiresAt: membership.accessExpiresAt,
        amountPaidCents: membership.amountPaidCents,
        currency: membership.currency,
      },
    });
  }

  const sessionId = url.searchParams.get("session_id") ?? "";
  if (!/^cs_(?:test|live)_[A-Za-z0-9_]+$/.test(sessionId)) {
    return response({ error: "A valid payment confirmation reference is required." }, 400);
  }

  try {
    const supabase = await getSupabaseAdmin();
    const paymentResult = await supabase
      .from("contributor_payments")
      .select("contributor_id,payment_status,amount_total,currency")
      .eq("stripe_checkout_session_id", sessionId)
      .maybeSingle();
    if (paymentResult.error) throw paymentResult.error;

    if (paymentResult.data?.contributor_id) {
      const memberResult = await supabase
        .from("contributors")
        .select(
          "full_name,contributor_number,paid_at,access_expires_at,membership_status",
        )
        .eq("id", paymentResult.data.contributor_id)
        .single();
      if (memberResult.error || !memberResult.data) throw memberResult.error;

      return response({
        status: paymentResult.data.payment_status.startsWith("duplicate_")
          ? paymentResult.data.payment_status
          : memberResult.data.membership_status,
        membership: {
          contributorNumber: formatContributorNumber(memberResult.data.contributor_number),
          fullName: memberResult.data.full_name,
          paidAt: memberResult.data.paid_at,
          accessExpiresAt: memberResult.data.access_expires_at,
          amountPaidCents: paymentResult.data.amount_total,
          currency: paymentResult.data.currency,
        },
      });
    }

    const stripe = await getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status === "paid") {
      return response({ status: "processing" }, 202);
    }
    return response({ status: session.status === "expired" ? "expired" : "unpaid" });
  } catch (error) {
    console.error("Contributor payment status failed", error);
    return response({ error: "Payment confirmation is temporarily unavailable." }, 503);
  }
}
