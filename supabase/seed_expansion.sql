-- =====================================================================
-- SEED (expansion) — widening toward "every villa/townhouse community
-- in Dubai" (ready + offplan, gated or not).
--
-- Honesty rule (from the brief): this file loads only STRUCTURAL facts —
-- the four-level taxonomy, Ready/Offplan/Mixed status, broad positioning
-- tier, approximate map centroids (lng, lat) and broad character tags.
-- Every master here is `is_placeholder = true`: all counts, prices,
-- descriptions, who-it's-for copy and market numbers stay NULL so they
-- render visibly empty until entered via Admin / DXB Interact.
--
-- This is an *expanding registry*: run seed.sql first, then this. Both are
-- idempotent (ON CONFLICT DO NOTHING). New communities are appended over
-- time as coverage grows toward the whole city.
--
-- Coordinates are approximate real centroids for map pins, not market data.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Additional developers / master-developers.
-- ---------------------------------------------------------------------
insert into developers (name, slug) values
  ('Al Barari Developers', 'al-barari-developers'),
  ('Zaya', 'zaya'),
  ('Union Properties', 'union-properties'),
  ('Tanmiyat', 'tanmiyat'),
  ('wasl', 'wasl'),
  ('Diamond Developers', 'diamond-developers'),
  ('Reportage', 'reportage'),
  ('Ellington', 'ellington'),
  ('Dubai South', 'dubai-south'),
  ('Azizi', 'azizi'),
  ('Ellington Nakheel (co)', 'ellington-nakheel')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Master communities (expansion). geo_center is an approximate centroid.
