import {
  isLandingDiagnosticId,
  parseLandingDiagnosticEvents,
} from "@/lib/landing-diagnostics";
import { getSupabaseAdmin } from "@/lib/supabase-admin.server";

export const dynamic = "force-dynamic";

const MAX_DIAGNOSTIC_BODY_BYTES = 4_096;

function noStoreResponse(status: number) {
  return new Response(null, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  if (request.headers.get("origin") !== requestUrl.origin) {
    return noStoreResponse(403);
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_DIAGNOSTIC_BODY_BYTES
  ) {
    return noStoreResponse(413);
  }

  let payload: unknown;
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > MAX_DIAGNOSTIC_BODY_BYTES) {
      return noStoreResponse(413);
    }
    payload = JSON.parse(body) as unknown;
  } catch {
    return noStoreResponse(400);
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return noStoreResponse(400);
  }
  const candidate = payload as Record<string, unknown>;
  if (
    Object.keys(candidate).some((key) => key !== "id" && key !== "events") ||
    !isLandingDiagnosticId(candidate.id)
  ) {
    return noStoreResponse(400);
  }
  const events = parseLandingDiagnosticEvents(candidate.events);
  if (!events) return noStoreResponse(400);

  try {
    const supabase = await getSupabaseAdmin();
    const { error } = await supabase.rpc(
      "record_landing_diagnostic_milestones",
      {
        p_id: candidate.id,
        p_events: events,
      },
    );
    if (error) {
      console.error("Landing diagnostic write failed", error.code);
    }
  } catch {
    console.error("Landing diagnostic write failed", "unexpected_error");
  }

  // Diagnostic persistence is deliberately fail-open for the visitor.
  return noStoreResponse(204);
}
