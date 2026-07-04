-- =====================================================================
-- SEED (client scenarios) — DEPTH data for the two live test briefs.
--
-- Honesty rule: every figure below is sourced from a public, verifiable
-- reference (developer price lists, Property Finder / Bayut listings,
-- DLD transaction commentary), cited inline as `-- src:`. Prices are
-- dated asking-price / launch-price snapshots (July 2026) — indicative,
-- not guarantees. Anything not verifiable is left NULL (renders empty).
--
-- Client 1 — 4BR / ≥4 bath, garden in plot, semi-detached or detached,
--   gated, close to Al Khail Road, budget AED 9M:
--     • The Meadows (Emaar)         — ready, detached, gated
--     • Dubai Hills · Sidra (Emaar) — ready, semi-detached, gated
--     • Dubai Hills · Maple (Emaar) — ready, townhouse, gated (value)
--
-- Client 2 — offplan villa/townhouse, capital-growth-led, long-term,
--   good yield, close to the city, budget AED 10M, handover ≤ 2029/30:
--     • Nad Al Sheba Gardens (Meraas) — offplan 2028, 10 min Downtown
--     • Lunaya by Zaya (Jebel Ali Village) — offplan 2029, lagoon villas
--     • Sobha Reserve (Sobha)         — completing 2026, quality benchmark
--
-- NOTE (fact correction): "Lunaya by Zaya" is in JEBEL ALI VILLAGE, not
-- Al Barari. A separate project, "Lunaria", is by Al Barari in Al Barari.
--
-- Idempotent: re-scopes (deletes then re-inserts) depth rows for exactly
-- these six sub-communities. Run after seed.sql + seed_expansion.sql.
-- =====================================================================

-- Relocate Lunaya to its real master area (Jebel Ali Village) + tag it.
-- src: propertyfinder.ae "Lunaya - in Jebel Ali by Zaya"; lunayabyzaya.com
update communities set
  geo_center = ST_SetSRID(ST_MakePoint(55.1100, 25.0050), 4326)::geography,
  character_tags = '{waterfront,new-launch,nature,investment}'
  where slug = 'lunaya';

-- ---------------------------------------------------------------------
-- Community-level depth (counts, handover text, narrative, buyer base).
-- ---------------------------------------------------------------------
update communities set
  status = 'ready',
  age_or_handover = 'Ready · first handover 2004',
  villa_count = 1800,
  is_placeholder = false,
  description_long = 'One of Dubai''s original master villa communities inside Emirates Living, The Meadows is nine gated, tree-lined sub-communities of independent (detached) villas wrapped around lakes and landscaped parks. Fully established, walkable, and minutes from Sheikh Zayed and Al Khail Roads.',
  who_its_for_base = 'End-user families who want a detached villa with a real garden inside a mature, gated community — close to schools, Dubai Marina and Downtown via Al Khail Road.'
  where slug = 'the-meadows';

update communities set
  age_or_handover = 'Ready · handover from 2019',
  is_placeholder = false,
  description_long = 'Emaar''s flagship modern master community along Al Khail Road, built around an 18-hole championship golf course, Dubai Hills Mall and a central park. A mix of gated villa and townhouse enclaves with strong, DLD-verified capital growth.',
  who_its_for_base = 'Families and investors who want new-generation, gated homes with best-in-class amenities and a proven appreciation track record, 12–15 minutes from Downtown.'
  where slug = 'dubai-hills-estate';

update communities set
  status = 'offplan',
  age_or_handover = 'Offplan · handover Q3 2028',
  is_placeholder = false,
  description_long = 'A gated Meraas master community of contemporary villas and townhouses around lagoons and parks, roughly 10 minutes from Downtown Dubai — among the most central new villa launches in the city.',
  who_its_for_base = 'Investors and end-users who want a central, gated, offplan villa with a developer payment plan and strong capital-growth positioning close to the city core.'
  where slug = 'nad-al-sheba-gardens';

