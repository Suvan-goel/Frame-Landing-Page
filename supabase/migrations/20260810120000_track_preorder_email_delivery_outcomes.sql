alter table public.preorder_email_deliveries
  add column if not exists provider_tracking_expected boolean not null default false,
  add column if not exists last_event text,
  add column if not exists last_event_at timestamptz,
  add column if not exists delivered_at timestamptz;

alter table public.preorder_email_deliveries
  drop constraint if exists preorder_email_deliveries_status_check;

alter table public.preorder_email_deliveries
  add constraint preorder_email_deliveries_status_check
  check (status in (
    'pending',
    'sent',
    'delivered',
    'delayed',
    'failed',
    'bounced',
    'complained',
    'suppressed'
  ));

update public.preorder_email_deliveries
   set last_event = case
         when status = 'sent' then 'email.sent'
         when status = 'failed' then 'email.failed'
         else last_event
       end,
       last_event_at = coalesce(last_event_at, sent_at, updated_at)
 where last_event is null
   and status in ('sent', 'failed');

create index if not exists preorder_email_deliveries_provider_message_idx
  on public.preorder_email_deliveries(provider_message_id)
  where provider_message_id is not null;

create index if not exists preorder_email_deliveries_outcome_idx
  on public.preorder_email_deliveries(status, last_event_at desc)
  where provider_tracking_expected;

create or replace function public.apply_preorder_email_provider_event(
  p_provider_message_id text,
  p_event_type text,
  p_event_at timestamptz
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
  v_updated integer := 0;
begin
  if p_provider_message_id is null
     or char_length(p_provider_message_id) < 6
     or char_length(p_provider_message_id) > 255
     or p_event_at is null then
    raise exception using errcode = '22023', message = 'INVALID_PREORDER_EMAIL_PROVIDER_EVENT';
  end if;

  v_status := case p_event_type
    when 'email.sent' then 'sent'
    when 'email.delivered' then 'delivered'
    when 'email.delivery_delayed' then 'delayed'
    when 'email.failed' then 'failed'
    when 'email.bounced' then 'bounced'
    when 'email.complained' then 'complained'
    when 'email.suppressed' then 'suppressed'
    else null
  end;

  if v_status is null then
    return 0;
  end if;

  update public.preorder_email_deliveries
     set status = v_status,
         provider_tracking_expected = true,
         last_event = p_event_type,
         last_event_at = p_event_at,
         delivered_at = case
           when v_status = 'delivered' then coalesce(delivered_at, p_event_at)
           else delivered_at
         end,
         error_message = case v_status
           when 'delivered' then null
           when 'sent' then null
           when 'delayed' then 'Resend reported a temporary delivery delay.'
           when 'failed' then 'Resend reported that the email failed to send.'
           when 'bounced' then 'The recipient mail server permanently rejected the email.'
           when 'complained' then 'The recipient reported the email as spam.'
           when 'suppressed' then 'Resend suppressed delivery to the recipient.'
           else error_message
         end,
         updated_at = clock_timestamp()
   where provider_message_id = p_provider_message_id
     and (last_event_at is null or last_event_at <= p_event_at)
     and not (
       (
         preorder_email_deliveries.status = 'delivered'
         and v_status in ('sent', 'delayed')
       )
       or (
         preorder_email_deliveries.status in ('failed', 'bounced', 'complained', 'suppressed')
         and v_status in ('sent', 'delayed', 'delivered')
       )
     );

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.apply_preorder_email_provider_event(text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.apply_preorder_email_provider_event(text, text, timestamptz)
  to service_role;

comment on column public.preorder_email_deliveries.provider_tracking_expected is
  'True for sends created after provider-outcome tracking was enabled; legacy sends remain false.';
comment on column public.preorder_email_deliveries.last_event is
  'Latest timestamp-ordered Resend event applied to this transactional email.';
comment on column public.preorder_email_deliveries.delivered_at is
  'When Resend reported successful delivery to the recipient mail server.';
comment on function public.apply_preorder_email_provider_event(text, text, timestamptz) is
  'Atomically applies signed Resend outcomes without allowing out-of-order events to overwrite newer or terminal failure states.';
