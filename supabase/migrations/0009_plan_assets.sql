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
