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