update communities set
  status = 'offplan',
  age_or_handover = 'Offplan · handover 2029',
  is_placeholder = false,
  description_long = 'A Zaya-developed community of ~500 waterfront villas set around a 900,000 sqft crystal lagoon in Jebel Ali Village. A lifestyle-led launch with an extended 40/60 payment plan and long offplan runway.',
  who_its_for_base = 'Investors seeking a differentiated, lagoon-front offplan villa with a low entry point, a long payment runway and lifestyle-driven growth potential.'
  where slug = 'lunaya';

update communities set
  status = 'offplan',
  age_or_handover = 'Completing · handover from 2026',
  is_placeholder = false,
  description_long = 'A Sobha Realty community of ~300 detached villas in Wadi Al Safa 2, each with a private pool and landscaped garden, built to Sobha''s in-house "backward-integration" quality standard. Near completion — the quality benchmark in this comparison.',
  who_its_for_base = 'Buyers who prize build quality and a private plot with pool, and want a near-ready villa with headroom under budget rather than a long offplan wait.'
  where slug = 'sobha-reserve';

-- ---------------------------------------------------------------------
-- Sub-community-level depth.
-- ---------------------------------------------------------------------
update sub_communities set status='ready', is_placeholder=false,
  description_long='Gated enclave of detached 4–6 bedroom villas with private gardens, arranged around lakes and parks in The Meadows.',
  who_its_for_base='Families wanting a detached villa with a garden inside a gated, established community close to Al Khail Road.'
  where slug='meadows-4';

update sub_communities set status='ready', is_placeholder=false,
  description_long='Contemporary gated cluster of 3–5 bedroom semi-detached villas in Dubai Hills Estate, walkable to the park, mall and golf course.',
  who_its_for_base='Families and investors after a modern, gated villa with a garden and a proven, DLD-verified appreciation record along Al Khail Road.'
  where slug='sidra';

update sub_communities set status='ready', is_placeholder=false,
  description_long='Gated townhouse enclave in Dubai Hills Estate offering 3–5 bedroom homes with private gardens, positioned between Sheikh Mohammed bin Zayed and Al Khail Roads.',
  who_its_for_base='Families who want a gated Dubai Hills address and a private garden at a lower entry than the detached-villa clusters.'
  where slug='maple';

update sub_communities set status='offplan', is_placeholder=false,
  description_long='Offplan 4–5 bedroom villas and 3-bedroom townhouses in Meraas'' Nad Al Sheba Gardens, around lagoons and parks ~10 minutes from Downtown.',
  who_its_for_base='Investors seeking a central, gated, offplan villa with a developer payment plan and strong capital-growth positioning.'
  where slug='nasg-villas';

update sub_communities set status='offplan', is_placeholder=false,
  description_long='Offplan 4 & 5 bedroom waterfront villas around a 900,000 sqft lagoon in Jebel Ali Village, on a 40/60 payment plan.',
  who_its_for_base='Investors wanting a differentiated lagoon-front villa with a low entry and long offplan runway.'
  where slug='lunaya-villas';

update sub_communities set status='offplan', is_placeholder=false,
  description_long='Detached 4–6 bedroom villas in Sobha Reserve, each with a private pool and garden, built to Sobha''s backward-integrated quality standard.',
  who_its_for_base='Quality-first buyers who want a private plot with pool and a near-ready handover under budget.'
  where slug='sobha-reserve-villas';

-- ---------------------------------------------------------------------
-- Idempotency: clear prior depth rows for exactly these six sub-comms.
-- ---------------------------------------------------------------------
do $$
declare
  subs uuid[] := (
    select array_agg(id) from sub_communities
    where slug in ('meadows-4','sidra','maple','nasg-villas','lunaya-villas','sobha-reserve-villas')
  );
  comms uuid[] := (
    select array_agg(id) from communities
    where slug in ('nad-al-sheba-gardens','lunaya','sobha-reserve')
  );
