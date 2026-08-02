import { getSupabaseAdmin } from "@/lib/supabase-admin.server";
import { formatName } from "@/lib/name-format";

export const dynamic = "force-dynamic";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BODY_BYTES = 8_192;
const MAX_NAME_LENGTH = 60;
const MIN_SITUATION_LENGTH = 20;
const MAX_SITUATION_LENGTH = 750;
const MIN_AGE = 18;
const MAX_AGE = 120;
const GENDER_VALUES = new Set([
  "woman",
  "man",
  "non_binary",
  "another_identity",
  "prefer_not_to_say",
]);
const MAIN_REASON_VALUES = new Set([
  "monitor_high_or_borderline",
  "understand_sleep",
  "understand_daily_factors",
  "understand_unexplained_changes",
  "track_response_and_recovery",
  "something_else",
]);
const MONITORING_METHOD_VALUES = new Set([
  "upper_arm_regularly",
  "upper_arm_occasionally",
  "wearable_or_cuffless",
  "medical_appointments_only",
  "not_currently_monitoring",
]);
const INTERVIEW_WILLINGNESS_VALUES = new Set(["yes", "possibly", "no"]);

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
  return formatName(value);
}

function cleanLongText(value: unknown) {
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
    gender?: unknown;
    age?: unknown;
    mainReason?: unknown;
    recentSituation?: unknown;
    monitoringMethod?: unknown;
    interviewWillingness?: unknown;
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
  const gender = typeof payload.gender === "string" ? payload.gender : "";
  const age = typeof payload.age === "number" ? payload.age : Number.NaN;
  const mainReason =
    typeof payload.mainReason === "string" ? payload.mainReason : "";
  const recentSituation = cleanLongText(payload.recentSituation);
  const monitoringMethod =
    typeof payload.monitoringMethod === "string"
      ? payload.monitoringMethod
      : "";
  const interviewWillingness =
    typeof payload.interviewWillingness === "string"
      ? payload.interviewWillingness
      : "";

  if (!MAIN_REASON_VALUES.has(mainReason)) {
    return jsonResponse(
      { error: "Choose the one main reason that matters most to you." },
      400,
    );
  }
  if (
    recentSituation.length < MIN_SITUATION_LENGTH ||
    recentSituation.length > MAX_SITUATION_LENGTH
  ) {
    return jsonResponse(
      {
        error: `Write between ${MIN_SITUATION_LENGTH} and ${MAX_SITUATION_LENGTH} characters about what Frame would solve for you.`,
      },
      400,
    );
  }
  if (!MONITORING_METHOD_VALUES.has(monitoringMethod)) {
    return jsonResponse(
      { error: "Choose how you currently monitor your blood pressure." },
      400,
    );
  }
  if (!INTERVIEW_WILLINGNESS_VALUES.has(interviewWillingness)) {
    return jsonResponse(
      { error: "Choose whether you would be willing to speak with us." },
      400,
    );
  }

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
  if (!GENDER_VALUES.has(gender)) {
    return jsonResponse({ error: "Select a gender option." }, 400);
  }
  if (!Number.isInteger(age) || age < MIN_AGE || age > MAX_AGE) {
    return jsonResponse(
      { error: `Enter an age between ${MIN_AGE} and ${MAX_AGE}.` },
      400,
    );
  }
  const qualificationRecord = JSON.stringify({
    version: 2,
    mainReason,
    recentSituation,
    monitoringMethod,
    interviewWillingness,
  });
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
          gender,
          age,
          motivation: qualificationRecord,
        })
        .eq("id", existingSignup.id);

      if (updateError) throw updateError;
      return jsonResponse({ status: "updated" });
    }

    const { error } = await supabase.from("waitlist_signups").insert({
      first_name: firstName,
      last_name: lastName,
      email: normalizedEmail,
      gender,
      age,
      motivation: qualificationRecord,
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
          gender,
          age,
          motivation: qualificationRecord,
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
