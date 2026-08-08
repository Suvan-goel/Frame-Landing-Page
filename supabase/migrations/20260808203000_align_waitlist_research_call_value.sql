-- Keep the database value aligned with the canonical "Possibly" option used
-- by the current and legacy waitlist forms.
alter table public.waitlist_signups
  drop constraint if exists waitlist_signups_research_call_value;

update public.waitlist_signups
set open_to_research_call = 'possibly'
where open_to_research_call = 'maybe';

alter table public.waitlist_signups
  add constraint waitlist_signups_research_call_value
  check (
    open_to_research_call is null
    or open_to_research_call in ('yes', 'possibly', 'no')
  );
