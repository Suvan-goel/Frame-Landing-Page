import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizedResendEventTimestamp,
  preorderEmailStatusForResendEvent,
} from "./preorder-email-delivery-events";

type ResendEmailEvent = {
  type: string;
  created_at?: string;
  data?: { email_id?: string; to?: string[] };
};

export async function applyPreorderEmailProviderEvent(input: {
  supabase: SupabaseClient;
  event: ResendEmailEvent;
  fallbackEventAt: string;
}) {
  const providerMessageId = input.event.data?.email_id ?? null;
  const status = preorderEmailStatusForResendEvent(input.event.type);
  if (!providerMessageId || !status) {
    return { matched: false, status };
  }
  const eventAt = normalizedResendEventTimestamp(
    input.event.created_at,
    input.fallbackEventAt,
  );
  const applied = await input.supabase.rpc("apply_preorder_email_provider_event", {
    p_provider_message_id: providerMessageId,
    p_event_type: input.event.type,
    p_event_at: eventAt,
  });
  if (applied.error) throw applied.error;
  return { matched: Number(applied.data ?? 0) > 0, status };
}

export async function replayStoredPreorderEmailProviderEvents(input: {
  supabase: SupabaseClient;
  providerMessageId: string;
}) {
  const stored = await input.supabase
    .from("email_webhook_events")
    .select("payload")
    .eq("provider_message_id", input.providerMessageId)
    .order("processed_at", { ascending: true })
    .limit(100)
    .returns<Array<{ payload: ResendEmailEvent }>>();
  if (stored.error) throw stored.error;
  const fallbackEventAt = new Date().toISOString();
  for (const row of stored.data ?? []) {
    await applyPreorderEmailProviderEvent({
      supabase: input.supabase,
      event: row.payload,
      fallbackEventAt,
    });
  }
}
