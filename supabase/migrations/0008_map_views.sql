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
