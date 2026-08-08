create table if not exists public.admin_settings (
  id text primary key check (id = 'global'),
  time_zone text not null default 'UTC'
    check (time_zone in (
      'UTC',
      'Europe/London',
      'Europe/Rome',
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'America/Sao_Paulo',
      'Asia/Dubai',
      'Asia/Kolkata',
      'Asia/Singapore',
      'Asia/Tokyo',
      'Australia/Sydney',
      'Pacific/Auckland'
    )),
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.admin_settings (id, time_zone)
values ('global', 'UTC')
on conflict (id) do nothing;

alter table public.admin_settings enable row level security;

comment on table public.admin_settings is
  'Global owner-managed application preferences used by the admin workspace.';

comment on column public.admin_settings.time_zone is
  'The canonical time zone used for lead timestamps until an owner changes it.';
