import { getSupabaseAdmin } from "@/lib/supabase-admin.server";
import { formatName } from "@/lib/name-format";
import { isLoopbackHost } from "@/lib/contributor-local-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  genderValues,
  monitoringMethodValues,
  normalizeResearchCallValue,
  primaryInterestValues,
  researchCallValues,
} from "@/lib/waitlist-options";
import {
  captureWaitlistEmail,
  completeWaitlistQualification,
  skipWaitlistQualification,
  type MetaLeadRecord,
  type QualificationUpdate,
  type WaitlistRecordState,
  type WaitlistRepository,
} from "@/lib/waitlist-service.server";
import { getWaitlistPreviewRepository } from "@/lib/waitlist-preview.server";
import { submitLegacyWaitlist } from "@/lib/legacy-waitlist-submission.server";
import { sendMetaLeadConversion } from "@/lib/meta-conversions.server";
import {
  META_TRACKING_STATE_VERSION,
  resolveMetaTrackingDecision,
  type MetaTrackingClientState,
} from "@/lib/meta-tracking";
import {
  submittedTrackingPolicy,
  type GeoPolicyResult,
} from "@/lib/geo-attestation";

export const dynamic = "force-dynamic";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 8_192;
const MAX_NAME_LENGTH = 60;
const MAX_ATTRIBUTION_LENGTH = 200;
const MAX_REFERRER_LENGTH = 500;
const MAX_OTHER_LENGTH = 160;
const MAX_LONG_TEXT_LENGTH = 750;
const MIN_FRUSTRATION_LENGTH = 20;
const MIN_AGE = 18;
const MAX_AGE = 120;
const MAX_META_IDENTIFIER_LENGTH = 500;

