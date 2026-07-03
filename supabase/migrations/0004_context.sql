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