-- ---------------------------------------------------------------------
insert into communities (developer_id, name, slug, status, positioning_tier, geo_center, is_placeholder) values
  -- Emaar — the established Emirates Living triad + Emirates Hills (near Al Khail Rd)
  ((select id from developers where slug='emaar'), 'The Springs',       'the-springs',       'ready',   'premium',     ST_SetSRID(ST_MakePoint(55.1660,25.0700),4326)::geography, true),
  ((select id from developers where slug='emaar'), 'The Meadows',       'the-meadows',       'ready',   'prime',       ST_SetSRID(ST_MakePoint(55.1580,25.0660),4326)::geography, true),
  ((select id from developers where slug='emaar'), 'The Lakes',         'the-lakes',         'ready',   'prime',       ST_SetSRID(ST_MakePoint(55.1720,25.0580),4326)::geography, true),
  ((select id from developers where slug='emaar'), 'Emirates Hills',    'emirates-hills',    'ready',   'ultra_prime', ST_SetSRID(ST_MakePoint(55.1620,25.0690),4326)::geography, true),
  ((select id from developers where slug='emaar'), 'Grand Polo Club & Resort', 'grand-polo-club', 'offplan', 'ultra_prime', ST_SetSRID(ST_MakePoint(55.3500,24.9450),4326)::geography, true),
  ((select id from developers where slug='emaar'), 'Alma (Dubai Hills)','alma',              'offplan', 'premium',     ST_SetSRID(ST_MakePoint(55.2450,25.0980),4326)::geography, true),
  -- Al Barari (Barari area) — Client 2 target incl. Lunaya (offplan, by Zaya)
  ((select id from developers where slug='al-barari-developers'), 'Al Barari', 'al-barari', 'mixed', 'ultra_prime', ST_SetSRID(ST_MakePoint(55.3150,25.0900),4326)::geography, true),
  ((select id from developers where slug='zaya'), 'Lunaya',             'lunaya',            'offplan', 'ultra_prime', ST_SetSRID(ST_MakePoint(55.3200,25.0850),4326)::geography, true),
  -- Dubailand / Wadi Al Safa belt (near Al Ain Rd / Sheikh Mohammed Bin Zayed)
  ((select id from developers where slug='tanmiyat'), 'Living Legends', 'living-legends',    'ready',   'premium',     ST_SetSRID(ST_MakePoint(55.3250,25.0450),4326)::geography, true),
  ((select id from developers where slug='dubai-holding'), 'Falcon City of Wonders', 'falcon-city', 'mixed', 'mid',    ST_SetSRID(ST_MakePoint(55.3200,25.0800),4326)::geography, true),
  ((select id from developers where slug='emaar'), 'Cherrywoods',       'cherrywoods',       'ready',   'mid',         ST_SetSRID(ST_MakePoint(55.2900,25.0100),4326)::geography, true),
  -- Sports City / Motor City belt (gated villa enclaves)
  ((select id from developers where slug='union-properties'), 'Victory Heights', 'victory-heights', 'ready', 'premium', ST_SetSRID(ST_MakePoint(55.2200,25.0430),4326)::geography, true),
  ((select id from developers where slug='union-properties'), 'Green Community (Motor City)', 'green-community-motor-city', 'ready', 'mid', ST_SetSRID(ST_MakePoint(55.2380,25.0480),4326)::geography, true),
  ((select id from developers where slug='union-properties'), 'Green Community (DIP)', 'green-community-dip', 'ready', 'mid', ST_SetSRID(ST_MakePoint(55.1700,24.9750),4326)::geography, true),
  -- The Sustainable City
  ((select id from developers where slug='diamond-developers'), 'The Sustainable City', 'the-sustainable-city', 'ready', 'premium', ST_SetSRID(ST_MakePoint(55.2880,24.9850),4326)::geography, true),
  -- wasl / Nad Al Sheba (villas)
  ((select id from developers where slug='wasl'), 'Nad Al Sheba Villas','nad-al-sheba-villas','mixed',  'premium',     ST_SetSRID(ST_MakePoint(55.3300,25.1600),4326)::geography, true),
  ((select id from developers where slug='wasl'), 'Wasl Gate',          'wasl-gate',          'mixed',   'mid',         ST_SetSRID(ST_MakePoint(55.1200,25.0000),4326)::geography, true),
  -- Mirdif belt (established eastern villas)
  ((select id from developers where slug='dubai-holding'), 'Uptown Mirdif', 'uptown-mirdif', 'ready',   'mid',         ST_SetSRID(ST_MakePoint(55.4200,25.2200),4326)::geography, true),
  -- Dubai South (villas/townhouses near Al Maktoum Intl / Expo)
  ((select id from developers where slug='dubai-south'), 'The Pulse',    'the-pulse',         'mixed',   'accessible',    ST_SetSRID(ST_MakePoint(55.1550,24.8800),4326)::geography, true),
  ((select id from developers where slug='dubai-south'), 'South Bay',    'south-bay',         'offplan', 'premium',     ST_SetSRID(ST_MakePoint(55.1450,24.8650),4326)::geography, true),
  -- Dubai Investment Park / Jebel Ali affordable villa belt
  ((select id from developers where slug='reportage'), 'Verdana',        'verdana',           'offplan', 'accessible',  ST_SetSRID(ST_MakePoint(55.1650,24.9800),4326)::geography, true),
  ((select id from developers where slug='reportage'), 'Rukan',          'rukan',             'mixed',   'accessible',    ST_SetSRID(ST_MakePoint(55.3400,24.9800),4326)::geography, true),
  -- Meydan / MBR belt (offplan townhouse/villa launches)
  ((select id from developers where slug='meydan'), 'Meydan Gardens (Polo Homes)', 'meydan-gardens', 'mixed', 'prime', ST_SetSRID(ST_MakePoint(55.3050,25.1550),4326)::geography, true),
  -- Emaar — Rashid & Creek waterfront townhouse/villa (mixed use, villa components)
  ((select id from developers where slug='emaar'), 'The Cove (Creek Harbour)', 'the-cove-creek', 'offplan', 'prime',   ST_SetSRID(ST_MakePoint(55.3520,25.1980),4326)::geography, true),
  -- DAMAC — additional
  ((select id from developers where slug='damac'), 'DAMAC Riverside',   'damac-riverside',   'offplan', 'mid',         ST_SetSRID(ST_MakePoint(55.1400,24.9400),4326)::geography, true),
  -- Nakheel — additional villa/townhouse
  ((select id from developers where slug='nakheel'), 'Tilal Al Furjan', 'tilal-al-furjan',   'mixed',   'premium',     ST_SetSRID(ST_MakePoint(55.1420,25.0250),4326)::geography, true),
  ((select id from developers where slug='nakheel'), 'Warsan Village',  'warsan-village',    'ready',   'accessible',    ST_SetSRID(ST_MakePoint(55.4000,25.1700),4326)::geography, true),
  -- Sobha — additional
  ((select id from developers where slug='sobha'), 'Sobha Elwood',      'sobha-elwood',      'offplan', 'prime',       ST_SetSRID(ST_MakePoint(55.3550,25.0250),4326)::geography, true),
  -- Nshama — additional (Town Square expansion parcels tracked separately if needed)
  ((select id from developers where slug='emaar'), 'The Valley 2 (Rivera / Velora)', 'the-valley-2', 'offplan', 'premium', ST_SetSRID(ST_MakePoint(55.4050,24.9800),4326)::geography, true),
  -- Ellington villa/townhouse
  ((select id from developers where slug='ellington'), 'The Wilds',     'the-wilds',         'offplan', 'premium',     ST_SetSRID(ST_MakePoint(55.2700,25.0000),4326)::geography, true)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Sub-communities (expansion). All is_placeholder = true (default).
