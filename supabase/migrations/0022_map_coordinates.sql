-- =====================================================================
-- 0022 — Map coordinates for the new masters
-- Fills geo_center for the communities added in 0019–0021 so every villa/
-- townhouse community pins on the map. Approximate district centroids
-- (WGS84); refine per master plan later. Idempotent.
-- =====================================================================

update communities set geo_center = ST_SetSRID(ST_MakePoint(55.2676,25.0498),4326)::geography where slug = 'arabian-ranches';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.18,25.22),4326)::geography where slug = 'amali-island';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.3,24.95),4326)::geography where slug = 'bayn';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.245,25.192),4326)::geography where slug = 'dar-wasl';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.348,25.202),4326)::geography where slug = 'dubai-creek-harbour';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.378,25.121),4326)::geography where slug = 'dubai-silicon-oasis';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.33,25.15),4326)::geography where slug = 'eden-hills';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.151,24.96),4326)::geography where slug = 'expo-city';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.29,25.0),4326)::geography where slug = 'ghaf-woods';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.31,25.16),4326)::geography where slug = 'keturah-reserve';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.312,25.165),4326)::geography where slug = 'mag-city';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.33,25.155),4326)::geography where slug = 'opal-gardens';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.273,25.283),4326)::geography where slug = 'rashid-yachts-marina';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.42,25.215),4326)::geography where slug = 'shorooq';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.34,25.16),4326)::geography where slug = 'sobha-sanctuary';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.245,25.235),4326)::geography where slug = 'sur-la-mer';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.33,25.16),4326)::geography where slug = 'the-fields';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.35,24.92),4326)::geography where slug = 'the-heights-country-club';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.33,25.15),4326)::geography where slug = 'the-sanctuary-ellington';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.165,25.225),4326)::geography where slug = 'the-world-islands';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.25,25.2),4326)::geography where slug = 'wasl-51';
update communities set geo_center = ST_SetSRID(ST_MakePoint(55.245,25.185),4326)::geography where slug = 'wasl-square';
