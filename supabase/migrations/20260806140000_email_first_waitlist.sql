alter table public.waitlist_signups
  add column if not exists survey_token uuid,
  add column if not exists qualification_status text,
  add column if not exists primary_interest text,
  add column if not exists primary_interest_other text,
  add column if not exists current_monitoring_method text,
  add column if not exists current_monitoring_method_other text,
  add column if not exists frustration_or_missing_need text,
  add column if not exists open_to_research_call text,
  add column if not exists survey_completed_at timestamptz,
  add column if not exists qualification_skipped_at timestamptz,
  add column if not exists signup_referrer text,
  add column if not exists utm_content text,
  add column if not exists utm_term text,
  add column if not exists meta_click_id text;

update public.waitlist_signups
set survey_token = gen_random_uuid()
where survey_token is null;

alter table public.waitlist_signups
  alter column survey_token set default gen_random_uuid(),
  alter column survey_token set not null;

create unique index if not exists waitlist_signups_survey_token_unique
  on public.waitlist_signups(survey_token);

-- Copy the existing version-2 qualification payload into the new columns.
-- The original JSON and demographic fields remain untouched.
do $$
declare
  signup record;
  qualification jsonb;
  call_preference text;
begin
  for signup in
    select id, motivation, created_at
    from public.waitlist_signups
    where qualification_status is null
      and motivation is not null
  loop
    begin
      qualification := signup.motivation::jsonb;
    exception when others then
      continue;
    end;

    if qualification ->> 'version' = '2'
      and nullif(qualification ->> 'mainReason', '') is not null
      and nullif(qualification ->> 'monitoringMethod', '') is not null
      and nullif(qualification ->> 'interviewWillingness', '') is not null
    then
      call_preference := case qualification ->> 'interviewWillingness'
        when 'possibly' then 'maybe'
        else qualification ->> 'interviewWillingness'
      end;

      update public.waitlist_signups
      set qualification_status = 'completed',
          primary_interest = qualification ->> 'mainReason',
          current_monitoring_method = qualification ->> 'monitoringMethod',
          frustration_or_missing_need = qualification ->> 'recentSituation',
          open_to_research_call = call_preference,
          survey_completed_at = created_at
      where id = signup.id;
    end if;
  end loop;
end
$$;

update public.waitlist_signups
set qualification_status = 'not_started'
where qualification_status is null;

alter table public.waitlist_signups
  alter column qualification_status set default 'not_started',
  alter column qualification_status set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'waitlist_signups_qualification_status_value'
      and conrelid = 'public.waitlist_signups'::regclass
  ) then
    alter table public.waitlist_signups
      add constraint waitlist_signups_qualification_status_value
      check (qualification_status in ('not_started', 'skipped', 'completed'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'waitlist_signups_research_call_value'
      and conrelid = 'public.waitlist_signups'::regclass
  ) then
    alter table public.waitlist_signups
      add constraint waitlist_signups_research_call_value
      check (
        open_to_research_call is null
        or open_to_research_call in ('yes', 'maybe', 'no')
      );
  end if;
end
$$;

comment on column public.waitlist_signups.survey_token is
  'Opaque capability used to associate the optional survey with the captured email record.';

comment on column public.waitlist_signups.qualification_status is
  'Optional survey state: not_started, skipped, or completed.';

comment on column public.waitlist_signups.survey_completed_at is
  'Time the optional qualification survey was first completed.';
