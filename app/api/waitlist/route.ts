import { getSupabaseAdmin } from "@/lib/supabase-admin.server";
import { formatName } from "@/lib/name-format";
import { isLoopbackHost } from "@/lib/contributor-local-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  monitoringMethodValues,
  primaryInterestValues,
  researchCallValues,
} from "@/lib/waitlist-options";
import {
  captureWaitlistEmail,
  completeWaitlistQualification,
  skipWaitlistQualification,
  type QualificationUpdate,
  type WaitlistRecordState,
  type WaitlistRepository,
} from "@/lib/waitlist-service.server";
import { getWaitlistPreviewRepository } from "@/lib/waitlist-preview.server";
import { submitLegacyWaitlist } from "@/lib/legacy-waitlist-submission.server";
import { EMAIL_FIRST_WAITLIST_HEADER } from "@/lib/waitlist-flow";

export const dynamic = "force-dynamic";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 8_192;
const MAX_NAME_LENGTH = 60;
const MAX_ATTRIBUTION_LENGTH = 200;
const MAX_REFERRER_LENGTH = 500;
const MAX_OTHER_LENGTH = 160;
const MAX_LONG_TEXT_LENGTH = 750;

type WaitlistAction =
  | "capture_email"
  | "submit_qualification"
  | "skip_qualification";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\s+/g, " ").slice(0, maxLength);
  return cleaned || null;
}

function cleanLongText(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value
    .trim()
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .slice(0, MAX_LONG_TEXT_LENGTH);
  return cleaned || null;
}

function cleanName(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = formatName(value).slice(0, MAX_NAME_LENGTH);
  return cleaned || null;
}

function validEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (
    !email ||
    email.length > 254 ||
    !EMAIL_PATTERN.test(email) ||
    email.includes("..")
  ) {
    return null;
  }
  return email;
}

function waitlistRepository(supabase: SupabaseClient): WaitlistRepository {
  const recordSelect =
    "id,survey_token,qualification_status,survey_completed_at";
  const toRecord = (row: {
    id: number;
    survey_token: string;
    qualification_status: string;
    survey_completed_at: string | null;
  }): WaitlistRecordState => ({
    id: row.id,
    signupToken: row.survey_token,
    qualificationStatus: row.qualification_status,
    surveyCompletedAt: row.survey_completed_at,
  });

  return {
    async findByEmail(email) {
      const { data, error } = await supabase
        .from("waitlist_signups")
        .select(recordSelect)
        .eq("email", email)
        .maybeSingle<{
          id: number;
          survey_token: string;
          qualification_status: string;
          survey_completed_at: string | null;
        }>();
      if (error) throw error;
      return data ? toRecord(data) : null;
    },
    async insert(input) {
      const { data, error } = await supabase
        .from("waitlist_signups")
        .insert({
          email: input.email,
          placement: input.placement,
          utm_source: input.utmSource,
          utm_medium: input.utmMedium,
          utm_campaign: input.utmCampaign,
          utm_content: input.utmContent,
          utm_term: input.utmTerm,
          meta_click_id: input.metaClickId,
          signup_referrer: input.referrer,
          qualification_status: "not_started",
        })
        .select(recordSelect)
        .single<{
          id: number;
          survey_token: string;
          qualification_status: string;
          survey_completed_at: string | null;
        }>();
      if (error) throw error;
      return toRecord(data);
    },
    async findByToken(signupToken) {
      const { data, error } = await supabase
        .from("waitlist_signups")
        .select(recordSelect)
        .eq("survey_token", signupToken)
        .maybeSingle<{
          id: number;
          survey_token: string;
          qualification_status: string;
          survey_completed_at: string | null;
        }>();
      if (error) throw error;
      return data ? toRecord(data) : null;
    },
    async markSkipped(id, skippedAt) {
      const { error } = await supabase
        .from("waitlist_signups")
        .update({
          qualification_status: "skipped",
          qualification_skipped_at: skippedAt,
        })
        .eq("id", id)
        .neq("qualification_status", "completed");
      if (error) throw error;
    },
    async completeIfIncomplete(id, update: QualificationUpdate) {
      const values: Record<string, string | null> = {
        qualification_status: "completed",
        primary_interest: update.primaryInterest,
        primary_interest_other: update.primaryInterestOther,
        current_monitoring_method: update.monitoringMethod,
        current_monitoring_method_other: update.monitoringMethodOther,
        frustration_or_missing_need: update.frustration,
        open_to_research_call: update.researchCall,
        survey_completed_at: update.completedAt,
      };
      if (update.firstName) values.first_name = update.firstName;

      const { data, error } = await supabase
        .from("waitlist_signups")
        .update(values)
        .eq("id", id)
        .neq("qualification_status", "completed")
        .is("survey_completed_at", null)
        .select("id")
        .maybeSingle<{ id: number }>();
      if (error) throw error;
      return Boolean(data);
    },
  };
}

async function repositoryForRequest(request: Request) {
  if (isLoopbackHost(new URL(request.url).host)) {
    return getWaitlistPreviewRepository();
  }
  return waitlistRepository(await getSupabaseAdmin());
}

