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
