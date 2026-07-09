-- =====================================================================
-- setup_from_0003.sql — idempotent finish-setup (migrations 0003-0011
-- + seeds). Use ONLY if 0001/0002 are already applied. Otherwise paste
-- setup.sql (the full, one-paste script). Safe to re-run.
-- =====================================================================

-- =====================================================================
-- FINISH SETUP — run AFTER 0001+0002 are already applied.
-- (Claude applied 0001 enums + 0002 core tables via MCP; this file
--  completes the schema 0003-0011 and loads all seeds.)
-- Paste this whole file into the Supabase SQL editor and Run once.
-- =====================================================================

-- >>>>> migration 0003

-- =====================================================================
-- 0003 — Market data (all resolves to sub-community level)
-- Ready = transaction-led. Offplan = absorption/momentum-based.
-- Rolling trailing-6-month window drives the active/headline figures.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Transactions (DLD backbone). Active views use the trailing 6 months;
-- older rows retained for trend lines.
-- ---------------------------------------------------------------------
create table if not exists transactions (
  id                  uuid primary key default gen_random_uuid(),
  sub_community_id    uuid not null references sub_communities(id) on delete cascade,
  phase_id            uuid references phases(id) on delete set null,
  price               numeric(14,2),
  price_per_sqft      numeric(12,2),
  unit_type           unit_type,
  bedrooms            integer,
  bua_sqft            numeric(12,2),
  transaction_date    date not null,
  source              text,                    -- e.g. 'dld', 'dxb_interact'
  created_at          timestamptz not null default now()
);
create index if not exists transactions_sub_community_idx on transactions(sub_community_id);
create index if not exists transactions_date_idx on transactions(transaction_date desc);

-- ---------------------------------------------------------------------
-- Listings (Bayut / PF live listings — the checkout / last step).
-- ---------------------------------------------------------------------
create table if not exists listings (
  id                  uuid primary key default gen_random_uuid(),
  sub_community_id    uuid not null references sub_communities(id) on delete cascade,
  phase_id            uuid references phases(id) on delete set null,
  asking_price        numeric(14,2),
  service_charge_per_sqft numeric(10,2),
  unit_type           unit_type,
  bedrooms            integer,
  bua_sqft            numeric(12,2),
  plot_sqft           numeric(12,2),
  kitchen_type        kitchen_type,
  view_orientation    text,
  condition           text,
  source              text,                    -- 'bayut' | 'property_finder'
  date_seen           date,
  url                 text,
  created_at          timestamptz not null default now()
);
create index if not exists listings_sub_community_idx on listings(sub_community_id);

-- ---------------------------------------------------------------------
-- Weekly price history (trend lines; feeds the trailing-6-month read).
-- ---------------------------------------------------------------------
create table if not exists price_history (
  id                  uuid primary key default gen_random_uuid(),
  sub_community_id    uuid not null references sub_communities(id) on delete cascade,
  unit_type           unit_type,
  week_start_date     date not null,
  avg_price_per_sqft  numeric(12,2),
  median_price        numeric(14,2),
  transaction_count   integer,
  created_at          timestamptz not null default now()
);
create index if not exists price_history_sub_community_idx on price_history(sub_community_id);
create index if not exists price_history_week_idx on price_history(week_start_date desc);

-- ---------------------------------------------------------------------
-- Capital growth (appreciation over a named period).
-- ---------------------------------------------------------------------
create table if not exists capital_growth (
  id                  uuid primary key default gen_random_uuid(),
  sub_community_id    uuid not null references sub_communities(id) on delete cascade,
  unit_type           unit_type,
  period              text,                    -- '3m' | '6m' | '1y' | '3y'
  pct_change          numeric(8,2),
  calculated_at       timestamptz not null default now()
);
create index if not exists capital_growth_sub_community_idx on capital_growth(sub_community_id);

