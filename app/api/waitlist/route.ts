import { ensureWaitlistStorage, getWaitlistDatabase } from "@/db/waitlist";

export const dynamic = "force-dynamic";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BODY_BYTES = 4_096;

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
    email?: unknown;
    website?: unknown;
    placement?: unknown;
    utmSource?: unknown;
    utmMedium?: unknown;
    utmCampaign?: unknown;
  };

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return jsonResponse({ error: "Enter a valid email address." }, 400);
  }

  // A filled honeypot is treated as success so automated submissions do not
  // receive a useful signal.
  if (typeof payload.website === "string" && payload.website.trim()) {
    return jsonResponse({ status: "joined" }, 201);
  }

  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  const normalizedEmail = email.toLowerCase();
  if (
    !email ||
    email.length > 254 ||
    !EMAIL_PATTERN.test(email) ||
    normalizedEmail.includes("..")
  ) {
    return jsonResponse({ error: "Enter a valid email address." }, 400);
  }

  try {
    await ensureWaitlistStorage();
    const database = await getWaitlistDatabase();
    const result = await database
      .prepare(
        `INSERT INTO waitlist_signups (
          email,
          normalized_email,
          placement,
          utm_source,
          utm_medium,
          utm_campaign
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(normalized_email) DO NOTHING`,
      )
      .bind(
        email,
        normalizedEmail,
        cleanAttribution(payload.placement) ?? "landing_page",
        cleanAttribution(payload.utmSource),
        cleanAttribution(payload.utmMedium),
        cleanAttribution(payload.utmCampaign),
      )
      .run();

    const joined = Number(result.meta.changes ?? 0) > 0;
    return jsonResponse(
      { status: joined ? "joined" : "already_joined" },
      joined ? 201 : 200,
    );
  } catch (error) {
    console.error("Waitlist signup failed", error);
    return jsonResponse(
      { error: "We couldn’t save your email. Please try again shortly." },
      503,
    );
  }
}