async function captureEmail(payload: Record<string, unknown>, request: Request) {
  // A filled honeypot receives the same successful shape without creating a
  // record or a conversion event.
  if (typeof payload.website === "string" && payload.website.trim()) {
    return jsonResponse({
      status: "joined",
      signupToken: crypto.randomUUID(),
      leadCreated: false,
    }, 201);
  }

  const email = validEmail(payload.email);
  if (!email) {
    return jsonResponse({ error: "Enter a valid email address." }, 400);
  }

  try {
    const result = await captureWaitlistEmail(await repositoryForRequest(request), {
      email,
      placement:
        cleanText(payload.placement, MAX_ATTRIBUTION_LENGTH) ?? "landing_page",
      utmSource: cleanText(payload.utmSource, MAX_ATTRIBUTION_LENGTH),
      utmMedium: cleanText(payload.utmMedium, MAX_ATTRIBUTION_LENGTH),
      utmCampaign: cleanText(payload.utmCampaign, MAX_ATTRIBUTION_LENGTH),
      utmContent: cleanText(payload.utmContent, MAX_ATTRIBUTION_LENGTH),
      utmTerm: cleanText(payload.utmTerm, MAX_ATTRIBUTION_LENGTH),
      metaClickId: cleanText(payload.metaClickId, MAX_ATTRIBUTION_LENGTH),
      referrer: cleanText(payload.referrer, MAX_REFERRER_LENGTH),
    });
    return jsonResponse(result, result.leadCreated ? 201 : 200);
  } catch (error) {
    console.error("Waitlist email capture failed", error);
    return jsonResponse(
      { error: "We couldn’t save your email. Please try again shortly." },
      503,
    );
  }
}

async function skipQualification(payload: Record<string, unknown>, request: Request) {
  const signupToken =
    typeof payload.signupToken === "string" ? payload.signupToken : "";
  if (!UUID_PATTERN.test(signupToken)) {
    return jsonResponse({ error: "This signup session is no longer valid." }, 400);
  }

  try {
    const result = await skipWaitlistQualification(
      await repositoryForRequest(request),
      signupToken,
      new Date().toISOString(),
    );
    if (result.status === "not_found") {
      return jsonResponse({ error: "This signup session is no longer valid." }, 404);
    }
    return jsonResponse(result);
  } catch (error) {
    console.error("Waitlist qualification skip failed", error);
    return jsonResponse(
      { error: "Your waitlist place is safe, but we couldn’t record the skipped survey." },
      503,
    );
  }
}

async function submitQualification(payload: Record<string, unknown>, request: Request) {
  const signupToken =
    typeof payload.signupToken === "string" ? payload.signupToken : "";
  const primaryInterest =
    typeof payload.primaryInterest === "string" ? payload.primaryInterest : "";
  const monitoringMethod =
    typeof payload.monitoringMethod === "string" ? payload.monitoringMethod : "";
  const researchCall =
    typeof payload.researchCall === "string" ? payload.researchCall : null;
  const firstName = cleanName(payload.firstName);

  if (!UUID_PATTERN.test(signupToken)) {
    return jsonResponse({ error: "This signup session is no longer valid." }, 400);
  }
  if (!primaryInterestValues.has(primaryInterest)) {
    return jsonResponse(
      { error: "Choose the one main reason that matters most to you." },
      400,
    );
  }
  if (!monitoringMethodValues.has(monitoringMethod)) {
    return jsonResponse(
      { error: "Choose how you currently monitor your blood pressure." },
      400,
    );
  }
  if (researchCall && !researchCallValues.has(researchCall)) {
    return jsonResponse({ error: "Choose a valid research-call response." }, 400);
  }
  if (researchCall === "yes" && !firstName) {
    return jsonResponse(
      { error: "Enter your first name so we know how to address you." },
      400,
    );
  }

  try {
    const result = await completeWaitlistQualification(
      await repositoryForRequest(request),
      signupToken,
      {
        primaryInterest,
        primaryInterestOther:
          primaryInterest === "something_else"
            ? cleanText(payload.primaryInterestOther, MAX_OTHER_LENGTH)
            : null,
        monitoringMethod,
        monitoringMethodOther:
          monitoringMethod === "something_else"
            ? cleanText(payload.monitoringMethodOther, MAX_OTHER_LENGTH)
            : null,
        frustration: cleanLongText(payload.frustration),
        researchCall,
        firstName: researchCall === "yes" ? firstName : null,
        completedAt: new Date().toISOString(),
      },
    );
    if (result.status === "not_found") {
      return jsonResponse({ error: "This signup session is no longer valid." }, 404);
    }
    return jsonResponse(result);
  } catch (error) {
    console.error("Waitlist qualification failed", error);
    return jsonResponse(
      { error: "We couldn’t save your answers. Please try again shortly." },
      503,
    );
  }
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

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "The submitted information is invalid." }, 400);
  }

  const action = payload.action as WaitlistAction | undefined;
  if (!action) return submitLegacyWaitlist(payload);

  const emailFirstAllowed =
    isLoopbackHost(new URL(request.url).host) ||
    request.headers.get(EMAIL_FIRST_WAITLIST_HEADER) === "1";
  if (!emailFirstAllowed) {
    return jsonResponse({ error: "Not found." }, 404);
  }

  if (action === "capture_email") return captureEmail(payload, request);
  if (action === "submit_qualification") return submitQualification(payload, request);
  if (action === "skip_qualification") return skipQualification(payload, request);
  return jsonResponse({ error: "The submitted action is invalid." }, 400);
}