type WaitlistAction =
  | "capture_email"
  | "deliver_meta_lead"
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
    "id,survey_token,meta_event_id,created_at,qualification_status,survey_completed_at";
  const toRecord = (row: {
    id: number;
    survey_token: string;
    meta_event_id: string;
    created_at: string;
    qualification_status: string;
    survey_completed_at: string | null;
  }): WaitlistRecordState => ({
    id: row.id,
    signupToken: row.survey_token,
    metaEventId: row.meta_event_id,
    createdAt: row.created_at,
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
          meta_event_id: string;
          created_at: string;
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
          meta_event_id: string;
          created_at: string;
          qualification_status: string;
          survey_completed_at: string | null;
        }>();
      if (error) throw error;
      return toRecord(data);
    },
    async resubscribe(id) {
      const { error } = await supabase
        .from("waitlist_signups")
        .update({ email_unsubscribed_at: null })
        .eq("id", id);
      if (error) throw error;
    },
    async findByToken(signupToken) {
      const { data, error } = await supabase
        .from("waitlist_signups")
        .select(recordSelect)
        .eq("survey_token", signupToken)
        .maybeSingle<{
          id: number;
          survey_token: string;
          meta_event_id: string;
          created_at: string;
          qualification_status: string;
          survey_completed_at: string | null;
        }>();
      if (error) throw error;
      return data ? toRecord(data) : null;
    },
    async findMetaLeadByEventId(metaEventId) {
      const { data, error } = await supabase
        .from("waitlist_signups")
        .select("meta_event_id,email,meta_click_id,created_at,meta_capi_status")
        .eq("meta_event_id", metaEventId)
        .maybeSingle<{
          meta_event_id: string;
          email: string;
          meta_click_id: string | null;
          created_at: string;
          meta_capi_status: string;
        }>();
      if (error) throw error;
      return data
        ? {
            metaEventId: data.meta_event_id,
            email: data.email,
            metaClickId: data.meta_click_id,
            createdAt: data.created_at,
            metaCapiStatus: data.meta_capi_status,
          }
        : null;
    },
    async updateMetaTrackingDiagnostics(metaEventId, update) {
      const values: Record<string, string | boolean | null> = {};
      if (update.policyMode !== undefined) {
        values.meta_tracking_policy_mode = update.policyMode;
      }
      if (update.consentState !== undefined) {
        values.meta_tracking_consent_state = update.consentState;
      }
      if (update.decision !== undefined) {
        values.meta_tracking_decision = update.decision;
      }
      if (update.clientStateValid !== undefined) {
        values.meta_tracking_client_state_valid = update.clientStateValid;
      }
      if (update.globalPrivacyControl !== undefined) {
        values.meta_gpc = update.globalPrivacyControl;
      }
      if (update.pixelReadyAtCapture !== undefined) {
        values.meta_pixel_ready_at_capture = update.pixelReadyAtCapture;
      }
      if (update.browserLeadAttemptedAt !== undefined) {
        values.meta_browser_lead_attempted_at = update.browserLeadAttemptedAt;
      }
      if (update.capiStatus !== undefined) {
        values.meta_capi_status = update.capiStatus;
      }
      if (update.capiSentAt !== undefined) {
        values.meta_capi_sent_at = update.capiSentAt;
      }
      if (update.capiLastError !== undefined) {
        values.meta_capi_last_error = update.capiLastError;
      }
      if (update.recordedAt !== undefined) {
        values.meta_tracking_recorded_at = update.recordedAt;
      }
      if (update.geoSource !== undefined) {
        values.meta_geo_source = update.geoSource;
      }
      if (update.geoCountry !== undefined) {
        values.meta_geo_country = update.geoCountry;
      }
      if (update.geoRegionCode !== undefined) {
        values.meta_geo_region_code = update.geoRegionCode;
      }
      if (update.geoResolutionReason !== undefined) {
        values.meta_geo_resolution_reason = update.geoResolutionReason;
      }
      if (update.geoPolicyVersion !== undefined) {
        values.meta_geo_policy_version = update.geoPolicyVersion;
      }
      if (update.geoRetryAttempted !== undefined) {
        values.meta_geo_retry_attempted = update.geoRetryAttempted;
      }
      if (update.geoRetrySucceeded !== undefined) {
        values.meta_geo_retry_succeeded = update.geoRetrySucceeded;
      }
      if (!Object.keys(values).length) return;

      const { error } = await supabase
        .from("waitlist_signups")
        .update(values)
        .eq("meta_event_id", metaEventId);
      if (error) throw error;
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
      const values: Record<string, string | number | null> = {
        qualification_status: "completed",
        first_name: update.firstName,
        last_name: update.lastName,
        age: update.age,
        gender: update.gender,
        primary_interest: update.primaryInterest,
        primary_interest_other: update.primaryInterestOther,
        current_monitoring_method: update.monitoringMethod,
        current_monitoring_method_other: update.monitoringMethodOther,
        frustration_or_missing_need: update.frustration,
        open_to_research_call: update.researchCall,
        survey_completed_at: update.completedAt,
      };
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

type ParsedMetaTrackingState = {
  state: MetaTrackingClientState;
  valid: boolean;
};

function parseMetaTrackingState(value: unknown): ParsedMetaTrackingState {
  const fallback: MetaTrackingClientState = {
    version: META_TRACKING_STATE_VERSION,
    storedConsent: null,
    globalPrivacyControl: false,
    pixelReady: false,
    eventSourceUrl: null,
    fbp: null,
    fbc: null,
  };
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { state: fallback, valid: false };
  }

  const candidate = value as Record<string, unknown>;
  const storedConsent = candidate.storedConsent;
  const valid =
    candidate.version === META_TRACKING_STATE_VERSION &&
    (storedConsent === null ||
      storedConsent === "granted" ||
      storedConsent === "denied") &&
    typeof candidate.globalPrivacyControl === "boolean" &&
    typeof candidate.pixelReady === "boolean";
  if (!valid) return { state: fallback, valid: false };

  return {
    valid: true,
    state: {
      version: META_TRACKING_STATE_VERSION,
      storedConsent,
      globalPrivacyControl: candidate.globalPrivacyControl as boolean,
      pixelReady: candidate.pixelReady as boolean,
      eventSourceUrl: cleanText(candidate.eventSourceUrl, MAX_REFERRER_LENGTH),
      fbp: cleanText(candidate.fbp, MAX_META_IDENTIFIER_LENGTH),
      fbc: cleanText(candidate.fbc, MAX_META_IDENTIFIER_LENGTH),
    },
  };
}

