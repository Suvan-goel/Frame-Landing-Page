alter table public.preorders
  add column if not exists manage_token_version integer not null default 1
    check (manage_token_version > 0),
  add column if not exists cancellation_status text not null default 'none'
    check (cancellation_status in ('none', 'requested', 'processing', 'completed', 'declined')),
  add column if not exists cancellation_requested_at timestamptz,
  add column if not exists cancellation_reason text,
  add column if not exists cancellation_resolved_at timestamptz,
  add column if not exists cancellation_resolution_note text,
  add column if not exists carrier text,
  add column if not exists tracking_number text,
  add column if not exists tracking_url text,
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists owner_note text;

create index if not exists preorders_cancellation_status_idx
  on public.preorders(environment, cancellation_status, cancellation_requested_at desc);
create index if not exists preorders_fulfillment_status_idx
  on public.preorders(environment, fulfillment_status, placed_at);

comment on column public.preorders.manage_token_version is
  'Increment to revoke previously issued signed customer order-management links.';
comment on column public.preorders.cancellation_status is
  'Tracks customer cancellation requests separately from payment refund status.';
comment on column public.preorders.owner_note is
  'Private operational note visible only in the authenticated owner view.';
