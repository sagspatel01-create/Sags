-- =====================================================================
-- SEED — breadth skeleton (Phase 1)
--
-- Honesty rule (from the brief): never fabricate data. This seed loads
-- only STRUCTURAL facts — the four-level taxonomy, Ready/Offplan/Mixed
-- status, broad positioning tier, and APPROXIMATE map coordinates
-- (geographic facts, centroid approximations for pins). All market
-- numbers, counts, prices, descriptions and who-it's-for copy are left
-- NULL so they render as visibly empty until real data is entered via
-- the admin surface. `is_placeholder = true` marks every skeleton page.
--
-- Idempotent: safe to re-run (ON CONFLICT DO NOTHING).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Developers
-- ---------------------------------------------------------------------
insert into developers (name, slug) values
  ('Emaar', 'emaar'),
  ('Nakheel', 'nakheel'),
  ('Meraas', 'meraas'),
  ('Dubai Holding / Dubai Properties', 'dubai-holding'),
  ('Majid Al Futtaim', 'majid-al-futtaim'),
  ('DAMAC', 'damac'),
  ('Aldar', 'aldar'),
  ('Sobha', 'sobha'),
  ('Nshama', 'nshama'),
  ('Meydan', 'meydan'),
  ('Binghatti', 'binghatti'),
  ('Danube', 'danube'),
  ('Pearl Jumeirah (custom)', 'pearl-jumeirah')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Master communities.