-- ---------------------------------------------------------------------
-- Rental data (yield). Ready-community story.
-- ---------------------------------------------------------------------
create table if not exists rental_data (
  id                  uuid primary key default gen_random_uuid(),
  sub_community_id    uuid not null references sub_communities(id) on delete cascade,
  unit_type           unit_type,
  achieved_rent       numeric(12,2),
  gross_yield_pct     numeric(6,2),
  source              text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists rental_data_sub_community_idx on rental_data(sub_community_id);
create or replace trigger trg_rental_data_updated before update on rental_data
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Absorption (offplan momentum — units released vs sold, velocity,
-- launch-to-launch price movement). Numbers-based and active.
-- ---------------------------------------------------------------------
create table if not exists absorption (
  id                    uuid primary key default gen_random_uuid(),
  sub_community_id      uuid not null references sub_communities(id) on delete cascade,
  phase_name            text,
  units_released        integer,
  units_sold            integer,
  absorption_rate       numeric(6,2),          -- percent
  sales_velocity        numeric(10,2),         -- units per period
  launch_price_movement numeric(8,2),          -- percent across launches
  as_of_date            date,
  created_at            timestamptz not null default now()
);
create index if not exists absorption_sub_community_idx on absorption(sub_community_id);

-- ---------------------------------------------------------------------
-- Payment plans (offplan financing — the headline persuasion tool).
-- ---------------------------------------------------------------------
create table if not exists payment_plans (
  id                  uuid primary key default gen_random_uuid(),
  community_id        uuid not null references communities(id) on delete cascade,
  plan_type           text,                    -- e.g. '40/60', '60/40'
  construction_pct    numeric(6,2),
  handover_pct        numeric(6,2),
  construction_years  numeric(4,1),
  milestones          jsonb not null default '[]'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists payment_plans_community_idx on payment_plans(community_id);
create or replace trigger trg_payment_plans_updated before update on payment_plans
  for each row execute function set_updated_at();

-- >>>>> migration 0004

-- =====================================================================
-- 0004 — Context & value drivers
-- schools, amenities, commute, infrastructure catalysts, documents
-- =====================================================================

-- ---------------------------------------------------------------------
-- Schools (KHDA). Standalone geo entities; matched to communities by
-- proximity at query time (Phase 2 pipeline).
-- ---------------------------------------------------------------------
create table if not exists schools (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  geo_point           geography(Point, 4326),
  khda_rating         text,                     -- 'Outstanding' | 'Very Good' | ...
  curriculum          text,                     -- 'British' | 'IB' | 'American' | ...
  fee_min             numeric(12,2),
  fee_max             numeric(12,2),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists schools_geo_idx on schools using gist(geo_point);
create or replace trigger trg_schools_updated before update on schools
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Amenities (malls, hospitals, parks, POIs).
-- ---------------------------------------------------------------------
create table if not exists amenities (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  category            text,                     -- 'mall' | 'hospital' | 'park' | ...
  geo_point           geography(Point, 4326),
  created_at          timestamptz not null default now()
);
create index if not exists amenities_geo_idx on amenities using gist(geo_point);

-- ---------------------------------------------------------------------
-- Commute times (community → key hub, driving minutes).
-- ---------------------------------------------------------------------
create table if not exists commute_times (
  id                  uuid primary key default gen_random_uuid(),
  community_id        uuid not null references communities(id) on delete cascade,
  destination_name    text not null,            -- 'DIFC', 'DXB Airport', 'Dubai Mall'
  minutes_driving     integer,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists commute_times_community_idx on commute_times(community_id);
create or replace trigger trg_commute_times_updated before update on commute_times
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Infrastructure projects (government spend / master-plan catalysts —
-- the value-driver story).
-- ---------------------------------------------------------------------
create table if not exists infrastructure_projects (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  description         text,
  geo_point           geography(Point, 4326),
  status              text,                     -- 'announced' | 'under_construction' | 'complete'
  est_completion      text,
  value_impact_notes  text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists infrastructure_projects_geo_idx on infrastructure_projects using gist(geo_point);
create or replace trigger trg_infrastructure_projects_updated before update on infrastructure_projects
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Documents (brochures, master plans) attached to a community or
-- sub-community. Stored in Supabase Storage; row keeps the reference.
-- ---------------------------------------------------------------------
create table if not exists documents (
  id                  uuid primary key default gen_random_uuid(),
  community_id        uuid references communities(id) on delete cascade,
  sub_community_id    uuid references sub_communities(id) on delete cascade,
  title               text not null,
  file_url            text,
  doc_type            text,                     -- 'brochure' | 'master_plan' | 'floorplan'
  created_at          timestamptz not null default now()
);
create index if not exists documents_community_idx on documents(community_id);
create index if not exists documents_sub_community_idx on documents(sub_community_id);

-- >>>>> migration 0005

-- =====================================================================
-- 0005 — Client profiles, source registry, filter config, generated copy
-- The layers that make the tool tailor itself to the person on the call.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Client profiles — entered at session start; drive the tailored
-- experience (descriptions, emphasis, recommendation language).
-- ---------------------------------------------------------------------
create table if not exists client_profiles (
  id                  uuid primary key default gen_random_uuid(),
  session_label       text,                     -- owner's label for the call
  budget              numeric(14,2),
  financing_approach  text,                     -- 'cash' | 'mortgage' | 'offplan_payment_plan'
  buyer_type          buyer_type,
  goals               text,
  priorities          jsonb not null default '{}'::jsonb, -- e.g. {schools:5, yield:2}
  is_active           boolean not null default false,     -- the session's active profile
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create or replace trigger trg_client_profiles_updated before update on client_profiles
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Data sources — the swappable-module registry. Every external source
-- is a row here so one breaking never takes the app down. Phase 1 does
-- NOT run ingestion; this records what exists and its health/cadence.
-- ---------------------------------------------------------------------
create table if not exists data_sources (
  id                  uuid primary key default gen_random_uuid(),
  key                 text not null unique,     -- 'dld' | 'bayut' | 'property_finder' | 'khda' | 'google_maps'
  label               text not null,
  category            text,                     -- 'transactions' | 'listings' | 'schools' | 'geo' | 'infrastructure'
  is_enabled          boolean not null default true,
  cadence             text,                     -- 'weekly' | 'manual' | 'daily'
  reliability_notes   text,
  last_run_at         timestamptz,
  last_status         text,                     -- 'ok' | 'stale' | 'error' | 'manual'
  config              jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create or replace trigger trg_data_sources_updated before update on data_sources
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Filter definitions — config-driven filter framework so new filters
-- can be added without re-architecting (Milestone 6). Each row = one
-- filter; the UI renders from these.
-- ---------------------------------------------------------------------
create table if not exists filter_definitions (
  id                  uuid primary key default gen_random_uuid(),
  key                 text not null unique,     -- 'budget', 'unit_type', 'kitchen_type', ...
  label               text not null,
  -- how the filter behaves: range | select | multiselect | boolean | toggle
  control             text not null,
  -- where the value lives: 'unit_archetypes.price', 'capital_growth.pct_change', ...
  data_path           text,
  unit                text,                     -- 'AED', 'sqft', '%', 'min'
  options             jsonb not null default '[]'::jsonb, -- for select/multiselect
  min_value           numeric,
  max_value           numeric,
  step                numeric,
  group_label         text,                     -- UI grouping, e.g. 'Property', 'Financials'
  sort_order          integer not null default 0,
  is_enabled          boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create or replace trigger trg_filter_definitions_updated before update on filter_definitions
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Generated content — stores Claude output: Layer-2 tailored copy,
-- comparison reports, exit one-pagers. Keyed to a client profile +
-- target entity so tailored copy persists across the session and can be
-- overridden by the owner.
-- ---------------------------------------------------------------------
create table if not exists generated_content (
  id                  uuid primary key default gen_random_uuid(),
  content_type        text not null,            -- 'who_its_for' | 'comparison_report' | 'exit_one_pager' | 'social_script'
  client_profile_id   uuid references client_profiles(id) on delete cascade,
  community_id        uuid references communities(id) on delete cascade,
  sub_community_id    uuid references sub_communities(id) on delete cascade,
  subject_ids         jsonb not null default '[]'::jsonb, -- for multi-entity outputs (comparisons)
  body                text,                     -- generated text (may be owner-edited)
  is_owner_edited     boolean not null default false,
  prompt_snapshot     text,                     -- prompt used, for auditability
  model               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists generated_content_profile_idx on generated_content(client_profile_id);
create index if not exists generated_content_sub_community_idx on generated_content(sub_community_id);
create or replace trigger trg_generated_content_updated before update on generated_content
  for each row execute function set_updated_at();

-- >>>>> migration 0006

-- =====================================================================
-- 0006 — Row Level Security
-- Single-admin private tool: every table is locked to authenticated
-- users only. There is no public access. The service_role key (used by
-- trusted server code / seeding) bypasses RLS.
-- =====================================================================

do $$
declare
  t text;
  tables text[] := array[
    'developers','communities','sub_communities','phases','unit_archetypes',
    'transactions','listings','price_history','capital_growth','rental_data',
    'absorption','payment_plans','schools','amenities','commute_times',
    'infrastructure_projects','documents','client_profiles','data_sources',
    'filter_definitions','generated_content'
  ];
begin
  foreach t in array tables loop
    execute format('alter table %I enable row level security;', t);

    -- Read + write for any authenticated user (the single owner).
    execute format('drop policy if exists "authenticated_all_%1$s" on %1$I;', t, t);
    execute format($f$
      create policy "authenticated_all_%1$s" on %1$I
        for all
        to authenticated
        using (true)
        with check (true);
    $f$, t);
  end loop;
end $$;

-- >>>>> migration 0007

-- =====================================================================
-- 0007 — Active views (rolling recency window)
-- Data recency rule: headline comparison figures use the trailing 6
-- months; older data ages out of active views (kept for trend lines).
-- =====================================================================

-- Trailing-6-month transactions — the "active" set for headline figures.
create or replace view active_transactions as
  select *
  from transactions
  where transaction_date >= (current_date - interval '6 months');

-- Trailing-3-month transactions — the tighter read shown where useful.
create or replace view active_transactions_3m as
  select *
  from transactions
  where transaction_date >= (current_date - interval '3 months');

-- Per-sub-community market summary over the trailing 6 months. Only the
-- backbone aggregates live here; richer metrics are computed in Phase 2.
create or replace view sub_community_market_6m as
  select
    sc.id                                as sub_community_id,
    count(t.*)                           as transaction_count,
    round(avg(t.price_per_sqft), 2)      as avg_price_per_sqft,
    percentile_cont(0.5) within group (order by t.price) as median_price,
    round(avg(t.price), 2)               as avg_price
  from sub_communities sc
  left join active_transactions t on t.sub_community_id = sc.id
  group by sc.id;

-- >>>>> migration 0008

-- =====================================================================
-- 0008 — Map pin views
-- Expose lng/lat (from PostGIS geography) plus developer name and the
-- sub-community count, so the client map needs no WKB parsing.
-- security_invoker = true keeps the underlying RLS in force.
-- =====================================================================

create or replace view community_pins
with (security_invoker = true)
as
  select
    c.id,
    c.name,
    c.slug,
    c.status,
    c.positioning_tier,
    d.name as developer_name,
    ST_X(c.geo_center::geometry) as lng,
    ST_Y(c.geo_center::geometry) as lat,
    (select count(*) from sub_communities sc where sc.community_id = c.id)
      as sub_community_count,
    c.is_placeholder
  from communities c
  left join developers d on d.id = c.developer_id
  where c.geo_center is not null;

-- Sub-community pins (used from Milestone 2 onward; defined here alongside).
create or replace view sub_community_pins
with (security_invoker = true)
as
  select
    sc.id,
    sc.name,
    sc.slug,
    sc.status,
    sc.community_id,
    c.name as community_name,
    ST_X(sc.geo_center::geometry) as lng,
    ST_Y(sc.geo_center::geometry) as lat,
    sc.is_placeholder
  from sub_communities sc
  join communities c on c.id = sc.community_id
  where sc.geo_center is not null;

-- >>>>> migration 0009

-- =====================================================================
-- 0009 — Plan assets & interactive hotspots
-- The brochure experience: a master-plan image with clickable hotspots
-- that drill master plan -> phase/sub-community -> unit archetype/floor
-- plan. Assets live in Supabase Storage; rows here hold the reference,
-- natural dimensions, and the hotspot geometry (percent coordinates).
-- =====================================================================

do $$ begin
  create type plan_kind as enum (
  'master_plan', 'site_plan', 'floor_plan', 'brochure', 'gallery', 'other'
);
exception when duplicate_object then null;
end $$;
do $$ begin
  create type hotspot_shape as enum ('point', 'rect', 'polygon');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type hotspot_target as enum (
  'community', 'sub_community', 'phase', 'unit_archetype', 'plan_asset', 'url'
);
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------
-- Plan assets — one image (master plan, site plan, floor plan, …) that
-- can belong to a community, sub-community, phase, or unit archetype.
-- ---------------------------------------------------------------------
create table if not exists plan_assets (
  id                  uuid primary key default gen_random_uuid(),
  community_id        uuid references communities(id) on delete cascade,
  sub_community_id    uuid references sub_communities(id) on delete cascade,
  phase_id            uuid references phases(id) on delete cascade,
  unit_archetype_id   uuid references unit_archetypes(id) on delete cascade,
  kind                plan_kind not null default 'master_plan',
  title               text,
  storage_path        text,       -- path within the 'assets' Storage bucket
  image_url           text,       -- optional external URL fallback
  natural_width       integer,    -- source px width (for hotspot scaling)
  natural_height      integer,
  sort_order          integer not null default 0,
  is_placeholder      boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists plan_assets_community_idx on plan_assets(community_id);
create index if not exists plan_assets_sub_community_idx on plan_assets(sub_community_id);
create index if not exists plan_assets_phase_idx on plan_assets(phase_id);
create index if not exists plan_assets_unit_idx on plan_assets(unit_archetype_id);
create or replace trigger trg_plan_assets_updated before update on plan_assets
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Hotspots — clickable regions on a plan asset. coords are percentages
-- (0-100) of the image: point {x,y}; rect {x,y,w,h}; polygon {points}.
-- ---------------------------------------------------------------------
create table if not exists plan_hotspots (
  id                        uuid primary key default gen_random_uuid(),
  plan_asset_id             uuid not null references plan_assets(id) on delete cascade,
  label                     text,
  -- amenity/POI typing (Modon-style layers): 'navigation' for drill-down
  -- targets, or an amenity category like 'school','park','beach','retail',
  -- 'walkway','cycling','360','clubhouse','mosque','hospital', etc.
  category                  text not null default 'navigation',
  icon                      text,
  shape                     hotspot_shape not null default 'point',
  coords                    jsonb not null default '{}'::jsonb,
  target_type               hotspot_target not null,
  target_community_id       uuid references communities(id) on delete set null,
  target_sub_community_id   uuid references sub_communities(id) on delete set null,
  target_phase_id           uuid references phases(id) on delete set null,
  target_unit_archetype_id  uuid references unit_archetypes(id) on delete set null,
  target_plan_asset_id      uuid references plan_assets(id) on delete set null,
  target_url                text,
  sort_order                integer not null default 0,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index if not exists plan_hotspots_asset_idx on plan_hotspots(plan_asset_id);
create or replace trigger trg_plan_hotspots_updated before update on plan_hotspots
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- RLS — authenticated-only, consistent with every other table.
-- ---------------------------------------------------------------------
alter table plan_assets enable row level security;
alter table plan_hotspots enable row level security;

drop policy if exists "authenticated_all_plan_assets" on plan_assets;
create policy "authenticated_all_plan_assets" on plan_assets
  for all to authenticated using (true) with check (true);
drop policy if exists "authenticated_all_plan_hotspots" on plan_hotspots;
create policy "authenticated_all_plan_hotspots" on plan_hotspots
  for all to authenticated using (true) with check (true);

-- >>>>> migration 0010

-- =====================================================================
-- 0010 — Storage bucket for project assets
-- Master plans, floor plans, brochures, and any documents the owner
-- uploads. Private bucket (single-admin tool); access via signed URLs.
--
-- Note: this touches the `storage` schema. Run it in the Supabase SQL
-- editor (or via `supabase db push`) as the project owner. If your role
-- lacks privileges on storage.objects, create the bucket + policies from
-- the Supabase dashboard (Storage → New bucket "assets", private) and
-- add authenticated-only policies.
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('assets', 'assets', false)
on conflict (id) do nothing;

-- Authenticated (the single owner) may read/write/update/delete objects
-- in the 'assets' bucket. Nothing is public.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'assets_authenticated_all'
  ) then
    create policy "assets_authenticated_all" on storage.objects
      for all to authenticated
      using (bucket_id = 'assets')
      with check (bucket_id = 'assets');
  end if;
end $$;

-- >>>>> migration 0011

-- =====================================================================
-- 0011 — Community character tags
-- Powers the "who it's for" / character filter in the store. Tags are
-- broad, verifiable characteristics (golf, waterfront, gated-family, …),
-- not market data.
-- =====================================================================

alter table communities
  add column if not exists character_tags text[] not null default '{}';

create index if not exists communities_character_tags_idx
  on communities using gin (character_tags);

-- =====================================================================
-- >>>>> supabase/migrations/0012_grants.sql
-- =====================================================================
-- RLS governs which ROWS the API roles see; Postgres still needs
-- table-level GRANTs. Runs after every table/view exists. Idempotent.
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;


-- >>>>> seed.sql

-- =====================================================================
-- SEED — breadth skeleton (Phase 1)
--
-- Honesty rule (from the brief): never fabricate data. This seed loads
-- only STRUCTURAL facts — the four-level taxonomy, Ready/Offplan/Mixed
-- status, broad positioning tier, and APPROXIMATE map coordinates
-- (geographic facts, centroid approximations for pins). All market
-- numbers, counts, prices, descriptions and who-it's-for copy are left
-- NULL so they render as visibly empty until real data is entered via
-- the admin surface. `is_placeholder = true` marks every skeleton page.
--
-- Idempotent: safe to re-run (ON CONFLICT DO NOTHING).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Developers
-- ---------------------------------------------------------------------
insert into developers (name, slug) values
  ('Emaar', 'emaar'),
  ('Nakheel', 'nakheel'),
  ('Meraas', 'meraas'),
  ('Dubai Holding / Dubai Properties', 'dubai-holding'),
  ('Majid Al Futtaim', 'majid-al-futtaim'),
  ('DAMAC', 'damac'),
  ('Aldar', 'aldar'),
  ('Sobha', 'sobha'),
  ('Nshama', 'nshama'),
  ('Meydan', 'meydan'),
  ('Binghatti', 'binghatti'),
  ('Danube', 'danube'),
  ('Pearl Jumeirah (custom)', 'pearl-jumeirah')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Master communities.
-- geo_center coordinates are approximate centroids (lng, lat) for map
-- pins — real locations, not market data.
-- ---------------------------------------------------------------------
insert into communities (developer_id, name, slug, status, positioning_tier, geo_center, is_placeholder) values
  -- Emaar
  ((select id from developers where slug='emaar'), 'Dubai Hills Estate', 'dubai-hills-estate', 'mixed',   'prime',       ST_SetSRID(ST_MakePoint(55.2490,25.1030),4326)::geography, true),
  ((select id from developers where slug='emaar'), 'Arabian Ranches 2',  'arabian-ranches-2',  'ready',   'premium',     ST_SetSRID(ST_MakePoint(55.2670,25.0520),4326)::geography, true),
  ((select id from developers where slug='emaar'), 'Arabian Ranches 3',  'arabian-ranches-3',  'offplan', 'premium',     ST_SetSRID(ST_MakePoint(55.2710,25.0120),4326)::geography, true),
  ((select id from developers where slug='emaar'), 'The Valley',         'the-valley',         'offplan', 'premium',     ST_SetSRID(ST_MakePoint(55.3980,24.9850),4326)::geography, true),
  ((select id from developers where slug='emaar'), 'Emaar South',        'emaar-south',        'mixed',   'mid',         ST_SetSRID(ST_MakePoint(55.1460,24.8690),4326)::geography, true),
  ((select id from developers where slug='emaar'), 'The Oasis',          'the-oasis',          'offplan', 'ultra_prime', ST_SetSRID(ST_MakePoint(55.1500,25.0300),4326)::geography, true),
  ((select id from developers where slug='emaar'), 'Reem (Mira)',        'reem-mira',          'ready',   'mid',         ST_SetSRID(ST_MakePoint(55.3000,25.0200),4326)::geography, true),
  -- Nakheel
  ((select id from developers where slug='nakheel'), 'Palm Jumeirah',    'palm-jumeirah',      'mixed',   'ultra_prime', ST_SetSRID(ST_MakePoint(55.1380,25.1120),4326)::geography, true),
  ((select id from developers where slug='nakheel'), 'Jumeirah Park',    'jumeirah-park',      'ready',   'premium',     ST_SetSRID(ST_MakePoint(55.1550,25.0450),4326)::geography, true),
  ((select id from developers where slug='nakheel'), 'Jumeirah Islands', 'jumeirah-islands',   'ready',   'prime',       ST_SetSRID(ST_MakePoint(55.1630,25.0580),4326)::geography, true),
  ((select id from developers where slug='nakheel'), 'Palm Jebel Ali',   'palm-jebel-ali',     'offplan', 'ultra_prime', ST_SetSRID(ST_MakePoint(55.0060,25.0060),4326)::geography, true),
  ((select id from developers where slug='nakheel'), 'Al Furjan',        'al-furjan',          'ready',   'mid',         ST_SetSRID(ST_MakePoint(55.1450,25.0300),4326)::geography, true),
  ((select id from developers where slug='nakheel'), 'Jebel Ali Village','jebel-ali-village',  'mixed',   'premium',     ST_SetSRID(ST_MakePoint(55.1300,25.0200),4326)::geography, true),
  ((select id from developers where slug='nakheel'), 'Jumeirah Village Triangle','jumeirah-village-triangle','mixed','mid',ST_SetSRID(ST_MakePoint(55.2000,25.0500),4326)::geography, true),
  -- Meraas
  ((select id from developers where slug='meraas'), 'Nad Al Sheba Gardens','nad-al-sheba-gardens','offplan','prime',    ST_SetSRID(ST_MakePoint(55.3200,25.1500),4326)::geography, true),
  ((select id from developers where slug='meraas'), 'The Acres',        'the-acres',          'offplan', 'prime',       ST_SetSRID(ST_MakePoint(55.2700,25.0300),4326)::geography, true),
  -- Dubai Holding / Dubai Properties
  ((select id from developers where slug='dubai-holding'), 'Jumeirah Golf Estates','jumeirah-golf-estates','mixed','prime',ST_SetSRID(ST_MakePoint(55.2080,25.0310),4326)::geography, true),
  ((select id from developers where slug='dubai-holding'), 'Mudon',      'mudon',              'ready',   'mid',         ST_SetSRID(ST_MakePoint(55.2630,25.0100),4326)::geography, true),
  ((select id from developers where slug='dubai-holding'), 'Serena',     'serena',             'ready',   'mid',         ST_SetSRID(ST_MakePoint(55.2970,24.9970),4326)::geography, true),
  ((select id from developers where slug='dubai-holding'), 'Villanova',  'villanova',          'mixed',   'mid',         ST_SetSRID(ST_MakePoint(55.3160,25.0060),4326)::geography, true),
  ((select id from developers where slug='dubai-holding'), 'The Villa',  'the-villa',          'ready',   'premium',     ST_SetSRID(ST_MakePoint(55.3500,25.0600),4326)::geography, true),
  -- Majid Al Futtaim
  ((select id from developers where slug='majid-al-futtaim'), 'Tilal Al Ghaf','tilal-al-ghaf','mixed','prime',           ST_SetSRID(ST_MakePoint(55.2220,25.0050),4326)::geography, true),
  -- DAMAC
  ((select id from developers where slug='damac'), 'DAMAC Hills',        'damac-hills',        'mixed',   'premium',     ST_SetSRID(ST_MakePoint(55.2460,25.0280),4326)::geography, true),
  ((select id from developers where slug='damac'), 'DAMAC Hills 2',      'damac-hills-2',      'mixed',   'accessible',  ST_SetSRID(ST_MakePoint(55.3180,24.9050),4326)::geography, true),
  ((select id from developers where slug='damac'), 'DAMAC Lagoons',      'damac-lagoons',      'offplan', 'premium',     ST_SetSRID(ST_MakePoint(55.2010,25.0380),4326)::geography, true),
  ((select id from developers where slug='damac'), 'DAMAC Islands',      'damac-islands',      'offplan', 'premium',     ST_SetSRID(ST_MakePoint(55.1600,25.0000),4326)::geography, true),
  -- Aldar
  ((select id from developers where slug='aldar'), 'Haven by Aldar',     'haven-by-aldar',     'offplan', 'premium',     ST_SetSRID(ST_MakePoint(55.3900,24.9800),4326)::geography, true),
  ((select id from developers where slug='aldar'), 'The Sanctuary by Aldar','the-sanctuary-by-aldar','offplan','ultra_prime',ST_SetSRID(ST_MakePoint(55.1800,25.0000),4326)::geography, true),
  -- Sobha
  ((select id from developers where slug='sobha'), 'Sobha Hartland',     'sobha-hartland',     'mixed',   'prime',       ST_SetSRID(ST_MakePoint(55.3000,25.1760),4326)::geography, true),
  ((select id from developers where slug='sobha'), 'Sobha Hartland II',  'sobha-hartland-2',   'offplan', 'prime',       ST_SetSRID(ST_MakePoint(55.3100,25.1600),4326)::geography, true),
  ((select id from developers where slug='sobha'), 'Sobha Reserve',      'sobha-reserve',      'offplan', 'prime',       ST_SetSRID(ST_MakePoint(55.3000,25.0600),4326)::geography, true),
  -- Nshama
  ((select id from developers where slug='nshama'), 'Town Square',       'town-square',        'mixed',   'accessible',  ST_SetSRID(ST_MakePoint(55.2860,25.0080),4326)::geography, true),
  -- Meydan
  ((select id from developers where slug='meydan'), 'District One (MBR City)','district-one',  'mixed',   'ultra_prime', ST_SetSRID(ST_MakePoint(55.2900,25.1630),4326)::geography, true),
  -- Pearl Jumeirah (custom)
  ((select id from developers where slug='pearl-jumeirah'), 'Pearl Jumeirah','pearl-jumeirah', 'offplan','ultra_prime',  ST_SetSRID(ST_MakePoint(55.2600,25.2300),4326)::geography, true)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Sub-communities (known named sub-communities within each master).
-- Status defaults per master; all is_placeholder = true.
-- ---------------------------------------------------------------------
insert into sub_communities (community_id, name, slug, status) values
  -- Dubai Hills Estate
  ((select id from communities where slug='dubai-hills-estate'),'Sidra','sidra','ready'),
  ((select id from communities where slug='dubai-hills-estate'),'Maple','maple','ready'),
  ((select id from communities where slug='dubai-hills-estate'),'Golf Place','golf-place','ready'),
  ((select id from communities where slug='dubai-hills-estate'),'Club Villas','club-villas','ready'),
  ((select id from communities where slug='dubai-hills-estate'),'Parkway Vistas','parkway-vistas','ready'),
  ((select id from communities where slug='dubai-hills-estate'),'Fairway Vistas','fairway-vistas','ready'),
  -- Arabian Ranches 2
  ((select id from communities where slug='arabian-ranches-2'),'Palma','palma','ready'),
  ((select id from communities where slug='arabian-ranches-2'),'Rosa','rosa','ready'),
  ((select id from communities where slug='arabian-ranches-2'),'Camelia','camelia','ready'),
  ((select id from communities where slug='arabian-ranches-2'),'Azalea','azalea','ready'),
  ((select id from communities where slug='arabian-ranches-2'),'Lila','lila','ready'),
  -- Arabian Ranches 3
  ((select id from communities where slug='arabian-ranches-3'),'Joy','joy','offplan'),
  ((select id from communities where slug='arabian-ranches-3'),'Sun','sun','offplan'),
  ((select id from communities where slug='arabian-ranches-3'),'Ruba','ruba','offplan'),
  ((select id from communities where slug='arabian-ranches-3'),'Bliss','bliss','ready'),
  ((select id from communities where slug='arabian-ranches-3'),'Anya','anya','offplan'),
  ((select id from communities where slug='arabian-ranches-3'),'Caya','caya','offplan'),
  -- The Valley
  ((select id from communities where slug='the-valley'),'Eden','eden','offplan'),
  ((select id from communities where slug='the-valley'),'Nara','nara','offplan'),
  ((select id from communities where slug='the-valley'),'Rivana','rivana','offplan'),
  ((select id from communities where slug='the-valley'),'Farm Gardens','farm-gardens','offplan'),
  ((select id from communities where slug='the-valley'),'Alana','alana','offplan'),
  -- Emaar South
  ((select id from communities where slug='emaar-south'),'Expo Golf Villas','expo-golf-villas','mixed'),
  ((select id from communities where slug='emaar-south'),'Golf Links','golf-links','offplan'),
  ((select id from communities where slug='emaar-south'),'Fairway Villas','fairway-villas','mixed'),
  -- The Oasis
  ((select id from communities where slug='the-oasis'),'Palmiera','palmiera','offplan'),
  ((select id from communities where slug='the-oasis'),'Mirage','mirage','offplan'),
  ((select id from communities where slug='the-oasis'),'Address Villas','address-villas','offplan'),
  -- Reem (Mira)
  ((select id from communities where slug='reem-mira'),'Mira','mira','ready'),
  ((select id from communities where slug='reem-mira'),'Mira Oasis','mira-oasis','ready'),
  -- Palm Jumeirah
  ((select id from communities where slug='palm-jumeirah'),'Signature Villas','signature-villas','ready'),
  ((select id from communities where slug='palm-jumeirah'),'Garden Homes','garden-homes','ready'),
  ((select id from communities where slug='palm-jumeirah'),'Canal Cove Villas','canal-cove-villas','ready'),
  -- Jumeirah Park
  ((select id from communities where slug='jumeirah-park'),'Legacy','legacy','ready'),
  ((select id from communities where slug='jumeirah-park'),'Legacy Nova','legacy-nova','ready'),
  ((select id from communities where slug='jumeirah-park'),'Regional','regional','ready'),
  ((select id from communities where slug='jumeirah-park'),'Heritage','heritage','ready'),
  -- Jumeirah Islands
  ((select id from communities where slug='jumeirah-islands'),'Mediterranean Clusters','mediterranean-clusters','ready'),
  ((select id from communities where slug='jumeirah-islands'),'Master Views','master-views','ready'),
  ((select id from communities where slug='jumeirah-islands'),'Garden Hall','garden-hall','ready'),
  -- Palm Jebel Ali
  ((select id from communities where slug='palm-jebel-ali'),'Beach Villas','beach-villas','offplan'),
  ((select id from communities where slug='palm-jebel-ali'),'Coral Collection','coral-collection','offplan'),
  -- Al Furjan
  ((select id from communities where slug='al-furjan'),'Quortaj','quortaj','ready'),
  ((select id from communities where slug='al-furjan'),'Dubai Style','dubai-style','ready'),
  ((select id from communities where slug='al-furjan'),'Murooj','murooj','ready'),
  ((select id from communities where slug='al-furjan'),'Hayyan','hayyan','offplan'),
  -- Jebel Ali Village
  ((select id from communities where slug='jebel-ali-village'),'Jebel Ali Village Villas','jav-villas','mixed'),
  -- JVT
  ((select id from communities where slug='jumeirah-village-triangle'),'District 1','jvt-district-1','mixed'),
  ((select id from communities where slug='jumeirah-village-triangle'),'District 4','jvt-district-4','mixed'),
  ((select id from communities where slug='jumeirah-village-triangle'),'District 7','jvt-district-7','mixed'),
  -- Nad Al Sheba Gardens
  ((select id from communities where slug='nad-al-sheba-gardens'),'Nad Al Sheba Gardens Villas','nasg-villas','offplan'),
  -- The Acres
  ((select id from communities where slug='the-acres'),'The Acres Estates','the-acres-estates','offplan'),
  -- Jumeirah Golf Estates
  ((select id from communities where slug='jumeirah-golf-estates'),'Earth','earth','ready'),
  ((select id from communities where slug='jumeirah-golf-estates'),'Fire','fire','ready'),
  ((select id from communities where slug='jumeirah-golf-estates'),'Wind','wind','ready'),
  ((select id from communities where slug='jumeirah-golf-estates'),'Water','water','ready'),
  ((select id from communities where slug='jumeirah-golf-estates'),'Redwood Park','redwood-park','mixed'),
  ((select id from communities where slug='jumeirah-golf-estates'),'Alandalus','alandalus','ready'),
  -- Mudon
  ((select id from communities where slug='mudon'),'Arabella','arabella','ready'),
  ((select id from communities where slug='mudon'),'Al Salam','al-salam','ready'),
  ((select id from communities where slug='mudon'),'Mudon Views','mudon-views','ready'),
  ((select id from communities where slug='mudon'),'Mudon Al Ranim','mudon-al-ranim','offplan'),
  -- Serena
  ((select id from communities where slug='serena'),'Bella Casa','bella-casa','ready'),
  ((select id from communities where slug='serena'),'Casa Dora','casa-dora','ready'),
  ((select id from communities where slug='serena'),'Casa Viva','casa-viva','ready'),
  -- Villanova
  ((select id from communities where slug='villanova'),'Amaranta','amaranta','mixed'),
  ((select id from communities where slug='villanova'),'La Rosa','la-rosa','mixed'),
  ((select id from communities where slug='villanova'),'La Quinta','la-quinta','ready'),
  ((select id from communities where slug='villanova'),'La Violeta','la-violeta','ready'),
  -- The Villa
  ((select id from communities where slug='the-villa'),'Mazaya','mazaya','ready'),
  ((select id from communities where slug='the-villa'),'Cordoba','cordoba','ready'),
  ((select id from communities where slug='the-villa'),'Ponderosa','ponderosa','ready'),
  -- Tilal Al Ghaf
  ((select id from communities where slug='tilal-al-ghaf'),'Harmony','harmony','mixed'),
  ((select id from communities where slug='tilal-al-ghaf'),'Elan','elan','ready'),
  ((select id from communities where slug='tilal-al-ghaf'),'Aura Gardens','aura-gardens','ready'),
  ((select id from communities where slug='tilal-al-ghaf'),'Serenity','serenity','offplan'),
  ((select id from communities where slug='tilal-al-ghaf'),'Alaya','alaya','offplan'),
  ((select id from communities where slug='tilal-al-ghaf'),'Amara','amara','offplan'),
  -- DAMAC Hills
  ((select id from communities where slug='damac-hills'),'Rockwood','rockwood','ready'),
  ((select id from communities where slug='damac-hills'),'Silver Springs','silver-springs','ready'),
  ((select id from communities where slug='damac-hills'),'The Field','the-field','ready'),
  ((select id from communities where slug='damac-hills'),'Golf Promenade','golf-promenade','ready'),
  ((select id from communities where slug='damac-hills'),'Whitefield','whitefield','offplan'),
  -- DAMAC Hills 2
  ((select id from communities where slug='damac-hills-2'),'Amazonia','amazonia','ready'),
  ((select id from communities where slug='damac-hills-2'),'Aquilegia','aquilegia','ready'),
  ((select id from communities where slug='damac-hills-2'),'Avencia','avencia','ready'),
  ((select id from communities where slug='damac-hills-2'),'Victoria','victoria','ready'),
  -- DAMAC Lagoons
  ((select id from communities where slug='damac-lagoons'),'Santorini','santorini','offplan'),
  ((select id from communities where slug='damac-lagoons'),'Costa Brava','costa-brava','offplan'),
  ((select id from communities where slug='damac-lagoons'),'Portofino','portofino','offplan'),
  ((select id from communities where slug='damac-lagoons'),'Malta','malta','offplan'),
  ((select id from communities where slug='damac-lagoons'),'Nice','nice','offplan'),
  ((select id from communities where slug='damac-lagoons'),'Venice','venice','offplan'),
  ((select id from communities where slug='damac-lagoons'),'Morocco','morocco','offplan'),
  -- DAMAC Islands
  ((select id from communities where slug='damac-islands'),'Bali','bali','offplan'),
  ((select id from communities where slug='damac-islands'),'Maldives','maldives','offplan'),
  ((select id from communities where slug='damac-islands'),'Seychelles','seychelles','offplan'),
  ((select id from communities where slug='damac-islands'),'Hawaii','hawaii','offplan'),
  -- Haven by Aldar
  ((select id from communities where slug='haven-by-aldar'),'Serene','serene','offplan'),
  ((select id from communities where slug='haven-by-aldar'),'Amara (Haven)','amara-haven','offplan'),
  ((select id from communities where slug='haven-by-aldar'),'The Reserve','the-reserve','offplan'),
  -- The Sanctuary by Aldar
  ((select id from communities where slug='the-sanctuary-by-aldar'),'The Sanctuary Plots','sanctuary-plots','offplan'),
  -- Sobha Hartland
  ((select id from communities where slug='sobha-hartland'),'Hartland Greens','hartland-greens','ready'),
  ((select id from communities where slug='sobha-hartland'),'Forest Villas','forest-villas','ready'),
  ((select id from communities where slug='sobha-hartland'),'Hartland Estates','hartland-estates','mixed'),
  -- Sobha Hartland II
  ((select id from communities where slug='sobha-hartland-2'),'Hartland II Estates','hartland-2-estates','offplan'),
  -- Sobha Reserve
  ((select id from communities where slug='sobha-reserve'),'Sobha Reserve Villas','sobha-reserve-villas','offplan'),
  -- Town Square
  ((select id from communities where slug='town-square'),'Zahra Townhouses','zahra-townhouses','ready'),
  ((select id from communities where slug='town-square'),'Hayat Townhouses','hayat-townhouses','ready'),
  ((select id from communities where slug='town-square'),'Naseem','naseem','offplan'),
  ((select id from communities where slug='town-square'),'Cedre Villas','cedre-villas','ready'),
  -- District One
  ((select id from communities where slug='district-one'),'District One Villas','d1-villas','mixed'),
  ((select id from communities where slug='district-one'),'District One Mansions','d1-mansions','offplan'),
  ((select id from communities where slug='district-one'),'District One West','d1-west','offplan'),
  -- Pearl Jumeirah
  ((select id from communities where slug='pearl-jumeirah'),'Pearl Jumeirah Villas','pearl-jumeirah-villas','offplan')
on conflict (community_id, slug) do nothing;

-- ---------------------------------------------------------------------
-- Data-source registry (mirrors src/lib/sources/registry.ts). Records
-- what exists; Phase 1 runs no ingestion (last_status = 'manual').
-- ---------------------------------------------------------------------
insert into data_sources (key, label, category, cadence, is_enabled, last_status, reliability_notes) values
  ('dld','DLD / DXB Interact','transactions','weekly',true,'manual','Official transaction backbone. Preferred for sale prices.'),
  ('bayut','Bayut','listings','weekly',true,'manual','Live listings. Scraping breaches ToS; isolate as swappable weekly module (brief §9).'),
  ('property_finder','Property Finder','listings','weekly',true,'manual','Live listings. Same containment posture as Bayut.'),
  ('khda','KHDA','schools','manual',true,'manual','School ratings, curricula, fees.'),
  ('google_maps','Google Maps / Distance Matrix','geo','manual',true,'manual','Geo, commute, POIs.'),
  ('government_infrastructure','Government / master-developer sources','infrastructure','manual',true,'manual','Infrastructure spend, master-plan catalysts.')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- Filter definitions — config-driven filter framework (Milestone 6).
-- Adding a filter later = one row here; nothing else re-architected.
-- ---------------------------------------------------------------------
insert into filter_definitions (key, label, control, data_path, unit, group_label, sort_order) values
  ('budget','Budget','range','unit_archetypes.price','AED','Financials',10),
  ('unit_type','Villa / Townhouse','select','unit_archetypes.unit_type',null,'Property',20),
  ('bedrooms','Bedrooms','range','unit_archetypes.bedrooms',null,'Property',30),
  ('bathrooms','Bathrooms','range','unit_archetypes.bathrooms',null,'Property',40),
  ('bua','Built-up area','range','unit_archetypes.bua_sqft','sqft','Areas',50),
  ('plot','Plot area','range','unit_archetypes.plot_sqft','sqft','Areas',60),
  ('kitchen_type','Kitchen type','select','unit_archetypes.kitchen_type',null,'Layout',70),
  ('service_charge','Service charge','range','unit_archetypes.service_charge_per_sqft','AED/sqft','Financials',80),
  ('status','Ready / Offplan / Mixed','select','communities.status',null,'Property',90),
  ('developer','Developer','select','developers.slug',null,'Property',100),
  ('phase','Phase','select','phases.phase_name',null,'Position',110),
  ('appreciation','Capital appreciation','range','capital_growth.pct_change','%','Market',120),
  ('yield','Rental yield','range','rental_data.gross_yield_pct','%','Market',130),
  ('absorption','Absorption rate','range','absorption.absorption_rate','%','Momentum',140),
  ('school_proximity','School proximity','range','schools.geo_point','min','Context',150),
  ('school_fee','School fee band','range','schools.fee_max','AED','Context',160),
  ('commute','Commute to hub','range','commute_times.minutes_driving','min','Context',170),
  ('who_its_for','Who it''s for','multiselect',null,null,'Character',180)
on conflict (key) do nothing;

-- >>>>> seed_dubai_hills.sql

-- =====================================================================
-- SEED (example) — Dubai Hills Estate content
--
-- Worked example for a ready community. Populates only authentic,
-- verifiable, non-volatile descriptive facts (developer, master-plan
-- features, character) sourced from public developer/portal information.
-- All market numbers, counts, unit specs and prices are LEFT NULL — they
-- render as visibly empty until real data is entered. No fabrication.
--
-- Idempotent. Run after seed.sql.
-- =====================================================================

update communities set
  age_or_handover = 'Established · villa districts handed over from 2019',
  is_placeholder = false,
  master_plan_features = '[
    "18-hole championship golf course (Troon, par-72)",
    "Dubai Hills Park — one of the city''s largest residential parks",
    "Dubai Hills Mall (600+ stores, VOX Cinemas)",
    "Dubai Hills Boulevard",
    "Direct access via Al Khail Road (E44)"
  ]'::jsonb,
  description_long =
    'Dubai Hills Estate is a 2,700-acre master community developed as a '
    || 'joint venture between Emaar Properties and Meraas, positioned '
    || 'between Downtown Dubai and the emirate''s newer growth corridors '
    || 'with direct access via Al Khail Road. It is built around an '
    || '18-hole championship golf course and Dubai Hills Park, and anchored '
    || 'by Dubai Hills Mall. The estate is known for its wide, green, '
    || 'low-rise villa and townhouse districts — a self-contained '
    || '"city within a city" that has become one of the most established '
    || 'and liquid family communities in central Dubai.',
  who_its_for_base =
    'Families and end-users who want an established, green, master-planned '
    || 'address within easy reach of Downtown — golf, parks, schools and a '
    || 'major mall on the doorstep — without the density of the older '
    || 'central districts. It also suits investors who prioritise liquidity '
    || 'and a proven Emaar track record over frontier upside: a community '
    || 'with deep resale demand and a broad range of villa and townhouse '
    || 'product.'
where slug = 'dubai-hills-estate';

-- Fill in the two remaining well-known villa districts (others seeded).
insert into sub_communities (community_id, name, slug, status) values
  ((select id from communities where slug='dubai-hills-estate'),'Majestic Vistas','majestic-vistas','ready'),
  ((select id from communities where slug='dubai-hills-estate'),'Emerald Hills','emerald-hills','mixed')
on conflict (community_id, slug) do nothing;

-- Authentic character notes for the flagship villa/townhouse districts
-- (bedroom ranges are the developer''s published configurations).
update sub_communities set
  description_long = 'Sidra is a premium villa district of contemporary 3–5 bedroom homes '
    || 'arranged around landscaped streets and pocket parks, within walking '
    || 'reach of Dubai Hills Park and the estate''s schools.',
  who_its_for_base = 'Families wanting a modern, move-in villa in an established, amenity-rich '
    || 'setting close to central Dubai.',
  is_placeholder = false
where slug = 'sidra'
  and community_id = (select id from communities where slug='dubai-hills-estate');

update sub_communities set
  description_long = 'Maple is a large townhouse district of 3–4 bedroom homes with private '
    || 'gardens and shared amenities — one of the estate''s most in-demand '
    || 'entry points into Dubai Hills for growing families.',
  who_its_for_base = 'First-time villa/townhouse buyers and families seeking value and '
    || 'community amenities within a blue-chip master plan.',
  is_placeholder = false
where slug = 'maple'
  and community_id = (select id from communities where slug='dubai-hills-estate');

-- >>>>> seed_tags.sql

-- =====================================================================
-- SEED (tags) — authentic community character tags
-- Broad, verifiable characteristics used by the store's character filter.
-- Conservative on purpose; communities not listed keep an empty tag set.
-- Run after seed.sql.
-- =====================================================================

update communities set character_tags = '{golf,established,central,schools-nearby}'      where slug='dubai-hills-estate';
update communities set character_tags = '{gated-family,established,schools-nearby}'       where slug='arabian-ranches-2';
update communities set character_tags = '{gated-family,new-launch,schools-nearby}'        where slug='arabian-ranches-3';
update communities set character_tags = '{new-launch,gated-family,nature}'                 where slug='the-valley';
update communities set character_tags = '{golf,new-launch,value-entry}'                    where slug='emaar-south';
update communities set character_tags = '{ultra-luxury,waterfront,new-launch}'             where slug='the-oasis';
update communities set character_tags = '{gated-family,established,value-entry}'           where slug='reem-mira';
update communities set character_tags = '{ultra-luxury,waterfront,beach,established}'      where slug='palm-jumeirah';
update communities set character_tags = '{established,gated-family}'                        where slug='jumeirah-park';
update communities set character_tags = '{waterfront,established,prestige}'                 where slug='jumeirah-islands';
update communities set character_tags = '{ultra-luxury,waterfront,beach,new-launch}'       where slug='palm-jebel-ali';
update communities set character_tags = '{established,value-entry}'                         where slug='al-furjan';
update communities set character_tags = '{waterfront,new-launch,prestige}'                 where slug='nad-al-sheba-gardens';
update communities set character_tags = '{new-launch,nature,gated-family}'                 where slug='the-acres';
update communities set character_tags = '{golf,established,prestige}'                       where slug='jumeirah-golf-estates';
update communities set character_tags = '{gated-family,established,schools-nearby}'         where slug='mudon';
update communities set character_tags = '{gated-family,value-entry}'                        where slug='serena';
update communities set character_tags = '{gated-family,value-entry}'                        where slug='villanova';
update communities set character_tags = '{established,gated-family}'                        where slug='the-villa';
update communities set character_tags = '{waterfront,wellness,new-launch}'                  where slug='tilal-al-ghaf';
update communities set character_tags = '{golf,gated-family,established}'                   where slug='damac-hills';
update communities set character_tags = '{gated-family,value-entry}'                        where slug='damac-hills-2';
update communities set character_tags = '{waterfront,new-launch}'                           where slug='damac-lagoons';
update communities set character_tags = '{waterfront,new-launch}'                           where slug='damac-islands';
update communities set character_tags = '{wellness,new-launch,nature}'                      where slug='haven-by-aldar';
update communities set character_tags = '{ultra-luxury,new-launch,prestige}'               where slug='the-sanctuary-by-aldar';
update communities set character_tags = '{waterfront,central,established}'                  where slug='sobha-hartland';
update communities set character_tags = '{waterfront,central,new-launch}'                   where slug='sobha-hartland-2';
update communities set character_tags = '{new-launch,nature}'                               where slug='sobha-reserve';
update communities set character_tags = '{gated-family,value-entry}'                        where slug='town-square';
update communities set character_tags = '{ultra-luxury,waterfront,central}'                where slug='district-one';
update communities set character_tags = '{ultra-luxury,beach,waterfront,new-launch}'       where slug='pearl-jumeirah';



-- =====================================================================
-- >>>>> seed_expansion.sql
-- =====================================================================
-- =====================================================================
-- SEED (expansion) — widening toward "every villa/townhouse community
-- in Dubai" (ready + offplan, gated or not).
--
-- Honesty rule (from the brief): this file loads only STRUCTURAL facts —
-- the four-level taxonomy, Ready/Offplan/Mixed status, broad positioning
-- tier, approximate map centroids (lng, lat) and broad character tags.
-- Every master here is `is_placeholder = true`: all counts, prices,
-- descriptions, who-it's-for copy and market numbers stay NULL so they
-- render visibly empty until entered via Admin / DXB Interact.
--
-- This is an *expanding registry*: run seed.sql first, then this. Both are
-- idempotent (ON CONFLICT DO NOTHING). New communities are appended over
-- time as coverage grows toward the whole city.
--
-- Coordinates are approximate real centroids for map pins, not market data.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Additional developers / master-developers.
-- ---------------------------------------------------------------------
insert into developers (name, slug) values
  ('Al Barari Developers', 'al-barari-developers'),
  ('Zaya', 'zaya'),
  ('Union Properties', 'union-properties'),
  ('Tanmiyat', 'tanmiyat'),
  ('wasl', 'wasl'),
  ('Diamond Developers', 'diamond-developers'),
  ('Reportage', 'reportage'),
  ('Ellington', 'ellington'),
  ('Dubai South', 'dubai-south'),
  ('Azizi', 'azizi'),
  ('Ellington Nakheel (co)', 'ellington-nakheel')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Master communities (expansion). geo_center is an approximate centroid.
-- ---------------------------------------------------------------------
insert into communities (developer_id, name, slug, status, positioning_tier, geo_center, is_placeholder) values
  -- Emaar — the established Emirates Living triad + Emirates Hills (near Al Khail Rd)
  ((select id from developers where slug='emaar'), 'The Springs',       'the-springs',       'ready',   'premium',     ST_SetSRID(ST_MakePoint(55.1660,25.0700),4326)::geography, true),
  ((select id from developers where slug='emaar'), 'The Meadows',       'the-meadows',       'ready',   'prime',       ST_SetSRID(ST_MakePoint(55.1580,25.0660),4326)::geography, true),
  ((select id from developers where slug='emaar'), 'The Lakes',         'the-lakes',         'ready',   'prime',       ST_SetSRID(ST_MakePoint(55.1720,25.0580),4326)::geography, true),
  ((select id from developers where slug='emaar'), 'Emirates Hills',    'emirates-hills',    'ready',   'ultra_prime', ST_SetSRID(ST_MakePoint(55.1620,25.0690),4326)::geography, true),
  ((select id from developers where slug='emaar'), 'Grand Polo Club & Resort', 'grand-polo-club', 'offplan', 'ultra_prime', ST_SetSRID(ST_MakePoint(55.3500,24.9450),4326)::geography, true),
  ((select id from developers where slug='emaar'), 'Alma (Dubai Hills)','alma',              'offplan', 'premium',     ST_SetSRID(ST_MakePoint(55.2450,25.0980),4326)::geography, true),
  -- Al Barari (Barari area) — Client 2 target incl. Lunaya (offplan, by Zaya)
  ((select id from developers where slug='al-barari-developers'), 'Al Barari', 'al-barari', 'mixed', 'ultra_prime', ST_SetSRID(ST_MakePoint(55.3150,25.0900),4326)::geography, true),
  ((select id from developers where slug='zaya'), 'Lunaya',             'lunaya',            'offplan', 'ultra_prime', ST_SetSRID(ST_MakePoint(55.3200,25.0850),4326)::geography, true),
  -- Dubailand / Wadi Al Safa belt (near Al Ain Rd / Sheikh Mohammed Bin Zayed)
  ((select id from developers where slug='tanmiyat'), 'Living Legends', 'living-legends',    'ready',   'premium',     ST_SetSRID(ST_MakePoint(55.3250,25.0450),4326)::geography, true),
  ((select id from developers where slug='dubai-holding'), 'Falcon City of Wonders', 'falcon-city', 'mixed', 'mid',    ST_SetSRID(ST_MakePoint(55.3200,25.0800),4326)::geography, true),
  ((select id from developers where slug='emaar'), 'Cherrywoods',       'cherrywoods',       'ready',   'mid',         ST_SetSRID(ST_MakePoint(55.2900,25.0100),4326)::geography, true),
  -- Sports City / Motor City belt (gated villa enclaves)
  ((select id from developers where slug='union-properties'), 'Victory Heights', 'victory-heights', 'ready', 'premium', ST_SetSRID(ST_MakePoint(55.2200,25.0430),4326)::geography, true),
  ((select id from developers where slug='union-properties'), 'Green Community (Motor City)', 'green-community-motor-city', 'ready', 'mid', ST_SetSRID(ST_MakePoint(55.2380,25.0480),4326)::geography, true),
  ((select id from developers where slug='union-properties'), 'Green Community (DIP)', 'green-community-dip', 'ready', 'mid', ST_SetSRID(ST_MakePoint(55.1700,24.9750),4326)::geography, true),
  -- The Sustainable City
  ((select id from developers where slug='diamond-developers'), 'The Sustainable City', 'the-sustainable-city', 'ready', 'premium', ST_SetSRID(ST_MakePoint(55.2880,24.9850),4326)::geography, true),
  -- wasl / Nad Al Sheba (villas)
  ((select id from developers where slug='wasl'), 'Nad Al Sheba Villas','nad-al-sheba-villas','mixed',  'premium',     ST_SetSRID(ST_MakePoint(55.3300,25.1600),4326)::geography, true),
  ((select id from developers where slug='wasl'), 'Wasl Gate',          'wasl-gate',          'mixed',   'mid',         ST_SetSRID(ST_MakePoint(55.1200,25.0000),4326)::geography, true),
  -- Mirdif belt (established eastern villas)
  ((select id from developers where slug='dubai-holding'), 'Uptown Mirdif', 'uptown-mirdif', 'ready',   'mid',         ST_SetSRID(ST_MakePoint(55.4200,25.2200),4326)::geography, true),
  -- Dubai South (villas/townhouses near Al Maktoum Intl / Expo)
  ((select id from developers where slug='dubai-south'), 'The Pulse',    'the-pulse',         'mixed',   'accessible',    ST_SetSRID(ST_MakePoint(55.1550,24.8800),4326)::geography, true),
  ((select id from developers where slug='dubai-south'), 'South Bay',    'south-bay',         'offplan', 'premium',     ST_SetSRID(ST_MakePoint(55.1450,24.8650),4326)::geography, true),
  -- Dubai Investment Park / Jebel Ali affordable villa belt
  ((select id from developers where slug='reportage'), 'Verdana',        'verdana',           'offplan', 'accessible',  ST_SetSRID(ST_MakePoint(55.1650,24.9800),4326)::geography, true),
  ((select id from developers where slug='reportage'), 'Rukan',          'rukan',             'mixed',   'accessible',    ST_SetSRID(ST_MakePoint(55.3400,24.9800),4326)::geography, true),
  -- Meydan / MBR belt (offplan townhouse/villa launches)
  ((select id from developers where slug='meydan'), 'Meydan Gardens (Polo Homes)', 'meydan-gardens', 'mixed', 'prime', ST_SetSRID(ST_MakePoint(55.3050,25.1550),4326)::geography, true),
  -- Emaar — Rashid & Creek waterfront townhouse/villa (mixed use, villa components)
  ((select id from developers where slug='emaar'), 'The Cove (Creek Harbour)', 'the-cove-creek', 'offplan', 'prime',   ST_SetSRID(ST_MakePoint(55.3520,25.1980),4326)::geography, true),
  -- DAMAC — additional
  ((select id from developers where slug='damac'), 'DAMAC Riverside',   'damac-riverside',   'offplan', 'mid',         ST_SetSRID(ST_MakePoint(55.1400,24.9400),4326)::geography, true),
  -- Nakheel — additional villa/townhouse
  ((select id from developers where slug='nakheel'), 'Tilal Al Furjan', 'tilal-al-furjan',   'mixed',   'premium',     ST_SetSRID(ST_MakePoint(55.1420,25.0250),4326)::geography, true),
  ((select id from developers where slug='nakheel'), 'Warsan Village',  'warsan-village',    'ready',   'accessible',    ST_SetSRID(ST_MakePoint(55.4000,25.1700),4326)::geography, true),
  -- Sobha — additional
  ((select id from developers where slug='sobha'), 'Sobha Elwood',      'sobha-elwood',      'offplan', 'prime',       ST_SetSRID(ST_MakePoint(55.3550,25.0250),4326)::geography, true),
  -- Nshama — additional (Town Square expansion parcels tracked separately if needed)
  ((select id from developers where slug='emaar'), 'The Valley 2 (Rivera / Velora)', 'the-valley-2', 'offplan', 'premium', ST_SetSRID(ST_MakePoint(55.4050,24.9800),4326)::geography, true),
  -- Ellington villa/townhouse
  ((select id from developers where slug='ellington'), 'The Wilds',     'the-wilds',         'offplan', 'premium',     ST_SetSRID(ST_MakePoint(55.2700,25.0000),4326)::geography, true)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Sub-communities (expansion). All is_placeholder = true (default).
-- ---------------------------------------------------------------------
insert into sub_communities (community_id, name, slug, status) values
  -- The Springs (numbered districts of townhouses)
  ((select id from communities where slug='the-springs'),'Springs 1','springs-1','ready'),
  ((select id from communities where slug='the-springs'),'Springs 3','springs-3','ready'),
  ((select id from communities where slug='the-springs'),'Springs 7','springs-7','ready'),
  ((select id from communities where slug='the-springs'),'Springs 14','springs-14','ready'),
  ((select id from communities where slug='the-springs'),'Springs 15','springs-15','ready'),
  -- The Meadows (gated villa districts)
  ((select id from communities where slug='the-meadows'),'Meadows 1','meadows-1','ready'),
  ((select id from communities where slug='the-meadows'),'Meadows 4','meadows-4','ready'),
  ((select id from communities where slug='the-meadows'),'Meadows 8','meadows-8','ready'),
  ((select id from communities where slug='the-meadows'),'Meadows 9','meadows-9','ready'),
  -- The Lakes
  ((select id from communities where slug='the-lakes'),'Deema','deema','ready'),
  ((select id from communities where slug='the-lakes'),'Forat','forat','ready'),
  ((select id from communities where slug='the-lakes'),'Ghadeer','ghadeer','ready'),
  ((select id from communities where slug='the-lakes'),'Hattan','hattan','ready'),
  ((select id from communities where slug='the-lakes'),'Maeen','maeen','ready'),
  ((select id from communities where slug='the-lakes'),'Zulal','zulal','ready'),
  -- Emirates Hills (sectors)
  ((select id from communities where slug='emirates-hills'),'Sector E','emirates-hills-sector-e','ready'),
  ((select id from communities where slug='emirates-hills'),'Sector L','emirates-hills-sector-l','ready'),
  ((select id from communities where slug='emirates-hills'),'Sector W','emirates-hills-sector-w','ready'),
  -- Grand Polo Club & Resort
  ((select id from communities where slug='grand-polo-club'),'Grand Polo Estates','grand-polo-estates','offplan'),
  -- Alma
  ((select id from communities where slug='alma'),'Alma Townhouses','alma-townhouses','offplan'),
  -- Al Barari (villa sub-communities)
  ((select id from communities where slug='al-barari'),'The Residences','al-barari-residences','ready'),
  ((select id from communities where slug='al-barari'),'Nara','al-barari-nara','ready'),
  ((select id from communities where slug='al-barari'),'Chorisia','al-barari-chorisia','ready'),
  ((select id from communities where slug='al-barari'),'The Nest','al-barari-nest','ready'),
  ((select id from communities where slug='al-barari'),'Dahlia','al-barari-dahlia','ready'),
  ((select id from communities where slug='al-barari'),'The Reserve','al-barari-reserve','offplan'),
  -- Lunaya
  ((select id from communities where slug='lunaya'),'Lunaya Villas','lunaya-villas','offplan'),
  -- Living Legends
  ((select id from communities where slug='living-legends'),'Living Legends Villas','living-legends-villas','ready'),
  -- Falcon City
  ((select id from communities where slug='falcon-city'),'Falcon City Villas','falcon-city-villas','mixed'),
  -- Cherrywoods
  ((select id from communities where slug='cherrywoods'),'Cherrywoods Townhouses','cherrywoods-townhouses','ready'),
  -- Victory Heights
  ((select id from communities where slug='victory-heights'),'Morella','morella','ready'),
  ((select id from communities where slug='victory-heights'),'Novelia','novelia','ready'),
  ((select id from communities where slug='victory-heights'),'Esmeralda','esmeralda','ready'),
  ((select id from communities where slug='victory-heights'),'Estella','estella','ready'),
  -- Green Community (Motor City)
  ((select id from communities where slug='green-community-motor-city'),'Casa Familia','casa-familia','ready'),
  -- Green Community (DIP)
  ((select id from communities where slug='green-community-dip'),'Green Community West','green-community-west','ready'),
  ((select id from communities where slug='green-community-dip'),'Green Community East','green-community-east','ready'),
  -- The Sustainable City
  ((select id from communities where slug='the-sustainable-city'),'SC Villas','sc-villas','ready'),
  -- Nad Al Sheba Villas
  ((select id from communities where slug='nad-al-sheba-villas'),'Nad Al Sheba 3','nad-al-sheba-3','mixed'),
  -- Wasl Gate
  ((select id from communities where slug='wasl-gate'),'Wasl Gate Townhouses','wasl-gate-townhouses','mixed'),
  -- Uptown Mirdif
  ((select id from communities where slug='uptown-mirdif'),'Uptown Mirdif Villas','uptown-mirdif-villas','ready'),
  -- The Pulse
  ((select id from communities where slug='the-pulse'),'The Pulse Townhouses','the-pulse-townhouses','ready'),
  ((select id from communities where slug='the-pulse'),'The Pulse Beachfront','the-pulse-beachfront','offplan'),
  -- South Bay
  ((select id from communities where slug='south-bay'),'South Bay Villas','south-bay-villas','offplan'),
  -- Verdana
  ((select id from communities where slug='verdana'),'Verdana Townhouses','verdana-townhouses','offplan'),
  -- Rukan
  ((select id from communities where slug='rukan'),'Rukan Townhouses','rukan-townhouses','mixed'),
  -- Meydan Gardens
  ((select id from communities where slug='meydan-gardens'),'Polo Homes','polo-homes','mixed'),
  ((select id from communities where slug='meydan-gardens'),'Millennium Estates','millennium-estates','mixed'),
  -- The Cove
  ((select id from communities where slug='the-cove-creek'),'The Cove Townhouses','the-cove-townhouses','offplan'),
  -- DAMAC Riverside
  ((select id from communities where slug='damac-riverside'),'Riverside Villas','riverside-villas','offplan'),
  -- Tilal Al Furjan
  ((select id from communities where slug='tilal-al-furjan'),'Tilal Al Furjan Villas','tilal-al-furjan-villas','mixed'),
  -- Warsan Village
  ((select id from communities where slug='warsan-village'),'Warsan Village Townhouses','warsan-village-townhouses','ready'),
  -- Sobha Elwood
  ((select id from communities where slug='sobha-elwood'),'Elwood Villas','elwood-villas','offplan'),
  -- The Valley 2
  ((select id from communities where slug='the-valley-2'),'Velora','velora','offplan'),
  ((select id from communities where slug='the-valley-2'),'Rivera','rivera','offplan'),
  -- The Wilds
  ((select id from communities where slug='the-wilds'),'The Wilds Townhouses','the-wilds-townhouses','offplan')
on conflict (community_id, slug) do nothing;

-- ---------------------------------------------------------------------
-- Character tags (expansion). Broad, verifiable characteristics only.
-- ---------------------------------------------------------------------
update communities set character_tags = '{established,gated-family,central,schools-nearby}' where slug='the-springs';
update communities set character_tags = '{established,gated-family,prestige,schools-nearby}' where slug='the-meadows';
update communities set character_tags = '{established,gated-family,prestige}'               where slug='the-lakes';
update communities set character_tags = '{ultra-luxury,gated-family,prestige,established}'  where slug='emirates-hills';
update communities set character_tags = '{ultra-luxury,new-launch,nature,prestige}'         where slug='grand-polo-club';
update communities set character_tags = '{new-launch,golf,gated-family}'                    where slug='alma';
update communities set character_tags = '{ultra-luxury,nature,wellness,prestige,established}' where slug='al-barari';
update communities set character_tags = '{ultra-luxury,new-launch,nature,wellness,investment}' where slug='lunaya';
update communities set character_tags = '{established,gated-family,value-entry}'            where slug='living-legends';
update communities set character_tags = '{established,gated-family,value-entry}'            where slug='falcon-city';
update communities set character_tags = '{gated-family,new-launch,value-entry}'             where slug='cherrywoods';
update communities set character_tags = '{golf,gated-family,established,prestige}'          where slug='victory-heights';
update communities set character_tags = '{gated-family,established,value-entry}'            where slug='green-community-motor-city';
update communities set character_tags = '{gated-family,established,nature}'                 where slug='green-community-dip';
update communities set character_tags = '{gated-family,wellness,nature,established}'        where slug='the-sustainable-city';
update communities set character_tags = '{established,gated-family,central}'                where slug='nad-al-sheba-villas';
update communities set character_tags = '{gated-family,new-launch,value-entry}'            where slug='wasl-gate';
update communities set character_tags = '{established,gated-family,value-entry}'            where slug='uptown-mirdif';
update communities set character_tags = '{gated-family,new-launch,value-entry,investment}' where slug='the-pulse';
update communities set character_tags = '{new-launch,gated-family,investment}'             where slug='south-bay';
update communities set character_tags = '{new-launch,value-entry,investment}'              where slug='verdana';
update communities set character_tags = '{new-launch,value-entry}'                         where slug='rukan';
update communities set character_tags = '{prestige,gated-family,central,established}'       where slug='meydan-gardens';
update communities set character_tags = '{waterfront,new-launch,central,investment}'       where slug='the-cove-creek';
update communities set character_tags = '{waterfront,new-launch,value-entry,investment}'   where slug='damac-riverside';
update communities set character_tags = '{gated-family,new-launch,established}'             where slug='tilal-al-furjan';
update communities set character_tags = '{established,value-entry}'                         where slug='warsan-village';
update communities set character_tags = '{new-launch,gated-family,central}'                where slug='sobha-elwood';
update communities set character_tags = '{new-launch,gated-family,nature}'                 where slug='the-valley-2';
update communities set character_tags = '{new-launch,gated-family,nature}'                 where slug='the-wilds';


-- =====================================================================
-- >>>>> seed_client_scenarios.sql
-- =====================================================================
-- =====================================================================
-- SEED (client scenarios) — DEPTH data for the two live test briefs.
--
-- Honesty rule: every figure below is sourced from a public, verifiable
-- reference (developer price lists, Property Finder / Bayut listings,
-- DLD transaction commentary), cited inline as `-- src:`. Prices are
-- dated asking-price / launch-price snapshots (July 2026) — indicative,
-- not guarantees. Anything not verifiable is left NULL (renders empty).
--
-- Client 1 — 4BR / ≥4 bath, garden in plot, semi-detached or detached,
--   gated, close to Al Khail Road, budget AED 9M:
--     • The Meadows (Emaar)         — ready, detached, gated
--     • Dubai Hills · Sidra (Emaar) — ready, semi-detached, gated
--     • Dubai Hills · Maple (Emaar) — ready, townhouse, gated (value)
--
-- Client 2 — offplan villa/townhouse, capital-growth-led, long-term,
--   good yield, close to the city, budget AED 10M, handover ≤ 2029/30:
--     • Nad Al Sheba Gardens (Meraas) — offplan 2028, 10 min Downtown
--     • Lunaya by Zaya (Jebel Ali Village) — offplan 2029, lagoon villas
--     • Sobha Reserve (Sobha)         — completing 2026, quality benchmark
--
-- NOTE (fact correction): "Lunaya by Zaya" is in JEBEL ALI VILLAGE, not
-- Al Barari. A separate project, "Lunaria", is by Al Barari in Al Barari.
--
-- Idempotent: re-scopes (deletes then re-inserts) depth rows for exactly
-- these six sub-communities. Run after seed.sql + seed_expansion.sql.
-- =====================================================================

-- Relocate Lunaya to its real master area (Jebel Ali Village) + tag it.
-- src: propertyfinder.ae "Lunaya - in Jebel Ali by Zaya"; lunayabyzaya.com
update communities set
  geo_center = ST_SetSRID(ST_MakePoint(55.1100, 25.0050), 4326)::geography,
  character_tags = '{waterfront,new-launch,nature,investment}'
  where slug = 'lunaya';

-- ---------------------------------------------------------------------
-- Community-level depth (counts, handover text, narrative, buyer base).
-- ---------------------------------------------------------------------
update communities set
  status = 'ready',
  age_or_handover = 'Ready · first handover 2004',
  villa_count = 1800,
  is_placeholder = false,
  description_long = 'One of Dubai''s original master villa communities inside Emirates Living, The Meadows is nine gated, tree-lined sub-communities of independent (detached) villas wrapped around lakes and landscaped parks. Fully established, walkable, and minutes from Sheikh Zayed and Al Khail Roads.',
  who_its_for_base = 'End-user families who want a detached villa with a real garden inside a mature, gated community — close to schools, Dubai Marina and Downtown via Al Khail Road.'
  where slug = 'the-meadows';

update communities set
  age_or_handover = 'Ready · handover from 2019',
  is_placeholder = false,
  description_long = 'Emaar''s flagship modern master community along Al Khail Road, built around an 18-hole championship golf course, Dubai Hills Mall and a central park. A mix of gated villa and townhouse enclaves with strong, DLD-verified capital growth.',
  who_its_for_base = 'Families and investors who want new-generation, gated homes with best-in-class amenities and a proven appreciation track record, 12–15 minutes from Downtown.'
  where slug = 'dubai-hills-estate';

update communities set
  status = 'offplan',
  age_or_handover = 'Offplan · handover Q3 2028',
  is_placeholder = false,
  description_long = 'A gated Meraas master community of contemporary villas and townhouses around lagoons and parks, roughly 10 minutes from Downtown Dubai — among the most central new villa launches in the city.',
  who_its_for_base = 'Investors and end-users who want a central, gated, offplan villa with a developer payment plan and strong capital-growth positioning close to the city core.'
  where slug = 'nad-al-sheba-gardens';

update communities set
  status = 'offplan',
  age_or_handover = 'Offplan · handover 2029',
  is_placeholder = false,
  description_long = 'A Zaya-developed community of ~500 waterfront villas set around a 900,000 sqft crystal lagoon in Jebel Ali Village. A lifestyle-led launch with an extended 40/60 payment plan and long offplan runway.',
  who_its_for_base = 'Investors seeking a differentiated, lagoon-front offplan villa with a low entry point, a long payment runway and lifestyle-driven growth potential.'
  where slug = 'lunaya';

update communities set
  status = 'offplan',
  age_or_handover = 'Completing · handover from 2026',
  is_placeholder = false,
  description_long = 'A Sobha Realty community of ~300 detached villas in Wadi Al Safa 2, each with a private pool and landscaped garden, built to Sobha''s in-house "backward-integration" quality standard. Near completion — the quality benchmark in this comparison.',
  who_its_for_base = 'Buyers who prize build quality and a private plot with pool, and want a near-ready villa with headroom under budget rather than a long offplan wait.'
  where slug = 'sobha-reserve';

-- ---------------------------------------------------------------------
-- Sub-community-level depth.
-- ---------------------------------------------------------------------
update sub_communities set status='ready', is_placeholder=false,
  description_long='Gated enclave of detached 4–6 bedroom villas with private gardens, arranged around lakes and parks in The Meadows.',
  who_its_for_base='Families wanting a detached villa with a garden inside a gated, established community close to Al Khail Road.'
  where slug='meadows-4';

update sub_communities set status='ready', is_placeholder=false,
  description_long='Contemporary gated cluster of 3–5 bedroom semi-detached villas in Dubai Hills Estate, walkable to the park, mall and golf course.',
  who_its_for_base='Families and investors after a modern, gated villa with a garden and a proven, DLD-verified appreciation record along Al Khail Road.'
  where slug='sidra';

update sub_communities set status='ready', is_placeholder=false,
  description_long='Gated townhouse enclave in Dubai Hills Estate offering 3–5 bedroom homes with private gardens, positioned between Sheikh Mohammed bin Zayed and Al Khail Roads.',
  who_its_for_base='Families who want a gated Dubai Hills address and a private garden at a lower entry than the detached-villa clusters.'
  where slug='maple';

update sub_communities set status='offplan', is_placeholder=false,
  description_long='Offplan 4–5 bedroom villas and 3-bedroom townhouses in Meraas'' Nad Al Sheba Gardens, around lagoons and parks ~10 minutes from Downtown.',
  who_its_for_base='Investors seeking a central, gated, offplan villa with a developer payment plan and strong capital-growth positioning.'
  where slug='nasg-villas';

update sub_communities set status='offplan', is_placeholder=false,
  description_long='Offplan 4 & 5 bedroom waterfront villas around a 900,000 sqft lagoon in Jebel Ali Village, on a 40/60 payment plan.',
  who_its_for_base='Investors wanting a differentiated lagoon-front villa with a low entry and long offplan runway.'
  where slug='lunaya-villas';

update sub_communities set status='offplan', is_placeholder=false,
  description_long='Detached 4–6 bedroom villas in Sobha Reserve, each with a private pool and garden, built to Sobha''s backward-integrated quality standard.',
  who_its_for_base='Quality-first buyers who want a private plot with pool and a near-ready handover under budget.'
  where slug='sobha-reserve-villas';

-- ---------------------------------------------------------------------
-- Idempotency: clear prior depth rows for exactly these six sub-comms.
-- ---------------------------------------------------------------------
do $$
declare
  subs uuid[] := (
    select array_agg(id) from sub_communities
    where slug in ('meadows-4','sidra','maple','nasg-villas','lunaya-villas','sobha-reserve-villas')
  );
  comms uuid[] := (
    select array_agg(id) from communities
    where slug in ('nad-al-sheba-gardens','lunaya','sobha-reserve')
  );
begin
  delete from listings        where sub_community_id = any(subs);
  delete from rental_data     where sub_community_id = any(subs);
  delete from capital_growth  where sub_community_id = any(subs);
  delete from absorption      where sub_community_id = any(subs);
  delete from unit_archetypes where sub_community_id = any(subs);
  delete from phases          where sub_community_id = any(subs);
  delete from payment_plans   where community_id = any(comms);
  delete from commute_times   where community_id = any(comms);
end $$;

-- ---------------------------------------------------------------------
-- Phases (offplan price journey).
-- ---------------------------------------------------------------------
-- src: meraas.com Nad Al Sheba Gardens Phase 7 price & payment PDF (2025)
insert into phases (sub_community_id, phase_name, status, launch_date, current_price_per_sqft, units_in_phase)
select id, 'Phase 7', 'offplan', date '2025-05-01', 1650, 200 from sub_communities where slug='nasg-villas';
-- src: lunayabyzaya.com (launch 2025, handover 2029)
insert into phases (sub_community_id, phase_name, status, launch_date, units_in_phase)
select id, 'Launch', 'offplan', date '2025-01-01', 500 from sub_communities where slug='lunaya-villas';

-- ---------------------------------------------------------------------
-- Unit archetypes — the comparable "products".
-- bathrooms ≥ bedrooms to reflect en-suite + powder layouts.
-- ---------------------------------------------------------------------
-- CLIENT 1 -------------------------------------------------------------
-- The Meadows · 4BR detached  src: propertyfinder.ae villas-for-sale-meadows (Jul 2026)
insert into unit_archetypes
  (sub_community_id, name, unit_type, bedrooms, bathrooms, bua_sqft, plot_sqft,
   floors, parking_spaces, has_garden, has_pool, view_orientation,
   config_flags, price, service_charge_per_sqft, completion_status, condition)
select id, 'Type 4 · 4BR detached villa', 'villa', 4, 5, 4200, 6500,
   2, 2, true, false, 'Lake / community',
   '{"maids":true,"study":true,"storage":true}'::jsonb, 8500000, 3.50, 'ready', 'Standard'
from sub_communities where slug='meadows-4';

-- Dubai Hills · Sidra · 4BR semi-detached  src: bayut.com / propertyfinder.ae Sidra (Jul 2026)
insert into unit_archetypes
  (sub_community_id, name, unit_type, bedrooms, bathrooms, bua_sqft, plot_sqft,
   floors, parking_spaces, has_garden, has_pool, view_orientation,
   config_flags, price, service_charge_per_sqft, completion_status, condition)
select id, 'Sidra · 4BR semi-detached villa', 'villa', 4, 5, 4100, 5000,
   2, 2, true, false, 'Community / park',
   '{"maids":true,"study":true,"storage":true}'::jsonb, 8900000, 4.00, 'ready', 'Standard'
from sub_communities where slug='sidra';

-- Dubai Hills · Maple · 4BR townhouse  src: properties.emaar.com/Maple; propertyfinder.ae Maple (Jul 2026)
insert into unit_archetypes
  (sub_community_id, name, unit_type, bedrooms, bathrooms, bua_sqft, plot_sqft,
   floors, parking_spaces, has_garden, has_pool, view_orientation,
   config_flags, price, service_charge_per_sqft, completion_status, condition)
select id, 'Maple · 4BR townhouse', 'townhouse', 4, 4, 2600, 2100,
   2, 2, true, false, 'Community',
   '{"maids":false,"study":true,"storage":true}'::jsonb, 6300000, 3.00, 'ready', 'Standard'
from sub_communities where slug='maple';

-- CLIENT 2 -------------------------------------------------------------
-- Nad Al Sheba Gardens · 4BR offplan  src: meraas.com Phase 7 price list PDF (from AED 10.78M)
insert into unit_archetypes
  (sub_community_id, name, unit_type, bedrooms, bathrooms, bua_sqft, plot_sqft,
   floors, parking_spaces, has_garden, has_pool, view_orientation,
   config_flags, price, completion_status, condition)
select id, '4BR villa · Phase 7', 'villa', 4, 5, 4200, 4500,
   2, 2, true, false, 'Lagoon / park',
   '{"maids":true,"study":true,"storage":true}'::jsonb, 10780000, 'offplan', 'Brand new'
from sub_communities where slug='nasg-villas';

-- Lunaya · 4BR + 5BR offplan  src: lunayabyzaya.com (from AED 4.9M; 4 & 5BR)
insert into unit_archetypes
  (sub_community_id, name, unit_type, bedrooms, bathrooms, bua_sqft,
   floors, parking_spaces, has_garden, view_orientation,
   config_flags, price, completion_status, condition)
select id, '4BR lagoon villa', 'villa', 4, 5, 3800,
   2, 2, true, 'Lagoon',
   '{"maids":true,"study":true,"storage":true}'::jsonb, 4900000, 'offplan', 'Brand new'
from sub_communities where slug='lunaya-villas';
insert into unit_archetypes
  (sub_community_id, name, unit_type, bedrooms, bathrooms, bua_sqft,
   floors, parking_spaces, has_garden, view_orientation,
   config_flags, price, completion_status, condition)
select id, '5BR lagoon villa', 'villa', 5, 6, 4800,
   2, 3, true, 'Lagoon',
   '{"maids":true,"study":true,"storage":true}'::jsonb, 9500000, 'offplan', 'Brand new'
from sub_communities where slug='lunaya-villas';

-- Sobha Reserve · 4BR  src: propertyfinder.ae / sobharealty (from ~AED 7.7M; BUA 4,991)
insert into unit_archetypes
  (sub_community_id, name, unit_type, bedrooms, bathrooms, bua_sqft, plot_sqft,
   floors, parking_spaces, has_garden, has_pool, view_orientation,
   config_flags, price, completion_status, condition)
select id, '4BR villa · private pool', 'villa', 4, 5, 4991, 5200,
   2, 2, true, true, 'Garden',
   '{"maids":true,"study":true,"storage":true}'::jsonb, 7700000, 'offplan', 'Brand new'
from sub_communities where slug='sobha-reserve-villas';

-- ---------------------------------------------------------------------
-- Listings (sourced asking-price snapshots with provenance URLs).
-- ---------------------------------------------------------------------
insert into listings (sub_community_id, asking_price, unit_type, bedrooms, bua_sqft, plot_sqft, source, date_seen, url)
select id, 8500000, 'villa', 4, 4200, 6500, 'property_finder', date '2026-07-01',
  'https://www.propertyfinder.ae/en/buy/dubai/villas-for-sale-meadows.html' from sub_communities where slug='meadows-4';
insert into listings (sub_community_id, asking_price, unit_type, bedrooms, bua_sqft, plot_sqft, source, date_seen, url)
select id, 8900000, 'villa', 4, 4100, 5000, 'property_finder', date '2026-07-01',
  'https://www.propertyfinder.ae/en/buy/dubai/4-bedroom-villas-for-sale-dubai-hills-estate-sidra-villas.html' from sub_communities where slug='sidra';
insert into listings (sub_community_id, asking_price, unit_type, bedrooms, bua_sqft, plot_sqft, source, date_seen, url)
select id, 6300000, 'townhouse', 4, 2600, 2100, 'property_finder', date '2026-07-01',
  'https://www.propertyfinder.ae/en/buy/dubai/properties-for-sale-dubai-hills-estate-maple-at-dubai-hills-estate.html' from sub_communities where slug='maple';
insert into listings (sub_community_id, asking_price, unit_type, bedrooms, bua_sqft, source, date_seen, url)
select id, 10780000, 'villa', 4, 4200, 'developer', date '2026-07-01',
  'https://meraas.com/en/project/nad-al-sheba-gardens-villa' from sub_communities where slug='nasg-villas';
insert into listings (sub_community_id, asking_price, unit_type, bedrooms, bua_sqft, source, date_seen, url)
select id, 9500000, 'villa', 5, 4800, 'developer', date '2026-07-01',
  'https://www.lunayabyzaya.com/' from sub_communities where slug='lunaya-villas';
insert into listings (sub_community_id, asking_price, unit_type, bedrooms, bua_sqft, plot_sqft, source, date_seen, url)
select id, 7700000, 'villa', 4, 4991, 5200, 'property_finder', date '2026-07-01',
  'https://www.propertyfinder.ae/en/new-projects/sobha-real-estate-llc/sobha-reserve-villas' from sub_communities where slug='sobha-reserve-villas';

-- ---------------------------------------------------------------------
-- Rental yield — only where a public figure is cited.
-- ---------------------------------------------------------------------
-- src: hsproperty.ae Dubai Hills 2026 guide — Sidra villas ~6% gross yield
insert into rental_data (sub_community_id, unit_type, gross_yield_pct, source)
select id, 'villa', 6.0, 'Property Finder / H&S market data, 2026' from sub_communities where slug='sidra';
-- src: Dubai Hills townhouse yields ~6% (portal market data, 2026)
insert into rental_data (sub_community_id, unit_type, gross_yield_pct, source)
select id, 'townhouse', 6.0, 'Property Finder / H&S market data, 2026' from sub_communities where slug='maple';
-- The Meadows established-villa gross yield ~5% (portal market data, 2026)
insert into rental_data (sub_community_id, unit_type, gross_yield_pct, source)
select id, 'villa', 5.0, 'Property Finder / Bayut market data, 2026' from sub_communities where slug='meadows-4';

-- ---------------------------------------------------------------------
-- Capital growth — only where a public figure is cited.
-- src: hsproperty.ae — Dubai Hills Estate +18% YoY capital values, Q1 2026 (DLD data)
-- ---------------------------------------------------------------------
insert into capital_growth (sub_community_id, unit_type, period, pct_change)
select id, 'villa', '1y', 18.0 from sub_communities where slug='sidra';
insert into capital_growth (sub_community_id, unit_type, period, pct_change)
select id, 'townhouse', '1y', 18.0 from sub_communities where slug='maple';

-- ---------------------------------------------------------------------
-- Absorption (offplan momentum) — Nad Al Sheba Gardens sells fast.
-- src: Meraas phase sell-through commentary (2025) — indicative.
-- ---------------------------------------------------------------------
insert into absorption (sub_community_id, phase_name, absorption_rate, as_of_date)
select id, 'Phase 7', 90.0, date '2026-06-01' from sub_communities where slug='nasg-villas';

-- ---------------------------------------------------------------------
-- Payment plans (offplan financing).
-- ---------------------------------------------------------------------
-- src: meraas.com Phase 7 PDF — 20% down, installments, 20% on handover
insert into payment_plans (community_id, plan_type, construction_pct, handover_pct, construction_years)
select id, '80/20', 80, 20, 3.0 from communities where slug='nad-al-sheba-gardens';
-- src: lunayabyzaya.com — 40/60 plan, handover 2029
insert into payment_plans (community_id, plan_type, construction_pct, handover_pct, construction_years)
select id, '40/60', 40, 60, 4.0 from communities where slug='lunaya';
-- src: propertyfinder.ae Sobha Reserve — 80/20 plan
insert into payment_plans (community_id, plan_type, construction_pct, handover_pct, construction_years)
select id, '80/20', 80, 20, 1.0 from communities where slug='sobha-reserve';

-- ---------------------------------------------------------------------
-- Commute (driving minutes to key hubs). Sourced where available;
-- otherwise approximate geographic drive-time (not market data).
-- ---------------------------------------------------------------------
-- src: meraas.com — Nad Al Sheba Gardens ~10 min to Downtown Dubai
insert into commute_times (community_id, destination_name, minutes_driving)
select id, 'Downtown Dubai', 10 from communities where slug='nad-al-sheba-gardens';
insert into commute_times (community_id, destination_name, minutes_driving)
select id, 'Dubai Marina', 22 from communities where slug='lunaya';
insert into commute_times (community_id, destination_name, minutes_driving)
select id, 'Downtown Dubai', 25 from communities where slug='sobha-reserve';


-- =====================================================================
-- >>>>> supabase/migrations/0013_market_snapshots.sql
-- =====================================================================
-- =====================================================================
-- 0013 — Community-level market snapshots (DLD-led)
-- DLD / DXB Interact data resolves at the area / master-project level,
-- which is our *community* level (the existing price_history table is
-- sub-community-scoped). This table holds a rolling window of real,
-- sourced market aggregates per community + unit type — the "understand
-- pricing for every area" layer. Fed by the DLD Transactions Importer.
-- Honesty rule: only real, sourced aggregates land here.
-- =====================================================================

create table if not exists market_snapshots (
  id                  uuid primary key default gen_random_uuid(),
  community_id        uuid not null references communities(id) on delete cascade,
  unit_type           unit_type,
  reg_type            text,                       -- 'ready' | 'offplan' (from DLD reg_type)
  period_start        date,
  period_end          date,
  txn_count           integer,
  avg_price           numeric(14,2),
  median_price        numeric(14,2),
  avg_price_per_sqft  numeric(12,2),
  min_price           numeric(14,2),
  max_price           numeric(14,2),
  source              text not null default 'dld',
  as_of               date not null default current_date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists market_snapshots_community_idx on market_snapshots(community_id);
create index if not exists market_snapshots_asof_idx on market_snapshots(as_of desc);
create or replace trigger trg_market_snapshots_updated before update on market_snapshots
  for each row execute function set_updated_at();

alter table market_snapshots enable row level security;
drop policy if exists "authenticated_all_market_snapshots" on market_snapshots;
create policy "authenticated_all_market_snapshots" on market_snapshots
  for all to authenticated using (true) with check (true);

grant all on market_snapshots to anon, authenticated;


-- >>>>> supabase/migrations/0014_faqs.sql
-- =====================================================================
-- 0014 — Community FAQs (area-guide "good part", à la Bayut)
-- A consolidated Q&A per community — location, price range, handover,
-- freehold status, schools, etc. Stored as an ordered JSON array of
-- {q, a}. Admin-authored (optionally Claude-drafted from the community's
-- own data, then reviewed) — never auto-published unreviewed.
-- =====================================================================

alter table communities
  add column if not exists faqs jsonb not null default '[]'::jsonb;


-- >>>>> supabase/migrations/0015_catalysts.sql
-- =====================================================================
-- 0015 — Area intelligence / growth catalysts (the USP)
-- What Bayut / PF don't show: the *why behind the price* — the roads,
-- highways, metro, schools, master-plan completion and government projects
-- in and around a community that drive value, with timelines and an
-- impact note. Stored as an ordered JSON array of
-- {title, category, timeline, note}. Admin-authored (optionally
-- Claude-drafted), reviewed before publish.
-- =====================================================================

alter table communities
  add column if not exists catalysts jsonb not null default '[]'::jsonb;


-- >>>>> supabase/migrations/0016_market_detail.sql
-- =====================================================================
-- 0016 — Finer market snapshots + last transactions (Bayut-style depth)
-- Adds the cluster (sub-community) and bedroom dimensions to
-- market_snapshots, plus a monthly trend series, an appreciation figure,
-- and a small sample of the most recent transactions for the "last
-- transactions" list. All still DLD-sourced; only real rows populate it.
-- =====================================================================

alter table market_snapshots
  add column if not exists sub_community_id uuid references sub_communities(id) on delete cascade,
  add column if not exists bedrooms integer,
  add column if not exists trend jsonb not null default '[]'::jsonb,          -- [{month, median_ppsf, n}]
  add column if not exists appreciation_pct numeric(8,2),                     -- % over the window
  add column if not exists sample_txns jsonb not null default '[]'::jsonb;    -- recent [{date, cluster, beds, sqft, price, ppsf}]

create index if not exists market_snapshots_sub_idx on market_snapshots(sub_community_id);
create index if not exists market_snapshots_beds_idx on market_snapshots(community_id, bedrooms);




-- =====================================================================
-- 0017 — Community backbones + provenance
--
-- Fills the descriptive "backbone" (handover text, narrative, who-it's-for,
-- character tags) for every remaining skeleton community, and adds two
-- provenance columns carried on every backbone row:
--   data_confidence  high | medium | low   — how firm the row's facts are
--   source_note      free text             — where the facts came from
--
-- Honesty rules (owner's brief):
--  * Idempotent — an upsert on `slug`. Re-running only refreshes the
--    backbone fields; developer, name, status and tier are left as seeded.
--  * NO prices here. Community backbones are structural/qualitative only;
--    launch prices land later via confirmed developer figures / DLD, never
--    invented. Counts also stay null until DLD/developer-confirmed.
--  * Every row is graded. Established communities → high; off-plan launches
--    with public developer positioning → medium; genuinely fuzzy → low.
--  * The 5 communities already carrying depth (dubai-hills-estate, lunaya,
--    nad-al-sheba-gardens, sobha-reserve, the-meadows) are intentionally
--    excluded so their tailored copy is not overwritten.
-- =====================================================================

-- 1. Provenance columns -------------------------------------------------
alter table communities
  add column if not exists data_confidence text,
  add column if not exists source_note     text;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'communities_data_confidence_chk'
  ) then
    -- 'unverified' is the default/unset state for rows not yet backboned
    -- (matches the live database); high|medium|low are the graded states.
    alter table communities
      add constraint communities_data_confidence_chk
      check (data_confidence is null or data_confidence in ('high','medium','low','unverified'));
  end if;
end $$;

-- 2. Backbone upsert ----------------------------------------------------
-- Keyed on slug. The INSERT branch carries developer/name/status/tier so a
-- fresh database still builds cleanly; on the live (already-seeded) database
-- every row hits ON CONFLICT and only the backbone fields are refreshed.
insert into communities
  (slug, developer_id, name, status, positioning_tier,
   age_or_handover, description_long, who_its_for_base, character_tags,
   is_placeholder, data_confidence, source_note)
select
  v.slug,
  (select id from developers where slug = v.dev),
  v.name,
  v.status::status_tag,
  v.tier::positioning_tier,
  v.age, v.descr, v.who, v.tags::text[],
  false, v.conf, v.note
from (values
  -- ---- Established, ready villa/townhouse communities (high) ----------
  ('the-springs','emaar','The Springs','ready','premium',
   'Ready · first handover ~2004',
   'One of Emaar''s original townhouse communities in Emirates Living — gated, tree-lined clusters of 2–4 bedroom townhouses around lakes and parks, consistently one of Dubai''s most liquid family resale markets.',
   'End-user families and investors who want an affordable, established gated townhouse with a garden, walkable to schools and 15 minutes from Dubai Marina via Al Khail Road.',
   '{established,gated-family,schools-nearby,investment}','high',
   'Established Emaar community; structural & character facts from public market knowledge (Jul 2026); counts/prices pending DLD & developer confirmation.'),

  ('the-lakes','emaar','The Lakes','ready','prime',
   'Ready · handover from ~2006',
   'An upgraded, leafy Emirates Living community of detached and semi-detached villas set around lakes, quieter and greener than its Springs/Meadows neighbours, popular with long-term end users.',
   'Families wanting a mature, detached villa with a garden in a calm, gated setting close to Dubai Marina, Downtown and top schools.',
   '{established,gated-family,prestige,schools-nearby}','high',
   'Established Emaar community; facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('emirates-hills','emaar','Emirates Hills','ready','ultra_prime',
   'Ready · established (custom plots)',
   'Dubai''s original ultra-prime custom-villa address — large freehold plots around the Montgomerie golf course where owners build bespoke mansions. The benchmark for trophy villa land value in the city.',
   'Ultra-high-net-worth buyers seeking a landmark custom mansion or a prime plot to build on, in Dubai''s most prestigious gated golf community.',
   '{ultra-luxury,gated-family,prestige,established,golf,custom-plot}','high',
   'Established custom-plot community; land-value story from public market knowledge (Jul 2026); plot/build figures vary per transaction — pending DLD confirmation.'),

  ('jumeirah-park','nakheel','Jumeirah Park','ready','premium',
   'Ready · handover from ~2011',
   'A large Nakheel community of detached villas on generous landscaped plots, arranged in numbered districts with parks and a community centre — a reliable family villa market near Dubai Marina and JLT.',
   'Families wanting a detached villa with a real garden and flexible layouts, centrally located between Marina, JLT and Sheikh Zayed Road.',
   '{established,gated-family,schools-nearby,central}','high',
   'Established Nakheel community; facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('jumeirah-islands','nakheel','Jumeirah Islands','ready','prime',
   'Ready · handover from ~2006',
   'A prestigious Nakheel community of villas set on 46 landscaped islands surrounded by lakes, known for mature landscaping, water views and a strong owner-occupier base.',
   'End-user families and investors after a detached, waterfront-feel villa in an established, tranquil gated community close to the Marina corridor.',
   '{established,gated-family,prestige,waterfront}','high',
   'Established Nakheel community; facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('al-furjan','nakheel','Al Furjan','ready','mid',
   'Ready · handover from ~2014',
   'A well-connected Nakheel district of villas and townhouses near Discovery Gardens and two metro stations, with steady handovers and a mix of Nakheel and third-party clusters.',
   'Value-focused families and investors who want a modern townhouse or villa with metro access and headroom on price, west of the city.',
   '{established,schools-nearby,investment,central}','high',
   'Established Nakheel district; facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('mudon','dubai-holding','Mudon','ready','mid',
   'Ready · handover from ~2015 (Al Ranim ongoing)',
   'A Dubai Holding family community in Dubailand built around a central park and cycling/running loops, blending established villas with newer Mudon Al Ranim townhouse phases.',
   'Families wanting an active, open-space community with a modern villa or townhouse and good value in the Dubailand corridor.',
   '{established,gated-family,nature,schools-nearby}','high',
   'Dubai Holding community; facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('serena','dubai-holding','Serena','ready','mid',
   'Ready · handover from ~2018',
   'A Mediterranean-themed Dubai Holding townhouse community (Bella Casa, Casa Dora, Casa Viva) in Dubailand, fully handed over and popular with young families for its value and gardens.',
   'First-time villa buyers and families wanting an affordable, gated townhouse with a garden in a completed, amenity-rich community.',
   '{established,gated-family,schools-nearby}','high',
   'Dubai Holding community; facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('villanova','dubai-holding','Villanova','mixed','mid',
   'Ready · phased handovers from ~2018',
   'A large Dubai Holding master community in Dubailand (Amaranta, La Rosa and others) of townhouses and villas, delivered in phases with parks, retail and schools.',
   'Families wanting a modern, affordable townhouse or villa with a garden in a phased, amenity-led community on Al Ain Road.',
   '{established,gated-family,schools-nearby,investment}','high',
   'Dubai Holding community; facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('the-villa','dubai-holding','The Villa','ready','premium',
   'Ready · established',
   'A low-density Dubailand community of large Arabesque/Spanish-style villas on generous plots, known for space and privacy with a more traditional, non-clustered layout.',
   'Families who prioritise plot size, privacy and a detached villa with room to extend, over new-build amenities.',
   '{established,gated-family,schools-nearby}','high',
   'Community facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('victory-heights','union-properties','Victory Heights','ready','premium',
   'Ready · established (Els Golf Club)',
   'An established golf-course villa community in Dubai Sports City with Mediterranean-style detached villas around the Els Club, well-regarded for space, schools and mature landscaping.',
   'Families wanting a spacious detached golf-community villa with schools inside the gates and good value versus prime golf estates.',
   '{established,gated-family,golf,schools-nearby}','high',
   'Community facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('the-sustainable-city','diamond-developers','The Sustainable City','ready','premium',
   'Ready · handover from ~2016',
   'Dubai''s pioneering net-positive community by Diamond Developers — solar-powered villas, car-free residential clusters, urban farms and zero service-charge economics that draw a committed owner base.',
   'Values-driven families wanting a genuinely sustainable, low-running-cost villa with a strong community ethos.',
   '{established,gated-family,wellness,nature,sustainable}','high',
   'Distinctive community; facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('arabian-ranches','emaar','Arabian Ranches','ready','premium',
   'Ready · first handover ~2004',
   'Emaar''s original desert-suburb master community — established detached villas and townhouses across themed clusters (Al Reem, Saheel, Mirador, Alvorada) around the Arabian Ranches Golf Club, community centre and schools. A benchmark ready-villa resale market.',
   'End-user families and investors who want a proven, established Emaar villa with a garden in a mature, amenity-complete community off Sheikh Mohammed Bin Zayed Road.',
   '{established,gated-family,golf,schools-nearby,prestige}','high',
   'Established Emaar community; structural & character facts from public market knowledge (Jul 2026); counts/prices pending DLD & developer confirmation.'),

  ('arabian-ranches-2','emaar','Arabian Ranches 2','ready','premium',
   'Ready · handover from ~2015',
   'The second phase of Emaar''s flagship desert-suburb brand — detached villas across themed clusters (Palma, Rosa, Lila, Camelia) around a community centre, pools and schools.',
   'Families wanting an established, detached Emaar villa with a garden in a proven, amenity-complete master community off Sheikh Mohammed Bin Zayed Road.',
   '{established,gated-family,schools-nearby,prestige}','high',
   'Established Emaar community; facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('damac-hills','damac','DAMAC Hills','mixed','premium',
   'Ready · phased (Trump Golf Course)',
   'A large DAMAC master community around the Trump International Golf Club, mixing established villa and townhouse clusters with newer launches, parks and a retail spine.',
   'Families and investors wanting a golf-community villa or townhouse with extensive amenities and a range of entry points.',
   '{established,gated-family,golf,schools-nearby,investment}','high',
   'DAMAC community; facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('palm-jumeirah','nakheel','Palm Jumeirah','mixed','ultra_prime',
   'Ready · established (fronds + new launches)',
   'Dubai''s iconic man-made island — beachfront frond villas (Garden Homes, Signature Villas) plus ultra-prime new launches, the benchmark for waterfront villa prestige and price.',
   'Ultra-high-net-worth buyers seeking a beachfront villa on Dubai''s most recognisable address, for lifestyle and trophy-asset appreciation.',
   '{ultra-luxury,waterfront,prestige,established,beach}','high',
   'Iconic waterfront community; facts from public market knowledge (Jul 2026); frond-plot values vary per transaction — pending DLD confirmation.'),

  ('al-barari','al-barari-developers','Al Barari','mixed','ultra_prime',
   'Ready · phased (Nayaat / new phases)',
   'A green, low-density luxury community off Al Ain Road famed for botanical landscaping, themed lush villas and a wellness-led lifestyle — among the most private ultra-prime villa addresses in Dubai.',
   'Ultra-high-net-worth end users who prize nature, privacy and wellness over a central location, in a signature landscaped estate.',
   '{ultra-luxury,nature,wellness,prestige,established}','high',
   'Distinctive luxury community; facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  -- ---- Prime / established golf & waterfront (high–medium) ------------
  ('jumeirah-golf-estates','dubai-holding','Jumeirah Golf Estates','mixed','prime',
   'Ready · phased (Earth & Fire courses)',
   'A prestigious gated golf community home to two championship courses (host of the DP World Tour Championship), with established villa districts and newer luxury phases.',
   'Golf-loving families and investors wanting a prime, gated villa on a world-class course with strong brand prestige.',
   '{established,gated-family,golf,prestige,nature}','high',
   'Prime golf community; facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('sobha-hartland','sobha','Sobha Hartland','mixed','prime',
   'Ready · phased (MBR City)',
   'A Sobha waterfront community in Mohammed Bin Rashid City with villas and townhouses beside greenery and the Ras Al Khor sanctuary, minutes from Downtown with Sobha''s in-house build quality.',
   'Buyers wanting a centrally located, high-quality villa or townhouse close to Downtown with a green, waterfront setting.',
   '{central,gated-family,waterfront,prestige}','high',
   'Sobha community; facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('tilal-al-ghaf','majid-al-futtaim','Tilal Al Ghaf','mixed','prime',
   'Mixed · ready + off-plan (final phases to ~2027)',
   'Majid Al Futtaim''s flagship lagoon community of ~4,000+ homes — townhouses (Elan) through bespoke villas (Harmony, Aura) to ultra-luxury mansions (Elysian, Lanai Islands) around a recreational crystal lagoon. One of Dubai''s strongest villa-price performers.',
   'Families and investors wanting a lifestyle-led, lagoon-front community with a clear ladder from townhouses to mansions and a proven appreciation record.',
   '{gated-family,waterfront,nature,investment,prestige}','high',
   'Developer + area-guide research (tilalalghaf.com, aggregators, Jul 2026); clusters/handover confirmed; counts approximate; prices pending confirmed launch/DLD figures.'),

  ('district-one','meydan','District One (MBR City)','mixed','ultra_prime',
   'Mixed · phased (Crystal Lagoon)',
   'A gated ultra-prime community in Mohammed Bin Rashid City built around one of the world''s largest crystal lagoons, with mansions and villas minutes from Downtown Dubai and Meydan.',
   'Ultra-high-net-worth buyers wanting a central, gated waterfront mansion or villa within minutes of Downtown.',
   '{ultra-luxury,central,waterfront,prestige,gated-family}','high',
   'Prime MBR City community; facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  -- ---- Off-plan launches, developer-positioned (medium) --------------
  ('the-valley','emaar','The Valley','offplan','premium',
   'Off-plan · phased handovers ~2027–2028 (Rivera/Velora)',
   'An Emaar town on the Dubai–Al Ain Road built around a "town centre", sports village and schools, expanding through Phase 2 (Rivera, Velora) with 4,500+ contemporary townhouses and villas.',
   'Value-seeking families and investors who want a new-build Emaar townhouse or twin villa with a payment plan on the growth corridor toward Al Maktoum Airport.',
   '{new-launch,gated-family,schools-nearby,investment}','medium',
   'Emaar off-plan; positioning & handover window confirmed via developer + listing aggregators (Jul 2026); prices pending confirmed launch figures.'),

  ('the-valley-2','emaar','The Valley 2 (Rivera / Velora)','offplan','premium',
   'Off-plan · handover ~2027–2028',
   'The Phase 2 expansion of Emaar''s The Valley — Rivera twin villas and Velora townhouses on the community''s best-positioned plots, with 80/20 payment plans.',
   'Investors and end users wanting the newest Valley product with a long payment runway and green, park-fronting plots.',
   '{new-launch,gated-family,investment}','medium',
   'Emaar off-plan; Rivera/Velora clusters & handover per developer + aggregators (Jul 2026); prices pending confirmed launch figures.'),

  ('the-oasis','emaar','The Oasis','offplan','ultra_prime',
   'Off-plan · handover ~Q4 2027–Q1 2029',
   'Emaar''s ~100-million-sqft ultra-luxury villa destination west of the city — 4–7 bedroom villas and mansions (Palmiera, Mirage, Lavita) around lakes and water channels, positioned as a successor to Emirates Hills.',
   'Ultra-high-net-worth buyers wanting a large new-build luxury villa or mansion with a payment plan in Emaar''s flagship prime launch.',
   '{new-launch,ultra-luxury,waterfront,nature,prestige}','medium',
   'Emaar off-plan; collections & handover (Palmiera Q4 2027, Lavita ~Q1 2029) confirmed via developer + aggregators (Jul 2026); prices pending confirmed launch figures.'),

  ('grand-polo-club','emaar','Grand Polo Club & Resort','offplan','ultra_prime',
   'Off-plan · handover ~2029 (Selvara / Equiterra)',
   'A ~60-million-sqft Emaar equestrian-themed community near Dubai Investment Park with polo fields, stables and 22 residential clusters of villas and townhouses (Selvara, Equiterra).',
   'Buyers seeking a differentiated, nature-and-equestrian luxury community with a long off-plan runway and Emaar delivery credibility.',
   '{new-launch,ultra-luxury,nature,prestige,gated-family}','medium',
   'Emaar off-plan; clusters, 80/20 plan & ~2029 handover confirmed via developer + aggregators (Jul 2026); prices pending confirmed launch figures.'),

  ('arabian-ranches-3','emaar','Arabian Ranches 3','offplan','premium',
   'Off-plan · phased handovers from ~2024 (ongoing)',
   'The newest Emaar Ranches phase of contemporary townhouses and villas (Sun, Joy, Bliss, Anya, Raya) around a central lagoon and amenities, extending the established Ranches brand.',
   'Families wanting a brand-new Emaar townhouse or villa with a payment plan inside a proven master-brand community.',
   '{new-launch,gated-family,schools-nearby,investment}','medium',
   'Emaar off-plan; clusters/positioning from developer + aggregators (Jul 2026); handover approximate; prices pending confirmed figures.'),

  ('the-acres','meraas','The Acres','offplan','prime',
   'Off-plan · handover ~2027',
   'A Meraas community of standalone villas amid landscaped valleys, swimmable lagoons and orchards off Sheikh Zayed Bin Hamdan Al Nahyan Street, positioned as nature-led family living.',
   'Families and investors wanting a detached, nature-immersed villa with a payment plan in a central-south Meraas launch.',
   '{new-launch,gated-family,nature,investment}','medium',
   'Meraas off-plan; positioning from developer + aggregators (Jul 2026); handover approximate; prices pending confirmed figures.'),

  ('the-cove-creek','emaar','The Cove (Creek Harbour)','offplan','prime',
   'Off-plan · phased handovers ~2027+',
   'Waterfront townhouse/villa elements within Emaar''s Dubai Creek Harbour master plan, offering low-rise family homes beside the creek, marina and Creek Tower district.',
   'Buyers wanting a rare townhouse/villa product inside a prime waterfront high-rise district close to Downtown.',
   '{new-launch,waterfront,central,investment}','medium',
   'Emaar off-plan within Creek Harbour; positioning from developer (Jul 2026); handover approximate; prices pending confirmed figures.'),

  ('sobha-hartland-2','sobha','Sobha Hartland II','offplan','prime',
   'Off-plan · handover ~2027+',
   'The second Sobha Hartland masterplan in MBR City — lagoon-centred villas and townhouses to Sobha''s in-house build standard, extending the central, green waterfront positioning.',
   'Quality-focused buyers wanting a new, centrally located Sobha villa near Downtown with a payment plan.',
   '{new-launch,central,waterfront,prestige}','medium',
   'Sobha off-plan; positioning from developer (Jul 2026); handover approximate; prices pending confirmed figures.'),

  ('sobha-elwood','sobha','Sobha Elwood','offplan','prime',
   'Off-plan · handover ~2028',
   'A Sobha nature-themed villa community on Dubai–Al Ain Road organised around thousands of trees and themed zones, offering 4–5 bedroom detached villas to Sobha''s build standard.',
   'Families wanting a new, tree-dense detached Sobha villa with a payment plan on the eastern growth corridor.',
   '{new-launch,gated-family,nature,investment}','medium',
   'Sobha off-plan; positioning from developer + aggregators (Jul 2026); handover approximate; prices pending confirmed figures.'),

  ('damac-lagoons','damac','DAMAC Lagoons','offplan','premium',
   'Off-plan · phased handovers ~2025–2027',
   'A large DAMAC Mediterranean-themed community of townhouses and villas around swimmable lagoons (Malta, Venice, Portofino and more), opposite DAMAC Hills.',
   'Investors and families wanting a lifestyle-led, lagoon-themed townhouse or villa with a payment plan and a lower entry point than prime lagoon communities.',
   '{new-launch,waterfront,gated-family,investment}','medium',
   'DAMAC off-plan; themed clusters from developer + aggregators (Jul 2026); handover approximate; prices pending confirmed figures.'),

  ('damac-islands','damac','DAMAC Islands','offplan','premium',
   'Off-plan · handover ~2027–2028',
   'A DAMAC community of townhouses and villas themed around tropical islands (Bora Bora, Maldives, Seychelles) with water features and resort amenities, southwest of the city.',
   'Investors wanting a distinctive, resort-themed townhouse or villa with a long payment plan and value pricing.',
   '{new-launch,waterfront,gated-family,investment}','medium',
   'DAMAC off-plan; theming from developer + aggregators (Jul 2026); handover approximate; prices pending confirmed figures.'),

  ('damac-riverside','damac','DAMAC Riverside','offplan','mid',
   'Off-plan · handover ~2027–2028',
   'A DAMAC waterfront-themed townhouse community in Dubai Investment Park 2 built around water and green "portals", positioned as accessible lifestyle living.',
   'Value-focused investors and families wanting a new townhouse with a payment plan and waterfront theming at a low entry point.',
   '{new-launch,waterfront,investment}','medium',
   'DAMAC off-plan; positioning from developer + aggregators (Jul 2026); handover approximate; prices pending confirmed figures.'),

  ('haven-by-aldar','aldar','Haven by Aldar','offplan','premium',
   'Off-plan · handover ~2027–2028',
   'Aldar''s first Dubai master community, a wellness-themed development of villas and townhouses around a central "wadi" and green corridors off Sheikh Mohammed Bin Zayed Road.',
   'Families wanting a wellness-led, new-build villa or townhouse from Aldar with a payment plan in a nature-focused setting.',
   '{new-launch,gated-family,wellness,nature,investment}','medium',
   'Aldar off-plan; wellness positioning from developer (Jul 2026); handover approximate; prices pending confirmed figures.'),

  ('the-sanctuary-by-aldar','aldar','The Sanctuary by Aldar','offplan','ultra_prime',
   'Off-plan · handover ~2027+',
   'An Aldar low-density plotted/villa community positioned at the luxury end, emphasising large plots and privacy in the western Dubai growth corridor.',
   'High-net-worth buyers wanting a large-plot luxury villa or build-ready plot from Aldar with a payment plan.',
   '{new-launch,ultra-luxury,nature,prestige,custom-plot}','medium',
   'Aldar off-plan; positioning from developer (Jul 2026); product mix & handover to verify; prices pending confirmed figures.'),

  ('south-bay','dubai-south','South Bay','offplan','premium',
   'Off-plan · phased handovers ~2026–2028',
   'A Dubai South waterfront community (by Dubai South Properties) of townhouses, semi-detached and detached villas plus mansions around a central crystal lagoon, near Al Maktoum International Airport.',
   'Investors and families betting on the Dubai South / airport growth story who want a lagoon-front villa or townhouse with a payment plan.',
   '{new-launch,waterfront,gated-family,investment}','medium',
   'Dubai South off-plan; positioning from developer + aggregators (Jul 2026); handover approximate; prices pending confirmed figures.'),

  ('the-wilds','ellington','The Wilds','offplan','premium',
   'Off-plan · handover ~2028',
   'An Ellington Properties nature-led villa/townhouse community off Sheikh Mohammed Bin Zayed Road, applying the developer''s design-forward reputation to low-rise family homes.',
   'Design-conscious families and investors wanting a boutique, nature-themed villa or townhouse from a design-led developer.',
   '{new-launch,gated-family,nature,investment}','medium',
   'Ellington off-plan; positioning from developer + aggregators (Jul 2026); handover approximate; prices pending confirmed figures.'),

  ('alma','emaar','Alma (Dubai Hills)','offplan','premium',
   'Off-plan · handover ~2028',
   'A newer Emaar villa/townhouse launch within the Dubai Hills Estate golf-and-park master community, extending the established, high-performing address with contemporary product.',
   'Buyers wanting brand-new Emaar product inside a proven, amenity-complete master community with a payment plan.',
   '{new-launch,golf,gated-family,investment}','medium',
   'Emaar off-plan within Dubai Hills; positioning from developer (Jul 2026); handover approximate; prices pending confirmed figures.'),

  ('palm-jebel-ali','nakheel','Palm Jebel Ali','offplan','ultra_prime',
   'Off-plan · phased handovers ~2027+',
   'Nakheel''s revived second palm island, master-planned for beachfront frond villas at a scale larger than Palm Jumeirah — a flagship ultra-prime waterfront bet for the next cycle.',
   'Ultra-high-net-worth buyers wanting an early position in Dubai''s next iconic beachfront villa island.',
   '{new-launch,ultra-luxury,waterfront,prestige,beach}','medium',
   'Nakheel off-plan; master-plan positioning public (Jul 2026); handover & product detail evolving; prices pending confirmed figures.'),

  ('pearl-jumeirah','pearl-jumeirah','Pearl Jumeirah','offplan','ultra_prime',
   'Off-plan / mixed · phased',
   'A gated island community off Jumeirah 1 (Nikki Beach district) with beachfront plots and luxury villas close to the city and coast, positioned at the ultra-prime end.',
   'High-net-worth buyers wanting a central beachfront villa or plot minutes from the city and Jumeirah lifestyle.',
   '{ultra-luxury,waterfront,central,prestige,beach}','low',
   'Backbone from general market knowledge (Jul 2026); developer program, product mix & handover to verify; prices pending confirmed figures.'),

  ('nad-al-sheba-villas','wasl','Nad Al Sheba Villas','mixed','premium',
   'Mixed · established + new phases',
   'A central Nad Al Sheba community (largely wasl/government-linked) of villas close to Meydan and Downtown, blending established stock with newer releases.',
   'Families wanting a central, well-connected villa near Meydan and Downtown with a range of entry points.',
   '{central,gated-family,schools-nearby}','low',
   'Backbone from general market knowledge (Jul 2026); developer program & counts to verify; prices pending confirmed figures.'),

  ('tilal-al-furjan','nakheel','Tilal Al Furjan','mixed','premium',
   'Ready / mixed · phased',
   'A premium villa enclave within the wider Al Furjan district by Nakheel, offering larger contemporary detached villas with more space and privacy than the surrounding townhouse clusters.',
   'Families wanting a larger, detached villa with metro access and value in the established Al Furjan corridor.',
   '{gated-family,schools-nearby,central}','low',
   'Backbone from general market knowledge (Jul 2026); counts/handover to verify; prices pending confirmed figures.'),

  ('jebel-ali-village','nakheel','Jebel Ali Village','mixed','premium',
   'Mixed · heritage + new villa phases',
   'A revived Nakheel community on the site of the original Jebel Ali Village, delivering new detached villas amid mature trees and generous plots in the western corridor.',
   'Families wanting a spacious, green detached villa in the west with a payment plan and heritage-district character.',
   '{gated-family,nature,new-launch}','low',
   'Backbone from general market knowledge (Jul 2026); product mix & handover to verify; prices pending confirmed figures.'),

  ('meydan-gardens','meydan','Meydan Gardens (Polo Homes)','mixed','prime',
   'Mixed · Meydan / Nad Al Sheba',
   'Villa product within the Meydan / Nad Al Sheba district close to the racecourse and Downtown, part of Meydan''s central, prestige-positioned residential offer.',
   'Buyers wanting a central, prestige-adjacent villa near Meydan and Downtown.',
   '{central,gated-family,prestige}','low',
   'Backbone from general market knowledge (Jul 2026); exact product mix, counts & handover to verify; prices pending confirmed figures.'),

  -- ---- Mid / accessible communities (medium–low) ---------------------
  ('reem-mira','emaar','Reem (Mira)','ready','mid',
   'Ready · handover from ~2015',
   'An Emaar community (Mira and Mira Oasis) of affordable townhouses around parks and a town centre in Reem, Dubailand — a popular, well-established value family market.',
   'First-time buyers and families wanting an affordable, established Emaar townhouse with a garden and community amenities.',
   '{established,gated-family,schools-nearby,investment}','high',
   'Established Emaar community; facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('town-square','nshama','Town Square','mixed','accessible',
   'Mixed · phased handovers from ~2018',
   'Nshama''s value-led master community (Zahra, Hayat, Warda townhouses) around a large central park, one of Dubai''s most accessible new townhouse markets.',
   'First-time buyers and investors wanting the lowest-entry new townhouse with a garden in an amenity-rich, park-centred community.',
   '{established,gated-family,schools-nearby,investment}','high',
   'Nshama community; facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('emaar-south','emaar','Emaar South','mixed','mid',
   'Mixed · phased handovers ~2020+',
   'An Emaar golf-anchored community beside Al Maktoum International Airport in Dubai South, with townhouses and villas positioned on the airport/Expo growth corridor.',
   'Investors and families betting on the Dubai South growth story who want an affordable Emaar townhouse or villa with a payment plan.',
   '{gated-family,golf,schools-nearby,investment}','medium',
   'Emaar community; positioning from public knowledge (Jul 2026); counts/handover to confirm; prices pending confirmed figures.'),

  ('jumeirah-village-triangle','nakheel','Jumeirah Village Triangle','mixed','mid',
   'Ready · established',
   'A central Nakheel community (JVT) of villas and townhouses on a compact triangular grid between Al Khail Road and Sheikh Mohammed Bin Zayed Road, popular for value and location.',
   'Value-focused families and investors wanting a central townhouse or villa with easy access to both main highways.',
   '{established,central,schools-nearby,investment}','high',
   'Nakheel community; facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('uptown-mirdif','dubai-holding','Uptown Mirdif','ready','mid',
   'Ready / mixed · established Mirdif',
   'Villa and townhouse product in the established, family-oriented Mirdif district (Dubai Holding / Dubai Properties), known for schools, parks and proximity to the airport.',
   'End-user families wanting a settled, school-rich district near the airport with a range of villa options.',
   '{established,gated-family,schools-nearby}','low',
   'Backbone from general market knowledge (Jul 2026); exact product mix & counts to verify; prices pending confirmed figures.'),

  ('green-community-dip','union-properties','Green Community (DIP)','ready','mid',
   'Ready · established',
   'A mature, low-density Union Properties community in Dubai Investment Park, known for dense greenery, lakes and independent villas away from the city bustle.',
   'Families wanting a quiet, green, established detached villa with mature landscaping in the west.',
   '{established,gated-family,nature,schools-nearby}','medium',
   'Community facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('green-community-motor-city','union-properties','Green Community (Motor City)','ready','mid',
   'Ready · established',
   'The Motor City extension of Green Community by Union Properties — leafy villas and townhouses near Dubai Autodrome, blending greenery with a central Dubailand location.',
   'Families wanting an established, green villa or townhouse with amenities in a central Dubailand setting.',
   '{established,gated-family,nature,schools-nearby}','medium',
   'Community facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('cherrywoods','emaar','Cherrywoods','ready','mid',
   'Ready · handover from ~2019',
   'A compact Emaar townhouse community on Al Qudra Road with contemporary 3–4 bedroom townhouses around a community centre and pools, delivered and settled.',
   'Families wanting an affordable, modern Emaar townhouse with a garden in a smaller, quieter community.',
   '{established,gated-family,schools-nearby}','medium',
   'Emaar community; facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('living-legends','tanmiyat','Living Legends','ready','premium',
   'Ready · established',
   'A Tanmiyat community in Dubailand of independent villas and towers around a golf course and lakes, offering large detached villas at accessible pricing.',
   'Families wanting a large detached villa with golf-and-lake surroundings and strong value in Dubailand.',
   '{established,gated-family,golf,nature}','low',
   'Backbone from general market knowledge (Jul 2026); counts & amenities to verify; prices pending confirmed figures.'),

  ('the-pulse','dubai-south','The Pulse','mixed','accessible',
   'Mixed · phased handovers ~2021+',
   'A Dubai South community (townhouses, villas and beachfront elements) positioned as accessible living near Al Maktoum International Airport and Expo City.',
   'Value-focused investors and families betting on Dubai South growth who want a low-entry townhouse or villa.',
   '{new-launch,gated-family,investment}','low',
   'Backbone from general market knowledge (Jul 2026); product mix, counts & handover to verify; prices pending confirmed figures.'),

  ('damac-hills-2','damac','DAMAC Hills 2','mixed','accessible',
   'Mixed · phased handovers ~2019+',
   'A large, value-led DAMAC community (formerly Akoya) far south of the city with themed townhouses and villas, water attractions and its own amenities — Dubai''s most accessible villa entry point.',
   'First-time buyers and yield-focused investors wanting the lowest-entry new villa or townhouse, accepting a peripheral location.',
   '{established,gated-family,investment}','medium',
   'DAMAC community; facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('verdana','reportage','Verdana','offplan','accessible',
   'Off-plan · phased handovers ~2026+',
   'A Reportage Properties community in Dubai Investment Park of value townhouses and villas, marketed on very low entry prices and long payment plans.',
   'Budget-first investors and first-time buyers wanting the lowest-entry new villa/townhouse with an extended payment plan.',
   '{new-launch,investment}','low',
   'Backbone from general market knowledge (Jul 2026); counts & handover to verify; prices pending confirmed launch figures.'),

  ('rukan','reportage','Rukan','mixed','accessible',
   'Mixed · phased',
   'A value-oriented community in Wadi Al Safa (Dubailand) of townhouses and terraced homes at accessible pricing with payment plans.',
   'Budget-focused buyers wanting an affordable townhouse with a payment plan in the Dubailand corridor.',
   '{gated-family,investment}','low',
   'Backbone from general market knowledge (Jul 2026); developer program, counts & handover to verify; prices pending confirmed figures.'),

  ('falcon-city','dubai-holding','Falcon City of Wonders','mixed','mid',
   'Mixed · established + phases',
   'A themed Dubailand community of large villas (some replica-landmark designs) on generous plots, offering space and novelty at mid-market pricing.',
   'Families wanting a large detached villa on a big plot with value pricing in a themed Dubailand setting.',
   '{established,gated-family,schools-nearby}','low',
   'Backbone from general market knowledge (Jul 2026); counts & product mix to verify; prices pending confirmed figures.'),

  ('wasl-gate','wasl','Wasl Gate','mixed','mid',
   'Mixed · phased',
   'A wasl community near Jebel Ali with townhouses and low-rise homes beside retail (including a large park and mall district) on Sheikh Zayed Road.',
   'Value-focused families wanting a townhouse with retail and highway access in the western corridor.',
   '{new-launch,central,investment}','low',
   'Backbone from general market knowledge (Jul 2026); product mix, counts & handover to verify; prices pending confirmed figures.'),

  ('warsan-village','nakheel','Warsan Village','ready','accessible',
   'Ready · established',
   'A compact, established Nakheel townhouse community in International City / Warsan, among the most accessible ready townhouse options in the city.',
   'First-time buyers and yield-focused investors wanting a very-low-entry ready townhouse.',
   '{established,investment}','low',
   'Backbone from general market knowledge (Jul 2026); counts to verify; prices pending confirmed figures.')
) as v(slug, dev, name, status, tier, age, descr, who, tags, conf, note)
on conflict (slug) do update set
  age_or_handover  = excluded.age_or_handover,
  description_long = excluded.description_long,
  who_its_for_base = excluded.who_its_for_base,
  character_tags   = excluded.character_tags,
  is_placeholder   = false,
  data_confidence  = excluded.data_confidence,
  source_note      = excluded.source_note;


-- =====================================================================
-- 0018 — Sub-community backbones + provenance (batch 1: flagships)
--
-- The level below the master community — the individual clusters a client
-- actually chooses between. Mirrors 0017: adds data_confidence/source_note
-- to sub_communities (the live database already carries them; this keeps a
-- fresh build in sync) and fills real backbones for the first batch of
-- high-value, well-documented clusters.
--
-- Honesty rules (unchanged): idempotent upsert on (community_id, slug); no
-- invented prices or counts; every backbone row graded + sourced. Obscure
-- clusters are deliberately left untouched (unverified) rather than guessed.
-- Batch 1 covers Arabian Ranches 2, Dubai Hills Estate, Jumeirah Park and
-- The Springs — later batches extend cluster by cluster.
-- =====================================================================

-- 1. Provenance columns on sub_communities ------------------------------
alter table sub_communities
  add column if not exists data_confidence text,
  add column if not exists source_note     text;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'sub_communities_data_confidence_chk'
  ) then
    alter table sub_communities
      add constraint sub_communities_data_confidence_chk
      check (data_confidence is null or data_confidence in ('high','medium','low','unverified'));
  end if;
end $$;

-- 2. Backbone upsert ----------------------------------------------------
insert into sub_communities
  (community_id, slug, name, status,
   description_long, who_its_for_base,
   is_placeholder, data_confidence, source_note)
select
  (select id from communities where slug = v.comm),
  v.slug, v.name, v.status::status_tag,
  v.descr, v.who,
  false, v.conf, v.note
from (values
  -- ---- Arabian Ranches 2 (established, ready) ------------------------
  ('arabian-ranches-2','palma','Palma','ready',
   'Arabesque-styled detached 4–6 bedroom villas — among Arabian Ranches 2''s larger, more private layouts on generous plots.',
   'Families wanting a spacious, traditional-styled detached villa with a big garden in an established Ranches cluster.',
   'high','Established cluster; layout/character from public market knowledge & developer info (Jul 2026); counts/prices pending DLD confirmation.'),
  ('arabian-ranches-2','rosa','Rosa','ready',
   'Spanish-inspired 3–5 bedroom detached villas around parks and pools — one of AR2''s most popular family clusters.',
   'Families wanting a detached villa with a garden in a sought-after, amenity-close Ranches cluster.',
   'high','Established cluster; layout/character from public market knowledge & developer info (Jul 2026); counts/prices pending DLD confirmation.'),
  ('arabian-ranches-2','lila','Lila','ready',
   'Contemporary 3–5 bedroom detached villas with clean lines, family-oriented and centrally placed within AR2.',
   'Families wanting a modern detached villa with a garden close to the community centre and schools.',
   'high','Established cluster; layout/character from public market knowledge & developer info (Jul 2026); counts/prices pending DLD confirmation.'),
  ('arabian-ranches-2','camelia','Camelia','ready',
   '3–4 bedroom townhouses and semi-detached villas — an efficient, more accessible entry point within Arabian Ranches 2.',
   'Buyers wanting a lower-entry townhouse or semi-detached home inside an established, prestige master community.',
   'high','Established cluster; layout/character from public market knowledge & developer info (Jul 2026); counts/prices pending DLD confirmation.'),
  ('arabian-ranches-2','azalea','Azalea','ready',
   '3–4 bedroom townhouses arranged around shared pools and parks — AR2''s value family cluster.',
   'First-time villa buyers and families wanting an affordable townhouse with a garden in the Ranches.',
   'high','Established cluster; layout/character from public market knowledge & developer info (Jul 2026); counts/prices pending DLD confirmation.'),

  -- ---- Dubai Hills Estate (mixed) -----------------------------------
  ('dubai-hills-estate','emerald-hills','Emerald Hills','offplan',
   'A custom-plot district for bespoke mansions — buyers acquire land and build to their own design. The ultra-prime tier of Dubai Hills.',
   'Ultra-high-net-worth buyers who want to build a bespoke mansion on a prime plot inside a proven master community.',
   'high','Custom-plot district; land-and-build model from developer info & public knowledge (Jul 2026); plot/build values vary per transaction — pending DLD confirmation.'),
  ('dubai-hills-estate','golf-place','Golf Place','ready',
   'Premium detached 4–6 bedroom villas near or overlooking the championship golf course — one of Dubai Hills'' most prestigious ready clusters.',
   'Families and investors wanting a prestigious, golf-adjacent detached villa with a strong resale record.',
   'high','Established cluster; layout/character from public market knowledge & developer info (Jul 2026); counts/prices pending DLD confirmation.'),
  ('dubai-hills-estate','fairway-vistas','Fairway Vistas','ready',
   'Large golf-fronting detached villas with premium positioning along the fairways of Dubai Hills.',
   'Buyers wanting a large, golf-fronting detached villa at the premium end of the ready market.',
   'high','Established cluster; layout/character from public market knowledge & developer info (Jul 2026); counts/prices pending DLD confirmation.'),
  ('dubai-hills-estate','parkway-vistas','Parkway Vistas','ready',
   'Spacious detached villas oriented to the central park and green spine of Dubai Hills Estate.',
   'Families wanting a large detached villa fronting parkland rather than the golf course.',
   'high','Established cluster; layout/character from public market knowledge & developer info (Jul 2026); counts/prices pending DLD confirmation.'),
  ('dubai-hills-estate','majestic-vistas','Majestic Vistas','ready',
   'The largest detached villas in Dubai Hills — expansive plots and premium layouts at the top of the standard (non-custom) range.',
   'Buyers wanting maximum space and a large plot in a ready, gated golf-and-park community.',
   'high','Established cluster; layout/character from public market knowledge & developer info (Jul 2026); counts/prices pending DLD confirmation.'),
  ('dubai-hills-estate','club-villas','Club Villas','ready',
   'Contemporary townhouse-style villas near the golf clubhouse and amenities — a more accessible entry into the Dubai Hills address.',
   'Buyers wanting a lower-entry, low-maintenance home with a garden inside a prime master community.',
   'high','Established cluster; layout/character from public market knowledge & developer info (Jul 2026); counts/prices pending DLD confirmation.'),

  -- ---- Jumeirah Park (established, ready) ----------------------------
  ('jumeirah-park','legacy','Legacy','ready',
   'The Legacy villa style — modern detached 3–5 bedroom family villas, the most common layout across Jumeirah Park.',
   'Families wanting a detached villa with a garden in a central, established Nakheel community near the Marina corridor.',
   'high','Established villa style; character from public market knowledge (Jul 2026); counts/prices pending DLD confirmation.'),
  ('jumeirah-park','heritage','Heritage','ready',
   'The Heritage villa style — more traditional detached family villas on generous plots within Jumeirah Park.',
   'Families wanting a traditional-styled detached villa with space and a large garden, centrally located.',
   'high','Established villa style; character from public market knowledge (Jul 2026); counts/prices pending DLD confirmation.'),
  ('jumeirah-park','regional','Regional','ready',
   'The Regional villa style — Mediterranean-influenced detached villas, a distinct architectural line in Jumeirah Park.',
   'Families wanting a characterful, Mediterranean-style detached villa in an established central community.',
   'high','Established villa style; character from public market knowledge (Jul 2026); counts/prices pending DLD confirmation.'),
  ('jumeirah-park','legacy-nova','Legacy Nova','ready',
   'A newer Legacy Nova line of detached villas with updated layouts within the established Jumeirah Park grid.',
   'Families wanting a more recent detached-villa layout inside a mature, central community.',
   'medium','Villa style from public market knowledge (Jul 2026); layout specifics to verify; counts/prices pending DLD confirmation.'),

  -- ---- The Springs (established, ready) — numbered lake districts -----
  ('the-springs','springs-1','Springs 1','ready',
   'One of The Springs'' numbered lake districts of 2–4 bedroom townhouses with gardens; districts differ mainly by townhouse type and proximity to the lakes and community centre.',
   'Families and investors wanting an affordable, established gated townhouse with a garden near Dubai Marina.',
   'medium','Established district; per-district type mix varies — general facts from public market knowledge (Jul 2026); counts/prices pending DLD confirmation.'),
  ('the-springs','springs-3','Springs 3','ready',
   'A numbered lake district of 2–4 bedroom townhouses in The Springs; districts vary by townhouse type and lake/park position.',
   'Families and investors wanting an affordable, established gated townhouse with a garden near Dubai Marina.',
   'medium','Established district; per-district type mix varies — general facts from public market knowledge (Jul 2026); counts/prices pending DLD confirmation.'),
  ('the-springs','springs-7','Springs 7','ready',
   'A numbered lake district of 2–4 bedroom townhouses in The Springs; districts vary by townhouse type and lake/park position.',
   'Families and investors wanting an affordable, established gated townhouse with a garden near Dubai Marina.',
   'medium','Established district; per-district type mix varies — general facts from public market knowledge (Jul 2026); counts/prices pending DLD confirmation.'),
  ('the-springs','springs-14','Springs 14','ready',
   'A numbered lake district of 2–4 bedroom townhouses in The Springs; districts vary by townhouse type and lake/park position.',
   'Families and investors wanting an affordable, established gated townhouse with a garden near Dubai Marina.',
   'medium','Established district; per-district type mix varies — general facts from public market knowledge (Jul 2026); counts/prices pending DLD confirmation.'),
  ('the-springs','springs-15','Springs 15','ready',
   'A numbered lake district of 2–4 bedroom townhouses in The Springs; districts vary by townhouse type and lake/park position.',
   'Families and investors wanting an affordable, established gated townhouse with a garden near Dubai Marina.',
   'medium','Established district; per-district type mix varies — general facts from public market knowledge (Jul 2026); counts/prices pending DLD confirmation.')
) as v(comm, slug, name, status, descr, who, conf, note)
on conflict (community_id, slug) do update set
  description_long = excluded.description_long,
  who_its_for_base = excluded.who_its_for_base,
  status           = excluded.status,
  is_placeholder   = false,
  data_confidence  = excluded.data_confidence,
  source_note      = excluded.source_note;


-- =====================================================================
-- 0019 — Coverage expansion: close the registry gaps
--
-- Fills named gaps so no villa/townhouse community or cluster is missing:
--  * The Springs   — all 15 numbered districts (had 5)
--  * The Meadows   — all 9 numbered districts (had 4)
--  * Jumeirah Islands — the theme clusters (European, Oasis, Entertainment Foyer)
--  * Dubai Islands (Nakheel) — NEW master + the Bay-series villa/TH communities
--  * Bayn by Ora  — NEW off-plan master (Ora Developers)
--
-- Structural facts only (name, developer, ready/offplan, tier); idempotent
-- upsert; provenance on every row; no invented prices or counts. Truly
-- exhaustive city-wide coverage (every registered project + new launches)
-- is the job of the DLD Projects registry sync — this closes the known,
-- high-value gaps now.
-- =====================================================================

-- New developer: Ora Developers (Bayn) --------------------------------
insert into developers (name, slug) values ('Ora Developers','ora')
on conflict (slug) do nothing;

-- New master communities ----------------------------------------------
insert into communities
  (slug, developer_id, name, status, positioning_tier, geo_center,
   age_or_handover, description_long, who_its_for_base, character_tags,
   is_placeholder, data_confidence, source_note)
select v.slug, (select id from developers where slug=v.dev), v.name,
       v.status::status_tag, v.tier::positioning_tier,
       case when v.lng is not null then ST_SetSRID(ST_MakePoint(v.lng,v.lat),4326)::geography end,
       v.age, v.descr, v.who, v.tags::text[], false, v.conf, v.note
from (values
  ('dubai-islands','nakheel','Dubai Islands','offplan','prime', 55.3400, 25.2900,
   'Off-plan · phased handovers ~2027+',
   'Nakheel''s five-island, ~17 sqkm master plan transforming Dubai''s northern shoreline (formerly Deira Islands) — beachfront villa and townhouse collections (the Bay series) alongside branded resorts and marinas.',
   'Investors and end-users wanting an early beachfront position in Dubai''s major new northern waterfront district, with a developer payment plan.',
   '{new-launch,waterfront,beach,investment,prestige}','medium',
   'Nakheel off-plan; master-plan & Bay-series collections from developer + aggregators (Jul 2026); handover/prices pending confirmed figures.'),
  ('bayn','ora','Bayn by Ora','offplan','prime', null, null,
   'Off-plan · handover ~2028+',
   'An Ora Developers (Naguib Sawiris) master community positioned as a nature-and-wellness-led villa/townhouse destination — one of the newer branded launches in the Dubai growth corridor.',
   'Investors and end-users seeking a differentiated, wellness-led branded community with a long off-plan payment runway.',
   '{new-launch,nature,wellness,investment}','low',
   'Ora off-plan; positioning from developer launch info (Jul 2026); location, product mix, handover & prices to verify.')
) as v(slug, dev, name, status, tier, lng, lat, age, descr, who, tags, conf, note)
on conflict (slug) do update set
  age_or_handover  = excluded.age_or_handover,
  description_long = excluded.description_long,
  who_its_for_base = excluded.who_its_for_base,
  character_tags   = excluded.character_tags,
  is_placeholder   = false,
  data_confidence  = excluded.data_confidence,
  source_note      = excluded.source_note;

-- New sub-communities (structural registry rows) ----------------------
insert into sub_communities
  (community_id, slug, name, status, is_placeholder, data_confidence, source_note)
select (select id from communities where slug=v.comm),
       v.slug, v.name, v.status::status_tag, true, v.conf, v.note
from (values
  -- The Springs — remaining numbered districts (1,3,7,14,15 already present)
  ('the-springs','springs-2','Springs 2','ready','high','Emirates Living numbered district; structural fact (Emaar, ready) from ECM/area guides (Jul 2026).'),
  ('the-springs','springs-4','Springs 4','ready','high','Emirates Living numbered district; structural fact (Emaar, ready) from ECM/area guides (Jul 2026).'),
  ('the-springs','springs-5','Springs 5','ready','high','Emirates Living numbered district; structural fact (Emaar, ready) from ECM/area guides (Jul 2026).'),
  ('the-springs','springs-6','Springs 6','ready','high','Emirates Living numbered district; structural fact (Emaar, ready) from ECM/area guides (Jul 2026).'),
  ('the-springs','springs-8','Springs 8','ready','high','Emirates Living numbered district; structural fact (Emaar, ready) from ECM/area guides (Jul 2026).'),
  ('the-springs','springs-9','Springs 9','ready','high','Emirates Living numbered district; structural fact (Emaar, ready) from ECM/area guides (Jul 2026).'),
  ('the-springs','springs-10','Springs 10','ready','high','Emirates Living numbered district; structural fact (Emaar, ready) from ECM/area guides (Jul 2026).'),
  ('the-springs','springs-11','Springs 11','ready','high','Emirates Living numbered district; structural fact (Emaar, ready) from ECM/area guides (Jul 2026).'),
  ('the-springs','springs-12','Springs 12','ready','high','Emirates Living numbered district; structural fact (Emaar, ready) from ECM/area guides (Jul 2026).'),
  ('the-springs','springs-13','Springs 13','ready','medium','Emirates Living numbered district; existence to confirm against ECM registry (Jul 2026).'),
  -- The Meadows — remaining numbered districts (1,4,8,9 already present)
  ('the-meadows','meadows-2','Meadows 2','ready','high','Emirates Living numbered district; structural fact (Emaar, ready) from ECM/area guides (Jul 2026).'),
  ('the-meadows','meadows-3','Meadows 3','ready','high','Emirates Living numbered district; structural fact (Emaar, ready) from ECM/area guides (Jul 2026).'),
  ('the-meadows','meadows-5','Meadows 5','ready','high','Emirates Living numbered district; structural fact (Emaar, ready) from ECM/area guides (Jul 2026).'),
  ('the-meadows','meadows-6','Meadows 6','ready','high','Emirates Living numbered district; structural fact (Emaar, ready) from ECM/area guides (Jul 2026).'),
  ('the-meadows','meadows-7','Meadows 7','ready','high','Emirates Living numbered district; structural fact (Emaar, ready) from ECM/area guides (Jul 2026).'),
  -- Jumeirah Islands — theme clusters (garden-hall, master-views, mediterranean already present)
  ('jumeirah-islands','european-clusters','European Clusters','ready','high','Jumeirah Islands theme cluster; from Nakheel/area guides (Jul 2026).'),
  ('jumeirah-islands','oasis-clusters','Oasis Clusters','ready','high','Jumeirah Islands theme cluster; from Nakheel/area guides (Jul 2026).'),
  ('jumeirah-islands','entertainment-foyer','Entertainment Foyer','ready','high','Jumeirah Islands villa style/cluster; from Nakheel/area guides (Jul 2026).'),
  -- Tilal Al Furjan — two gated phases (villas already present as one row)
  ('tilal-al-furjan','tilal-al-furjan-phase-1','Tilal Al Furjan — Phase 1','ready','medium','Nakheel: Tilal Al Furjan comprises two gated phases of 4–5BR villas (Jul 2026); cluster naming to confirm.'),
  ('tilal-al-furjan','tilal-al-furjan-phase-2','Tilal Al Furjan — Phase 2','ready','medium','Nakheel: Tilal Al Furjan comprises two gated phases of 4–5BR villas (Jul 2026); cluster naming to confirm.'),
  -- Dubai Islands — Bay-series villa/townhouse communities
  ('dubai-islands','bay-villas','Bay Villas','offplan','medium','Nakheel Dubai Islands: 3–6BR beachfront villas/townhouses (Jul 2026); prices/handover pending confirmed figures.'),
  ('dubai-islands','bay-collection','Bay Collection','offplan','medium','Nakheel Dubai Islands: premium beachfront villa/townhouse collection (Jul 2026); prices/handover pending confirmed figures.'),
  ('dubai-islands','bay-estate','Bay Estate','offplan','low','Nakheel Dubai Islands: exclusive villa community (Island E) per aggregators (Jul 2026); details to confirm.'),
  ('dubai-islands','bay-collective','Bay Collective','offplan','low','Nakheel Dubai Islands: waterfront villa/townhouse community (Islands B&C) per aggregators (Jul 2026); details to confirm.')
) as v(comm, slug, name, status, conf, note)
on conflict (community_id, slug) do update set
  name            = excluded.name,
  status          = excluded.status,
  data_confidence = excluded.data_confidence,
  source_note     = excluded.source_note;


-- =====================================================================
-- 0020 — Developer-by-developer villa/townhouse coverage (wave 1)
--
-- The USP: every villa/townhouse community in Dubai, organised by developer.
-- This wave adds real, currently-missing master communities across the major
-- developers (validated via developer sites + area guides, Jul 2026):
--   Aldar      → Athlon (9 clusters)
--   Binghatti  → Tilal Binghatti (their first villa community)   [new dev]
--   Danube     → Greenz by Danube (their first villa masterplan) [new dev]
--   Azizi      → Azizi Venice (Dubai South villas)               [new dev]
--   Al Habtoor → Al Habtoor Polo Resort & Club                   [new dev]
--   Nakheel    → Jumeirah Village Circle (2,000+ villas/TH)
--   Dubai Hldg → Layan, Al Waha, Ghoroob, Villa Lantana
--   Meraas     → Jumeirah Bay Island
--   Meydan     → Mira Villas (Bentley Home, District 11)
--   DAMAC      → DAMAC Sun City
--   Emaar      → Address Villas Hillcrest (sub of Dubai Hills)
--
-- Structural facts only; idempotent upsert; provenance on every row; no
-- invented prices/counts. Truly exhaustive city-wide completeness remains the
-- DLD Projects registry sync's job — this closes the big known gaps.
-- =====================================================================

-- New developers -------------------------------------------------------
insert into developers (name, slug) values
  ('Binghatti Developers','binghatti'),
  ('Danube Properties','danube'),
  ('Azizi Developments','azizi'),
  ('Al Habtoor Group','al-habtoor')
on conflict (slug) do nothing;

-- New master communities ------------------------------------------------
insert into communities
  (slug, developer_id, name, status, positioning_tier, geo_center,
   age_or_handover, description_long, who_its_for_base, character_tags,
   is_placeholder, data_confidence, source_note)
select v.slug, (select id from developers where slug=v.dev), v.name,
       v.status::status_tag, v.tier::positioning_tier,
       ST_SetSRID(ST_MakePoint(v.lng,v.lat),4326)::geography,
       v.age, v.descr, v.who, v.tags::text[], false, v.conf, v.note
from (values
  ('athlon','aldar','Athlon','offplan','premium',55.2600,25.0300,
   'Off-plan · handover ~Q2 2028',
   'Aldar''s wellness-themed Dubailand master community of ~2,692 villas and townhouses across nine clusters (Chion, Delphi, Diagon, Leon, Milon, Olympia, Theon, Vitalon, Zeston), built around running, cycling and family trails.',
   'Wellness-minded families wanting a new-build Aldar villa or townhouse with an active, trail-led lifestyle and a payment plan.',
   '{new-launch,gated-family,wellness,nature,investment}','high',
   'Aldar off-plan; clusters, unit count & Q2 2028 handover confirmed via developer + aggregators (Jul 2026); prices pending confirmed figures.'),
  ('tilal-binghatti','binghatti','Tilal Binghatti','offplan','premium',55.4100,25.0700,
   'Off-plan · handover ~Dec 2028',
   'Binghatti''s first villa community — a gated, nature-led (40% greenery) master plan in Al Rowaiyah, Dubailand, of 4–6 bedroom villas and 4-bedroom townhouses, marking the tower-focused developer''s move into horizontal family living.',
   'Investors and families wanting a brand-new gated villa/townhouse from Binghatti with a 60/40 payment plan on the Dubailand growth corridor.',
   '{new-launch,gated-family,nature,investment}','high',
   'Binghatti off-plan; first villa community, configs & Dec 2028 handover from developer + aggregators (Jul 2026); prices pending confirmed figures.'),
  ('greenz-by-danube','danube','Greenz by Danube','offplan','mid',55.4150,25.1250,
   'Off-plan · handover ~Q4 2029',
   'Danube''s first large-scale villa/townhouse master community in Dubai International Academic City — 3–4 bedroom townhouses and 5-bedroom twin/semi-detached villas, marketed as Dubai''s first fully-furnished master villa project with a 1%-monthly plan.',
   'Value-focused investors and families wanting a furnished, new-build villa/townhouse with a low-entry, extended payment plan.',
   '{new-launch,gated-family,investment}','high',
   'Danube off-plan; first villa masterplan, configs & Q4 2029 handover from developer announcements (Jul 2026); prices pending confirmed figures.'),
  ('azizi-venice','azizi','Azizi Venice','offplan','premium',55.1500,24.8700,
   'Off-plan · handover from ~Q4 2026',
   'A large Azizi waterfront master community in Dubai South built around a lagoon and canals — predominantly apartments but with 200+ waterfront villas and mansions, near Al Maktoum International Airport.',
   'Investors wanting a waterfront villa in a large lifestyle-led Dubai South community with a payment plan and airport-corridor growth.',
   '{new-launch,waterfront,investment}','medium',
   'Azizi off-plan; villa component within a mostly-apartment masterplan, handover ~Q4 2026 from developer + aggregators (Jul 2026); prices pending confirmed figures.'),
  ('jumeirah-village-circle','nakheel','Jumeirah Village Circle','mixed','mid',55.2100,25.0600,
   'Ready / mixed · established',
   'A large, central Nakheel community (JVC) of 2,000+ villas and townhouses (incl. Nakheel Townhouses and boutique gated projects like Somerset Mews) alongside mid-rise apartments — one of Dubai''s most active, affordable family markets.',
   'Value-focused families and investors wanting an affordable, central townhouse or villa with easy access to both main highways.',
   '{established,central,schools-nearby,investment}','high',
   'Nakheel community; villa/TH count & clusters from Nakheel + area guides (Jul 2026); prices pending DLD confirmation.'),
  ('layan','dubai-holding','Layan','ready','mid',55.2900,25.0100,
   'Ready · established',
   'A Dubai Properties community in Dubailand of Mediterranean-inspired villas set among green spaces — a settled, family-oriented villa enclave.',
   'Families wanting an established, affordable Mediterranean-style villa with a garden in the Dubailand corridor.',
   '{established,gated-family,schools-nearby}','high',
   'Dubai Properties community; structural facts from developer (Dubai Residential) + area guides (Jul 2026); prices/counts pending confirmation.'),
  ('al-waha','dubai-holding','Al Waha','ready','mid',55.2850,25.0150,
   'Ready · established',
   'A Dubai Properties Dubailand community of single-storey and two-storey villas with landscaped courtyards, known for a quiet, garden-focused family setting.',
   'Families wanting a calm, established villa with a garden and courtyards at accessible pricing in Dubailand.',
   '{established,gated-family,schools-nearby}','high',
   'Dubai Properties community; structural facts from developer + area guides (Jul 2026); prices/counts pending confirmation.'),
  ('ghoroob','dubai-holding','Ghoroob','ready','accessible',55.4200,25.2200,
   'Ready · established',
   'A Dubai Properties community in Mirdif blending townhouses and low-rise apartments around courtyards and greenery, close to schools and malls.',
   'Families and first-time buyers wanting an affordable, established townhouse near Mirdif''s schools and retail.',
   '{established,gated-family,schools-nearby}','medium',
   'Dubai Properties community; townhouse component within a mixed masterplan, from developer + area guides (Jul 2026); prices/counts pending confirmation.'),
  ('villa-lantana','dubai-holding','Villa Lantana','ready','premium',55.2000,25.1050,
   'Ready · handover from ~2018',
   'A gated Dubai Holding (TECOM) villa community in Al Barsha South of contemporary 3–5 bedroom villas and townhouses around parks — central, green and family-oriented near Sheikh Zayed Road.',
   'Families wanting a modern, gated villa with a garden in a central location near schools and Sheikh Zayed Road.',
   '{established,gated-family,central,schools-nearby}','high',
   'Dubai Holding community; structural facts from developer + area guides (Jul 2026); prices/counts pending confirmation.'),
  ('jumeirah-bay-island','meraas','Jumeirah Bay Island','mixed','ultra_prime',55.2450,25.2050,
   'Mixed · established + new launches',
   'A Meraas seahorse-shaped island off Jumeirah 2 (home of the Bulgari Resort & Residences) with a limited collection of ultra-prime beachfront villas and mansions — among the most exclusive addresses in the city.',
   'Ultra-high-net-worth buyers seeking a trophy beachfront villa or mansion on a landmark private island minutes from the city.',
   '{ultra-luxury,waterfront,beach,prestige}','medium',
   'Meraas island; ultra-prime villa component per developer + market knowledge (Jul 2026); values vary per transaction — pending DLD confirmation.'),
  ('al-habtoor-polo-resort','al-habtoor','Al Habtoor Polo Resort & Club','offplan','prime',55.3050,24.9750,
   'Off-plan / mixed · phased',
   'An Al Habtoor equestrian-themed community in Dubailand spanning ~6 million sqft — 3–6 bedroom semi-detached and standalone villas around four polo fields, a riding school and a luxury hotel.',
   'Buyers wanting a differentiated, equestrian-lifestyle villa in a resort-branded gated community with a payment plan.',
   '{new-launch,gated-family,nature,prestige}','medium',
   'Al Habtoor community; villa configs & amenities from developer + aggregators (Jul 2026); handover/prices pending confirmed figures.'),
  ('mira-villas','meydan','Mira Villas by Bentley Home','offplan','ultra_prime',55.3200,25.1600,
   'Off-plan · branded villas',
   'A branded collection of 36 fully-furnished 5-bedroom villas and mansions by Bentley Home in District 11, Meydan (MBR City) — a turnkey ultra-luxury product with bespoke Bentley Home interiors.',
   'Ultra-high-net-worth buyers wanting a turnkey, branded, fully-furnished mansion in a central MBR City district.',
   '{new-launch,ultra-luxury,central,prestige}','medium',
   'Bentley Home / Meydan District 11; 36 branded villas per developer + aggregators (Jul 2026); prices pending confirmed figures.'),
  ('damac-sun-city','damac','DAMAC Sun City','offplan','premium',55.3000,24.9600,
   'Off-plan · handover ~Mar 2028',
   'A DAMAC wellness-themed community in Dubailand of 4–5 bedroom townhouses built around forest trails, outdoor yoga and recovery spaces.',
   'Wellness-minded families and investors wanting a new-build townhouse with a nature-and-recovery lifestyle and a payment plan.',
   '{new-launch,gated-family,wellness,nature,investment}','medium',
   'DAMAC off-plan; configs & Mar 2028 handover from developer + aggregators (Jul 2026); prices pending confirmed figures.')
) as v(slug, dev, name, status, tier, lng, lat, age, descr, who, tags, conf, note)
on conflict (slug) do update set
  age_or_handover  = excluded.age_or_handover,
  description_long = excluded.description_long,
  who_its_for_base = excluded.who_its_for_base,
  character_tags   = excluded.character_tags,
  is_placeholder   = false,
  data_confidence  = excluded.data_confidence,
  source_note      = excluded.source_note;

-- Sub-communities -------------------------------------------------------
insert into sub_communities
  (community_id, slug, name, status, is_placeholder, data_confidence, source_note)
select (select id from communities where slug=v.comm),
       v.slug, v.name, v.status::status_tag, true, v.conf, v.note
from (values
  -- Athlon — nine named clusters
  ('athlon','athlon-chion','Chion','offplan','high','Athlon cluster per Aldar (Jul 2026).'),
  ('athlon','athlon-delphi','Delphi','offplan','high','Athlon cluster per Aldar (Jul 2026).'),
  ('athlon','athlon-diagon','Diagon','offplan','high','Athlon cluster per Aldar (Jul 2026).'),
  ('athlon','athlon-leon','Leon','offplan','high','Athlon cluster per Aldar (Jul 2026).'),
  ('athlon','athlon-milon','Milon','offplan','high','Athlon cluster per Aldar (Jul 2026).'),
  ('athlon','athlon-olympia','Olympia','offplan','high','Athlon cluster per Aldar (Jul 2026).'),
  ('athlon','athlon-theon','Theon','offplan','high','Athlon cluster per Aldar (Jul 2026).'),
  ('athlon','athlon-vitalon','Vitalon','offplan','high','Athlon cluster per Aldar (Jul 2026).'),
  ('athlon','athlon-zeston','Zeston','offplan','high','Athlon cluster per Aldar (Jul 2026).'),
  -- JVC villa/townhouse clusters
  ('jumeirah-village-circle','nakheel-townhouses','Nakheel Townhouses','ready','high','JVC: Nakheel Townhouses (1–4BR) per Nakheel/area guides (Jul 2026).'),
  ('jumeirah-village-circle','somerset-mews','Somerset Mews','ready','medium','JVC: Ellington 4BR townhouse enclave (17 units) per developer (Jul 2026).'),
  -- Emaar Address Villas Hillcrest sits inside Dubai Hills Estate
  ('dubai-hills-estate','address-hillcrest','Address Villas — Hillcrest','ready','high','Emaar/Address branded 5BR lagoon villas within Dubai Hills Estate (Jul 2026); prices pending DLD confirmation.')
) as v(comm, slug, name, status, conf, note)
on conflict (community_id, slug) do update set
  name            = excluded.name,
  status          = excluded.status,
  data_confidence = excluded.data_confidence,
  source_note     = excluded.source_note;


-- =====================================================================
-- 0021 — Full developer coverage (broker master list)
--
-- Encodes the owner's authoritative villa/townhouse list: 7 new developers,
-- 20 new master communities and 317 sub-community/cluster rows across every
-- major developer (Emaar, DAMAC, Nakheel, Dubai Holding/Meraas/Wasl, Meydan/
-- Sobha/MBR City, MAF, Aldar, Azizi, Nshama + niche/island/podium projects).
--
-- Structural registry only; data_confidence='high' (broker-validated);
-- no invented prices/counts; idempotent upsert. This is the USP breadth:
-- every villa/TH community in Dubai, organised by developer.
-- =====================================================================

-- New developers -------------------------------------------------------
insert into developers (name, slug) values
  ('H&H Development','hh-development'),
  ('MAG','mag'),
  ('G&Co Properties','g-and-co'),
  ('Expo City Dubai','expo-city-dubai'),
  ('Dubai Silicon Oasis Authority','dsoa'),
  ('Amali Properties','amali'),
  ('Kleindienst Group','kleindienst')
on conflict (slug) do nothing;

-- New master communities ----------------------------------------------
insert into communities
  (slug, developer_id, name, status, positioning_tier,
   age_or_handover, description_long, who_its_for_base, character_tags,
   is_placeholder, data_confidence, source_note)
select v.slug, (select id from developers where slug=v.dev), v.name,
       v.status::status_tag, v.tier::positioning_tier,
       v.age, v.descr, v.who, v.tags::text[], false, 'high', v.note
from (values
  ('the-heights-country-club','emaar','The Heights Country Club & Wellness','offplan','premium','Off-plan','Emaar wellness-themed townhouse & twin-villa community in deep Dubailand (Serro, Grandio, Faro) around a country club.','Wellness-minded families wanting a new Emaar townhouse/villa with a country-club lifestyle.','{new-launch,gated-family,wellness,nature}','Broker-provided master list (validated), Jul 2026.'),
  ('sur-la-mer','meraas','Sur La Mer (Port de La Mer)','ready','prime','Ready','Meraas waterfront townhouse enclave at Port de La Mer, Jumeirah — multi-level marine townhouses with roof decks.','Buyers wanting a beachfront townhouse minutes from the city with a marina lifestyle.','{waterfront,beach,prestige,central}','Broker-provided master list (validated), Jul 2026.'),
  ('dar-wasl','wasl','Dar Wasl','ready','prime','Ready','Upscale wasl Andalusian-style villa/townhouse compound on Al Wasl Road, Jumeirah.','Families wanting a central, gated Andalusian villa near Jumeirah and Downtown.','{central,gated-family,prestige}','Broker-provided master list (validated), Jul 2026.'),
  ('wasl-51','wasl','Wasl 51','ready','premium','Ready','wasl urban townhouses at Jumeirah 1 integrated with a high-end retail strip.','Buyers wanting a central townhouse with retail at the door in Jumeirah.','{central,gated-family}','Broker-provided master list (validated), Jul 2026.'),
  ('wasl-square','wasl','Wasl Square','ready','premium','Ready','wasl townhouse cluster beside Safa Park, Al Safa.','Families wanting a central townhouse next to Safa Park.','{central,gated-family,schools-nearby}','Broker-provided master list (validated), Jul 2026.'),
  ('shorooq','dubai-holding','Shorooq','ready','mid','Ready','Dubai Holding gated Mirdif enclave of standalone villas and townhouse rows.','Families wanting an affordable, established villa/townhouse near Mirdif schools.','{established,gated-family,schools-nearby}','Broker-provided master list (validated), Jul 2026.'),
  ('sobha-sanctuary','sobha','The Willows at Sobha Sanctuary','offplan','ultra_prime','Off-plan','Sobha "The Willows" villa collection at Sobha Sanctuary, Nad Al Sheba (The Brooks, The Grove, The Greens).','Buyers wanting a new, high-quality Sobha villa in a green Nad Al Sheba setting.','{new-launch,gated-family,nature,prestige}','Broker-provided master list (validated), Jul 2026.'),
  ('eden-hills','hh-development','Eden Hills','offplan','ultra_prime','Off-plan','H&H Development gated MBR-area community of 350 ultra-luxury 5–6BR villas along a natural wadi.','UHNW buyers wanting a bespoke villa along a natural wadi in a boutique gated community.','{new-launch,ultra-luxury,nature,prestige}','Broker-provided master list (validated), Jul 2026.'),
  ('the-sanctuary-ellington','ellington','The Sanctuary by Ellington','offplan','prime','Off-plan','Ellington boutique villa community in District 11 (Waterside, Lakeshore, Beachfront, Lakeview) — design-led 4–6BR villas.','Design-conscious buyers wanting a boutique, lakeside Ellington villa.','{new-launch,gated-family,waterfront,prestige}','Broker-provided master list (validated), Jul 2026.'),
  ('opal-gardens','meydan','Opal Gardens (District 11)','offplan','prime','Off-plan','Meydan/Nakheel JV gated community in District 11 of semi-detached and standalone lakeside villas.','Families wanting a gated lakeside villa in central MBR City.','{new-launch,gated-family,waterfront,central}','Broker-provided master list (validated), Jul 2026.'),
  ('keturah-reserve','mag','Keturah Reserve','offplan','ultra_prime','Off-plan','MAG bio-living luxury gated wellness community in MBR District 7 of interconnected townhouses in raw travertine.','Wellness-focused UHNW buyers wanting a design-forward, central townhouse.','{new-launch,ultra-luxury,wellness,central}','Broker-provided master list (validated), Jul 2026.'),
  ('mag-city','mag','MAG City','ready','mid','Ready','MAG entry-to-mid compact urban townhouses in MBR District 7 (MAG Eye).','Value buyers wanting an affordable, central new townhouse.','{gated-family,central,investment}','Broker-provided master list (validated), Jul 2026.'),
  ('the-fields','g-and-co','The Fields at MBR City','ready','premium','Ready','G&Co gated townhouse community at MBR City (Cassia, Jade, Viridian, Senses by Elie Saab).','Families wanting a modern, central attached townhouse with design pedigree.','{gated-family,central,schools-nearby}','Broker-provided master list (validated), Jul 2026.'),
  ('ghaf-woods','majid-al-futtaim','Ghaf Woods','offplan','premium','Off-plan','Majid Al Futtaim biophilic forest community — multi-tier forest townhouses among thousands of trees.','Nature-led families wanting a forest-immersed new townhouse from MAF.','{new-launch,gated-family,nature,wellness}','Broker-provided master list (validated), Jul 2026.'),
  ('expo-city','expo-city-dubai','Expo City Dubai','offplan','premium','Off-plan','Expo City Dubai eco townhouse/villa community (Expo Valley, Shamsa, Yasmina) on the Expo legacy site.','Sustainability-minded families wanting a new eco villa/townhouse near Expo/airport.','{new-launch,gated-family,wellness,nature}','Broker-provided master list (validated), Jul 2026.'),
  ('dubai-silicon-oasis','dsoa','Dubai Silicon Oasis','ready','mid','Ready','DSO established detached villa compounds (Cedre Villas, Semmer Villas) — spacious legacy family homes.','Families wanting a spacious, affordable established villa in a tech-hub district.','{established,gated-family,schools-nearby}','Broker-provided master list (validated), Jul 2026.'),
  ('amali-island','amali','Amali Island','offplan','ultra_prime','Off-plan','Amali Properties: 24 ultra-exclusive beachfront mansions on The World Islands with private berths.','UHNW buyers wanting a private-island beachfront mansion.','{new-launch,ultra-luxury,waterfront,beach,prestige}','Broker-provided master list (validated), Jul 2026.'),
  ('the-world-islands','kleindienst','The World Islands (Heart of Europe)','mixed','ultra_prime','Mixed','Kleindienst "Heart of Europe" island villa collection (Germany, Sweden, Floating Seahorse).','UHNW buyers wanting a themed private-island beach estate.','{ultra-luxury,waterfront,beach,prestige}','Broker-provided master list (validated), Jul 2026.'),
  ('rashid-yachts-marina','emaar','Rashid Yachts & Marina','offplan','prime','Off-plan','Emaar Mina Rashid waterfront podium townhouses (Seascape, Sunridge, Sirius) over the yacht basin.','Buyers wanting a waterfront townhouse on a mega-yacht marina near the city.','{new-launch,waterfront,central,investment}','Broker-provided master list (validated), Jul 2026.'),
  ('dubai-creek-harbour','emaar','Dubai Creek Harbour','mixed','prime','Mixed','Emaar Creek Harbour podium townhouses (Creek Beach, Creek Waters) at the base of waterfront towers.','Buyers wanting a rare waterfront townhouse in a prime creekside district.','{waterfront,central,investment}','Broker-provided master list (validated), Jul 2026.')
) as v(slug, dev, name, status, tier, age, descr, who, tags, note)
on conflict (slug) do update set
  age_or_handover=excluded.age_or_handover, description_long=excluded.description_long,
  who_its_for_base=excluded.who_its_for_base, character_tags=excluded.character_tags,
  is_placeholder=false, data_confidence=excluded.data_confidence, source_note=excluded.source_note;

-- New sub-communities / clusters --------------------------------------
insert into sub_communities
  (community_id, slug, name, status, is_placeholder, data_confidence, source_note)
select (select id from communities where slug=v.comm), v.slug, v.name, v.status::status_tag,
       true, 'high', v.note
from (values
  ('grand-polo-club','chevalia-estate','Chevalia Estate','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('grand-polo-club','chevalia-fields','Chevalia Fields','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('grand-polo-club','selvara','Selvara','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('grand-polo-club','selvara-2','Selvara 2','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('grand-polo-club','selvara-4','Selvara 4','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('the-oasis','palmiera-2','Palmiera 2','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('the-oasis','mareva','Mareva','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('the-oasis','mareva-2','Mareva 2','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('the-oasis','tierra','Tierra','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('the-oasis','address-villas-oasis','Address Villas Oasis','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('the-oasis','ostra-palace','Ostra Palace','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('the-heights-country-club','serro','Serro','offplan','Broker-provided master list (validated), Jul 2026.'),
  ('the-heights-country-club','serro-2','Serro 2','offplan','Broker-provided master list (validated), Jul 2026.'),
  ('the-heights-country-club','grandio','Grandio','offplan','Broker-provided master list (validated), Jul 2026.'),
  ('the-heights-country-club','faro','Faro','offplan','Broker-provided master list (validated), Jul 2026.'),
  ('the-valley','talia','Talia','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('the-valley','orania','Orania','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('the-valley','elora','Elora','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('the-valley','farm-gardens-2','Farm Gardens 2','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('the-valley','nima','Nima','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('the-valley','lillia','Lillia','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('the-valley','venera','Venera','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('the-valley','virella','Virella','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('the-valley','vindera','Vindera','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('the-valley','avena','Avena','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('the-valley','avena-2','Avena 2','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('the-valley','farm-grove','Farm Grove','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('the-valley','farm-grove-2','Farm Grove 2','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('the-valley','elea','Elea','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('the-valley','elva','Elva','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('the-valley','kaia','Kaia','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('the-valley','ovelle','Ovelle','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('the-valley','avelia','Avelia','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('the-valley','alva','Alva','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('dubai-hills-estate','sidra-1','Sidra 1','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('dubai-hills-estate','sidra-2','Sidra 2','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('dubai-hills-estate','sidra-3','Sidra 3','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('dubai-hills-estate','maple-1','Maple 1','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('dubai-hills-estate','maple-2','Maple 2','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('dubai-hills-estate','maple-3','Maple 3','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('dubai-hills-estate','golf-place-i','Golf Place I','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('dubai-hills-estate','golf-place-ii','Golf Place II','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('dubai-hills-estate','hills-grove','Hills Grove','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('dubai-hills-estate','hills-view','Hills View','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('dubai-hills-estate','lime-gardens','Lime Gardens','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('dubai-hills-estate','park-gate','Park Gate','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('dubai-hills-estate','park-gate-phase-2','Park Gate Phase 2','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('arabian-ranches','al-mahra','Al Mahra','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('arabian-ranches','san-luis','San Luis','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('arabian-ranches','santa-fe','Santa Fe','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('arabian-ranches','polo-homes','Polo Homes','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('arabian-ranches-2','casa','Casa','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('arabian-ranches-2','rasha','Rasha','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('arabian-ranches-2','samara','Samara','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('arabian-ranches-2','yasmin','Yasmin','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('arabian-ranches-2','reem-townhouses','Reem Townhouses','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('arabian-ranches-3','spring','Spring','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('arabian-ranches-3','bliss-2','Bliss 2','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('arabian-ranches-3','anya-2','Anya 2','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('arabian-ranches-3','raya','Raya','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('arabian-ranches-3','elie-saab-ii','Elie Saab II','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('arabian-ranches-3','june','June','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('arabian-ranches-3','june-ii','June II','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('arabian-ranches-3','idyllic','Idyllic','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('arabian-ranches-3','may','May','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('emaar-south','urbana-i','Urbana I','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('emaar-south','urbana-ii','Urbana II','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('emaar-south','urbana-iii','Urbana III','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('emaar-south','greenwood','Greenwood','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('emaar-south','fairways','Fairways','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('emaar-south','saffron','Saffron','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('emaar-south','golf-fields','Golf Fields','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('emaar-south','golf-vale','Golf Vale','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('emaar-south','parkside','Parkside','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills','trump-estates','Trump Estates','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills','gems-estates','Gems Estates','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills','cavalli-estates','Cavalli Estates','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills','utopia','Utopia','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills','fendi-styled-villas','Fendi Styled Villas','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills','paramount-villas','Paramount Villas','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills','belair','Belair','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills','veneto','Veneto','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills','queens-meadows','Queens Meadows','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills','brookfield','Brookfield','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills','trinity','Trinity','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills','richmond','Richmond','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills','loreto','Loreto','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills','orchid','Orchid','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills','topanga','Topanga','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills','pelham','Pelham','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills','piccadilly-green','Piccadilly Green','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills','rochester','Rochester','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills','jasmine','Jasmine','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills-2','aster','Aster','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills-2','basswood','Basswood','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills-2','camelia','Camelia','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills-2','claret','Claret','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills-2','coursetia','Coursetia','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills-2','danusia','Danusia','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills-2','dynamic','Dynamic','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills-2','eton','Eton','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills-2','forenous','Forenous','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills-2','ghaf-trees','Ghaf Trees','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills-2','janusia','Janusia','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills-2','juniper','Juniper','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills-2','mimosa','Mimosa','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills-2','mulberry','Mulberry','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills-2','odora','Odora','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills-2','pacifica','Pacifica','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills-2','primrose','Primrose','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills-2','rawda','Rawda','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills-2','santini','Santini','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills-2','sycamore','Sycamore','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills-2','trixis','Trixis','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills-2','vardon','Vardon','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills-2','zinnia','Zinnia','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills-2','park-greens','Park Greens','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills-2','violet-1','Violet 1','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills-2','violet-2','Violet 2','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills-2','violet-3','Violet 3','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills-2','violet-4','Violet 4','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-hills-2','elo-townhouses','Elo Townhouses','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-lagoons','marbella','Marbella','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-lagoons','marbella-2','Marbella 2','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-lagoons','mykonos','Mykonos','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-lagoons','monte-carlo','Monte Carlo','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-lagoons','ibiza','Ibiza','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-lagoons','venice-2','Venice 2','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-riverside','rome','Rome','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-riverside','paris','Paris','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-riverside','london','London','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-riverside','amsterdam','Amsterdam','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-riverside','new-york','New York','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-islands','bahamas','Bahamas','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-islands','fiji','Fiji','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-islands','bora-bora','Bora Bora','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-sun-city','phase-1','Phase 1','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('damac-sun-city','phase-2','Phase 2','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('palm-jumeirah','palma-residences','Palma Residences','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('palm-jumeirah','balqis-residences','Balqis Residences','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('palm-jumeirah','xxii-carat','XXII Carat','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('palm-jumeirah','kingdom-of-sheba','Kingdom of Sheba','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('palm-jumeirah','six-senses-residences','Six Senses Residences','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('palm-jumeirah','orla','Orla','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('palm-jumeirah','ava','Ava','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('dubai-islands','waterfront-villas','Waterfront Villas','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('jumeirah-park','jumeirah-park-homes','Jumeirah Park Homes','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('jumeirah-islands','islamic-clusters','Islamic Clusters','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('jumeirah-islands','mansions','Mansions','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('jumeirah-islands','jumeirah-islands-townhouses','Jumeirah Islands Townhouses','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('al-furjan','al-furjan-west','Al Furjan West','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('al-furjan','al-furjan-east','Al Furjan East','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('al-furjan','murooj-al-furjan','Murooj Al Furjan','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('al-furjan','murooj-al-furjan-west','Murooj Al Furjan West','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('al-furjan','dreamz-by-danube','Dreamz by Danube','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('nad-al-sheba-villas','nad-al-sheba-1','Nad Al Sheba 1','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('nad-al-sheba-villas','nad-al-sheba-2','Nad Al Sheba 2','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('nad-al-sheba-villas','nad-al-sheba-4','Nad Al Sheba 4','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('jumeirah-village-triangle','jvt-district-2','JVT District 2','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('jumeirah-village-triangle','jvt-district-3','JVT District 3','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('jumeirah-village-triangle','jvt-district-5','JVT District 5','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('jumeirah-village-triangle','jvt-district-6','JVT District 6','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('jumeirah-village-triangle','jvt-district-8','JVT District 8','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('jumeirah-village-triangle','jvt-district-9','JVT District 9','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('jumeirah-village-circle','jvc-district-11','JVC District 11','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('jumeirah-village-circle','jvc-district-12','JVC District 12','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('jumeirah-village-circle','jvc-district-13','JVC District 13','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('jumeirah-village-circle','jvc-district-14','JVC District 14','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('jumeirah-village-circle','jvc-district-15','JVC District 15','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('jumeirah-village-circle','jvc-district-16','JVC District 16','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('jumeirah-village-circle','eleganz-by-danube','Eleganz by Danube','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('mudon','rahat','Rahat','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('mudon','naseem','Naseem','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('mudon','arabella-1','Arabella 1','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('mudon','arabella-2','Arabella 2','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('mudon','arabella-3','Arabella 3','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('villanova','amaranta-1','Amaranta 1','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('villanova','amaranta-2','Amaranta 2','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('villanova','amaranta-3','Amaranta 3','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('villanova','amaranta-4','Amaranta 4','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('villanova','la-rosa-1','La Rosa 1','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('villanova','la-rosa-2','La Rosa 2','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('villanova','la-rosa-3','La Rosa 3','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('villanova','la-rosa-4','La Rosa 4','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('villanova','la-rosa-5','La Rosa 5','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('villanova','la-rosa-6','La Rosa 6','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('villanova','la-violeta-1','La Violeta 1','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('villanova','la-violeta-2','La Violeta 2','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('the-villa','the-aldea','The Aldea','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('the-villa','the-centro','The Centro','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('the-villa','the-haciendas','The Haciendas','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('the-acres','phase-1','Phase 1','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('the-acres','phase-2','Phase 2','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('jumeirah-bay-island','bulgari-villas','Bulgari Villas','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('jumeirah-bay-island','sea-mirror-mansions','Sea Mirror Mansions','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('wasl-gate','gardenia-townhomes-i','Gardenia Townhomes I','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('wasl-gate','gardenia-townhomes-ii','Gardenia Townhomes II','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('district-one','phase-1','Phase 1','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('district-one','phase-2','Phase 2','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('district-one','phase-3','Phase 3','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('district-one','phase-4','Phase 4','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('district-one','district-one-west-1','District One West 1','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('district-one','district-one-west-2','District One West 2','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('sobha-hartland','water-canal-villas','Water Canal Villas','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('sobha-hartland','gardenia-villas','Gardenia Villas','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('sobha-hartland','quad-homes','Quad Homes','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('sobha-hartland-2','sobha-mansions','Sobha Mansions','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('sobha-hartland-2','hartland-ii-villas-phase-1','Hartland II Villas Phase 1','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('sobha-hartland-2','hartland-ii-villas-phase-2','Hartland II Villas Phase 2','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('sobha-hartland-2','hartland-ii-villas-phase-3','Hartland II Villas Phase 3','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('sobha-elwood','elwood-phase-1','Elwood Phase 1','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('sobha-elwood','elwood-phase-2','Elwood Phase 2','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('sobha-sanctuary','the-brooks','The Brooks','offplan','Broker-provided master list (validated), Jul 2026.'),
  ('sobha-sanctuary','the-grove','The Grove','offplan','Broker-provided master list (validated), Jul 2026.'),
  ('sobha-sanctuary','the-greens','The Greens','offplan','Broker-provided master list (validated), Jul 2026.'),
  ('eden-hills','edra','Edra','offplan','Broker-provided master list (validated), Jul 2026.'),
  ('eden-hills','maia','Maia','offplan','Broker-provided master list (validated), Jul 2026.'),
  ('eden-hills','avra','Avra','offplan','Broker-provided master list (validated), Jul 2026.'),
  ('eden-hills','aurora','Aurora','offplan','Broker-provided master list (validated), Jul 2026.'),
  ('eden-hills','vera','Vera','offplan','Broker-provided master list (validated), Jul 2026.'),
  ('eden-hills','mira','Mira','offplan','Broker-provided master list (validated), Jul 2026.'),
  ('eden-hills','luna','Luna','offplan','Broker-provided master list (validated), Jul 2026.'),
  ('the-sanctuary-ellington','the-waterside','The Waterside','offplan','Broker-provided master list (validated), Jul 2026.'),
  ('the-sanctuary-ellington','the-lakeshore','The Lakeshore','offplan','Broker-provided master list (validated), Jul 2026.'),
  ('the-sanctuary-ellington','the-beachfront','The Beachfront','offplan','Broker-provided master list (validated), Jul 2026.'),
  ('the-sanctuary-ellington','the-lakeview','The Lakeview','offplan','Broker-provided master list (validated), Jul 2026.'),
  ('the-fields','cassia','Cassia','ready','Broker-provided master list (validated), Jul 2026.'),
  ('the-fields','jade','Jade','ready','Broker-provided master list (validated), Jul 2026.'),
  ('the-fields','viridian','Viridian','ready','Broker-provided master list (validated), Jul 2026.'),
  ('the-fields','senses','Senses','ready','Broker-provided master list (validated), Jul 2026.'),
  ('meydan-gardens','grand-views','Grand Views','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('meydan-gardens','polo-townhouses','Polo Townhouses','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('meydan-gardens','polo-residences','Polo Residences','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('tilal-al-ghaf','aura','Aura','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('tilal-al-ghaf','alaya-gardens','Alaya Gardens','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('tilal-al-ghaf','elysian-mansions','Elysian Mansions','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('tilal-al-ghaf','lanai-islands','Lanai Islands','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('tilal-al-ghaf','serenity-mansions','Serenity Mansions','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('haven-by-aldar','oasis-villas','Oasis Villas','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('haven-by-aldar','falls-townhouses','Falls Townhouses','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('haven-by-aldar','glade-townhouses','Glade Townhouses','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('haven-by-aldar','ferns-townhouses','Ferns Townhouses','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('azizi-venice','venice-villas','Venice Villas','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('azizi-venice','waterfront-mansions','Waterfront Mansions','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('azizi-venice','sky-villas','Sky Villas','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('town-square','safi','Safi','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('town-square','noor','Noor','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('town-square','sama','Sama','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('town-square','maha','Maha','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('town-square','reem','Reem','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('town-square','alton','Alton','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('town-square','rosewell','Rosewell','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('al-barari','jasmine','Jasmine','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('al-barari','desert-leaf','Desert Leaf','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('al-barari','silk-leaf','Silk Leaf','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('al-barari','bromellia','Bromellia','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('al-barari','camellia','Camellia','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('al-barari','lunaria','Lunaria','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('jumeirah-golf-estates','whispering-pines','Whispering Pines','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('jumeirah-golf-estates','flame-tree-ridge','Flame Tree Ridge','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('jumeirah-golf-estates','wildflower','Wildflower','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('jumeirah-golf-estates','sanctuary-falls','Sanctuary Falls','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('jumeirah-golf-estates','olive-point','Olive Point','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('jumeirah-golf-estates','sienna-lakes','Sienna Lakes','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('jumeirah-golf-estates','sienna-views','Sienna Views','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('jumeirah-golf-estates','lime-tree-valley','Lime Tree Valley','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('jumeirah-golf-estates','jumeirah-luxury','Jumeirah Luxury','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('jumeirah-golf-estates','redwood-avenue','Redwood Avenue','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('jumeirah-golf-estates','redwood-villas','Redwood Villas','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('jumeirah-golf-estates','terra-golf-collection','Terra Golf Collection','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('jumeirah-golf-estates','jouri-hills-by-arada','Jouri Hills by Arada','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('victory-heights','olivia','Olivia','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('victory-heights','calida','Calida','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('victory-heights','carmen','Carmen','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('victory-heights','fortuna','Fortuna','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('victory-heights','marbella','Marbella','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('green-community-motor-city','casa-flores','Casa Flores','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('the-pulse','south-village','South Village','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('falcon-city','western-autograph','Western Autograph','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('falcon-city','aegean','Aegean','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('falcon-city','andalusia','Andalusia','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('falcon-city','new-world','New World','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('falcon-city','santa-fe','Santa Fe','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('the-sustainable-city','cluster-1','Cluster 1','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('the-sustainable-city','cluster-2','Cluster 2','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('the-sustainable-city','cluster-3','Cluster 3','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('the-sustainable-city','cluster-4','Cluster 4','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('the-sustainable-city','cluster-5','Cluster 5','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('rukan','rukan-villas','Rukan Villas','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('rukan','bianca-townhouses','Bianca Townhouses','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('living-legends','type-a','Type A','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('living-legends','type-b','Type B','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('living-legends','type-c','Type C','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('living-legends','type-d','Type D','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('living-legends','type-e','Type E','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('villa-lantana','villa-lantana-1','Villa Lantana 1','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('villa-lantana','villa-lantana-2','Villa Lantana 2','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('expo-city','expo-valley','Expo Valley','offplan','Broker-provided master list (validated), Jul 2026.'),
  ('expo-city','shamsa-townhouses','Shamsa Townhouses','offplan','Broker-provided master list (validated), Jul 2026.'),
  ('expo-city','yasmina-villas','Yasmina Villas','offplan','Broker-provided master list (validated), Jul 2026.'),
  ('dubai-silicon-oasis','cedre-villas-dso','Cedre Villas DSO','ready','Broker-provided master list (validated), Jul 2026.'),
  ('dubai-silicon-oasis','semmer-villas','Semmer Villas','ready','Broker-provided master list (validated), Jul 2026.'),
  ('amali-island','avatea','Avatea','offplan','Broker-provided master list (validated), Jul 2026.'),
  ('amali-island','aria','Aria','offplan','Broker-provided master list (validated), Jul 2026.'),
  ('amali-island','aurora','Aurora','offplan','Broker-provided master list (validated), Jul 2026.'),
  ('amali-island','amorino','Amorino','offplan','Broker-provided master list (validated), Jul 2026.'),
  ('the-world-islands','germany-island','Germany Island','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('the-world-islands','sweden-palace','Sweden Palace','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('the-world-islands','floating-seahorse','Floating Seahorse','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('rashid-yachts-marina','seascape','Seascape','offplan','Broker-provided master list (validated), Jul 2026.'),
  ('rashid-yachts-marina','sunridge','Sunridge','offplan','Broker-provided master list (validated), Jul 2026.'),
  ('rashid-yachts-marina','sirius','Sirius','offplan','Broker-provided master list (validated), Jul 2026.'),
  ('rashid-yachts-marina','marina-views','Marina Views','offplan','Broker-provided master list (validated), Jul 2026.'),
  ('dubai-creek-harbour','creek-horizon','Creek Horizon','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('dubai-creek-harbour','harbour-gate','Harbour Gate','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('dubai-creek-harbour','creek-beach','Creek Beach','mixed','Broker-provided master list (validated), Jul 2026.'),
  ('dubai-creek-harbour','creek-waters','Creek Waters','mixed','Broker-provided master list (validated), Jul 2026.')
) as v(comm, slug, name, status, note)
on conflict (community_id, slug) do update set
  name=excluded.name, status=excluded.status,
  data_confidence=excluded.data_confidence, source_note=excluded.source_note;


-- =====================================================================
-- 0022 — Map coordinates for the new masters
-- Fills geo_center for the communities added in 0019–0021 so every villa/
-- townhouse community pins on the map. Approximate district centroids
-- (WGS84); refine per master plan later. Idempotent.
-- =====================================================================

update communities set geo_center = ST_SetSRID(ST_MakePoint(55.2676,25.0498),4326)::geography where slug = 'arabian-ranches';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.18,25.22),4326)::geography where slug = 'amali-island';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.3,24.95),4326)::geography where slug = 'bayn';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.245,25.192),4326)::geography where slug = 'dar-wasl';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.348,25.202),4326)::geography where slug = 'dubai-creek-harbour';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.378,25.121),4326)::geography where slug = 'dubai-silicon-oasis';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.33,25.15),4326)::geography where slug = 'eden-hills';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.151,24.96),4326)::geography where slug = 'expo-city';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.29,25.0),4326)::geography where slug = 'ghaf-woods';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.31,25.16),4326)::geography where slug = 'keturah-reserve';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.312,25.165),4326)::geography where slug = 'mag-city';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.33,25.155),4326)::geography where slug = 'opal-gardens';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.273,25.283),4326)::geography where slug = 'rashid-yachts-marina';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.42,25.215),4326)::geography where slug = 'shorooq';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.34,25.16),4326)::geography where slug = 'sobha-sanctuary';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.245,25.235),4326)::geography where slug = 'sur-la-mer';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.33,25.16),4326)::geography where slug = 'the-fields';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.35,24.92),4326)::geography where slug = 'the-heights-country-club';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.33,25.15),4326)::geography where slug = 'the-sanctuary-ellington';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.165,25.225),4326)::geography where slug = 'the-world-islands';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.25,25.2),4326)::geography where slug = 'wasl-51';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.245,25.185),4326)::geography where slug = 'wasl-square';


-- =====================================================================
-- 0023 — Dubai Hills Estate: PhD-depth dossier (flagship villa/TH clusters)
--
-- Deepens the Dubai Hills Estate exemplar from backbone → dossier: real,
-- developer-published unit configurations for the flagship villa and
-- townhouse product lines (Sidra, Maple, Golf Place, Parkway Vistas).
--
-- Data discipline: every figure here is a NON-VOLATILE developer spec
-- (bedroom counts, built-up-area configurations) published by Emaar and
-- corroborated across portals — NOT a market price. Prices stay NULL: those
-- come only from DLD-registered transactions. Provenance is recorded on each
-- sub-community (data_confidence='high', source_note cites Emaar).
--
-- Sources (verified Jul 2026):
--   Sidra        — properties.emaar.com/en/properties/sidra (3–5BR, ~3,100–4,283 sqft)
--   Maple        — properties.emaar.com/en/properties/maple (3–5BR TH, ~2,228–2,700 sqft)
--   Golf Place   — properties.emaar.com/en/properties/golf-place (4–6BR, ~5,126–9,991 sqft)
--   Parkway Vistas — Emaar / ecm.ae (6–7BR, ~8,286–9,212 sqft)
--
-- Idempotent: sub-community updates are set-based; unit archetypes upsert on
-- a (sub_community_id, name) unique index. Safe to run repeatedly.
-- =====================================================================

-- Community-level provenance (description already seeded in seed_dubai_hills.sql).
update communities set
  data_confidence = 'high',
  source_note = 'Emaar master-community facts + published cluster configurations (properties.emaar.com), verified Jul 2026.',
  updated_at = now()
where slug = 'dubai-hills-estate';

-- ---------------------------------------------------------------------
-- Flagship cluster descriptions + provenance (sourced developer specs).
-- ---------------------------------------------------------------------
update sub_communities s set
  description_long = v.descr,
  who_its_for_base = coalesce(s.who_its_for_base, v.who),
  is_placeholder = false,
  data_confidence = 'high',
  source_note = 'Emaar published villa/townhouse configurations (properties.emaar.com), verified Jul 2026.',
  updated_at = now()
from (values
  ('sidra-1',
   'Sidra is Dubai Hills'' contemporary detached-villa line — 3–5 bedroom homes of roughly 3,100–4,283 sq ft built-up area, each with a maid''s room, covered parking and a private garden, arranged around landscaped streets and pocket parks within walking reach of Dubai Hills Park and the estate''s schools.',
   'Families wanting a modern, move-in villa in an established, amenity-rich setting close to central Dubai.'),
  ('sidra-2',
   'Sidra Phase 2 — contemporary 3–5 bedroom detached villas (~3,100–4,283 sq ft BUA) with maid''s room, covered parking and private garden, continuing the Sidra product line deeper into the community.',
   'Families wanting a modern, move-in villa in an established, amenity-rich setting close to central Dubai.'),
  ('sidra-3',
   'Sidra Phase 3 — the newest run of the Sidra 3–5 bedroom detached-villa line (~3,100–4,283 sq ft BUA), maid''s room, covered parking and garden, on landscaped streets near the park and schools.',
   'Families wanting a modern, move-in villa in an established, amenity-rich setting close to central Dubai.'),
  ('maple-1',
   'Maple is Dubai Hills'' flagship townhouse line — contemporary 3–5 bedroom townhouses of roughly 2,228–2,700 sq ft built-up area, each with a maid''s room, two covered parking bays and a private garden, set along tree-lined family streets.',
   'Families and end-users wanting a townhouse entry into the Dubai Hills address with parks and schools on the doorstep.'),
  ('maple-2',
   'Maple Phase 2 — contemporary 3–5 bedroom townhouses (~2,228–2,700 sq ft BUA) with maid''s room, two covered parking bays and a private garden.',
   'Families and end-users wanting a townhouse entry into the Dubai Hills address with parks and schools on the doorstep.'),
  ('maple-3',
   'Maple Phase 3 — the newest Maple townhouses, 3–5 bedrooms (~2,228–2,700 sq ft BUA), maid''s room, two covered parking bays and private garden, in a tree-lined setting.',
   'Families and end-users wanting a townhouse entry into the Dubai Hills address with parks and schools on the doorstep.'),
  ('golf-place-i',
   'Golf Place is Dubai Hills'' premium golf-fronting collection — detached 4–6 bedroom villas of roughly 5,126–9,991 sq ft built-up area in contemporary, elegant and modern architectural styles, with expansive terraces overlooking the championship fairways.',
   'Buyers prioritising prestige and golf-course positioning within an established, blue-chip Emaar address.'),
  ('golf-place-ii',
   'Golf Place II — the second phase of the golf-fronting collection: 4–6 bedroom detached villas (~5,126–9,991 sq ft BUA) in three architectural styles, fronting or overlooking the Dubai Hills championship course.',
   'Buyers prioritising prestige and golf-course positioning within an established, blue-chip Emaar address.'),
  ('parkway-vistas',
   'Parkway Vistas is the estate''s large-format villa enclave — 6–7 bedroom homes of roughly 8,286–9,212 sq ft built-up area in classic and modern styles, positioned at the heart of the community beside Dubai Hills Golf Club.',
   'Large families and prestige buyers wanting a substantial detached home in the most central part of the estate.')
) as v(slug, descr, who)
where s.slug = v.slug
  and s.community_id = (select id from communities where slug = 'dubai-hills-estate');

-- ---------------------------------------------------------------------
-- Unit archetypes (developer-published configurations). Idempotent upsert.
-- ---------------------------------------------------------------------
create unique index if not exists ux_unit_archetypes_sub_name
  on unit_archetypes (sub_community_id, name) where name is not null;

with sc as (
  select s.id, s.slug
  from sub_communities s
  where s.community_id = (select id from communities where slug = 'dubai-hills-estate')
)
insert into unit_archetypes
  (sub_community_id, name, unit_type, bedrooms, bua_sqft, completion_status,
   has_garden, parking_spaces, config_flags)
select sc.id, v.name, v.unit_type::unit_type, v.bedrooms, v.bua_sqft,
       v.completion::status_tag, v.has_garden, v.parking, v.flags::jsonb
from (values
  -- Sidra villas (3–5BR) — applied to each Sidra phase
  ('sidra-1','Sidra — 3BR Villa','villa',3, 3100::numeric,'ready',true, null::int,'{"maids":true}'),
  ('sidra-1','Sidra — 4BR Villa','villa',4, 3237,'ready',true, null,'{"maids":true}'),
  ('sidra-1','Sidra — 5BR Villa','villa',5, 3757,'ready',true, null,'{"maids":true}'),
  ('sidra-2','Sidra — 3BR Villa','villa',3, 3100,'ready',true, null,'{"maids":true}'),
  ('sidra-2','Sidra — 4BR Villa','villa',4, 3237,'ready',true, null,'{"maids":true}'),
  ('sidra-2','Sidra — 5BR Villa','villa',5, 3757,'ready',true, null,'{"maids":true}'),
  ('sidra-3','Sidra — 3BR Villa','villa',3, 3100,'ready',true, null,'{"maids":true}'),
  ('sidra-3','Sidra — 4BR Villa','villa',4, 3237,'ready',true, null,'{"maids":true}'),
  ('sidra-3','Sidra — 5BR Villa','villa',5, 3757,'ready',true, null,'{"maids":true}'),
  -- Maple townhouses (3–5BR) — two covered parking bays
  ('maple-1','Maple — 3BR Townhouse','townhouse',3, 2228,'ready',true, 2,'{"maids":true}'),
  ('maple-1','Maple — 4BR Townhouse','townhouse',4, 2387,'ready',true, 2,'{"maids":true}'),
  ('maple-1','Maple — 5BR Townhouse','townhouse',5, 2700,'ready',true, 2,'{"maids":true}'),
  ('maple-2','Maple — 3BR Townhouse','townhouse',3, 2228,'ready',true, 2,'{"maids":true}'),
  ('maple-2','Maple — 4BR Townhouse','townhouse',4, 2387,'ready',true, 2,'{"maids":true}'),
  ('maple-2','Maple — 5BR Townhouse','townhouse',5, 2700,'ready',true, 2,'{"maids":true}'),
  ('maple-3','Maple — 3BR Townhouse','townhouse',3, 2228,'ready',true, 2,'{"maids":true}'),
  ('maple-3','Maple — 4BR Townhouse','townhouse',4, 2387,'ready',true, 2,'{"maids":true}'),
  ('maple-3','Maple — 5BR Townhouse','townhouse',5, 2700,'ready',true, 2,'{"maids":true}'),
  -- Golf Place villas (4–6BR) — BUA bounds sourced (5,126 low / 9,991 high); 5BR left null
  ('golf-place-i','Golf Place — 4BR Villa','villa',4, 5126,'ready',true, null,'{}'),
  ('golf-place-i','Golf Place — 5BR Villa','villa',5, null,'ready',true, null,'{}'),
  ('golf-place-i','Golf Place — 6BR Villa','villa',6, 9991,'ready',true, null,'{}'),
  ('golf-place-ii','Golf Place — 4BR Villa','villa',4, 5126,'ready',true, null,'{}'),
  ('golf-place-ii','Golf Place — 5BR Villa','villa',5, null,'ready',true, null,'{}'),
  ('golf-place-ii','Golf Place — 6BR Villa','villa',6, 9991,'ready',true, null,'{}'),
  -- Parkway Vistas villas (6–7BR)
  ('parkway-vistas','Parkway Vistas — 6BR Villa','villa',6, 8286,'mixed',true, null,'{"maids":true}'),
  ('parkway-vistas','Parkway Vistas — 7BR Villa','villa',7, 9212,'mixed',true, null,'{"maids":true}')
) as v(scslug, name, unit_type, bedrooms, bua_sqft, completion, has_garden, parking, flags)
join sc on sc.slug = v.scslug
on conflict (sub_community_id, name) where name is not null
do update set
  unit_type         = excluded.unit_type,
  bedrooms          = excluded.bedrooms,
  bua_sqft          = excluded.bua_sqft,
  completion_status = excluded.completion_status,
  has_garden        = excluded.has_garden,
  parking_spaces    = excluded.parking_spaces,
  config_flags      = excluded.config_flags,
  updated_at        = now();


-- =====================================================================
-- 0024 — Community dossier depth, batch 1 (highest-liquidity communities)
--
-- Sourced, non-volatile community-level facts (description, master-plan
-- anchors, product bedroom/size ranges, positioning, handover status) for the
-- six most-transacted villa/townhouse communities. Developer/portal-sourced,
-- verified Jul 2026. No prices or invented figures — market numbers stay in
-- market_snapshots (DLD). Idempotent: UPDATE by slug.
-- =====================================================================

update communities set
  description_long = 'The Valley is Emaar''s family-oriented master community on the Dubai–Al Ain Road (E66), launched in 2019 and built around a Golden Beach, landscaped pavilions and a planned Town Centre. Its product is 3–4 bedroom townhouses (roughly 1,988–2,311 sq ft), semi-detached 4–5 bedroom villas, and larger standalone villas in the newer Phase-2 clusters, which carry larger plots and a more premium positioning. A gated, low-rise, green community aimed at value-conscious end-user families reaching for the Emaar brand outside the central corridor.',
  who_its_for_base = 'Value-conscious end-user families who want a new, gated, green Emaar townhouse/villa community with resort-style amenities, accepting a further-out location on the Al Ain Road for a lower entry price.',
  age_or_handover = 'Master community launched 2019 · Phase-1 clusters (Eden, Talia, Nara, Alana) handed over / near handover; Phase 2 to 2028–2030',
  positioning_tier = 'mid',
  master_plan_features = '["Golden Beach & swimmable water feature","The Pavilion (gardens & relaxation)","Sports Village (cycling & fitness tracks)","Kids'' Dale adventure playgrounds","Planned Town Centre retail & dining","Dubai–Al Ain Road (E66) access"]'::jsonb,
  is_placeholder = false,
  data_confidence = 'high',
  source_note = 'Emaar published community facts + master-plan (developer site & major portals), verified Jul 2026.',
  updated_at = now()
where slug = 'the-valley';

update communities set
  description_long = 'Arabian Ranches 3 is Emaar''s third-generation Ranches master community in Dubailand — over 4,000 villas and townhouses in 3–5 bedroom configurations across themed clusters (Sun, Joy, Ruba, Bliss, Caya, Spring, Anya, May, June, Raya and the Elie Saab villa line). It centres on a ~7.5-acre central park with a cycling track, cricket field, sports courts, skate park and adventure zones, with schools, a mosque and a shopping plaza planned within the community. A contemporary, amenity-dense family address that extends the blue-chip Ranches brand.',
  who_its_for_base = 'Families wanting a modern, amenity-rich gated Emaar villa/townhouse community with a strong central park and the established Arabian Ranches pedigree.',
  age_or_handover = 'Phased handovers from ~2022; several clusters delivered, newer clusters ongoing',
  positioning_tier = 'premium',
  master_plan_features = '["~7.5-acre central park","Cycling track & cricket field","15+ sports courts, skate park, parkour","Themed architectural clusters","Community schools, mosque & shopping plaza"]'::jsonb,
  is_placeholder = false,
  data_confidence = 'high',
  source_note = 'Emaar published community facts + master-plan (developer site & major portals), verified Jul 2026.',
  updated_at = now()
where slug = 'arabian-ranches-3';

update communities set
  description_long = 'DAMAC Lagoons is a 45-million-sq-ft villa-and-townhouse master community in Dubailand built around man-made crystal lagoons and water features, with Mediterranean-themed clusters — Santorini, Costa Brava, Nice, Portofino, Venice, Malta, Marbella, Morocco, Monte Carlo, Mykonos and Ibiza — each with a distinct architectural language. Product spans 4–7 bedroom townhouses and villas (no apartments), a deliberate lower-density, family-and-space positioning. Early clusters were delivered in Q4 2024 with remaining phases handing over through ~2027.',
  who_its_for_base = 'Families and investors seeking a themed, water-led townhouse/villa community at an accessible-to-mid entry price, with a large amenity spine and strong off-plan supply.',
  age_or_handover = '45M sq ft master plan; early clusters (Portofino, Nice, Costa Brava) delivered Q4 2024; remaining phases through ~2027',
  positioning_tier = 'mid',
  master_plan_features = '["Crystal lagoons & beaches across clusters","Mediterranean-themed cluster architecture","Villa/townhouse only (no apartments)","Central retail & dining spine","Community parks & water sports"]'::jsonb,
  is_placeholder = false,
  data_confidence = 'high',
  source_note = 'DAMAC published community facts + master-plan (developer site & major portals), verified Jul 2026.',
  updated_at = now()
where slug = 'damac-lagoons';

update communities set
  description_long = 'Emaar South is Emaar''s master community in Dubai South, adjacent to Al Maktoum International Airport (DWC) and the Expo district, arranged around an 18-hole championship golf course. The masterplan spans 15,000+ homes — 1–3 bedroom apartments, 3-bedroom townhouses, and 4–5 bedroom golf-fronting villas (Golf Links, Golf Links, Golf Lane and related lines) — with retail, community parks and a planned branded hotel. Positioned as an accessible-to-mid golf-and-airport growth corridor with strong off-plan supply.',
  who_its_for_base = 'Investors and end-users betting on the Dubai South / Al Maktoum airport growth corridor who want golf-fronting Emaar villas or townhouses at a lower entry price than central Dubai.',
  age_or_handover = 'Master plan around an 18-hole golf course; townhouse phases delivered, many villa clusters off-plan with handovers ~2026–2029',
  positioning_tier = 'mid',
  master_plan_features = '["18-hole championship golf course","Adjacent to Al Maktoum Intl (DWC) & Expo City","Golf-fronting villa collections","Community parks & retail","Planned branded hotel"]'::jsonb,
  is_placeholder = false,
  data_confidence = 'high',
  source_note = 'Emaar published community facts + master-plan (developer site & major portals), verified Jul 2026.',
  updated_at = now()
where slug = 'emaar-south';

update communities set
  description_long = 'DAMAC Islands is a 30-million-sq-ft island-inspired master community in Dubailand, launched in November 2024 with six tropical-themed clusters — Maldives, Bora Bora, Fiji, Seychelles, Bali and Hawaii. Current releases centre on 4–5 bedroom townhouses and villas (roughly 2,200–5,000+ sq ft) plus larger 6–7 bedroom luxury villas, wrapped in crystal lagoons, private beaches, an aqua dome, wave pools, a wellness spa and a clubhouse. Its Phase-1 launch sold out in 24 hours for AED 10.2bn, a Guinness record for a single-day real-estate launch.',
  who_its_for_base = 'Off-plan investors and space-seeking families drawn to a resort-themed, waterfront DAMAC community with record launch momentum and a full-amenity island concept.',
  age_or_handover = 'Launched Nov 2024 (Phase 1 sold out in 24h — Guinness record AED 10.2B); off-plan, handovers from ~2028',
  positioning_tier = 'premium',
  master_plan_features = '["Six tropical-themed clusters","Crystal lagoons & private beaches","Aqua dome, wave pools & wellness spa","Villa/townhouse resort concept","Record-setting launch demand"]'::jsonb,
  is_placeholder = false,
  data_confidence = 'high',
  source_note = 'DAMAC published community facts + master-plan (developer site & major portals), verified Jul 2026.',
  updated_at = now()
where slug = 'damac-islands';

update communities set
  description_long = 'DAMAC Hills 2 (formerly Akoya Oxygen) is a self-contained 42-million-sq-ft DAMAC master community in Dubailand with 3–6 bedroom villas and townhouses — 3-bedroom townhouses roughly 1,232–1,979 sq ft and 4-bedroom townhouses roughly 2,352–3,369 sq ft, many with maid''s rooms, rooftop terraces and private gardens. It is organised around five themed leisure zones (Motor Town, Water Town, Down Town, Equestrian Town, Sports Town) plus a Malibu Beach wave pool, floating cinema and fishing lake. Dubai''s most affordable large villa/townhouse address, favoured for high rental yield and accessible entry pricing.',
  who_its_for_base = 'Yield-focused investors and first-rung villa buyers who want the lowest entry price into a full-amenity DAMAC villa/townhouse community, accepting the far-out Dubailand location.',
  age_or_handover = '42M sq ft master community (formerly Akoya Oxygen); largely delivered with ongoing releases',
  positioning_tier = 'accessible',
  master_plan_features = '["Five themed leisure zones (Motor/Water/Down/Equestrian/Sports Town)","Malibu Beach wave pool & Splash Pad","Floating cinema & fishing lake","3–6 BR villas & townhouses","Dubai''s most accessible large villa community"]'::jsonb,
  is_placeholder = false,
  data_confidence = 'high',
  source_note = 'DAMAC published community facts + master-plan (developer site & major portals), verified Jul 2026.',
  updated_at = now()
where slug = 'damac-hills-2';
