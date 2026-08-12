alter table public.email_campaign_drafts
  add column if not exists cta_position text not null default 'end';

alter table public.email_campaign_drafts
  drop constraint if exists email_campaign_drafts_cta_position_check;

alter table public.email_campaign_drafts
  add constraint email_campaign_drafts_cta_position_check
  check (cta_position = 'end' or cta_position ~ '^after:[1-9][0-9]*$');

alter table public.email_campaigns
  add column if not exists cta_position text not null default 'end';

alter table public.email_campaigns
  drop constraint if exists email_campaigns_cta_position_check;

alter table public.email_campaigns
  add constraint email_campaigns_cta_position_check
  check (cta_position = 'end' or cta_position ~ '^after:[1-9][0-9]*$');

comment on column public.email_campaign_drafts.cta_position is
  'Places the optional campaign call-to-action at the end or after a numbered body paragraph.';

comment on column public.email_campaigns.cta_position is
  'Persists the rendered call-to-action position for delivery audits and retries.';