-- geo_center coordinates are approximate centroids (lng, lat) for map
-- pins — real locations, not market data.
-- ---------------------------------------------------------------------
insert into communities (developer_id, name, slug, status, positioning_tier, geo_center, is_placeholder) values
  -- Emaar
  ((select id from developers where slug='emaar'), 'Dubai Hills Estate', 'dubai-hills-estate', 'mixed',   'prime',       ST_SetSRID(ST_MakePoint(55.2490,25.1030),4326)::geography, true),
  ((select id from developers where slug='emaar'), 'Arabian Ranches 2',  'arabian-ranches-2',  'ready',   'premium',     ST_SetSRID(ST_MakePoint(55.2670,25.0520),4326)::geography, true),
  ((select id from developers where slug='emaar'), 'Arabian Ranches 3',  'arabian-ranches-3',  'offplan', 'premium',     ST_SetSRID(ST_MakePoint(55.2710,25.0120),4326)::geography, true),
  ((select id from developers where slug='emaar'), 'The Valley',         'the-valley',         'offplan', 'premium',     ST_SetSRID(ST_MakePoint(55.3980,24.9850),4326)::geography, true),
  ((select id from developers where slug='emaar'), 'Emaar South',        'emaar-south',        'mixed',   'mid',         ST_SetSRID(ST_MakePoint(55.1460,24.8690),4326)::geography, true),
  ((select id from developers where slug='emaar'), 'The Oasis',          'the-oasis',          'offplan', 'ultra_prime', ST_SetSRID(ST_MakePoint(55.1500,25.0300),4326)::geography, true),
  ((select id from developers where slug='emaar'), 'Reem (Mira)',        'reem-mira',          'ready',   'mid',         ST_SetSRID(ST_MakePoint(55.3000,25.0200),4326)::geography, true),
  -- Nakheel
  ((select id from developers where slug='nakheel'), 'Palm Jumeirah',    'palm-jumeirah',      'mixed',   'ultra_prime', ST_SetSRID(ST_MakePoint(55.1380,25.1120),4326)::geography, true),
  ((select id from developers where slug='nakheel'), 'Jumeirah Park',    'jumeirah-park',      'ready',   'premium',     ST_SetSRID(ST_MakePoint(55.1550,25.0450),4326)::geography, true),
  ((select id from developers where slug='nakheel'), 'Jumeirah Islands', 'jumeirah-islands',   'ready',   'prime',       ST_SetSRID(ST_MakePoint(55.1630,25.0580),4326)::geography, true),
  ((select id from developers where slug='nakheel'), 'Palm Jebel Ali',   'palm-jebel-ali',     'offplan', 'ultra_prime', ST_SetSRID(ST_MakePoint(55.0060,25.0060),4326)::geography, true),
  ((select id from developers where slug='nakheel'), 'Al Furjan',        'al-furjan',          'ready',   'mid',         ST_SetSRID(ST_MakePoint(55.1450,25.0300),4326)::geography, true),
  ((select id from developers where slug='nakheel'), 'Jebel Ali Village','jebel-ali-village',  'mixed',   'premium',     ST_SetSRID(ST_MakePoint(55.1300,25.0200),4326)::geography, true),
  ((select id from developers where slug='nakheel'), 'Jumeirah Village Triangle','jumeirah-village-triangle','mixed','mid',ST_SetSRID(ST_MakePoint(55.2000,25.0500),4326)::geography, true),
  -- Meraas
  ((select id from developers where slug='meraas'), 'Nad Al Sheba Gardens','nad-al-sheba-gardens','offplan','prime',    ST_SetSRID(ST_MakePoint(55.3200,25.1500),4326)::geography, true),
  ((select id from developers where slug='meraas'), 'The Acres',        'the-acres',          'offplan', 'prime',       ST_SetSRID(ST_MakePoint(55.2700,25.0300),4326)::geography, true),
  -- Dubai Holding / Dubai Properties
  ((select id from developers where slug='dubai-holding'), 'Jumeirah Golf Estates','jumeirah-golf-estates','mixed','prime',ST_SetSRID(ST_MakePoint(55.2080,25.0310),4326)::geography, true),
  ((select id from developers where slug='dubai-holding'), 'Mudon',      'mudon',              'ready',   'mid',         ST_SetSRID(ST_MakePoint(55.2630,25.0100),4326)::geography, true),
  ((select id from developers where slug='dubai-holding'), 'Serena',     'serena',             'ready',   'mid',         ST_SetSRID(ST_MakePoint(55.2970,24.9970),4326)::geography, true),
  ((select id from developers where slug='dubai-holding'), 'Villanova',  'villanova',          'mixed',   'mid',         ST_SetSRID(ST_MakePoint(55.3160,25.0060),4326)::geography, true),
  ((select id from developers where slug='dubai-holding'), 'The Villa',  'the-villa',          'ready',   'premium',     ST_SetSRID(ST_MakePoint(55.3500,25.0600),4326)::geography, true),
  -- Majid Al Futtaim
  ((select id from developers where slug='majid-al-futtaim'), 'Tilal Al Ghaf','tilal-al-ghaf','mixed','prime',           ST_SetSRID(ST_MakePoint(55.2220,25.0050),4326)::geography, true),
  -- DAMAC
  ((select id from developers where slug='damac'), 'DAMAC Hills',        'damac-hills',        'mixed',   'premium',     ST_SetSRID(ST_MakePoint(55.2460,25.0280),4326)::geography, true),
  ((select id from developers where slug='damac'), 'DAMAC Hills 2',      'damac-hills-2',      'mixed',   'accessible',  ST_SetSRID(ST_MakePoint(55.3180,24.9050),4326)::geography, true),
  ((select id from developers where slug='damac'), 'DAMAC Lagoons',      'damac-lagoons',      'offplan', 'premium',     ST_SetSRID(ST_MakePoint(55.2010,25.0380),4326)::geography, true),
  ((select id from developers where slug='damac'), 'DAMAC Islands',      'damac-islands',      'offplan', 'premium',     ST_SetSRID(ST_MakePoint(55.1600,25.0000),4326)::geography, true),
  -- Aldar
  ((select id from developers where slug='aldar'), 'Haven by Aldar',     'haven-by-aldar',     'offplan', 'premium',     ST_SetSRID(ST_MakePoint(55.3900,24.9800),4326)::geography, true),
  ((select id from developers where slug='aldar'), 'The Sanctuary by Aldar','the-sanctuary-by-aldar','offplan','ultra_prime',ST_SetSRID(ST_MakePoint(55.1800,25.0000),4326)::geography, true),
  -- Sobha
  ((select id from developers where slug='sobha'), 'Sobha Hartland',     'sobha-hartland',     'mixed',   'prime',       ST_SetSRID(ST_MakePoint(55.3000,25.1760),4326)::geography, true),
  ((select id from developers where slug='sobha'), 'Sobha Hartland II',  'sobha-hartland-2',   'offplan', 'prime',       ST_SetSRID(ST_MakePoint(55.3100,25.1600),4326)::geography, true),
  ((select id from developers where slug='sobha'), 'Sobha Reserve',      'sobha-reserve',      'offplan', 'prime',       ST_SetSRID(ST_MakePoint(55.3000,25.0600),4326)::geography, true),
  -- Nshama
  ((select id from developers where slug='nshama'), 'Town Square',       'town-square',        'mixed',   'accessible',  ST_SetSRID(ST_MakePoint(55.2860,25.0080),4326)::geography, true),
  -- Meydan
  ((select id from developers where slug='meydan'), 'District One (MBR City)','district-one',  'mixed',   'ultra_prime', ST_SetSRID(ST_MakePoint(55.2900,25.1630),4326)::geography, true),
  -- Pearl Jumeirah (custom)
  ((select id from developers where slug='pearl-jumeirah'), 'Pearl Jumeirah','pearl-jumeirah', 'offplan','ultra_prime',  ST_SetSRID(ST_MakePoint(55.2600,25.2300),4326)::geography, true)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Sub-communities (known named sub-communities within each master).
