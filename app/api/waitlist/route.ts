import { getSupabaseAdmin } from "@/lib/supabase-admin.server";

export const dynamic = "force-dynamic";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BODY_BYTES = 4_096;
const MAX_NAME_LENGTH = 60;
const MIN_MOTIVATION_LENGTH = 30;
const MAX_MOTIVATION_LENGTH = 1_500;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function cleanAttribution(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\s+/g, " ").slice(0, 100);
  return cleaned || null;
}

function cleanName(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ");
}

function cleanMotivation(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n");
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return jsonResponse({ error: "Request is too large." }, 413);
  }

  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return jsonResponse({ error: "Request origin is not allowed." }, 403);
  }

  let payload: {
    firstName?: unknown;
    lastName?: unknown;
    email?: unknown;
    motivation?: unknown;
    website?: unknown;
    placement?: unknown;
    utmSource?: unknown;
    utmMedium?: unknown;
    utmCampaign?: unknown;
  };

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return jsonResponse({ error: "Complete every application field." }, 400);
  }

  // A filled honeypot is treated as success so automated submissions do not
  // receive a useful signal.
  if (typeof payload.website === "string" && payload.website.trim()) {
    return jsonResponse({ status: "joined" }, 201);
  }

  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  const normalizedEmail = email.toLowerCase();
  const firstName = cleanName(payload.firstName);
  const lastName = cleanName(payload.lastName);
  const motivation = cleanMotivation(payload.motivation);

  if (!firstName || firstName.length > MAX_NAME_LENGTH) {
    return jsonResponse({ error: "Enter your first name." }, 400);
  }
  if (!lastName || lastName.length > MAX_NAME_LENGTH) {
    return jsonResponse({ error: "Enter your last name." }, 400);
  }
  if (
    !email ||
    email.length > 254 ||
    !EMAIL_PATTERN.test(email) ||
    normalizedEmail.includes("..")
  ) {
    return jsonResponse({ error: "Enter a valid email address." }, 400);
  }
  if (
    motivation.length < MIN_MOTIVATION_LENGTH ||
    motivation.length > MAX_MOTIVATION_LENGTH
  ) {
    return jsonResponse(
      {
        error:
          "Write a few sentences about the problem you want Frame to solve.",
      },
      400,
    );
  }

  try {
    const supabase = await getSupabaseAdmin();
    const { data: existingSignup, error: lookupError } = await supabase
      .from("waitlist_signups")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (lookupError) {
      throw lookupError;
    }
    if (existingSignup) {
      const { error: updateError } = await supabase
        .from("waitlist_signups")
        .update({
          first_name: firstName,
          last_name: lastName,
          motivation,
        })
        .eq("id", existingSignup.id);

      if (updateError) throw updateError;
      return jsonResponse({ status: "updated" });
    }

    const { error } = await supabase.from("waitlist_signups").insert({
      first_name: firstName,
      last_name: lastName,
      email: normalizedEmail,
      motivation,
      placement: cleanAttribution(payload.placement) ?? "landing_page",
      utm_source: cleanAttribution(payload.utmSource),
      utm_medium: cleanAttribution(payload.utmMedium),
      utm_campaign: cleanAttribution(payload.utmCampaign),
    });

    if (error?.code === "23505") {
      const { error: updateError } = await supabase
        .from("waitlist_signups")
        .update({
          first_name: firstName,
          last_name: lastName,
          motivation,
        })
        .eq("email", normalizedEmail);

      if (updateError) throw updateError;
      return jsonResponse({ status: "updated" });
    }
    if (error) {
      throw error;
    }

    return jsonResponse({ status: "joined" }, 201);
  } catch (error) {
    console.error("Waitlist signup failed", error);
    return jsonResponse(
      { error: "We couldn’t save your application. Please try again shortly." },
      503,
    );
  }
}
