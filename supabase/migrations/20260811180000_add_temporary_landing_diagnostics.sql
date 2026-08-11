create table if not exists public.landing_diagnostics (
  id uuid primary key,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '48 hours'),
  page_path text not null default '/',
  meta_attributed boolean not null default true,
  utm_campaign_id text,
  server_arrived_at timestamptz,
  server_responded_at timestamptz,
  document_status smallint,
  html_executed_at timestamptz,
  dom_ready_at timestamptz,
  hydrated_at timestamptz,
  geo_resolved_at timestamptz,
  geo_status text,
  geo_policy text,
  geo_failure_code text,
  pixel_initialized_at timestamptz,
  pixel_script_loaded_at timestamptz,
  pixel_failure_at timestamptz,
  pixel_failure_code text,
  pageview_attempted_at timestamptz,
  pageview_network_observed_at timestamptz,
  lead_attempted_at timestamptz,
  lead_completed_at timestamptz,
  client_failure_at timestamptz,
  client_failure_code text,
  last_milestone text,
  updated_at timestamptz not null default now(),
  constraint landing_diagnostics_expiration_window check (
    expires_at > created_at
    and expires_at <= created_at + interval '48 hours'
  ),
  constraint landing_diagnostics_page_path check (page_path = '/'),
  constraint landing_diagnostics_meta_attributed check (meta_attributed is true),
  constraint landing_diagnostics_campaign_id check (
    utm_campaign_id is null or utm_campaign_id ~ '^[0-9]{1,32}$'
  ),
  constraint landing_diagnostics_document_status check (
    document_status is null or document_status between 100 and 599
  ),
  constraint landing_diagnostics_geo_status check (
    geo_status is null
    or geo_status in ('success', 'timeout', 'fetch_failed', 'unresolved', 'invalid')
  ),
  constraint landing_diagnostics_geo_policy check (
    geo_policy is null or geo_policy in ('us-opt-out', 'explicit-consent')
  ),
  constraint landing_diagnostics_geo_failure_code check (
    geo_failure_code is null
    or geo_failure_code in (
      'timeout',
      'fetch_failed',
      'missing_country',
      'missing_region',
      'invalid_region',
      'missing_token',
      'invalid_token',
      'policy_mismatch'
    )
  ),
  constraint landing_diagnostics_pixel_failure_code check (
    pixel_failure_code is null
    or pixel_failure_code in (
      'bootstrap_error',
      'script_error',
      'script_timeout',
      'fbq_unavailable'
    )
  ),
  constraint landing_diagnostics_client_failure_code check (
    client_failure_code is null
    or client_failure_code in (
      'uncaught_error',
      'unhandled_rejection',
      'collector_error'
    )
  ),
  constraint landing_diagnostics_last_milestone check (
    last_milestone is null
    or last_milestone in (
      'server_arrived',
      'server_responded',
      'html_executed',
      'dom_ready',
      'hydrated',
      'geo_resolved',
      'pixel_initialized',
      'pixel_script_loaded',
      'pixel_failure',
      'pageview_attempted',
      'pageview_network_observed',
      'lead_attempted',
      'lead_completed',
      'client_failure'
    )
  )
);

create index if not exists landing_diagnostics_server_arrived_idx
  on public.landing_diagnostics (server_arrived_at);

create index if not exists landing_diagnostics_expires_idx
  on public.landing_diagnostics (expires_at);

alter table public.landing_diagnostics enable row level security;
revoke all on table public.landing_diagnostics from anon, authenticated;
grant select, insert, update, delete on table public.landing_diagnostics to service_role;

