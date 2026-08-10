alter table public.waitlist_signups
  add column if not exists meta_event_id uuid,
  add column if not exists meta_tracking_policy_mode text,
  add column if not exists meta_tracking_consent_state text,
  add column if not exists meta_tracking_decision text,
  add column if not exists meta_tracking_client_state_valid boolean,
  add column if not exists meta_gpc boolean,
  add column if not exists meta_pixel_ready_at_capture boolean,
  add column if not exists meta_browser_lead_attempted_at timestamptz,
  add column if not exists meta_capi_status text not null default 'not_attempted',
  add column if not exists meta_capi_sent_at timestamptz,
  add column if not exists meta_capi_last_error text,
  add column if not exists meta_tracking_recorded_at timestamptz;

update public.waitlist_signups
set meta_event_id = gen_random_uuid()
where meta_event_id is null;

alter table public.waitlist_signups
  alter column meta_event_id set default gen_random_uuid(),
  alter column meta_event_id set not null;

create unique index if not exists waitlist_signups_meta_event_id_unique
  on public.waitlist_signups(meta_event_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'waitlist_signups_meta_tracking_policy_mode_value'
      and conrelid = 'public.waitlist_signups'::regclass
  ) then
    alter table public.waitlist_signups
      add constraint waitlist_signups_meta_tracking_policy_mode_value
      check (
        meta_tracking_policy_mode is null
        or meta_tracking_policy_mode in ('explicit-consent', 'us-opt-out')
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'waitlist_signups_meta_tracking_consent_state_value'
      and conrelid = 'public.waitlist_signups'::regclass
  ) then
    alter table public.waitlist_signups
      add constraint waitlist_signups_meta_tracking_consent_state_value
      check (
        meta_tracking_consent_state is null
        or meta_tracking_consent_state in ('granted', 'denied', 'unset')
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'waitlist_signups_meta_capi_status_value'
      and conrelid = 'public.waitlist_signups'::regclass
  ) then
    alter table public.waitlist_signups
      add constraint waitlist_signups_meta_capi_status_value
      check (
        meta_capi_status in (
          'not_attempted',
          'sent',
          'skipped_not_configured',
          'skipped_not_permitted',
          'failed'
        )
      );
  end if;
end
$$;

comment on column public.waitlist_signups.meta_event_id is
  'Non-secret stable conversion identifier shared by Meta Pixel and Conversions API for Lead deduplication.';

comment on column public.waitlist_signups.meta_tracking_decision is
  'Coarse privacy decision reason recorded without survey answers, free text, IP address, or user agent.';

comment on column public.waitlist_signups.meta_capi_last_error is
  'Sanitised Meta delivery status, numeric error code, and error type; never contains request data or the access token.';