-- Status defaults per master; all is_placeholder = true.
-- ---------------------------------------------------------------------
insert into sub_communities (community_id, name, slug, status) values
  -- Dubai Hills Estate
  ((select id from communities where slug='dubai-hills-estate'),'Sidra','sidra','ready'),
  ((select id from communities where slug='dubai-hills-estate'),'Maple','maple','ready'),
  ((select id from communities where slug='dubai-hills-estate'),'Golf Place','golf-place','ready'),
  ((select id from communities where slug='dubai-hills-estate'),'Club Villas','club-villas','ready'),
  ((select id from communities where slug='dubai-hills-estate'),'Parkway Vistas','parkway-vistas','ready'),
  ((select id from communities where slug='dubai-hills-estate'),'Fairway Vistas','fairway-vistas','ready'),
  -- Arabian Ranches 2
  ((select id from communities where slug='arabian-ranches-2'),'Palma','palma','ready'),
  ((select id from communities where slug='arabian-ranches-2'),'Rosa','rosa','ready'),
  ((select id from communities where slug='arabian-ranches-2'),'Camelia','camelia','ready'),
  ((select id from communities where slug='arabian-ranches-2'),'Azalea','azalea','ready'),
  ((select id from communities where slug='arabian-ranches-2'),'Lila','lila','ready'),
  -- Arabian Ranches 3
  ((select id from communities where slug='arabian-ranches-3'),'Joy','joy','offplan'),
  ((select id from communities where slug='arabian-ranches-3'),'Sun','sun','offplan'),
  ((select id from communities where slug='arabian-ranches-3'),'Ruba','ruba','offplan'),
  ((select id from communities where slug='arabian-ranches-3'),'Bliss','bliss','ready'),
  ((select id from communities where slug='arabian-ranches-3'),'Anya','anya','offplan'),
  ((select id from communities where slug='arabian-ranches-3'),'Caya','caya','offplan'),
  -- The Valley
  ((select id from communities where slug='the-valley'),'Eden','eden','offplan'),
  ((select id from communities where slug='the-valley'),'Nara','nara','offplan'),
  ((select id from communities where slug='the-valley'),'Rivana','rivana','offplan'),
  ((select id from communities where slug='the-valley'),'Farm Gardens','farm-gardens','offplan'),
  ((select id from communities where slug='the-valley'),'Alana','alana','offplan'),
  -- Emaar South
  ((select id from communities where slug='emaar-south'),'Expo Golf Villas','expo-golf-villas','mixed'),
  ((select id from communities where slug='emaar-south'),'Golf Links','golf-links','offplan'),
  ((select id from communities where slug='emaar-south'),'Fairway Villas','fairway-villas','mixed'),
  -- The Oasis
  ((select id from communities where slug='the-oasis'),'Palmiera','palmiera','offplan'),
  ((select id from communities where slug='the-oasis'),'Mirage','mirage','offplan'),
  ((select id from communities where slug='the-oasis'),'Address Villas','address-villas','offplan'),
  -- Reem (Mira)
  ((select id from communities where slug='reem-mira'),'Mira','mira','ready'),
  ((select id from communities where slug='reem-mira'),'Mira Oasis','mira-oasis','ready'),
  -- Palm Jumeirah
  ((select id from communities where slug='palm-jumeirah'),'Signature Villas','signature-villas','ready'),
  ((select id from communities where slug='palm-jumeirah'),'Garden Homes','garden-homes','ready'),
  ((select id from communities where slug='palm-jumeirah'),'Canal Cove Villas','canal-cove-villas','ready'),
  -- Jumeirah Park
  ((select id from communities where slug='jumeirah-park'),'Legacy','legacy','ready'),
  ((select id from communities where slug='jumeirah-park'),'Legacy Nova','legacy-nova','ready'),
  ((select id from communities where slug='jumeirah-park'),'Regional','regional','ready'),
  ((select id from communities where slug='jumeirah-park'),'Heritage','heritage','ready'),
  -- Jumeirah Islands
  ((select id from communities where slug='jumeirah-islands'),'Mediterranean Clusters','mediterranean-clusters','ready'),
  ((select id from communities where slug='jumeirah-islands'),'Master Views','master-views','ready'),
  ((select id from communities where slug='jumeirah-islands'),'Garden Hall','garden-hall','ready'),
  -- Palm Jebel Ali
  ((select id from communities where slug='palm-jebel-ali'),'Beach Villas','beach-villas','offplan'),
  ((select id from communities where slug='palm-jebel-ali'),'Coral Collection','coral-collection','offplan'),
  -- Al Furjan
  ((select id from communities where slug='al-furjan'),'Quortaj','quortaj','ready'),
  ((select id from communities where slug='al-furjan'),'Dubai Style','dubai-style','ready'),
  ((select id from communities where slug='al-furjan'),'Murooj','murooj','ready'),
  ((select id from communities where slug='al-furjan'),'Hayyan','hayyan','offplan'),
  -- Jebel Ali Village
  ((select id from communities where slug='jebel-ali-village'),'Jebel Ali Village Villas','jav-villas','mixed'),
  -- JVT
  ((select id from communities where slug='jumeirah-village-triangle'),'District 1','jvt-district-1','mixed'),
  ((select id from communities where slug='jumeirah-village-triangle'),'District 4','jvt-district-4','mixed'),
  ((select id from communities where slug='jumeirah-village-triangle'),'District 7','jvt-district-7','mixed'),
  -- Nad Al Sheba Gardens
  ((select id from communities where slug='nad-al-sheba-gardens'),'Nad Al Sheba Gardens Villas','nasg-villas','offplan'),
  -- The Acres
  ((select id from communities where slug='the-acres'),'The Acres Estates','the-acres-estates','offplan'),
  -- Jumeirah Golf Estates
  ((select id from communities where slug='jumeirah-golf-estates'),'Earth','earth','ready'),
  ((select id from communities where slug='jumeirah-golf-estates'),'Fire','fire','ready'),
  ((select id from communities where slug='jumeirah-golf-estates'),'Wind','wind','ready'),
  ((select id from communities where slug='jumeirah-golf-estates'),'Water','water','ready'),
  ((select id from communities where slug='jumeirah-golf-estates'),'Redwood Park','redwood-park','mixed'),
  ((select id from communities where slug='jumeirah-golf-estates'),'Alandalus','alandalus','ready'),
  -- Mudon
  ((select id from communities where slug='mudon'),'Arabella','arabella','ready'),
  ((select id from communities where slug='mudon'),'Al Salam','al-salam','ready'),
  ((select id from communities where slug='mudon'),'Mudon Views','mudon-views','ready'),
  ((select id from communities where slug='mudon'),'Mudon Al Ranim','mudon-al-ranim','offplan'),
  -- Serena
  ((select id from communities where slug='serena'),'Bella Casa','bella-casa','ready'),
  ((select id from communities where slug='serena'),'Casa Dora','casa-dora','ready'),
  ((select id from communities where slug='serena'),'Casa Viva','casa-viva','ready'),
  -- Villanova
  ((select id from communities where slug='villanova'),'Amaranta','amaranta','mixed'),
  ((select id from communities where slug='villanova'),'La Rosa','la-rosa','mixed'),
  ((select id from communities where slug='villanova'),'La Quinta','la-quinta','ready'),
  ((select id from communities where slug='villanova'),'La Violeta','la-violeta','ready'),
  -- The Villa
  ((select id from communities where slug='the-villa'),'Mazaya','mazaya','ready'),
  ((select id from communities where slug='the-villa'),'Cordoba','cordoba','ready'),
  ((select id from communities where slug='the-villa'),'Ponderosa','ponderosa','ready'),
  -- Tilal Al Ghaf
  ((select id from communities where slug='tilal-al-ghaf'),'Harmony','harmony','mixed'),
  ((select id from communities where slug='tilal-al-ghaf'),'Elan','elan','ready'),
  ((select id from communities where slug='tilal-al-ghaf'),'Aura Gardens','aura-gardens','ready'),
  ((select id from communities where slug='tilal-al-ghaf'),'Serenity','serenity','offplan'),
  ((select id from communities where slug='tilal-al-ghaf'),'Alaya','alaya','offplan'),
  ((select id from communities where slug='tilal-al-ghaf'),'Amara','amara','offplan'),
  -- DAMAC Hills
  ((select id from communities where slug='damac-hills'),'Rockwood','rockwood','ready'),
  ((select id from communities where slug='damac-hills'),'Silver Springs','silver-springs','ready'),
  ((select id from communities where slug='damac-hills'),'The Field','the-field','ready'),
  ((select id from communities where slug='damac-hills'),'Golf Promenade','golf-promenade','ready'),
  ((select id from communities where slug='damac-hills'),'Whitefield','whitefield','offplan'),
  -- DAMAC Hills 2
  ((select id from communities where slug='damac-hills-2'),'Amazonia','amazonia','ready'),
  ((select id from communities where slug='damac-hills-2'),'Aquilegia','aquilegia','ready'),
  ((select id from communities where slug='damac-hills-2'),'Avencia','avencia','ready'),
  ((select id from communities where slug='damac-hills-2'),'Victoria','victoria','ready'),
  -- DAMAC Lagoons
  ((select id from communities where slug='damac-lagoons'),'Santorini','santorini','offplan'),
  ((select id from communities where slug='damac-lagoons'),'Costa Brava','costa-brava','offplan'),
  ((select id from communities where slug='damac-lagoons'),'Portofino','portofino','offplan'),
  ((select id from communities where slug='damac-lagoons'),'Malta','malta','offplan'),
  ((select id from communities where slug='damac-lagoons'),'Nice','nice','offplan'),
  ((select id from communities where slug='damac-lagoons'),'Venice','venice','offplan'),
  ((select id from communities where slug='damac-lagoons'),'Morocco','morocco','offplan'),
  -- DAMAC Islands
  ((select id from communities where slug='damac-islands'),'Bali','bali','offplan'),
  ((select id from communities where slug='damac-islands'),'Maldives','maldives','offplan'),
  ((select id from communities where slug='damac-islands'),'Seychelles','seychelles','offplan'),
  ((select id from communities where slug='damac-islands'),'Hawaii','hawaii','offplan'),
  -- Haven by Aldar
  ((select id from communities where slug='haven-by-aldar'),'Serene','serene','offplan'),
  ((select id from communities where slug='haven-by-aldar'),'Amara (Haven)','amara-haven','offplan'),
  ((select id from communities where slug='haven-by-aldar'),'The Reserve','the-reserve','offplan'),
  -- The Sanctuary by Aldar
  ((select id from communities where slug='the-sanctuary-by-aldar'),'The Sanctuary Plots','sanctuary-plots','offplan'),
  -- Sobha Hartland
  ((select id from communities where slug='sobha-hartland'),'Hartland Greens','hartland-greens','ready'),
  ((select id from communities where slug='sobha-hartland'),'Forest Villas','forest-villas','ready'),
  ((select id from communities where slug='sobha-hartland'),'Hartland Estates','hartland-estates','mixed'),
  -- Sobha Hartland II
  ((select id from communities where slug='sobha-hartland-2'),'Hartland II Estates','hartland-2-estates','offplan'),
  -- Sobha Reserve
  ((select id from communities where slug='sobha-reserve'),'Sobha Reserve Villas','sobha-reserve-villas','offplan'),
  -- Town Square
  ((select id from communities where slug='town-square'),'Zahra Townhouses','zahra-townhouses','ready'),
  ((select id from communities where slug='town-square'),'Hayat Townhouses','hayat-townhouses','ready'),
  ((select id from communities where slug='town-square'),'Naseem','naseem','offplan'),
  ((select id from communities where slug='town-square'),'Cedre Villas','cedre-villas','ready'),
  -- District One
  ((select id from communities where slug='district-one'),'District One Villas','d1-villas','mixed'),
  ((select id from communities where slug='district-one'),'District One Mansions','d1-mansions','offplan'),
  ((select id from communities where slug='district-one'),'District One West','d1-west','offplan'),
  -- Pearl Jumeirah
  ((select id from communities where slug='pearl-jumeirah'),'Pearl Jumeirah Villas','pearl-jumeirah-villas','offplan')
