alter table public.preorder_checkout_intents
  add column if not exists offer_type text,
  add column if not exists reservation_amount integer,
  add column if not exists locked_total_price integer,
  add column if not exists remaining_balance integer;

update public.preorder_checkout_intents
set offer_type = 'full_preorder'
where offer_type is null;

alter table public.preorder_checkout_intents
  alter column offer_type set default 'full_preorder',
  alter column offer_type set not null;

alter table public.preorders
  add column if not exists offer_type text,
  add column if not exists reservation_amount integer,
  add column if not exists locked_total_price integer,
  add column if not exists remaining_balance integer,
  add column if not exists reservation_status text;

update public.preorders
set offer_type = 'full_preorder'
where offer_type is null;

alter table public.preorders
  alter column offer_type set default 'full_preorder',
  alter column offer_type set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'preorder_checkout_intents_offer_type_value'
      and conrelid = 'public.preorder_checkout_intents'::regclass
  ) then
    alter table public.preorder_checkout_intents
      add constraint preorder_checkout_intents_offer_type_value
      check (offer_type in ('full_preorder', 'reservation'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'preorder_checkout_intents_reservation_terms'
      and conrelid = 'public.preorder_checkout_intents'::regclass
  ) then
    alter table public.preorder_checkout_intents
      add constraint preorder_checkout_intents_reservation_terms
      check (
        offer_type = 'full_preorder'
        or (
          reservation_amount is not null and reservation_amount > 0
          and locked_total_price is not null
          and locked_total_price > reservation_amount
          and remaining_balance is not null
          and remaining_balance = locked_total_price - reservation_amount
          and unit_amount = reservation_amount
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'preorders_offer_type_value'
      and conrelid = 'public.preorders'::regclass
  ) then
    alter table public.preorders
      add constraint preorders_offer_type_value
      check (offer_type in ('full_preorder', 'reservation'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'preorders_reservation_status_value'
      and conrelid = 'public.preorders'::regclass
  ) then
    alter table public.preorders
      add constraint preorders_reservation_status_value
      check (
        reservation_status is null or reservation_status in (
          'active',
          'refund_pending',
          'refunded',
          'converted',
          'fulfilled'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'preorders_reservation_terms'
      and conrelid = 'public.preorders'::regclass
  ) then
    alter table public.preorders
      add constraint preorders_reservation_terms
      check (
        offer_type = 'full_preorder'
        or (
          reservation_amount is not null and reservation_amount > 0
          and locked_total_price is not null
          and locked_total_price > reservation_amount
          and remaining_balance is not null
          and remaining_balance = locked_total_price - reservation_amount
          and reservation_status is not null
        )
      );
  end if;
end
$$;

alter table public.preorder_payments
  drop constraint if exists preorder_payments_payment_kind_check;

alter table public.preorder_payments
  add constraint preorder_payments_payment_kind_check
  check (payment_kind in ('full_payment', 'deposit', 'balance', 'reservation_fee'));

alter table public.waitlist_signups
  add column if not exists willingness_to_pay_band text,
  add column if not exists evidence_requirements text[],
  add column if not exists evidence_requirements_other text;

do $$
begin
  alter table public.waitlist_signups
    drop constraint if exists waitlist_signups_preorder_decline_reason_value;

  alter table public.waitlist_signups
    add constraint waitlist_signups_preorder_decline_reason_value
    check (
      preorder_decline_reason is null or preorder_decline_reason in (
        'need_more_evidence',
        'need_more_product_detail',
        'do_not_preorder',
        'price_too_high',
        'not_urgent',
        'not_available_where_i_live',
        'need_to_discuss',
        'does_not_solve_need',
        'pay_too_early',
        'need_working_product',
        'comfort_concern',
        'shipping_too_far',
        'another_reason'
      )
    );

  if not exists (
    select 1 from pg_constraint
    where conname = 'waitlist_signups_willingness_to_pay_band_value'
      and conrelid = 'public.waitlist_signups'::regclass
  ) then
    alter table public.waitlist_signups
      add constraint waitlist_signups_willingness_to_pay_band_value
      check (
        willingness_to_pay_band is null or willingness_to_pay_band in (
          'under_100',
          '100_149',
          '150_199',
          '200_249',
          '250_299',
          '300_399',
          '400_plus',
          'probably_would_not_buy'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'waitlist_signups_evidence_requirements_values'
      and conrelid = 'public.waitlist_signups'::regclass
  ) then
    alter table public.waitlist_signups
      add constraint waitlist_signups_evidence_requirements_values
      check (
        evidence_requirements is null
        or evidence_requirements <@ array[
          'validated_cuff_comparison',
          'published_real_user_testing',
          'working_prototype',
          'early_user_reviews',
          'final_device_design',
          'money_back_guarantee',
          'clinician_recommendation',
          'regulatory_or_clinical_validation',
          'something_else'
        ]::text[]
      );
  end if;
end
$$;

comment on column public.preorder_checkout_intents.offer_type is
  'Explicitly distinguishes legacy full-payment pre-orders from Frame reservations.';
comment on column public.preorders.offer_type is
  'Legacy rows are full_preorder; new reservation rows retain immutable reservation financial terms.';
comment on column public.preorders.reservation_status is
  'Lifecycle of a paid Frame reservation. Null for legacy full-payment pre-orders.';
comment on column public.waitlist_signups.willingness_to_pay_band is
  'Structured follow-up shown only when price is the main reservation objection.';
comment on column public.waitlist_signups.evidence_requirements is
  'First-party multi-select evidence requirements shown only for an accuracy/evidence objection.';
