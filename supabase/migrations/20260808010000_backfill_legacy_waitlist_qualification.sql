-- Promote complete version-2 legacy survey submissions into the canonical
-- qualification columns used by the current email-first waitlist flow.
do $$
declare
  signup record;
  qualification jsonb;
  call_preference text;
begin
  for signup in
    select id, motivation, created_at
    from public.waitlist_signups
    where qualification_status <> 'completed'
      and motivation is not null
      and nullif(trim(first_name), '') is not null
      and nullif(trim(last_name), '') is not null
      and gender is not null
      and age is not null
  loop
    begin
      qualification := signup.motivation::jsonb;
    exception when others then
      continue;
    end;

    if qualification ->> 'version' = '2'
      and nullif(qualification ->> 'mainReason', '') is not null
      and nullif(qualification ->> 'recentSituation', '') is not null
      and nullif(qualification ->> 'monitoringMethod', '') is not null
      and nullif(qualification ->> 'interviewWillingness', '') is not null
    then
      call_preference := case qualification ->> 'interviewWillingness'
        when 'possibly' then 'maybe'
        else qualification ->> 'interviewWillingness'
      end;

      update public.waitlist_signups
      set qualification_status = 'completed',
          primary_interest = coalesce(primary_interest, qualification ->> 'mainReason'),
          current_monitoring_method = coalesce(
            current_monitoring_method,
            qualification ->> 'monitoringMethod'
          ),
          frustration_or_missing_need = coalesce(
            frustration_or_missing_need,
            qualification ->> 'recentSituation'
          ),
          open_to_research_call = coalesce(open_to_research_call, call_preference),
          survey_completed_at = coalesce(survey_completed_at, signup.created_at),
          qualification_skipped_at = null
      where id = signup.id;
    end if;
  end loop;
end
$$;
