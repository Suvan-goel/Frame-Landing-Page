alter table public.waitlist_signups
  add column if not exists email_delivery_suppressed_at timestamptz,
  add column if not exists email_delivery_suppression_reason text,
  add column if not exists email_delivery_suppression_provider_id text;

create index if not exists waitlist_signups_email_delivery_suppressed_idx
  on public.waitlist_signups(email_delivery_suppressed_at desc)
  where email_delivery_suppressed_at is not null;

create table if not exists public.email_campaign_drafts (
  created_by text primary key,
  subject text not null default '' check (char_length(subject) <= 160),
  preview_text text not null default '' check (char_length(preview_text) <= 200),
  body_text text not null default '' check (char_length(body_text) <= 20000),
  cta_label text not null default '' check (char_length(cta_label) <= 80),
  cta_url text not null default '',
  recipient_ids bigint[] not null default '{}',
  preview_recipient_id bigint,
  updated_at timestamptz not null default now()
);

create table if not exists public.email_send_confirmations (
  id uuid primary key default gen_random_uuid(),
  created_by text not null,
  payload_hash text not null,
  recipient_count integer not null check (recipient_count > 0),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists email_send_confirmations_lookup_idx
  on public.email_send_confirmations(id, created_by, expires_at)
  where used_at is null;

create table if not exists public.email_provider_settings (
  key text primary key,
  secret_value text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.email_webhook_events (
  event_id text primary key,
  event_type text not null,
  provider_message_id text,
  payload jsonb not null,
  processed_at timestamptz not null default now()
);

alter table public.email_campaign_recipients
  add column if not exists last_event text,
  add column if not exists last_event_at timestamptz;

alter table public.email_campaign_recipients
  drop constraint if exists email_campaign_recipients_status_check;

alter table public.email_campaign_recipients
  add constraint email_campaign_recipients_status_check
  check (status in ('pending', 'retrying', 'sent', 'delivered', 'failed', 'bounced', 'complained'));

alter table public.email_campaign_drafts enable row level security;
alter table public.email_send_confirmations enable row level security;
alter table public.email_provider_settings enable row level security;
alter table public.email_webhook_events enable row level security;

comment on column public.waitlist_signups.email_delivery_suppressed_at is
  'When set after a bounce or complaint, excludes the address from future campaign sends.';

comment on table public.email_campaign_drafts is
  'One durable owner draft per administrator, including the currently selected audience.';

comment on table public.email_send_confirmations is
  'Short-lived, single-use review tokens required before a mailing-list campaign can send.';

comment on table public.email_provider_settings is
  'Private provider configuration populated by authenticated owner setup flows.';

comment on table public.email_webhook_events is
  'Idempotency and audit records for verified email provider webhook events.';
