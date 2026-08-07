alter table public.preorders
  add column if not exists current_estimated_delivery text,
  add column if not exists address_change_status text not null default 'none'
    check (address_change_status in ('none', 'requested', 'processing', 'completed', 'declined')),
  add column if not exists address_change_requested_at timestamptz,
  add column if not exists requested_shipping_address jsonb,
  add column if not exists address_change_reason text,
  add column if not exists address_change_resolved_at timestamptz,
  add column if not exists address_change_resolution_note text,
  add column if not exists delivery_update_version integer not null default 0
    check (delivery_update_version >= 0),
  add column if not exists delivery_update_status text not null default 'none'
    check (delivery_update_status in ('none', 'pending', 'accepted', 'cancellation_requested')),
  add column if not exists delivery_update_message text,
  add column if not exists delivery_update_sent_at timestamptz,
  add column if not exists delivery_update_acknowledged_at timestamptz;

update public.preorders
   set current_estimated_delivery = estimated_delivery
 where current_estimated_delivery is null;

alter table public.preorders
  alter column current_estimated_delivery set not null;

create index if not exists preorders_address_change_status_idx
  on public.preorders(environment, address_change_status, address_change_requested_at desc);
create index if not exists preorders_delivery_update_status_idx
  on public.preorders(environment, delivery_update_status, delivery_update_sent_at desc);

comment on column public.preorders.estimated_delivery is
  'Immutable original delivery wording shown when the customer placed the order.';
comment on column public.preorders.current_estimated_delivery is
  'Latest delivery estimate communicated after the order was placed.';
comment on column public.preorders.requested_shipping_address is
  'Customer-proposed shipping address awaiting authenticated owner review.';
comment on column public.preorders.delivery_update_status is
  'Tracks whether the customer has acknowledged the latest delivery estimate update.';