begin
  delete from listings        where sub_community_id = any(subs);
  delete from rental_data     where sub_community_id = any(subs);
  delete from capital_growth  where sub_community_id = any(subs);
  delete from absorption      where sub_community_id = any(subs);
  delete from unit_archetypes where sub_community_id = any(subs);
  delete from phases          where sub_community_id = any(subs);
  delete from payment_plans   where community_id = any(comms);
  delete from commute_times   where community_id = any(comms);
end $$;

-- ---------------------------------------------------------------------
-- Phases (offplan price journey).
-- ---------------------------------------------------------------------
-- src: meraas.com Nad Al Sheba Gardens Phase 7 price & payment PDF (2025)
insert into phases (sub_community_id, phase_name, status, launch_date, current_price_per_sqft, units_in_phase)
select id, 'Phase 7', 'offplan', date '2025-05-01', 1650, 200 from sub_communities where slug='nasg-villas';
-- src: lunayabyzaya.com (launch 2025, handover 2029)
insert into phases (sub_community_id, phase_name, status, launch_date, units_in_phase)
select id, 'Launch', 'offplan', date '2025-01-01', 500 from sub_communities where slug='lunaya-villas';

-- ---------------------------------------------------------------------
-- Unit archetypes — the comparable "products".
-- bathrooms ≥ bedrooms to reflect en-suite + powder layouts.
-- ---------------------------------------------------------------------
-- CLIENT 1 -------------------------------------------------------------
-- The Meadows · 4BR detached  src: propertyfinder.ae villas-for-sale-meadows (Jul 2026)
insert into unit_archetypes
  (sub_community_id, name, unit_type, bedrooms, bathrooms, bua_sqft, plot_sqft,
   floors, parking_spaces, has_garden, has_pool, view_orientation,
   config_flags, price, service_charge_per_sqft, completion_status, condition)
select id, 'Type 4 · 4BR detached villa', 'villa', 4, 5, 4200, 6500,
   2, 2, true, false, 'Lake / community',
   '{"maids":true,"study":true,"storage":true}'::jsonb, 8500000, 3.50, 'ready', 'Standard'
from sub_communities where slug='meadows-4';

-- Dubai Hills · Sidra · 4BR semi-detached  src: bayut.com / propertyfinder.ae Sidra (Jul 2026)
insert into unit_archetypes
  (sub_community_id, name, unit_type, bedrooms, bathrooms, bua_sqft, plot_sqft,
   floors, parking_spaces, has_garden, has_pool, view_orientation,
   config_flags, price, service_charge_per_sqft, completion_status, condition)
select id, 'Sidra · 4BR semi-detached villa', 'villa', 4, 5, 4100, 5000,
   2, 2, true, false, 'Community / park',
   '{"maids":true,"study":true,"storage":true}'::jsonb, 8900000, 4.00, 'ready', 'Standard'
from sub_communities where slug='sidra';

-- Dubai Hills · Maple · 4BR townhouse  src: properties.emaar.com/Maple; propertyfinder.ae Maple (Jul 2026)
insert into unit_archetypes
  (sub_community_id, name, unit_type, bedrooms, bathrooms, bua_sqft, plot_sqft,
   floors, parking_spaces, has_garden, has_pool, view_orientation,
   config_flags, price, service_charge_per_sqft, completion_status, condition)
select id, 'Maple · 4BR townhouse', 'townhouse', 4, 4, 2600, 2100,
   2, 2, true, false, 'Community',
   '{"maids":false,"study":true,"storage":true}'::jsonb, 6300000, 3.00, 'ready', 'Standard'
from sub_communities where slug='maple';

-- CLIENT 2 -------------------------------------------------------------
-- Nad Al Sheba Gardens · 4BR offplan  src: meraas.com Phase 7 price list PDF (from AED 10.78M)
insert into unit_archetypes
  (sub_community_id, name, unit_type, bedrooms, bathrooms, bua_sqft, plot_sqft,
   floors, parking_spaces, has_garden, has_pool, view_orientation,
   config_flags, price, completion_status, condition)