function eventSourceUrl(value: string | null, request: Request) {
  const requestUrl = new URL(request.url);
  if (value) {
    try {
      const candidate = new URL(value);
      if (
        candidate.origin === requestUrl.origin &&
        (candidate.protocol === "https:" || candidate.protocol === "http:")
      ) {
        candidate.search = "";
        candidate.hash = "";
        return candidate.href.slice(0, MAX_REFERRER_LENGTH);
      }
    } catch {
      // Fall back to the request origin below.
    }
  }
  return new URL("/", requestUrl.origin).href;
}

function clientIpAddress(request: Request) {
  const value =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0] ??
    null;
  return cleanText(value, 100);
}

async function recordMetaDiagnostics(
  repository: WaitlistRepository,
  metaEventId: string,
  update: Parameters<WaitlistRepository["updateMetaTrackingDiagnostics"]>[1],
) {
  try {
    await repository.updateMetaTrackingDiagnostics(metaEventId, update);
  } catch (error) {
    console.error("Meta tracking diagnostics update failed", error);
  }
}

async function deliverMetaLead(
  repository: WaitlistRepository,
  lead: MetaLeadRecord,
  trackingValue: unknown,
  request: Request,
  browserLeadAttempted: boolean,
  geoPolicy: GeoPolicyResult,
) {
  const parsed = parseMetaTrackingState(trackingValue);
  const policyMode = geoPolicy.mode;
  const globalPrivacyControl =
    request.headers.get("sec-gpc") === "1" ||
    parsed.state.globalPrivacyControl;
  const decision = resolveMetaTrackingDecision({
    policyMode,
    storedConsent: parsed.state.storedConsent,
    globalPrivacyControl,
    clientStateValid: parsed.valid,
  });
  const now = new Date().toISOString();
  const diagnostics = {
    policyMode,
    consentState: parsed.state.storedConsent ?? "unset",
    decision: decision.reason,
    clientStateValid: parsed.valid,
    globalPrivacyControl,
    ...(!browserLeadAttempted
      ? { pixelReadyAtCapture: parsed.state.pixelReady }
      : {}),
    ...(browserLeadAttempted ? { browserLeadAttemptedAt: now } : {}),
    recordedAt: now,
    geoSource: geoPolicy.geoSource,
    geoCountry: geoPolicy.country,
    geoRegionCode: geoPolicy.regionCode,
    geoResolutionReason: geoPolicy.resolutionReason,
    geoPolicyVersion: geoPolicy.policyVersion,
    geoRetryAttempted: geoPolicy.retryAttempted,
    geoRetrySucceeded: geoPolicy.retrySucceeded,
  } as const;

  if (!decision.permitted) {
    const capiStatus =
      lead.metaCapiStatus === "sent"
        ? "sent"
        : "skipped_not_permitted";
    await recordMetaDiagnostics(repository, lead.metaEventId, {
      ...diagnostics,
      capiStatus,
      capiLastError: null,
    });
    return { permitted: false, capiStatus };
  }

  if (lead.metaCapiStatus === "sent") {
    await recordMetaDiagnostics(repository, lead.metaEventId, diagnostics);
    return { permitted: true, capiStatus: "sent" as const };
  }

  const parsedCreatedAt = Date.parse(lead.createdAt);
  const eventTime = Number.isFinite(parsedCreatedAt)
    ? Math.floor(parsedCreatedAt / 1000)
    : Math.floor(Date.now() / 1000);
  const capi = await sendMetaLeadConversion({
    eventId: lead.metaEventId,
    email: lead.email,
    eventTime,
    eventSourceUrl: eventSourceUrl(parsed.state.eventSourceUrl, request),
    clientIpAddress: clientIpAddress(request),
    clientUserAgent: cleanText(request.headers.get("user-agent"), 500),
    metaClickId: lead.metaClickId,
    fbp: parsed.state.fbp,
    fbc: parsed.state.fbc,
  });
  await recordMetaDiagnostics(repository, lead.metaEventId, {
    ...diagnostics,
    capiStatus: capi.status,
    capiSentAt: capi.status === "sent" ? now : null,
    capiLastError: capi.error,
  });
  return { permitted: true, capiStatus: capi.status };
}

