-- =====================================================================
-- 0023 — Dubai Hills Estate: PhD-depth dossier (flagship villa/TH clusters)
--
-- Deepens the Dubai Hills Estate exemplar from backbone → dossier: real,
-- developer-published unit configurations for the flagship villa and
-- townhouse product lines (Sidra, Maple, Golf Place, Parkway Vistas).
--
-- Data discipline: every figure here is a NON-VOLATILE developer spec
-- (bedroom counts, built-up-area configurations) published by Emaar and
-- corroborated across portals — NOT a market price. Prices stay NULL: those
-- come only from DLD-registered transactions. Provenance is recorded on each
-- sub-community (data_confidence='high', source_note cites Emaar).
--
-- Sources (verified Jul 2026):
--   Sidra        — properties.emaar.com/en/properties/sidra (3–5BR, ~3,100–4,283 sqft)
--   Maple        — properties.emaar.com/en/properties/maple (3–5BR TH, ~2,228–2,700 sqft)
--   Golf Place   — properties.emaar.com/en/properties/golf-place (4–6BR, ~5,126–9,991 sqft)
--   Parkway Vistas — Emaar / ecm.ae (6–7BR, ~8,286–9,212 sqft)
--
-- Idempotent: sub-community updates are set-based; unit archetypes upsert on
-- a (sub_community_id, name) unique index. Safe to run repeatedly.
-- =====================================================================

-- Community-level provenance (description already seeded in seed_dubai_hills.sql).
update communities set
  data_confidence = 'high',
  source_note = 'Emaar master-community facts + published cluster configurations (properties.emaar.com), verified Jul 2026.',
  updated_at = now()
where slug = 'dubai-hills-estate';

-- ---------------------------------------------------------------------
-- Flagship cluster descriptions + provenance (sourced developer specs).
-- ---------------------------------------------------------------------
update sub_communities s set
  description_long = v.descr,
  who_its_for_base = coalesce(s.who_its_for_base, v.who),
  is_placeholder = false,
  data_confidence = 'high',
  source_note = 'Emaar published villa/townhouse configurations (properties.emaar.com), verified Jul 2026.',
  updated_at = now()
from (values
  ('sidra-1',
   'Sidra is Dubai Hills'' contemporary detached-villa line — 3–5 bedroom homes of roughly 3,100–4,283 sq ft built-up area, each with a maid''s room, covered parking and a private garden, arranged around landscaped streets and pocket parks within walking reach of Dubai Hills Park and the estate''s schools.',
   'Families wanting a modern, move-in villa in an established, amenity-rich setting close to central Dubai.'),
  ('sidra-2',
   'Sidra Phase 2 — contemporary 3–5 bedroom detached villas (~3,100–4,283 sq ft BUA) with maid''s room, covered parking and private garden, continuing the Sidra product line deeper into the community.',
   'Families wanting a modern, move-in villa in an established, amenity-rich setting close to central Dubai.'),
  ('sidra-3',
   'Sidra Phase 3 — the newest run of the Sidra 3–5 bedroom detached-villa line (~3,100–4,283 sq ft BUA), maid''s room, covered parking and garden, on landscaped streets near the park and schools.',
   'Families wanting a modern, move-in villa in an established, amenity-rich setting close to central Dubai.'),
  ('maple-1',
   'Maple is Dubai Hills'' flagship townhouse line — contemporary 3–5 bedroom townhouses of roughly 2,228–2,700 sq ft built-up area, each with a maid''s room, two covered parking bays and a private garden, set along tree-lined family streets.',
   'Families and end-users wanting a townhouse entry into the Dubai Hills address with parks and schools on the doorstep.'),
  ('maple-2',
   'Maple Phase 2 — contemporary 3–5 bedroom townhouses (~2,228–2,700 sq ft BUA) with maid''s room, two covered parking bays and a private garden.',
   'Families and end-users wanting a townhouse entry into the Dubai Hills address with parks and schools on the doorstep.'),
  ('maple-3',
   'Maple Phase 3 — the newest Maple townhouses, 3–5 bedrooms (~2,228–2,700 sq ft BUA), maid''s room, two covered parking bays and private garden, in a tree-lined setting.',
   'Families and end-users wanting a townhouse entry into the Dubai Hills address with parks and schools on the doorstep.'),
  ('golf-place-i',
   'Golf Place is Dubai Hills'' premium golf-fronting collection — detached 4–6 bedroom villas of roughly 5,126–9,991 sq ft built-up area in contemporary, elegant and modern architectural styles, with expansive terraces overlooking the championship fairways.',
   'Buyers prioritising prestige and golf-course positioning within an established, blue-chip Emaar address.'),
  ('golf-place-ii',
   'Golf Place II — the second phase of the golf-fronting collection: 4–6 bedroom detached villas (~5,126–9,991 sq ft BUA) in three architectural styles, fronting or overlooking the Dubai Hills championship course.',
   'Buyers prioritising prestige and golf-course positioning within an established, blue-chip Emaar address.'),
  ('parkway-vistas',
   'Parkway Vistas is the estate''s large-format villa enclave — 6–7 bedroom homes of roughly 8,286–9,212 sq ft built-up area in classic and modern styles, positioned at the heart of the community beside Dubai Hills Golf Club.',
   'Large families and prestige buyers wanting a substantial detached home in the most central part of the estate.')
) as v(slug, descr, who)
where s.slug = v.slug
  and s.community_id = (select id from communities where slug = 'dubai-hills-estate');