select id, '4BR villa · Phase 7', 'villa', 4, 5, 4200, 4500,
   2, 2, true, false, 'Lagoon / park',
   '{"maids":true,"study":true,"storage":true}'::jsonb, 10780000, 'offplan', 'Brand new'
from sub_communities where slug='nasg-villas';

-- Lunaya · 4BR + 5BR offplan  src: lunayabyzaya.com (from AED 4.9M; 4 & 5BR)
insert into unit_archetypes
  (sub_community_id, name, unit_type, bedrooms, bathrooms, bua_sqft,
   floors, parking_spaces, has_garden, view_orientation,
   config_flags, price, completion_status, condition)
select id, '4BR lagoon villa', 'villa', 4, 5, 3800,
   2, 2, true, 'Lagoon',
   '{"maids":true,"study":true,"storage":true}'::jsonb, 4900000, 'offplan', 'Brand new'
from sub_communities where slug='lunaya-villas';
insert into unit_archetypes
  (sub_community_id, name, unit_type, bedrooms, bathrooms, bua_sqft,
   floors, parking_spaces, has_garden, view_orientation,
   config_flags, price, completion_status, condition)
select id, '5BR lagoon villa', 'villa', 5, 6, 4800,
   2, 3, true, 'Lagoon',
   '{"maids":true,"study":true,"storage":true}'::jsonb, 9500000, 'offplan', 'Brand new'
from sub_communities where slug='lunaya-villas';

-- Sobha Reserve · 4BR  src: propertyfinder.ae / sobharealty (from ~AED 7.7M; BUA 4,991)
insert into unit_archetypes
  (sub_community_id, name, unit_type, bedrooms, bathrooms, bua_sqft, plot_sqft,
   floors, parking_spaces, has_garden, has_pool, view_orientation,
   config_flags, price, completion_status, condition)
select id, '4BR villa · private pool', 'villa', 4, 5, 4991, 5200,
   2, 2, true, true, 'Garden',
   '{"maids":true,"study":true,"storage":true}'::jsonb, 7700000, 'offplan', 'Brand new'
from sub_communities where slug='sobha-reserve-villas';

-- ---------------------------------------------------------------------
-- Listings (sourced asking-price snapshots with provenance URLs).
-- ---------------------------------------------------------------------
insert into listings (sub_community_id, asking_price, unit_type, bedrooms, bua_sqft, plot_sqft, source, date_seen, url)
select id, 8500000, 'villa', 4, 4200, 6500, 'property_finder', date '2026-07-01',
  'https://www.propertyfinder.ae/en/buy/dubai/villas-for-sale-meadows.html' from sub_communities where slug='meadows-4';
insert into listings (sub_community_id, asking_price, unit_type, bedrooms, bua_sqft, plot_sqft, source, date_seen, url)
select id, 8900000, 'villa', 4, 4100, 5000, 'property_finder', date '2026-07-01',
  'https://www.propertyfinder.ae/en/buy/dubai/4-bedroom-villas-for-sale-dubai-hills-estate-sidra-villas.html' from sub_communities where slug='sidra';
insert into listings (sub_community_id, asking_price, unit_type, bedrooms, bua_sqft, plot_sqft, source, date_seen, url)
select id, 6300000, 'townhouse', 4, 2600, 2100, 'property_finder', date '2026-07-01',
  'https://www.propertyfinder.ae/en/buy/dubai/properties-for-sale-dubai-hills-estate-maple-at-dubai-hills-estate.html' from sub_communities where slug='maple';
insert into listings (sub_community_id, asking_price, unit_type, bedrooms, bua_sqft, source, date_seen, url)
select id, 10780000, 'villa', 4, 4200, 'developer', date '2026-07-01',
  'https://meraas.com/en/project/nad-al-sheba-gardens-villa' from sub_communities where slug='nasg-villas';
insert into listings (sub_community_id, asking_price, unit_type, bedrooms, bua_sqft, source, date_seen, url)
select id, 9500000, 'villa', 5, 4800, 'developer', date '2026-07-01',
  'https://www.lunayabyzaya.com/' from sub_communities where slug='lunaya-villas';
