import { getRuntimeValue } from "./runtime-env.server";
import { META_PIXEL_ID } from "./meta-tracking";

export const META_GRAPH_API_VERSION = "v26.0";
const META_CAPI_TIMEOUT_MS = 2_500;

export type MetaCapiStatus =
  | "sent"
  | "skipped_not_configured"
  | "failed";

export type MetaCapiResult = {
  status: MetaCapiStatus;
  error: string | null;
};

type MetaLeadConversionInput = {
  eventId: string;
  email: string;
  eventTime: number;
  eventSourceUrl: string;
  clientIpAddress: string | null;
  clientUserAgent: string | null;
  metaClickId: string | null;
  fbp: string | null;
  fbc: string | null;
};

type SendMetaLeadOptions = {
  accessToken?: string | null;
  testEventCode?: string | null;
  fetcher?: typeof fetch;
};

function normalizedMetaIdentifier(value: string | null) {
  if (!value) return null;
  const cleaned = value.trim().slice(0, 500);
  return cleaned || null;
}

function resolvedFbc(input: MetaLeadConversionInput) {
  const supplied = normalizedMetaIdentifier(input.fbc);
  if (supplied?.startsWith("fb.")) return supplied;

  const clickId = normalizedMetaIdentifier(input.metaClickId);
  return clickId ? `fb.1.${input.eventTime * 1000}.${clickId}` : null;
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function buildMetaLeadPayload(input: MetaLeadConversionInput) {
  const userData: Record<string, string | string[]> = {
    em: [await sha256Hex(input.email)],
  };
  const fbp = normalizedMetaIdentifier(input.fbp);
  const fbc = resolvedFbc(input);
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;
  if (input.clientIpAddress) {
    userData.client_ip_address = input.clientIpAddress;
  }
  if (input.clientUserAgent) {
    userData.client_user_agent = input.clientUserAgent;
  }

  return {
    data: [
      {
        event_name: "Lead",
        event_time: input.eventTime,
        event_id: input.eventId,
        event_source_url: input.eventSourceUrl,
        action_source: "website",
        user_data: userData,
        custom_data: {
          content_name: "Frame updates signup",
        },
      },
    ],
  };
}

function safeMetaError(status: number, responseText: string) {
  try {
    const parsed = JSON.parse(responseText) as {
      error?: { code?: unknown; error_subcode?: unknown; type?: unknown };
    };
    const code =
      typeof parsed.error?.code === "number" ? parsed.error.code : null;
    const subcode =
      typeof parsed.error?.error_subcode === "number"
        ? parsed.error.error_subcode
        : null;
    const type =
      typeof parsed.error?.type === "string"
        ? parsed.error.type.replace(/[^A-Za-z0-9_ -]/g, "").slice(0, 80)
        : null;
    return [
      `Meta API ${status}`,
      code === null ? null : `code ${code}`,
      subcode === null ? null : `subcode ${subcode}`,
      type,
    ]
      .filter(Boolean)
      .join("; ");
  } catch {
    return `Meta API ${status}`;
  }
}

export async function sendMetaLeadConversion(
  input: MetaLeadConversionInput,
  options: SendMetaLeadOptions = {},
): Promise<MetaCapiResult> {
  const accessToken =
    options.accessToken ??
    (await getRuntimeValue("META_CONVERSIONS_API_ACCESS_TOKEN"));
  if (!accessToken?.trim()) {
    return { status: "skipped_not_configured", error: null };
  }

  const testEventCode =
    options.testEventCode ??
    (await getRuntimeValue("META_CONVERSIONS_API_TEST_EVENT_CODE"));
  const payload = {
    ...(await buildMetaLeadPayload(input)),
    access_token: accessToken.trim(),
    ...(testEventCode?.trim()
      ? { test_event_code: testEventCode.trim() }
      : {}),
  };

  try {
    const response = await (options.fetcher ?? fetch)(
      `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${META_PIXEL_ID}/events`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(META_CAPI_TIMEOUT_MS),
      },
    );
    const responseText = await response.text();
    if (!response.ok) {
      return {
        status: "failed",
        error: safeMetaError(response.status, responseText),
      };
    }
    try {
      const parsed = JSON.parse(responseText) as { events_received?: unknown };
      if (
        typeof parsed.events_received === "number" &&
        parsed.events_received < 1
      ) {
        return {
          status: "failed",
          error: "Meta API accepted no events",
        };
      }
    } catch {
      // A successful HTTP response is accepted if Meta returns no JSON body.
    }
    return { status: "sent", error: null };
  } catch (error) {
    return {
      status: "failed",
      error:
        error instanceof Error
          ? `Meta API request failed: ${error.name}`
          : "Meta API request failed",
    };
  }
}
