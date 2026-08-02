alter table public.waitlist_signups
  add column if not exists gender text,
  add column if not exists age smallint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'waitlist_signups_gender_value'
      and conrelid = 'public.waitlist_signups'::regclass
  ) then
    alter table public.waitlist_signups
      add constraint waitlist_signups_gender_value
      check (
        gender is null or gender in (
          'woman',
          'man',
          'non_binary',
          'another_identity',
          'prefer_not_to_say'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'waitlist_signups_age_range'
      and conrelid = 'public.waitlist_signups'::regclass
  ) then
    alter table public.waitlist_signups
      add constraint waitlist_signups_age_range
      check (age is null or age between 18 and 120);
  end if;
end
$$;

comment on column public.waitlist_signups.gender is
  'Gender option supplied with an early-access application.';

comment on column public.waitlist_signups.age is
  'Age in years supplied with an early-access application.';