-- ---------------------------------------------------------------------
-- Unit archetypes (developer-published configurations). Idempotent upsert.
-- ---------------------------------------------------------------------
create unique index if not exists ux_unit_archetypes_sub_name
  on unit_archetypes (sub_community_id, name) where name is not null;

with sc as (
  select s.id, s.slug
  from sub_communities s
  where s.community_id = (select id from communities where slug = 'dubai-hills-estate')
)
insert into unit_archetypes
  (sub_community_id, name, unit_type, bedrooms, bua_sqft, completion_status,
   has_garden, parking_spaces, config_flags)
select sc.id, v.name, v.unit_type::unit_type, v.bedrooms, v.bua_sqft,
       v.completion::status_tag, v.has_garden, v.parking, v.flags::jsonb
from (values
  -- Sidra villas (3–5BR) — applied to each Sidra phase
  ('sidra-1','Sidra — 3BR Villa','villa',3, 3100::numeric,'ready',true, null::int,'{"maids":true}'),
  ('sidra-1','Sidra — 4BR Villa','villa',4, 3237,'ready',true, null,'{"maids":true}'),
  ('sidra-1','Sidra — 5BR Villa','villa',5, 3757,'ready',true, null,'{"maids":true}'),
  ('sidra-2','Sidra — 3BR Villa','villa',3, 3100,'ready',true, null,'{"maids":true}'),
  ('sidra-2','Sidra — 4BR Villa','villa',4, 3237,'ready',true, null,'{"maids":true}'),
  ('sidra-2','Sidra — 5BR Villa','villa',5, 3757,'ready',true, null,'{"maids":true}'),
  ('sidra-3','Sidra — 3BR Villa','villa',3, 3100,'ready',true, null,'{"maids":true}'),
  ('sidra-3','Sidra — 4BR Villa','villa',4, 3237,'ready',true, null,'{"maids":true}'),
  ('sidra-3','Sidra — 5BR Villa','villa',5, 3757,'ready',true, null,'{"maids":true}'),
  -- Maple townhouses (3–5BR) — two covered parking bays
  ('maple-1','Maple — 3BR Townhouse','townhouse',3, 2228,'ready',true, 2,'{"maids":true}'),
  ('maple-1','Maple — 4BR Townhouse','townhouse',4, 2387,'ready',true, 2,'{"maids":true}'),
  ('maple-1','Maple — 5BR Townhouse','townhouse',5, 2700,'ready',true, 2,'{"maids":true}'),
  ('maple-2','Maple — 3BR Townhouse','townhouse',3, 2228,'ready',true, 2,'{"maids":true}'),
  ('maple-2','Maple — 4BR Townhouse','townhouse',4, 2387,'ready',true, 2,'{"maids":true}'),
  ('maple-2','Maple — 5BR Townhouse','townhouse',5, 2700,'ready',true, 2,'{"maids":true}'),
  ('maple-3','Maple — 3BR Townhouse','townhouse',3, 2228,'ready',true, 2,'{"maids":true}'),
  ('maple-3','Maple — 4BR Townhouse','townhouse',4, 2387,'ready',true, 2,'{"maids":true}'),
  ('maple-3','Maple — 5BR Townhouse','townhouse',5, 2700,'ready',true, 2,'{"maids":true}'),
  -- Golf Place villas (4–6BR) — BUA bounds sourced (5,126 low / 9,991 high); 5BR left null
  ('golf-place-i','Golf Place — 4BR Villa','villa',4, 5126,'ready',true, null,'{}'),
  ('golf-place-i','Golf Place — 5BR Villa','villa',5, null,'ready',true, null,'{}'),
  ('golf-place-i','Golf Place — 6BR Villa','villa',6, 9991,'ready',true, null,'{}'),
  ('golf-place-ii','Golf Place — 4BR Villa','villa',4, 5126,'ready',true, null,'{}'),
  ('golf-place-ii','Golf Place — 5BR Villa','villa',5, null,'ready',true, null,'{}'),
  ('golf-place-ii','Golf Place — 6BR Villa','villa',6, 9991,'ready',true, null,'{}'),
  -- Parkway Vistas villas (6–7BR)
  ('parkway-vistas','Parkway Vistas — 6BR Villa','villa',6, 8286,'mixed',true, null,'{"maids":true}'),
  ('parkway-vistas','Parkway Vistas — 7BR Villa','villa',7, 9212,'mixed',true, null,'{"maids":true}')
) as v(scslug, name, unit_type, bedrooms, bua_sqft, completion, has_garden, parking, flags)
join sc on sc.slug = v.scslug
on conflict (sub_community_id, name) where name is not null
do update set
  unit_type         = excluded.unit_type,
  bedrooms          = excluded.bedrooms,
  bua_sqft          = excluded.bua_sqft,
  completion_status = excluded.completion_status,
  has_garden        = excluded.has_garden,
  parking_spaces    = excluded.parking_spaces,
  config_flags      = excluded.config_flags,
  updated_at        = now();