-- ---------------------------------------------------------------------
insert into sub_communities (community_id, name, slug, status) values
  -- The Springs (numbered districts of townhouses)
  ((select id from communities where slug='the-springs'),'Springs 1','springs-1','ready'),
  ((select id from communities where slug='the-springs'),'Springs 3','springs-3','ready'),
  ((select id from communities where slug='the-springs'),'Springs 7','springs-7','ready'),
  ((select id from communities where slug='the-springs'),'Springs 14','springs-14','ready'),
  ((select id from communities where slug='the-springs'),'Springs 15','springs-15','ready'),
  -- The Meadows (gated villa districts)
  ((select id from communities where slug='the-meadows'),'Meadows 1','meadows-1','ready'),
  ((select id from communities where slug='the-meadows'),'Meadows 4','meadows-4','ready'),
  ((select id from communities where slug='the-meadows'),'Meadows 8','meadows-8','ready'),
  ((select id from communities where slug='the-meadows'),'Meadows 9','meadows-9','ready'),
  -- The Lakes
  ((select id from communities where slug='the-lakes'),'Deema','deema','ready'),
  ((select id from communities where slug='the-lakes'),'Forat','forat','ready'),
  ((select id from communities where slug='the-lakes'),'Ghadeer','ghadeer','ready'),
  ((select id from communities where slug='the-lakes'),'Hattan','hattan','ready'),
  ((select id from communities where slug='the-lakes'),'Maeen','maeen','ready'),
  ((select id from communities where slug='the-lakes'),'Zulal','zulal','ready'),
  -- Emirates Hills (sectors)
  ((select id from communities where slug='emirates-hills'),'Sector E','emirates-hills-sector-e','ready'),
  ((select id from communities where slug='emirates-hills'),'Sector L','emirates-hills-sector-l','ready'),
  ((select id from communities where slug='emirates-hills'),'Sector W','emirates-hills-sector-w','ready'),
  -- Grand Polo Club & Resort
  ((select id from communities where slug='grand-polo-club'),'Grand Polo Estates','grand-polo-estates','offplan'),
  -- Alma
  ((select id from communities where slug='alma'),'Alma Townhouses','alma-townhouses','offplan'),
  -- Al Barari (villa sub-communities)
  ((select id from communities where slug='al-barari'),'The Residences','al-barari-residences','ready'),
  ((select id from communities where slug='al-barari'),'Nara','al-barari-nara','ready'),
  ((select id from communities where slug='al-barari'),'Chorisia','al-barari-chorisia','ready'),
  ((select id from communities where slug='al-barari'),'The Nest','al-barari-nest','ready'),
  ((select id from communities where slug='al-barari'),'Dahlia','al-barari-dahlia','ready'),
  ((select id from communities where slug='al-barari'),'The Reserve','al-barari-reserve','offplan'),
  -- Lunaya
  ((select id from communities where slug='lunaya'),'Lunaya Villas','lunaya-villas','offplan'),
  -- Living Legends
  ((select id from communities where slug='living-legends'),'Living Legends Villas','living-legends-villas','ready'),
  -- Falcon City
  ((select id from communities where slug='falcon-city'),'Falcon City Villas','falcon-city-villas','mixed'),
  -- Cherrywoods
  ((select id from communities where slug='cherrywoods'),'Cherrywoods Townhouses','cherrywoods-townhouses','ready'),
  -- Victory Heights
  ((select id from communities where slug='victory-heights'),'Morella','morella','ready'),
  ((select id from communities where slug='victory-heights'),'Novelia','novelia','ready'),
  ((select id from communities where slug='victory-heights'),'Esmeralda','esmeralda','ready'),
  ((select id from communities where slug='victory-heights'),'Estella','estella','ready'),
  -- Green Community (Motor City)
  ((select id from communities where slug='green-community-motor-city'),'Casa Familia','casa-familia','ready'),
  -- Green Community (DIP)
  ((select id from communities where slug='green-community-dip'),'Green Community West','green-community-west','ready'),
  ((select id from communities where slug='green-community-dip'),'Green Community East','green-community-east','ready'),
  -- The Sustainable City
  ((select id from communities where slug='the-sustainable-city'),'SC Villas','sc-villas','ready'),
  -- Nad Al Sheba Villas
  ((select id from communities where slug='nad-al-sheba-villas'),'Nad Al Sheba 3','nad-al-sheba-3','mixed'),
  -- Wasl Gate
  ((select id from communities where slug='wasl-gate'),'Wasl Gate Townhouses','wasl-gate-townhouses','mixed'),
  -- Uptown Mirdif
  ((select id from communities where slug='uptown-mirdif'),'Uptown Mirdif Villas','uptown-mirdif-villas','ready'),
  -- The Pulse
  ((select id from communities where slug='the-pulse'),'The Pulse Townhouses','the-pulse-townhouses','ready'),
  ((select id from communities where slug='the-pulse'),'The Pulse Beachfront','the-pulse-beachfront','offplan'),
  -- South Bay
  ((select id from communities where slug='south-bay'),'South Bay Villas','south-bay-villas','offplan'),
  -- Verdana
  ((select id from communities where slug='verdana'),'Verdana Townhouses','verdana-townhouses','offplan'),
  -- Rukan
  ((select id from communities where slug='rukan'),'Rukan Townhouses','rukan-townhouses','mixed'),
  -- Meydan Gardens
  ((select id from communities where slug='meydan-gardens'),'Polo Homes','polo-homes','mixed'),
  ((select id from communities where slug='meydan-gardens'),'Millennium Estates','millennium-estates','mixed'),
  -- The Cove
  ((select id from communities where slug='the-cove-creek'),'The Cove Townhouses','the-cove-townhouses','offplan'),
  -- DAMAC Riverside
  ((select id from communities where slug='damac-riverside'),'Riverside Villas','riverside-villas','offplan'),
  -- Tilal Al Furjan
  ((select id from communities where slug='tilal-al-furjan'),'Tilal Al Furjan Villas','tilal-al-furjan-villas','mixed'),
  -- Warsan Village
  ((select id from communities where slug='warsan-village'),'Warsan Village Townhouses','warsan-village-townhouses','ready'),
  -- Sobha Elwood
  ((select id from communities where slug='sobha-elwood'),'Elwood Villas','elwood-villas','offplan'),
  -- The Valley 2
  ((select id from communities where slug='the-valley-2'),'Velora','velora','offplan'),
  ((select id from communities where slug='the-valley-2'),'Rivera','rivera','offplan'),
  -- The Wilds
  ((select id from communities where slug='the-wilds'),'The Wilds Townhouses','the-wilds-townhouses','offplan')