on conflict (community_id, slug) do nothing;

-- ---------------------------------------------------------------------
-- Data-source registry (mirrors src/lib/sources/registry.ts). Records
-- what exists; Phase 1 runs no ingestion (last_status = 'manual').
-- ---------------------------------------------------------------------
insert into data_sources (key, label, category, cadence, is_enabled, last_status, reliability_notes) values
  ('dld','DLD / DXB Interact','transactions','weekly',true,'manual','Official transaction backbone. Preferred for sale prices.'),
  ('bayut','Bayut','listings','weekly',true,'manual','Live listings. Scraping breaches ToS; isolate as swappable weekly module (brief §9).'),
  ('property_finder','Property Finder','listings','weekly',true,'manual','Live listings. Same containment posture as Bayut.'),
  ('khda','KHDA','schools','manual',true,'manual','School ratings, curricula, fees.'),
  ('google_maps','Google Maps / Distance Matrix','geo','manual',true,'manual','Geo, commute, POIs.'),
  ('government_infrastructure','Government / master-developer sources','infrastructure','manual',true,'manual','Infrastructure spend, master-plan catalysts.')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- Filter definitions — config-driven filter framework (Milestone 6).
-- Adding a filter later = one row here; nothing else re-architected.
-- ---------------------------------------------------------------------
insert into filter_definitions (key, label, control, data_path, unit, group_label, sort_order) values
  ('budget','Budget','range','unit_archetypes.price','AED','Financials',10),
  ('unit_type','Villa / Townhouse','select','unit_archetypes.unit_type',null,'Property',20),
  ('bedrooms','Bedrooms','range','unit_archetypes.bedrooms',null,'Property',30),
  ('bathrooms','Bathrooms','range','unit_archetypes.bathrooms',null,'Property',40),
  ('bua','Built-up area','range','unit_archetypes.bua_sqft','sqft','Areas',50),
  ('plot','Plot area','range','unit_archetypes.plot_sqft','sqft','Areas',60),
  ('kitchen_type','Kitchen type','select','unit_archetypes.kitchen_type',null,'Layout',70),
  ('service_charge','Service charge','range','unit_archetypes.service_charge_per_sqft','AED/sqft','Financials',80),
  ('status','Ready / Offplan / Mixed','select','communities.status',null,'Property',90),
  ('developer','Developer','select','developers.slug',null,'Property',100),
  ('phase','Phase','select','phases.phase_name',null,'Position',110),
  ('appreciation','Capital appreciation','range','capital_growth.pct_change','%','Market',120),
  ('yield','Rental yield','range','rental_data.gross_yield_pct','%','Market',130),
  ('absorption','Absorption rate','range','absorption.absorption_rate','%','Momentum',140),
  ('school_proximity','School proximity','range','schools.geo_point','min','Context',150),
  ('school_fee','School fee band','range','schools.fee_max','AED','Context',160),
  ('commute','Commute to hub','range','commute_times.minutes_driving','min','Context',170),
  ('who_its_for','Who it''s for','multiselect',null,null,'Character',180)
on conflict (key) do nothing;
