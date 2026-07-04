-- =====================================================================
-- Dubai Villa & Townhouse Intelligence Engine — FULL SETUP (one paste)
-- Paste this whole file into the Supabase SQL editor and run once.
-- It applies all migrations (0001-0011) then loads the seeds.
-- Safe to re-run: seeds are idempotent; migrations use IF NOT EXISTS
-- where practical. If a CREATE TYPE/TABLE errors on a second run,
-- the schema already exists — you can ignore those specific errors.
-- =====================================================================


-- >>>>> supabase/migrations/0001_init_extensions_enums.sql

-- =====================================================================
-- 0001 — Extensions & enums
-- Dubai Villa & Townhouse Intelligence Engine
-- =====================================================================

-- PostGIS for geo boundaries, points, distance/commute work (Phase 2+).
create extension if not exists postgis;
-- gen_random_uuid()
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Enums (shared vocabulary — every level tagged Ready/Offplan/Mixed)
-- ---------------------------------------------------------------------

-- Ready / Offplan / Mixed status, used at every taxonomy level.
create type status_tag as enum ('ready', 'offplan', 'mixed');

-- Villa vs townhouse.
create type unit_type as enum ('villa', 'townhouse');

-- Kitchen configuration (a first-class, comparable listing field).
create type kitchen_type as enum ('open', 'closed', 'semi_open');

-- Furnishing status (mirrors Bayut/PF listing field).
create type furnishing_status as enum ('unfurnished', 'semi_furnished', 'furnished');

-- Buyer type for the client profile that drives tailoring.
create type buyer_type as enum ('family', 'investor', 'enduser');

-- Positioning tier — the luxury-first delivery order (AED 5M+ prioritised).
create type positioning_tier as enum ('ultra_prime', 'prime', 'premium', 'mid', 'accessible');

-- ---------------------------------------------------------------------
-- Shared trigger: keep updated_at fresh on every row update.
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- >>>>> supabase/migrations/0002_taxonomy.sql

