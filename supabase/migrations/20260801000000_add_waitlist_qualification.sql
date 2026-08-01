alter table public.waitlist_signups
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists motivation text;

comment on column public.waitlist_signups.first_name is
  'First name supplied with an early-access application.';

comment on column public.waitlist_signups.last_name is
  'Last name supplied with an early-access application.';

comment on column public.waitlist_signups.motivation is
  'Applicant response describing why they want Frame and the problem it would solve.';
