import { getSupabaseAdmin } from "@/lib/supabase-admin.server";
import { unsubscribeWaitlist } from "@/lib/waitlist-unsubscribe.server";

export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function noStoreJson(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = new URL("/unsubscribe", url.origin);
  const token = url.searchParams.get("token");
  if (token) target.searchParams.set("token", token);
  return Response.redirect(target, 303);
}

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== requestUrl.origin) {
    return noStoreJson({ error: "Request origin is not allowed." }, 403);
  }

  const token = requestUrl.searchParams.get("token")?.trim() ?? "";
  if (!UUID_PATTERN.test(token)) {
    return noStoreJson({ error: "This unsubscribe link is invalid." }, 400);
  }

  try {
    const supabase = await getSupabaseAdmin();
    const status = await unsubscribeWaitlist(
      {
        async markUnsubscribed(unsubscribeToken, unsubscribedAt) {
          const { data, error } = await supabase
            .from("waitlist_signups")
            .update({ email_unsubscribed_at: unsubscribedAt })
            .eq("email_unsubscribe_token", unsubscribeToken)
            .is("email_unsubscribed_at", null)
            .select("id")
            .maybeSingle<{ id: number }>();
          if (error) throw error;
          return Boolean(data);
        },
        async findByToken(unsubscribeToken) {
          const { data, error } = await supabase
            .from("waitlist_signups")
            .select("id,email_unsubscribed_at")
            .eq("email_unsubscribe_token", unsubscribeToken)
            .maybeSingle<{
              id: number;
              email_unsubscribed_at: string | null;
            }>();
          if (error) throw error;
          return data
            ? { unsubscribedAt: data.email_unsubscribed_at }
            : null;
        },
      },
      token,
      new Date().toISOString(),
    );

    if (status === "not_found") {
      return noStoreJson({ error: "This unsubscribe link is invalid." }, 400);
    }

    return noStoreJson({ status });
  } catch (error) {
    console.error("Waitlist unsubscribe failed", error);
    return noStoreJson(
      { error: "We couldn’t update your email preference. Please try again." },
      503,
    );
  }
}