-- =====================================================================
-- 0002 — Four-level taxonomy
-- developer → master community → sub-community → unit archetype
-- ALL market data resolves to the sub-community level.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Developers (Emaar, Nakheel/Meraas, MAF, DAMAC, Binghatti, Danube,
-- Aldar, custom e.g. Pearl Jumeirah)
-- ---------------------------------------------------------------------
create table developers (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null unique,
  slug                  text not null unique,
  track_record_notes    text,
  delivery_reputation   text,
  logo_url              text,
  website_url           text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create trigger trg_developers_updated before update on developers
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Master communities (e.g. Dubai Hills Estate)
-- ---------------------------------------------------------------------
create table communities (
  id                    uuid primary key default gen_random_uuid(),
  developer_id          uuid references developers(id) on delete set null,
  name                  text not null,
  slug                  text not null unique,
  status                status_tag not null default 'mixed',
  positioning_tier      positioning_tier,
  age_or_handover       text,                       -- free text: "Handover 2019", "Offplan, 2027"
  sub_community_count   integer,                     -- first-class field (how many sub-communities)
  villa_count           integer,
  townhouse_count       integer,
  total_units           integer,
  master_plan_features  jsonb not null default '[]'::jsonb,
  description_long      text,
  who_its_for_base      text,                        -- Layer 1 base buyer profile
  hero_image_url        text,
  geo_center            geography(Point, 4326),      -- map marker
  geo_boundary          geometry(MultiPolygon, 4326),-- optional master-plan outline
  is_placeholder        boolean not null default true, -- skeleton page vs depth-filled
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index communities_developer_idx on communities(developer_id);
create index communities_geo_center_idx on communities using gist(geo_center);
create trigger trg_communities_updated before update on communities
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Sub-communities (e.g. Sidra, Maple; Santorini, Costa Brava)
-- All market data resolves here.
-- ---------------------------------------------------------------------
create table sub_communities (
  id                    uuid primary key default gen_random_uuid(),
  community_id          uuid not null references communities(id) on delete cascade,
  name                  text not null,
  slug                  text not null,
  status                status_tag not null default 'mixed',
  villa_count           integer,
  townhouse_count       integer,
  total_units           integer,
  description_long      text,
  who_its_for_base      text,                        -- Layer 1 base buyer profile
  hero_image_url        text,
  geo_center            geography(Point, 4326),
  geo_boundary          geometry(MultiPolygon, 4326),
  is_placeholder        boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (community_id, slug)
);
create index sub_communities_community_idx on sub_communities(community_id);
create index sub_communities_geo_center_idx on sub_communities using gist(geo_center);
create trigger trg_sub_communities_updated before update on sub_communities
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Phases (sub-communities are released in phases; track the price-journey)
-- ---------------------------------------------------------------------
create table phases (
  id                      uuid primary key default gen_random_uuid(),
  sub_community_id        uuid not null references sub_communities(id) on delete cascade,
  phase_name              text not null,
  status                  status_tag not null default 'offplan',
  launch_date             date,
  launch_price_per_sqft   numeric(12,2),             -- phase launch price
  current_price_per_sqft  numeric(12,2),             -- current price (the journey)
  units_in_phase          integer,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index phases_sub_community_idx on phases(sub_community_id);
create trigger trg_phases_updated before update on phases
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Unit archetypes (villa/townhouse type within a sub-community).
-- Fields grouped to mirror Bayut/PF listing categories:
-- basics / areas / layout & features / financials / position.
-- ---------------------------------------------------------------------
create table unit_archetypes (
  id                    uuid primary key default gen_random_uuid(),
  sub_community_id      uuid not null references sub_communities(id) on delete cascade,
  phase_id              uuid references phases(id) on delete set null,
  name                  text,                          -- e.g. "Type 3 / 4BR Villa"

  -- basics
  unit_type             unit_type not null,
  bedrooms              integer,
  bathrooms             integer,
  furnishing            furnishing_status,
  completion_status     status_tag,

  -- areas
  bua_sqft              numeric(12,2),
  plot_sqft             numeric(12,2),
  internal_sqft         numeric(12,2),
  external_sqft         numeric(12,2),

  -- layout & features
  kitchen_type          kitchen_type,
  config_flags          jsonb not null default '{}'::jsonb, -- {maids, drivers, study, storage}
  floors                integer,
  parking_spaces        integer,
  view_orientation      text,                          -- park, golf, lagoon, community
  has_pool              boolean,
  has_garden            boolean,
  has_balcony           boolean,

  -- financials
  price                 numeric(14,2),
  service_charge_per_sqft numeric(10,2),               -- standard Bayut/PF field
  condition             text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index unit_archetypes_sub_community_idx on unit_archetypes(sub_community_id);
create index unit_archetypes_phase_idx on unit_archetypes(phase_id);
create trigger trg_unit_archetypes_updated before update on unit_archetypes
  for each row execute function set_updated_at();


-- >>>>> supabase/migrations/0003_market_data.sql

-- =====================================================================
-- 0003 — Market data (all resolves to sub-community level)
-- Ready = transaction-led. Offplan = absorption/momentum-based.
-- Rolling trailing-6-month window drives the active/headline figures.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Transactions (DLD backbone). Active views use the trailing 6 months;
-- older rows retained for trend lines.
-- ---------------------------------------------------------------------
create table transactions (
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
create index transactions_sub_community_idx on transactions(sub_community_id);
create index transactions_date_idx on transactions(transaction_date desc);

-- ---------------------------------------------------------------------
-- Listings (Bayut / PF live listings — the checkout / last step).
-- ---------------------------------------------------------------------
create table listings (
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
create index listings_sub_community_idx on listings(sub_community_id);

-- ---------------------------------------------------------------------
-- Weekly price history (trend lines; feeds the trailing-6-month read).
-- ---------------------------------------------------------------------
create table price_history (
  id                  uuid primary key default gen_random_uuid(),
  sub_community_id    uuid not null references sub_communities(id) on delete cascade,
  unit_type           unit_type,
  week_start_date     date not null,
  avg_price_per_sqft  numeric(12,2),
  median_price        numeric(14,2),
  transaction_count   integer,
  created_at          timestamptz not null default now()
);
create index price_history_sub_community_idx on price_history(sub_community_id);
create index price_history_week_idx on price_history(week_start_date desc);

-- ---------------------------------------------------------------------
-- Capital growth (appreciation over a named period).
-- ---------------------------------------------------------------------
create table capital_growth (
  id                  uuid primary key default gen_random_uuid(),
  sub_community_id    uuid not null references sub_communities(id) on delete cascade,
  unit_type           unit_type,
  period              text,                    -- '3m' | '6m' | '1y' | '3y'
  pct_change          numeric(8,2),
  calculated_at       timestamptz not null default now()
);
create index capital_growth_sub_community_idx on capital_growth(sub_community_id);

-- ---------------------------------------------------------------------
-- Rental data (yield). Ready-community story.
-- ---------------------------------------------------------------------
create table rental_data (
  id                  uuid primary key default gen_random_uuid(),
  sub_community_id    uuid not null references sub_communities(id) on delete cascade,
  unit_type           unit_type,
  achieved_rent       numeric(12,2),
  gross_yield_pct     numeric(6,2),
  source              text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index rental_data_sub_community_idx on rental_data(sub_community_id);
create trigger trg_rental_data_updated before update on rental_data
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Absorption (offplan momentum — units released vs sold, velocity,
-- launch-to-launch price movement). Numbers-based and active.
-- ---------------------------------------------------------------------
create table absorption (
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
create index absorption_sub_community_idx on absorption(sub_community_id);

-- ---------------------------------------------------------------------
-- Payment plans (offplan financing — the headline persuasion tool).
-- ---------------------------------------------------------------------
create table payment_plans (
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
create index payment_plans_community_idx on payment_plans(community_id);
create trigger trg_payment_plans_updated before update on payment_plans
  for each row execute function set_updated_at();


-- >>>>> supabase/migrations/0004_context.sql

-- =====================================================================
-- 0004 — Context & value drivers
-- schools, amenities, commute, infrastructure catalysts, documents
-- =====================================================================

-- ---------------------------------------------------------------------
-- Schools (KHDA). Standalone geo entities; matched to communities by
-- proximity at query time (Phase 2 pipeline).
-- ---------------------------------------------------------------------
create table schools (
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
create index schools_geo_idx on schools using gist(geo_point);
create trigger trg_schools_updated before update on schools
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Amenities (malls, hospitals, parks, POIs).
-- ---------------------------------------------------------------------
create table amenities (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  category            text,                     -- 'mall' | 'hospital' | 'park' | ...
  geo_point           geography(Point, 4326),
  created_at          timestamptz not null default now()
);
create index amenities_geo_idx on amenities using gist(geo_point);

-- ---------------------------------------------------------------------
-- Commute times (community → key hub, driving minutes).
-- ---------------------------------------------------------------------
create table commute_times (
  id                  uuid primary key default gen_random_uuid(),
  community_id        uuid not null references communities(id) on delete cascade,
  destination_name    text not null,            -- 'DIFC', 'DXB Airport', 'Dubai Mall'
  minutes_driving     integer,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index commute_times_community_idx on commute_times(community_id);
create trigger trg_commute_times_updated before update on commute_times
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Infrastructure projects (government spend / master-plan catalysts —
-- the value-driver story).
-- ---------------------------------------------------------------------
create table infrastructure_projects (
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
create index infrastructure_projects_geo_idx on infrastructure_projects using gist(geo_point);
create trigger trg_infrastructure_projects_updated before update on infrastructure_projects
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Documents (brochures, master plans) attached to a community or
-- sub-community. Stored in Supabase Storage; row keeps the reference.
-- ---------------------------------------------------------------------
create table documents (
  id                  uuid primary key default gen_random_uuid(),
  community_id        uuid references communities(id) on delete cascade,
  sub_community_id    uuid references sub_communities(id) on delete cascade,
  title               text not null,
  file_url            text,
  doc_type            text,                     -- 'brochure' | 'master_plan' | 'floorplan'
  created_at          timestamptz not null default now()
);
create index documents_community_idx on documents(community_id);
create index documents_sub_community_idx on documents(sub_community_id);


-- >>>>> supabase/migrations/0005_client_sources_config.sql

-- =====================================================================
-- 0005 — Client profiles, source registry, filter config, generated copy
-- The layers that make the tool tailor itself to the person on the call.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Client profiles — entered at session start; drive the tailored
-- experience (descriptions, emphasis, recommendation language).
-- ---------------------------------------------------------------------
create table client_profiles (
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
create trigger trg_client_profiles_updated before update on client_profiles
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Data sources — the swappable-module registry. Every external source
-- is a row here so one breaking never takes the app down. Phase 1 does
-- NOT run ingestion; this records what exists and its health/cadence.
-- ---------------------------------------------------------------------
create table data_sources (
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
create trigger trg_data_sources_updated before update on data_sources
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Filter definitions — config-driven filter framework so new filters
-- can be added without re-architecting (Milestone 6). Each row = one
-- filter; the UI renders from these.
-- ---------------------------------------------------------------------
create table filter_definitions (
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
create trigger trg_filter_definitions_updated before update on filter_definitions
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Generated content — stores Claude output: Layer-2 tailored copy,
-- comparison reports, exit one-pagers. Keyed to a client profile +
-- target entity so tailored copy persists across the session and can be
-- overridden by the owner.
-- ---------------------------------------------------------------------
create table generated_content (
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
create index generated_content_profile_idx on generated_content(client_profile_id);
create index generated_content_sub_community_idx on generated_content(sub_community_id);
create trigger trg_generated_content_updated before update on generated_content
  for each row execute function set_updated_at();


-- >>>>> supabase/migrations/0006_rls.sql

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
    execute format($f$
      create policy "authenticated_all_%1$s" on %1$I
        for all
        to authenticated
        using (true)
        with check (true);
    $f$, t);
  end loop;
end $$;


-- >>>>> supabase/migrations/0007_views.sql

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


-- >>>>> supabase/migrations/0008_map_views.sql

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


-- >>>>> supabase/migrations/0009_plan_assets.sql

-- =====================================================================
-- 0009 — Plan assets & interactive hotspots
-- The brochure experience: a master-plan image with clickable hotspots
-- that drill master plan -> phase/sub-community -> unit archetype/floor
-- plan. Assets live in Supabase Storage; rows here hold the reference,
-- natural dimensions, and the hotspot geometry (percent coordinates).
-- =====================================================================

create type plan_kind as enum (
  'master_plan', 'site_plan', 'floor_plan', 'brochure', 'gallery', 'other'
);
create type hotspot_shape as enum ('point', 'rect', 'polygon');
create type hotspot_target as enum (
  'community', 'sub_community', 'phase', 'unit_archetype', 'plan_asset', 'url'
);

-- ---------------------------------------------------------------------
-- Plan assets — one image (master plan, site plan, floor plan, …) that
-- can belong to a community, sub-community, phase, or unit archetype.
-- ---------------------------------------------------------------------
create table plan_assets (
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
create index plan_assets_community_idx on plan_assets(community_id);
create index plan_assets_sub_community_idx on plan_assets(sub_community_id);
create index plan_assets_phase_idx on plan_assets(phase_id);
create index plan_assets_unit_idx on plan_assets(unit_archetype_id);
create trigger trg_plan_assets_updated before update on plan_assets
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Hotspots — clickable regions on a plan asset. coords are percentages
-- (0-100) of the image: point {x,y}; rect {x,y,w,h}; polygon {points}.
-- ---------------------------------------------------------------------
create table plan_hotspots (
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
create index plan_hotspots_asset_idx on plan_hotspots(plan_asset_id);
create trigger trg_plan_hotspots_updated before update on plan_hotspots
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- RLS — authenticated-only, consistent with every other table.
-- ---------------------------------------------------------------------
alter table plan_assets enable row level security;
alter table plan_hotspots enable row level security;

create policy "authenticated_all_plan_assets" on plan_assets
  for all to authenticated using (true) with check (true);
create policy "authenticated_all_plan_hotspots" on plan_hotspots
  for all to authenticated using (true) with check (true);


-- >>>>> supabase/migrations/0010_storage.sql

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


-- >>>>> supabase/migrations/0011_character_tags.sql

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

-- >>>>> supabase/seed.sql

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

-- >>>>> supabase/seed_dubai_hills.sql

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

-- >>>>> supabase/seed_tags.sql

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

