import { parseReservationFunnelEvent } from "@/lib/funnel-analytics";
import { getSupabaseAdmin } from "@/lib/supabase-admin.server";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4_096;

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
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return noStoreResponse(413);
  }

  let payload: unknown;
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
      return noStoreResponse(413);
    }
    payload = JSON.parse(body) as unknown;
  } catch {
    return noStoreResponse(400);
  }

  const event = parseReservationFunnelEvent(payload);
  if (!event) return noStoreResponse(400);

  try {
    const supabase = await getSupabaseAdmin();
    const { error } = await supabase.from("reservation_funnel_events").upsert(
      {
        event_id: event.eventId,
        session_id: event.sessionId,
        event_name: event.event,
        page_path: event.pagePath,
        event_properties: event.properties,
      },
      { onConflict: "event_id", ignoreDuplicates: true },
    );
    if (error) {
      console.error("Reservation funnel event write failed", error.code);
      return noStoreResponse(503);
    }
  } catch {
    console.error("Reservation funnel event write failed", "unexpected_error");
    return noStoreResponse(503);
  }

  return noStoreResponse(204);
}
