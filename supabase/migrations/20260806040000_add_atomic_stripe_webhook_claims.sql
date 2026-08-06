create or replace function public.claim_stripe_webhook_event(
  p_event_id text,
  p_event_type text,
  p_livemode boolean,
  p_stale_after_seconds integer
)
returns table (
  duplicate boolean,
  processing_attempts integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.stripe_webhook_events%rowtype;
  v_inserted integer := 0;
  v_now timestamptz := clock_timestamp();
begin
  if char_length(p_event_id) < 6
     or char_length(p_event_id) > 255
     or char_length(p_event_type) < 1
     or char_length(p_event_type) > 255
     or p_stale_after_seconds < 30
     or p_stale_after_seconds > 3600 then
    raise exception using errcode = '22023', message = 'INVALID_STRIPE_WEBHOOK_CLAIM';
  end if;

  insert into public.stripe_webhook_events (
    event_id,
    event_type,
    livemode,
    status,
    error_message,
    received_at,
    processed_at,
    processing_attempts,
    last_attempted_at
  ) values (
    p_event_id,
    p_event_type,
    p_livemode,
    'processing',
    null,
    v_now,
    null,
    1,
    v_now
  )
  on conflict (event_id) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 1 then
    return query select false, 1;
    return;
  end if;

  select *
    into v_event
    from public.stripe_webhook_events
   where event_id = p_event_id
   for update;

  if v_event.status = 'processed'
     or (
       v_event.status = 'processing'
       and v_event.last_attempted_at is not null
       and v_event.last_attempted_at > v_now - make_interval(secs => p_stale_after_seconds)
     ) then
    return query select true, v_event.processing_attempts;
    return;
  end if;

  update public.stripe_webhook_events
     set event_type = p_event_type,
         livemode = p_livemode,
         status = 'processing',
         error_message = null,
         processed_at = null,
         processing_attempts = v_event.processing_attempts + 1,
         last_attempted_at = v_now
   where event_id = p_event_id
   returning * into v_event;

  return query select false, v_event.processing_attempts;
end;
$$;

revoke all on function public.claim_stripe_webhook_event(text, text, boolean, integer)
  from public, anon, authenticated;
grant execute on function public.claim_stripe_webhook_event(text, text, boolean, integer)
  to service_role;

comment on function public.claim_stripe_webhook_event(text, text, boolean, integer) is
  'Atomically claims a Stripe webhook for processing, suppressing concurrent duplicates while allowing failed or stale work to be recovered.';
