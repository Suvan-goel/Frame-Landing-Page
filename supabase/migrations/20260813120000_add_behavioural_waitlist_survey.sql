alter table public.waitlist_signups
  add column if not exists monitoring_frequency text,
  add column if not exists monitoring_reason text,
  add column if not exists monitoring_readiness text,
  add column if not exists monitoring_outcome text,
  add column if not exists preorder_decline_reason text,
  add column if not exists preorder_decline_detail text,
  add column if not exists preorder_declined_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'waitlist_signups_monitoring_frequency_value'
      and conrelid = 'public.waitlist_signups'::regclass
  ) then
    alter table public.waitlist_signups
      add constraint waitlist_signups_monitoring_frequency_value
      check (
        monitoring_frequency is null or monitoring_frequency in (
          'sixteen_or_more_days',
          'eight_to_fifteen_days',
          'three_to_seven_days',
          'one_or_two_days',
          'none_recently',
          'never_outside_appointment'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'waitlist_signups_monitoring_reason_value'
      and conrelid = 'public.waitlist_signups'::regclass
  ) then
    alter table public.waitlist_signups
      add constraint waitlist_signups_monitoring_reason_value
      check (
        monitoring_reason is null or monitoring_reason in (
          'regular_routine',
          'clinician_requested',
          'recheck_reading_or_feeling',
          'medication_or_treatment',
          'daily_factor_effect',
          'day_or_night_change',
          'general_tracking',
          'another_reason'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'waitlist_signups_monitoring_readiness_value'
      and conrelid = 'public.waitlist_signups'::regclass
  ) then
    alter table public.waitlist_signups
      add constraint waitlist_signups_monitoring_readiness_value
      check (
        monitoring_readiness is null or monitoring_readiness in (
          'obtained_device',
          'compared_devices',
          'asked_clinician',
          'thought_no_action',
          'not_considered'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'waitlist_signups_monitoring_outcome_value'
      and conrelid = 'public.waitlist_signups'::regclass
  ) then
    alter table public.waitlist_signups
      add constraint waitlist_signups_monitoring_outcome_value
      check (
        monitoring_outcome is null or monitoring_outcome in (
          'worked_easily',
          'worked_with_difficulty',
          'easy_but_unanswered',
          'difficult_and_unanswered',
          'reading_only',
          'not_sure'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'waitlist_signups_preorder_decline_reason_value'
      and conrelid = 'public.waitlist_signups'::regclass
  ) then
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
          'another_reason'
        )
      );
  end if;
end
$$;

comment on column public.waitlist_signups.monitoring_frequency is
  'Number of days the respondent measured their blood pressure in the previous 30 days.';

comment on column public.waitlist_signups.monitoring_reason is
  'Main reason for the respondent most recently measuring their blood pressure.';

comment on column public.waitlist_signups.monitoring_readiness is
  'Furthest monitoring step taken by a respondent who has never measured outside an appointment.';

comment on column public.waitlist_signups.monitoring_outcome is
  'Whether the respondent most recent monitoring approach solved the underlying job.';

comment on column public.waitlist_signups.preorder_decline_reason is
  'Main reason a survey respondent said they were not ready to pre-order Frame.';

comment on column public.waitlist_signups.preorder_decline_detail is
  'Optional detail when the respondent selected another pre-order decline reason.';

comment on column public.waitlist_signups.preorder_declined_at is
  'Time the respondent submitted their pre-order decline reason.';
