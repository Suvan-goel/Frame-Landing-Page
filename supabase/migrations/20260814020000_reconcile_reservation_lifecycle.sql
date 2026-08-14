-- Keep the reservation-specific lifecycle aligned with the established order
-- and payment fields during the transition from the legacy full-payment build.
-- This is intentionally idempotent and touches reservation rows only.

update public.preorders
set
  reservation_status = 'refunded',
  updated_at = now()
where offer_type = 'reservation'
  and (
    payment_status = 'refunded'
    or (amount_total > 0 and amount_refunded >= amount_total)
  )
  and reservation_status is distinct from 'refunded';

update public.preorders
set
  reservation_status = 'refund_pending',
  updated_at = now()
where offer_type = 'reservation'
  and payment_status in ('refund_pending', 'partially_refunded')
  and amount_refunded < amount_total
  and reservation_status not in ('refund_pending', 'refunded');

update public.preorders
set
  reservation_status = 'active',
  updated_at = now()
where offer_type = 'reservation'
  and order_status = 'placed'
  and payment_status = 'paid'
  and amount_refunded = 0
  and reservation_status is distinct from 'active';

comment on column public.preorders.reservation_status is
  'Lifecycle of a paid Frame reservation, reconciled with order and payment state during the reservation cutover. Null for legacy full-payment pre-orders.';
