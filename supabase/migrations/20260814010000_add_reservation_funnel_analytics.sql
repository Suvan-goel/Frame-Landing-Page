create table if not exists public.reservation_funnel_events (
  id bigint generated always as identity primary key,
  event_id uuid not null unique,
  session_id uuid not null,
  event_name text not null,
  page_path text not null,
  event_properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint reservation_funnel_events_name_value check (
    event_name in (
      'waitlist_form_viewed',
      'waitlist_email_submitted',
      'waitlist_email_success',
      'waitlist_email_error',
      'qualification_started',
      'qualification_skipped',
      'qualification_completed',
      'preorder_decline_started',
      'preorder_decline_completed',
      'reservation_objection_selected',
      'reservation_price_objection_selected',
      'reservation_willingness_band_selected',
      'reservation_evidence_objection_selected',
      'reservation_evidence_requirement_selected',
      'reservation_cta_viewed',
      'reservation_cta_clicked',
      'reservation_checkout_started',
      'reservation_checkout_error',
      'reservation_completed'
    )
  ),
  constraint reservation_funnel_events_page_path_value check (
    page_path like '/%' and
    page_path not like '%?%' and
    page_path not like '%#%' and
    char_length(page_path) between 1 and 200
  ),
  constraint reservation_funnel_events_properties_object check (
    jsonb_typeof(event_properties) = 'object'
  ),
  constraint reservation_funnel_events_properties_size check (
    octet_length(event_properties::text) <= 2048
  )
);

create index if not exists reservation_funnel_events_occurred_at_idx
  on public.reservation_funnel_events (occurred_at desc);

create index if not exists reservation_funnel_events_name_occurred_at_idx
  on public.reservation_funnel_events (event_name, occurred_at desc);

create index if not exists reservation_funnel_events_session_idx
  on public.reservation_funnel_events (session_id, occurred_at);

alter table public.reservation_funnel_events enable row level security;
revoke all on table public.reservation_funnel_events from public, anon, authenticated;
grant select, insert on table public.reservation_funnel_events to service_role;
grant usage, select on sequence public.reservation_funnel_events_id_seq to service_role;

comment on table public.reservation_funnel_events is
  'First-party, non-sensitive measurement for the Frame waitlist-to-reservation funnel.';

comment on column public.reservation_funnel_events.event_properties is
  'Whitelisted acquisition and funnel-choice labels only. Free text, email addresses and health answers are not accepted.';
