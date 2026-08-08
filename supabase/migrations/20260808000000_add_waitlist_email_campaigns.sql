alter table public.waitlist_signups
  add column if not exists email_unsubscribe_token uuid,
  add column if not exists email_unsubscribed_at timestamptz;

update public.waitlist_signups
set email_unsubscribe_token = gen_random_uuid()
where email_unsubscribe_token is null;

alter table public.waitlist_signups
  alter column email_unsubscribe_token set default gen_random_uuid(),
  alter column email_unsubscribe_token set not null;

create unique index if not exists waitlist_signups_email_unsubscribe_token_unique
  on public.waitlist_signups(email_unsubscribe_token);

create index if not exists waitlist_signups_email_subscribed_idx
  on public.waitlist_signups(created_at desc)
  where email_unsubscribed_at is null;

create table if not exists public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_by text not null,
  subject text not null check (char_length(subject) between 1 and 160),
  preview_text text check (preview_text is null or char_length(preview_text) <= 200),
  body_text text not null check (char_length(body_text) between 1 and 20000),
  cta_label text check (cta_label is null or char_length(cta_label) <= 80),
  cta_url text,
  status text not null default 'preparing'
    check (status in ('preparing', 'sending', 'sent', 'partial', 'failed')),
  recipient_count integer not null default 0 check (recipient_count >= 0),
  sent_count integer not null default 0 check (sent_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.email_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.email_campaigns(id) on delete cascade,
  waitlist_signup_id bigint references public.waitlist_signups(id) on delete set null,
  recipient_email text not null,
  recipient_first_name text,
  recipient_last_name text,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed')),
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_id, recipient_email)
);

create index if not exists email_campaigns_created_idx
  on public.email_campaigns(created_at desc);

create index if not exists email_campaign_recipients_campaign_idx
  on public.email_campaign_recipients(campaign_id, status);

alter table public.email_campaigns enable row level security;
alter table public.email_campaign_recipients enable row level security;

comment on column public.waitlist_signups.email_unsubscribed_at is
  'When set, excludes the signup from Frame waitlist update campaigns.';

comment on table public.email_campaigns is
  'Owner-created messages sent to selected, currently subscribed waitlist signups.';

comment on table public.email_campaign_recipients is
  'Per-recipient delivery audit for a waitlist email campaign.';
