alter table public.preorder_checkout_intents
  add column if not exists environment text not null default 'test'
    check (environment in ('test', 'live')),
  add column if not exists request_key uuid not null default gen_random_uuid();

alter table public.preorders
  add column if not exists environment text not null default 'test'
    check (environment in ('test', 'live'));

alter table public.preorder_payments
  add column if not exists environment text not null default 'test'
    check (environment in ('test', 'live'));

create unique index if not exists preorder_checkout_intents_request_key_idx
  on public.preorder_checkout_intents(environment, request_key);
create index if not exists preorder_checkout_intents_environment_status_idx
  on public.preorder_checkout_intents(environment, status, expires_at);
create index if not exists preorders_environment_order_idx
  on public.preorders(environment, order_number desc);
create index if not exists preorder_payments_environment_idx
  on public.preorder_payments(environment, created_at desc);

create table if not exists public.preorder_sales_controls (
  environment text primary key check (environment in ('test', 'live')),
  sales_status text not null default 'paused'
    check (sales_status in ('open', 'paused', 'sold_out')),
  unit_limit integer check (unit_limit is null or unit_limit > 0),
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.preorder_sales_controls (environment, sales_status, unit_limit)
values
  ('test', 'open', null),
  ('live', 'paused', null)
on conflict (environment) do nothing;

alter table public.preorder_sales_controls enable row level security;

create or replace function public.reserve_preorder_checkout(
  p_request_key uuid,
  p_environment text,
  p_sku text,
  p_quantity smallint,
  p_unit_amount integer,
  p_currency text,
  p_estimated_delivery text,
  p_source text,
  p_utm_source text,
  p_utm_medium text,
  p_utm_campaign text,
  p_terms_version text,
  p_product_status_version text,
  p_terms_accepted_at timestamptz,
  p_product_status_acknowledged_at timestamptz,
  p_marketing_opt_in boolean,
  p_marketing_consent_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_control public.preorder_sales_controls%rowtype;
  v_existing public.preorder_checkout_intents%rowtype;
  v_paid_units bigint := 0;
  v_reserved_units bigint := 0;
  v_intent_id uuid;
begin
  if p_environment not in ('test', 'live') then
    raise exception using errcode = 'P0001', message = 'PREORDER_INVALID_ENVIRONMENT';
  end if;

  select *
    into v_control
    from public.preorder_sales_controls
   where environment = p_environment
   for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'PREORDER_CONTROL_MISSING';
  end if;

  update public.preorder_checkout_intents
     set status = 'expired', updated_at = now()
   where environment = p_environment
     and status in ('created', 'checkout_open')
     and expires_at is not null
     and expires_at <= now();

  select *
    into v_existing
    from public.preorder_checkout_intents
   where environment = p_environment
     and request_key = p_request_key;

  if found and v_existing.status in ('created', 'checkout_open') then
    return v_existing.id;
  elsif found and v_existing.status = 'paid' then
    raise exception using errcode = 'P0001', message = 'PREORDER_REQUEST_ALREADY_COMPLETED';
  end if;

  if v_control.sales_status = 'paused' then
    raise exception using errcode = 'P0001', message = 'PREORDER_PAUSED';
  elsif v_control.sales_status = 'sold_out' then
    raise exception using errcode = 'P0001', message = 'PREORDER_SOLD_OUT';
  end if;

  select coalesce(sum(items.quantity), 0)
    into v_paid_units
    from public.preorders orders
    join public.preorder_order_items items on items.preorder_id = orders.id
   where orders.environment = p_environment
     and orders.order_status <> 'cancelled'
     and orders.payment_status <> 'refunded';

  select coalesce(sum(quantity), 0)
    into v_reserved_units
    from public.preorder_checkout_intents
   where environment = p_environment
     and status in ('created', 'checkout_open')
     and (expires_at is null or expires_at > now())
     and (v_existing.id is null or id <> v_existing.id);

  if v_control.unit_limit is not null
     and v_paid_units + v_reserved_units + p_quantity > v_control.unit_limit then
    raise exception using errcode = 'P0001', message = 'PREORDER_SOLD_OUT';
  end if;

  if v_existing.id is not null then
    update public.preorder_checkout_intents
       set status = 'created',
           sku = p_sku,
           quantity = p_quantity,
           unit_amount = p_unit_amount,
           currency = p_currency,
           estimated_delivery = p_estimated_delivery,
           source = p_source,
           utm_source = p_utm_source,
           utm_medium = p_utm_medium,
           utm_campaign = p_utm_campaign,
           terms_version = p_terms_version,
           product_status_version = p_product_status_version,
           terms_accepted_at = p_terms_accepted_at,
           product_status_acknowledged_at = p_product_status_acknowledged_at,
           marketing_opt_in = p_marketing_opt_in,
           marketing_consent_at = p_marketing_consent_at,
           stripe_checkout_session_id = null,
           stripe_customer_id = null,
           expires_at = now() + interval '24 hours',
           updated_at = now()
     where id = v_existing.id
     returning id into v_intent_id;
  else
    insert into public.preorder_checkout_intents (
      environment,
      request_key,
      status,
      sku,
      quantity,
      unit_amount,
      currency,
      estimated_delivery,
      source,
      utm_source,
      utm_medium,
      utm_campaign,
      terms_version,
      product_status_version,
      terms_accepted_at,
      product_status_acknowledged_at,
      marketing_opt_in,
      marketing_consent_at,
      expires_at
    ) values (
      p_environment,
      p_request_key,
      'created',
      p_sku,
      p_quantity,
      p_unit_amount,
      p_currency,
      p_estimated_delivery,
      p_source,
      p_utm_source,
      p_utm_medium,
      p_utm_campaign,
      p_terms_version,
      p_product_status_version,
      p_terms_accepted_at,
      p_product_status_acknowledged_at,
      p_marketing_opt_in,
      p_marketing_consent_at,
      now() + interval '24 hours'
    )
    returning id into v_intent_id;
  end if;

  return v_intent_id;
end;
$$;

create or replace function public.get_preorder_sales_snapshot(p_environment text)
returns table (
  environment text,
  sales_status text,
  unit_limit integer,
  paid_units bigint,
  reserved_units bigint,
  remaining_units bigint,
  updated_at timestamptz,
  updated_by text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with paid as (
    select coalesce(sum(items.quantity), 0)::bigint as units
      from public.preorders orders
      join public.preorder_order_items items on items.preorder_id = orders.id
     where orders.environment = p_environment
       and orders.order_status <> 'cancelled'
       and orders.payment_status <> 'refunded'
  ), reserved as (
    select coalesce(sum(quantity), 0)::bigint as units
      from public.preorder_checkout_intents
     where preorder_checkout_intents.environment = p_environment
       and status in ('created', 'checkout_open')
       and (expires_at is null or expires_at > now())
  )
  select controls.environment,
         controls.sales_status,
         controls.unit_limit,
         paid.units,
         reserved.units,
         case
           when controls.unit_limit is null then null
           else greatest(controls.unit_limit::bigint - paid.units - reserved.units, 0)
         end as remaining_units,
         controls.updated_at,
         controls.updated_by
    from public.preorder_sales_controls controls
    cross join paid
    cross join reserved
   where controls.environment = p_environment;
$$;

revoke all on function public.reserve_preorder_checkout(
  uuid, text, text, smallint, integer, text, text, text, text, text, text,
  text, text, timestamptz, timestamptz, boolean, timestamptz
) from public, anon, authenticated;
grant execute on function public.reserve_preorder_checkout(
  uuid, text, text, smallint, integer, text, text, text, text, text, text,
  text, text, timestamptz, timestamptz, boolean, timestamptz
) to service_role;

revoke all on function public.get_preorder_sales_snapshot(text)
  from public, anon, authenticated;
grant execute on function public.get_preorder_sales_snapshot(text)
  to service_role;

comment on table public.preorder_sales_controls is
  'Owner-controlled availability and capacity limits for test and live Frame pre-orders.';
comment on column public.preorder_checkout_intents.request_key is
  'Customer request id used to make Checkout Session creation idempotent.';
comment on column public.preorders.environment is
  'Stripe payment environment. Test and live orders must remain operationally separate.';
