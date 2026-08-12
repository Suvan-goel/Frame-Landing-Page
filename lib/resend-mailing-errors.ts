const RESEND_QUOTA_ERROR_CODES = new Set([
  "daily_quota_exceeded",
  "monthly_quota_exceeded",
]);

export class ResendMailingError extends Error {
  readonly code: string | null;
  readonly retryAfterSeconds: number | null;

  constructor(
    message: string,
    options: { code?: string | null; retryAfterSeconds?: number | null } = {},
  ) {
    super(message);
    this.name = "ResendMailingError";
    this.code = options.code ?? null;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
  }
}

function parsedResendFailure(value: string) {
  try {
    const parsed = JSON.parse(value) as { name?: unknown; message?: unknown };
    return {
      code: typeof parsed.name === "string" ? parsed.name : null,
      detail: typeof parsed.message === "string" ? parsed.message : "",
    };
  } catch {
    return { code: null, detail: value };
  }
}

export function resendMailingFailureMessage(value: unknown) {
  const raw = value instanceof Error ? value.message : typeof value === "string" ? value : "";
  const suppliedCode = value instanceof ResendMailingError ? value.code : null;
  const parsed = parsedResendFailure(raw);
  const code = suppliedCode ?? parsed.code;

  if (code === "daily_quota_exceeded" || raw.includes("daily_quota_exceeded")) {
    return "Resend’s daily email quota has been reached. Upgrade the Resend sending plan or retry the failed recipients after the quota resets.";
  }
  if (code === "monthly_quota_exceeded" || raw.includes("monthly_quota_exceeded")) {
    return "Resend’s monthly email quota has been reached. Upgrade the Resend sending plan or retry the failed recipients after the quota resets.";
  }
  if (code === "rate_limit_exceeded" || raw.includes("rate_limit_exceeded")) {
    return "Resend is temporarily limiting email requests. Retry the failed recipients in a minute.";
  }

  return (parsed.detail || raw || "Email provider request failed.").slice(0, 500);
}

export function isResendQuotaFailure(value: unknown) {
  if (value instanceof ResendMailingError && value.code) {
    return RESEND_QUOTA_ERROR_CODES.has(value.code);
  }
  const raw = value instanceof Error ? value.message : typeof value === "string" ? value : "";
  const parsed = parsedResendFailure(raw);
  return Boolean(
    (parsed.code && RESEND_QUOTA_ERROR_CODES.has(parsed.code)) ||
      [...RESEND_QUOTA_ERROR_CODES].some((code) => raw.includes(code)),
  );
}

export async function resendResponseError(response: Response, fallback: string) {
  const raw = (await response.text()).slice(0, 500);
  const parsed = parsedResendFailure(raw);
  const retryAfter = Number(response.headers.get("retry-after"));
  return new ResendMailingError(resendMailingFailureMessage(raw || fallback), {
    code: parsed.code,
    retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
  });
}
