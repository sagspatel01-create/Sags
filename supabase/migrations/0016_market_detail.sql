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