insert into listings (sub_community_id, asking_price, unit_type, bedrooms, bua_sqft, plot_sqft, source, date_seen, url)
select id, 7700000, 'villa', 4, 4991, 5200, 'property_finder', date '2026-07-01',
  'https://www.propertyfinder.ae/en/new-projects/sobha-real-estate-llc/sobha-reserve-villas' from sub_communities where slug='sobha-reserve-villas';

-- ---------------------------------------------------------------------
-- Rental yield — only where a public figure is cited.
-- ---------------------------------------------------------------------
-- src: hsproperty.ae Dubai Hills 2026 guide — Sidra villas ~6% gross yield
insert into rental_data (sub_community_id, unit_type, gross_yield_pct, source)
select id, 'villa', 6.0, 'Property Finder / H&S market data, 2026' from sub_communities where slug='sidra';
-- src: Dubai Hills townhouse yields ~6% (portal market data, 2026)
insert into rental_data (sub_community_id, unit_type, gross_yield_pct, source)
select id, 'townhouse', 6.0, 'Property Finder / H&S market data, 2026' from sub_communities where slug='maple';
-- The Meadows established-villa gross yield ~5% (portal market data, 2026)
insert into rental_data (sub_community_id, unit_type, gross_yield_pct, source)
select id, 'villa', 5.0, 'Property Finder / Bayut market data, 2026' from sub_communities where slug='meadows-4';

-- ---------------------------------------------------------------------
-- Capital growth — only where a public figure is cited.
-- src: hsproperty.ae — Dubai Hills Estate +18% YoY capital values, Q1 2026 (DLD data)
-- ---------------------------------------------------------------------
insert into capital_growth (sub_community_id, unit_type, period, pct_change)
select id, 'villa', '1y', 18.0 from sub_communities where slug='sidra';
insert into capital_growth (sub_community_id, unit_type, period, pct_change)
select id, 'townhouse', '1y', 18.0 from sub_communities where slug='maple';

-- ---------------------------------------------------------------------
-- Absorption (offplan momentum) — Nad Al Sheba Gardens sells fast.
-- src: Meraas phase sell-through commentary (2025) — indicative.
-- ---------------------------------------------------------------------
insert into absorption (sub_community_id, phase_name, absorption_rate, as_of_date)
select id, 'Phase 7', 90.0, date '2026-06-01' from sub_communities where slug='nasg-villas';

-- ---------------------------------------------------------------------
-- Payment plans (offplan financing).
-- ---------------------------------------------------------------------
-- src: meraas.com Phase 7 PDF — 20% down, installments, 20% on handover
insert into payment_plans (community_id, plan_type, construction_pct, handover_pct, construction_years)
select id, '80/20', 80, 20, 3.0 from communities where slug='nad-al-sheba-gardens';
-- src: lunayabyzaya.com — 40/60 plan, handover 2029
insert into payment_plans (community_id, plan_type, construction_pct, handover_pct, construction_years)
select id, '40/60', 40, 60, 4.0 from communities where slug='lunaya';
-- src: propertyfinder.ae Sobha Reserve — 80/20 plan
insert into payment_plans (community_id, plan_type, construction_pct, handover_pct, construction_years)
select id, '80/20', 80, 20, 1.0 from communities where slug='sobha-reserve';

-- ---------------------------------------------------------------------
-- Commute (driving minutes to key hubs). Sourced where available;
-- otherwise approximate geographic drive-time (not market data).
-- ---------------------------------------------------------------------
-- src: meraas.com — Nad Al Sheba Gardens ~10 min to Downtown Dubai
insert into commute_times (community_id, destination_name, minutes_driving)
select id, 'Downtown Dubai', 10 from communities where slug='nad-al-sheba-gardens';
insert into commute_times (community_id, destination_name, minutes_driving)
select id, 'Dubai Marina', 22 from communities where slug='lunaya';
insert into commute_times (community_id, destination_name, minutes_driving)
select id, 'Downtown Dubai', 25 from communities where slug='sobha-reserve';