async function deliverMetaLeadAction(
  payload: Record<string, unknown>,
  request: Request,
) {
  const metaEventId =
    typeof payload.metaEventId === "string" ? payload.metaEventId : "";
  if (!UUID_PATTERN.test(metaEventId)) {
    return jsonResponse({ error: "This conversion session is no longer valid." }, 400);
  }

  try {
    const repository = await repositoryForRequest(request);
    const lead = await repository.findMetaLeadByEventId(metaEventId);
    if (!lead) {
      return jsonResponse({ error: "This conversion session is no longer valid." }, 404);
    }
    const geoPolicy = await submittedTrackingPolicy(
      payload.geoAttestationToken,
      {
        resolutionReason: payload.geoResolutionReason,
        retryAttempted: payload.geoRetryAttempted,
        retrySucceeded: payload.geoRetrySucceeded,
      },
    );
    const result = await deliverMetaLead(
      repository,
      lead,
      payload.tracking,
      request,
      payload.browserLeadAttempted === true,
      geoPolicy,
    );
    return jsonResponse({ status: "recorded", ...result });
  } catch (error) {
    console.error("Meta Lead replay failed", error);
    return jsonResponse({ error: "The conversion signal could not be recorded." }, 503);
  }
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
    const repository = await repositoryForRequest(request);
    const result = await captureWaitlistEmail(repository, {
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

    if (result.leadCreated) {
      try {
        const lead = await repository.findMetaLeadByEventId(result.metaEventId);
        if (lead) {
          const geoPolicy = await submittedTrackingPolicy(
            payload.geoAttestationToken,
            {
              resolutionReason: payload.geoResolutionReason,
              retryAttempted: payload.geoRetryAttempted,
              retrySucceeded: payload.geoRetrySucceeded,
            },
          );
          await deliverMetaLead(
            repository,
            lead,
            payload.tracking,
            request,
            false,
            geoPolicy,
          );
        }
      } catch (error) {
        console.error("Initial Meta Lead delivery failed", error);
      }
    }
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
      { error: "Your subscription is safe, but we couldn’t record the skipped survey." },
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
  const submittedResearchCall =
    typeof payload.researchCall === "string" ? payload.researchCall : null;
  const researchCall = normalizeResearchCallValue(submittedResearchCall);
  const firstName = cleanName(payload.firstName);
  const lastName = cleanName(payload.lastName);
  const age = typeof payload.age === "number" ? payload.age : null;
  const gender = typeof payload.gender === "string" && payload.gender
    ? payload.gender
    : null;
  const frustration = cleanLongText(payload.frustration);

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
  if (!frustration || frustration.length < MIN_FRUSTRATION_LENGTH) {
    return jsonResponse(
      { error: "Write at least 20 characters before submitting." },
      400,
    );
  }
  if (!researchCall || !researchCallValues.has(researchCall)) {
    return jsonResponse({ error: "Choose a valid research-call response." }, 400);
  }
  if (!firstName) {
    return jsonResponse({ error: "Enter your first name." }, 400);
  }
  if (!lastName) {
    return jsonResponse({ error: "Enter your last name." }, 400);
  }
  if (age === null || !Number.isInteger(age) || age < MIN_AGE || age > MAX_AGE) {
    return jsonResponse(
      { error: `Enter an age between ${MIN_AGE} and ${MAX_AGE}.` },
      400,
    );
  }
  if (!gender || !genderValues.has(gender)) {
    return jsonResponse({ error: "Select a gender option." }, 400);
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
        frustration,
        researchCall,
        firstName,
        lastName,
        age,
        gender,
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


  if (action === "capture_email") return captureEmail(payload, request);
  if (action === "deliver_meta_lead") return deliverMetaLeadAction(payload, request);
  if (action === "submit_qualification") return submitQualification(payload, request);
  if (action === "skip_qualification") return skipQualification(payload, request);
  return jsonResponse({ error: "The submitted action is invalid." }, 400);
}
