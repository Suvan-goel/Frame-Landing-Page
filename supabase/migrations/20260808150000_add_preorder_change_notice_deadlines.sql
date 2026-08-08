alter table public.preorders
  add column if not exists delivery_update_notice_type text not null default 'none'
    check (delivery_update_notice_type in (
      'none',
      'first_short_delay',
      'consent_required_delay',
      'material_product_change'
    )),
  add column if not exists delivery_update_response_mode text not null default 'none'
    check (delivery_update_response_mode in (
      'none',
      'silence_is_consent',
      'affirmative_consent_required'
    )),
  add column if not exists delivery_update_response_deadline timestamptz,
  add column if not exists delivery_update_expired_at timestamptz;

alter table public.preorders
  drop constraint if exists preorders_delivery_update_status_check;

alter table public.preorders
  add constraint preorders_delivery_update_status_check
    check (delivery_update_status in (
      'none',
      'pending',
      'accepted',
      'cancellation_requested',
      'expired'
    ));

create index if not exists preorders_delivery_response_deadline_idx
  on public.preorders(environment, delivery_update_response_deadline)
  where delivery_update_status = 'pending'
    and delivery_update_response_mode = 'affirmative_consent_required';

create index if not exists preorders_expired_delivery_refund_idx
  on public.preorders(environment, cancellation_status, payment_status)
  where delivery_update_status = 'expired';

comment on column public.preorders.delivery_update_notice_type is
  'Classifies a short first delay, a delay requiring affirmative consent, or a material product change.';
comment on column public.preorders.delivery_update_response_mode is
  'Records whether silence keeps the order active or affirmative consent is required.';
comment on column public.preorders.delivery_update_response_deadline is
  'Deadline for affirmative consent before an unshipped order must be cancelled and refunded.';
comment on column public.preorders.delivery_update_expired_at is
  'When a required affirmative-consent deadline expired without a customer response.';
