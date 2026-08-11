alter table public.waitlist_signups
  add column if not exists meta_geo_source text,
  add column if not exists meta_geo_country text,
  add column if not exists meta_geo_region_code text,
  add column if not exists meta_geo_resolution_reason text,
  add column if not exists meta_geo_policy_version text,
  add column if not exists meta_geo_retry_attempted boolean,
  add column if not exists meta_geo_retry_succeeded boolean;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'waitlist_signups_meta_geo_source_value'
      and conrelid = 'public.waitlist_signups'::regclass
  ) then
    alter table public.waitlist_signups
      add constraint waitlist_signups_meta_geo_source_value
      check (
        meta_geo_source is null
        or meta_geo_source in ('netlify_context_geo', 'unknown')
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'waitlist_signups_meta_geo_country_format'
      and conrelid = 'public.waitlist_signups'::regclass
  ) then
    alter table public.waitlist_signups
      add constraint waitlist_signups_meta_geo_country_format
      check (
        meta_geo_country is null
        or meta_geo_country ~ '^[A-Z]{2}$'
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'waitlist_signups_meta_geo_region_code_format'
      and conrelid = 'public.waitlist_signups'::regclass
  ) then
    alter table public.waitlist_signups
      add constraint waitlist_signups_meta_geo_region_code_format
      check (
        meta_geo_region_code is null
        or meta_geo_region_code ~ '^[A-Z]{2}$'
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'waitlist_signups_meta_geo_retry_consistency'
      and conrelid = 'public.waitlist_signups'::regclass
  ) then
    alter table public.waitlist_signups
      add constraint waitlist_signups_meta_geo_retry_consistency
      check (
        meta_geo_retry_succeeded is null
        or meta_geo_retry_succeeded is false
        or meta_geo_retry_attempted is true
      );
  end if;
end
$$;

comment on column public.waitlist_signups.meta_geo_source is
  'Coarse signed geo source used for the Meta policy; never an IP address or browser-supplied geo header.';

comment on column public.waitlist_signups.meta_geo_country is
  'Coarse ISO country code from a verified short-lived Netlify geo attestation.';

comment on column public.waitlist_signups.meta_geo_region_code is
  'Coarse US state code from a verified short-lived Netlify geo attestation.';

comment on column public.waitlist_signups.meta_geo_resolution_reason is
  'Coarse attestation or resolution outcome; no token, headers, city, postcode, coordinates, or visitor identifiers.';

comment on column public.waitlist_signups.meta_geo_policy_version is
  'Verified geo-policy version used for the Meta consent decision.';

comment on column public.waitlist_signups.meta_geo_retry_attempted is
  'Whether the browser made the single permitted retry after a signed unresolved-US result.';

comment on column public.waitlist_signups.meta_geo_retry_succeeded is
  'Whether that single retry returned a verified valid US state.';
