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
