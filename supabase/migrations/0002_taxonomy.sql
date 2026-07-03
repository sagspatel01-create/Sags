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
