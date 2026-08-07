alter table public.preorder_sales_controls
  add column if not exists inventory_limit integer not null default 1000
    check (inventory_limit > 0);

alter table public.preorder_sales_controls
  drop constraint if exists preorder_sales_controls_unit_limit_check;

update public.preorder_sales_controls
   set inventory_limit = 1000,
       unit_limit = case
         when environment = 'live' then 0
         else least(coalesce(unit_limit, 1000), 1000)
       end,
       updated_at = now();

alter table public.preorder_sales_controls
  alter column unit_limit set default 0,
  alter column unit_limit set not null;

alter table public.preorder_sales_controls
  add constraint preorder_sales_controls_release_limit_check
    check (unit_limit >= 0 and unit_limit <= inventory_limit);

drop function if exists public.get_preorder_sales_snapshot(text);

create function public.get_preorder_sales_snapshot(p_environment text)
returns table (
  environment text,
  sales_status text,
  inventory_limit integer,
  unit_limit integer,
  paid_units bigint,
  reserved_units bigint,
  remaining_units bigint,
  inventory_remaining_units bigint,
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
         controls.inventory_limit,
         controls.unit_limit,
         paid.units,
         reserved.units,
         greatest(controls.unit_limit::bigint - paid.units - reserved.units, 0)
           as remaining_units,
         greatest(controls.inventory_limit::bigint - paid.units - reserved.units, 0)
           as inventory_remaining_units,
         controls.updated_at,
         controls.updated_by
    from public.preorder_sales_controls controls
    cross join paid
    cross join reserved
   where controls.environment = p_environment;
$$;

revoke all on function public.get_preorder_sales_snapshot(text)
  from public, anon, authenticated;
grant execute on function public.get_preorder_sales_snapshot(text)
  to service_role;

comment on column public.preorder_sales_controls.inventory_limit is
  'Lifetime unit ceiling for this environment. Frame live pre-orders are capped at 1,000.';
comment on column public.preorder_sales_controls.unit_limit is
  'Cumulative unit ceiling released for sale; increase in controlled batches up to inventory_limit.';