create or replace function public.record_landing_diagnostic_arrival(
  p_id uuid,
  p_campaign_id text,
  p_server_arrived_at timestamptz,
  p_server_responded_at timestamptz default null,
  p_document_status smallint default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_campaign_id is not null and p_campaign_id !~ '^[0-9]{1,32}$' then
    raise exception 'invalid campaign id';
  end if;
  if p_document_status is not null and p_document_status not between 100 and 599 then
    raise exception 'invalid document status';
  end if;

  insert into public.landing_diagnostics (
    id,
    created_at,
    expires_at,
    page_path,
    meta_attributed,
    utm_campaign_id,
    server_arrived_at,
    server_responded_at,
    document_status,
    last_milestone,
    updated_at
  ) values (
    p_id,
    p_server_arrived_at,
    p_server_arrived_at + interval '48 hours',
    '/',
    true,
    p_campaign_id,
    p_server_arrived_at,
    p_server_responded_at,
    p_document_status,
    case when p_server_responded_at is null then 'server_arrived' else 'server_responded' end,
    now()
  )
  on conflict (id) do update set
    created_at = least(landing_diagnostics.created_at, excluded.created_at),
    expires_at = least(landing_diagnostics.created_at, excluded.created_at) + interval '48 hours',
    utm_campaign_id = coalesce(landing_diagnostics.utm_campaign_id, excluded.utm_campaign_id),
    server_arrived_at = coalesce(landing_diagnostics.server_arrived_at, excluded.server_arrived_at),
    server_responded_at = coalesce(landing_diagnostics.server_responded_at, excluded.server_responded_at),
    document_status = coalesce(landing_diagnostics.document_status, excluded.document_status),
    last_milestone = case
      when excluded.server_responded_at is not null then 'server_responded'
      else landing_diagnostics.last_milestone
    end,
    updated_at = now();
end;
$$;

create or replace function public.record_landing_diagnostic_milestones(
  p_id uuid,
  p_events jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  diagnostic_event jsonb;
  milestone text;
  event_time timestamptz := clock_timestamp();
begin
  if jsonb_typeof(p_events) <> 'array'
    or jsonb_array_length(p_events) < 1
    or jsonb_array_length(p_events) > 16 then
    raise exception 'invalid diagnostic event batch';
  end if;

  insert into public.landing_diagnostics (id)
  values (p_id)
  on conflict (id) do nothing;

  for diagnostic_event in select value from jsonb_array_elements(p_events)
  loop
    milestone := diagnostic_event ->> 'milestone';

    case milestone
      when 'html_executed' then
        update public.landing_diagnostics
        set html_executed_at = coalesce(html_executed_at, event_time)
        where id = p_id;
      when 'dom_ready' then
        update public.landing_diagnostics
        set dom_ready_at = coalesce(dom_ready_at, event_time)
        where id = p_id;
      when 'hydrated' then
        update public.landing_diagnostics
        set hydrated_at = coalesce(hydrated_at, event_time)
        where id = p_id;
      when 'geo_resolved' then
        update public.landing_diagnostics
        set
          geo_resolved_at = coalesce(geo_resolved_at, event_time),
          geo_status = coalesce(geo_status, diagnostic_event ->> 'geoStatus'),
          geo_policy = coalesce(geo_policy, diagnostic_event ->> 'geoPolicy'),
          geo_failure_code = coalesce(geo_failure_code, diagnostic_event ->> 'geoFailureCode')
        where id = p_id;
      when 'pixel_initialized' then
        update public.landing_diagnostics
        set pixel_initialized_at = coalesce(pixel_initialized_at, event_time)
        where id = p_id;
      when 'pixel_script_loaded' then
        update public.landing_diagnostics
        set pixel_script_loaded_at = coalesce(pixel_script_loaded_at, event_time)
        where id = p_id;
      when 'pixel_failure' then
        update public.landing_diagnostics
        set
          pixel_failure_at = coalesce(pixel_failure_at, event_time),
          pixel_failure_code = coalesce(pixel_failure_code, diagnostic_event ->> 'pixelFailureCode')
        where id = p_id;
      when 'pageview_attempted' then
        update public.landing_diagnostics
        set pageview_attempted_at = coalesce(pageview_attempted_at, event_time)
        where id = p_id;
      when 'pageview_network_observed' then
        update public.landing_diagnostics
        set pageview_network_observed_at = coalesce(pageview_network_observed_at, event_time)
        where id = p_id;
      when 'lead_attempted' then
        update public.landing_diagnostics
        set lead_attempted_at = coalesce(lead_attempted_at, event_time)
        where id = p_id;
      when 'lead_completed' then
        update public.landing_diagnostics
        set lead_completed_at = coalesce(lead_completed_at, event_time)
        where id = p_id;
      when 'client_failure' then
        update public.landing_diagnostics
        set
          client_failure_at = coalesce(client_failure_at, event_time),
          client_failure_code = coalesce(client_failure_code, diagnostic_event ->> 'clientFailureCode')
        where id = p_id;
      else
        raise exception 'invalid diagnostic milestone';
    end case;

    update public.landing_diagnostics
    set last_milestone = milestone, updated_at = event_time
    where id = p_id;
  end loop;
end;
$$;

create or replace function public.purge_expired_landing_diagnostics()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.landing_diagnostics where expires_at <= now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.record_landing_diagnostic_arrival(uuid, text, timestamptz, timestamptz, smallint) from public, anon, authenticated;
revoke all on function public.record_landing_diagnostic_milestones(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.purge_expired_landing_diagnostics() from public, anon, authenticated;
grant execute on function public.record_landing_diagnostic_arrival(uuid, text, timestamptz, timestamptz, smallint) to service_role;
grant execute on function public.record_landing_diagnostic_milestones(uuid, jsonb) to service_role;
grant execute on function public.purge_expired_landing_diagnostics() to service_role;

comment on table public.landing_diagnostics is
  'Temporary first-party landing-funnel milestones. One random ID per document; no advertising IDs, contact data, health data, demographics, referrer, user agent, or free text.';

comment on column public.landing_diagnostics.id is
  'Random per-document diagnostic ID. It is never stored in a cookie or browser storage.';

comment on column public.landing_diagnostics.meta_attributed is
  'Boolean derived at the edge from Meta click or allowlisted paid-Meta UTM presence; source identifiers are discarded.';

comment on column public.landing_diagnostics.expires_at is
  'Hard deletion deadline, no later than 48 hours after the first server arrival.';