on conflict (community_id, slug) do nothing;

-- ---------------------------------------------------------------------
-- Character tags (expansion). Broad, verifiable characteristics only.
-- ---------------------------------------------------------------------
update communities set character_tags = '{established,gated-family,central,schools-nearby}' where slug='the-springs';
update communities set character_tags = '{established,gated-family,prestige,schools-nearby}' where slug='the-meadows';
update communities set character_tags = '{established,gated-family,prestige}'               where slug='the-lakes';
update communities set character_tags = '{ultra-luxury,gated-family,prestige,established}'  where slug='emirates-hills';
update communities set character_tags = '{ultra-luxury,new-launch,nature,prestige}'         where slug='grand-polo-club';
update communities set character_tags = '{new-launch,golf,gated-family}'                    where slug='alma';
update communities set character_tags = '{ultra-luxury,nature,wellness,prestige,established}' where slug='al-barari';
update communities set character_tags = '{ultra-luxury,new-launch,nature,wellness,investment}' where slug='lunaya';
update communities set character_tags = '{established,gated-family,value-entry}'            where slug='living-legends';
update communities set character_tags = '{established,gated-family,value-entry}'            where slug='falcon-city';
update communities set character_tags = '{gated-family,new-launch,value-entry}'             where slug='cherrywoods';
update communities set character_tags = '{golf,gated-family,established,prestige}'          where slug='victory-heights';
update communities set character_tags = '{gated-family,established,value-entry}'            where slug='green-community-motor-city';
update communities set character_tags = '{gated-family,established,nature}'                 where slug='green-community-dip';
update communities set character_tags = '{gated-family,wellness,nature,established}'        where slug='the-sustainable-city';
update communities set character_tags = '{established,gated-family,central}'                where slug='nad-al-sheba-villas';
update communities set character_tags = '{gated-family,new-launch,value-entry}'            where slug='wasl-gate';
update communities set character_tags = '{established,gated-family,value-entry}'            where slug='uptown-mirdif';
update communities set character_tags = '{gated-family,new-launch,value-entry,investment}' where slug='the-pulse';
update communities set character_tags = '{new-launch,gated-family,investment}'             where slug='south-bay';
update communities set character_tags = '{new-launch,value-entry,investment}'              where slug='verdana';
update communities set character_tags = '{new-launch,value-entry}'                         where slug='rukan';
update communities set character_tags = '{prestige,gated-family,central,established}'       where slug='meydan-gardens';
update communities set character_tags = '{waterfront,new-launch,central,investment}'       where slug='the-cove-creek';
update communities set character_tags = '{waterfront,new-launch,value-entry,investment}'   where slug='damac-riverside';
update communities set character_tags = '{gated-family,new-launch,established}'             where slug='tilal-al-furjan';
update communities set character_tags = '{established,value-entry}'                         where slug='warsan-village';
update communities set character_tags = '{new-launch,gated-family,central}'                where slug='sobha-elwood';
update communities set character_tags = '{new-launch,gated-family,nature}'                 where slug='the-valley-2';
update communities set character_tags = '{new-launch,gated-family,nature}'                 where slug='the-wilds';
