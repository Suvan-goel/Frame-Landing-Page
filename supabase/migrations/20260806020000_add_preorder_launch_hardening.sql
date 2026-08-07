create table if not exists public.preorder_rate_limits (
  scope text not null,
  subject_hash text not null,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (scope, subject_hash),
  check (char_length(scope) between 1 and 100),
  check (char_length(subject_hash) = 64)
);

create index if not exists preorder_rate_limits_updated_idx
  on public.preorder_rate_limits(updated_at);

alter table public.preorder_rate_limits enable row level security;

create or replace function public.consume_preorder_rate_limit(
  p_scope text,
  p_subject_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.preorder_rate_limits%rowtype;
  v_now timestamptz := clock_timestamp();
  v_window interval;
begin
  if char_length(p_scope) < 1
     or char_length(p_scope) > 100
     or p_subject_hash !~ '^[0-9a-f]{64}$'
     or p_limit < 1
     or p_limit > 10000
     or p_window_seconds < 1
     or p_window_seconds > 604800 then
    raise exception using errcode = '22023', message = 'INVALID_PREORDER_RATE_LIMIT';
  end if;

  v_window := p_window_seconds * interval '1 second';

  insert into public.preorder_rate_limits (
    scope,
    subject_hash,
    window_started_at,
    request_count,
    updated_at
  ) values (
    p_scope,
    p_subject_hash,
    v_now,
    1,
    v_now
  )
  on conflict (scope, subject_hash) do update
    set window_started_at = case
          when public.preorder_rate_limits.window_started_at + v_window <= v_now
            then v_now
          else public.preorder_rate_limits.window_started_at
        end,
        request_count = case
          when public.preorder_rate_limits.window_started_at + v_window <= v_now
            then 1
          else public.preorder_rate_limits.request_count + 1
        end,
        updated_at = v_now
  returning * into v_row;

  allowed := v_row.request_count <= p_limit;
  remaining := greatest(p_limit - v_row.request_count, 0);
  retry_after_seconds := case
    when allowed then 0
    else greatest(
      ceil(extract(epoch from (v_row.window_started_at + v_window - v_now)))::integer,
      1
    )
  end;
  return next;
end;
$$;

revoke all on function public.consume_preorder_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_preorder_rate_limit(text, text, integer, integer)
  to service_role;

alter table public.stripe_webhook_events
  add column if not exists livemode boolean not null default false,
  add column if not exists processing_attempts integer not null default 0
    check (processing_attempts >= 0),
  add column if not exists last_attempted_at timestamptz;

create index if not exists stripe_webhook_events_recovery_idx
  on public.stripe_webhook_events(livemode, status, last_attempted_at desc);

comment on table public.preorder_rate_limits is
  'Privacy-preserving server-side throttles for public pre-order endpoints. Subject hashes are HMACs; raw client addresses are not stored.';
comment on column public.stripe_webhook_events.processing_attempts is
  'Number of signed webhook deliveries or authenticated owner recovery attempts processed by Frame.';
