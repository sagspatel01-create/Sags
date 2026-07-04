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
