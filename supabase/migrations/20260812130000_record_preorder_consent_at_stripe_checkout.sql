alter table public.preorder_checkout_intents
  alter column terms_accepted_at drop not null,
  alter column product_status_acknowledged_at drop not null;

comment on column public.preorder_checkout_intents.terms_accepted_at is
  'Recorded after the required terms consent is accepted in Stripe Checkout; null while checkout is open.';

comment on column public.preorder_checkout_intents.product_status_acknowledged_at is
  'Recorded after the required product-status consent is accepted in Stripe Checkout; null while checkout is open.';

create or replace function public.record_preorder_checkout_consent(
  p_intent_id uuid,
  p_accepted_at timestamptz
)
returns table (
  terms_accepted_at timestamptz,
  product_status_acknowledged_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_accepted_at is null then
    raise exception using
      errcode = 'P0001',
      message = 'PREORDER_CONSENT_TIMESTAMP_MISSING';
  end if;

  return query
  update public.preorder_checkout_intents as intent
     set terms_accepted_at = coalesce(intent.terms_accepted_at, p_accepted_at),
         product_status_acknowledged_at = coalesce(
           intent.product_status_acknowledged_at,
           p_accepted_at
         ),
         updated_at = now()
   where intent.id = p_intent_id
   returning intent.terms_accepted_at,
             intent.product_status_acknowledged_at;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'PREORDER_INTENT_MISSING';
  end if;
end;
$$;

revoke all on function public.record_preorder_checkout_consent(uuid, timestamptz)
  from public, anon, authenticated;

grant execute on function public.record_preorder_checkout_consent(uuid, timestamptz)
  to service_role;
