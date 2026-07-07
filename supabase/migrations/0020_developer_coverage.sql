-- =====================================================================
-- 0020 — Developer-by-developer villa/townhouse coverage (wave 1)
--
-- The USP: every villa/townhouse community in Dubai, organised by developer.
-- This wave adds real, currently-missing master communities across the major
-- developers (validated via developer sites + area guides, Jul 2026):
--   Aldar      → Athlon (9 clusters)
--   Binghatti  → Tilal Binghatti (their first villa community)   [new dev]
--   Danube     → Greenz by Danube (their first villa masterplan) [new dev]
--   Azizi      → Azizi Venice (Dubai South villas)               [new dev]
--   Al Habtoor → Al Habtoor Polo Resort & Club                   [new dev]
--   Nakheel    → Jumeirah Village Circle (2,000+ villas/TH)
--   Dubai Hldg → Layan, Al Waha, Ghoroob, Villa Lantana
--   Meraas     → Jumeirah Bay Island
--   Meydan     → Mira Villas (Bentley Home, District 11)
--   DAMAC      → DAMAC Sun City
--   Emaar      → Address Villas Hillcrest (sub of Dubai Hills)
--
-- Structural facts only; idempotent upsert; provenance on every row; no
-- invented prices/counts. Truly exhaustive city-wide completeness remains the
-- DLD Projects registry sync's job — this closes the big known gaps.
-- =====================================================================

-- New developers -------------------------------------------------------
insert into developers (name, slug) values
  ('Binghatti Developers','binghatti'),
  ('Danube Properties','danube'),
  ('Azizi Developments','azizi'),
  ('Al Habtoor Group','al-habtoor')
on conflict (slug) do nothing;

-- New master communities ------------------------------------------------
insert into communities
  (slug, developer_id, name, status, positioning_tier, geo_center,
   age_or_handover, description_long, who_its_for_base, character_tags,
   is_placeholder, data_confidence, source_note)
select v.slug, (select id from developers where slug=v.dev), v.name,
       v.status::status_tag, v.tier::positioning_tier,
       ST_SetSRID(ST_MakePoint(v.lng,v.lat),4326)::geography,
       v.age, v.descr, v.who, v.tags::text[], false, v.conf, v.note
from (values
  ('athlon','aldar','Athlon','offplan','premium',55.2600,25.0300,
   'Off-plan · handover ~Q2 2028',
   'Aldar''s wellness-themed Dubailand master community of ~2,692 villas and townhouses across nine clusters (Chion, Delphi, Diagon, Leon, Milon, Olympia, Theon, Vitalon, Zeston), built around running, cycling and family trails.',
   'Wellness-minded families wanting a new-build Aldar villa or townhouse with an active, trail-led lifestyle and a payment plan.',
   '{new-launch,gated-family,wellness,nature,investment}','high',
   'Aldar off-plan; clusters, unit count & Q2 2028 handover confirmed via developer + aggregators (Jul 2026); prices pending confirmed figures.'),
  ('tilal-binghatti','binghatti','Tilal Binghatti','offplan','premium',55.4100,25.0700,
   'Off-plan · handover ~Dec 2028',
   'Binghatti''s first villa community — a gated, nature-led (40% greenery) master plan in Al Rowaiyah, Dubailand, of 4–6 bedroom villas and 4-bedroom townhouses, marking the tower-focused developer''s move into horizontal family living.',
   'Investors and families wanting a brand-new gated villa/townhouse from Binghatti with a 60/40 payment plan on the Dubailand growth corridor.',
   '{new-launch,gated-family,nature,investment}','high',
   'Binghatti off-plan; first villa community, configs & Dec 2028 handover from developer + aggregators (Jul 2026); prices pending confirmed figures.'),
  ('greenz-by-danube','danube','Greenz by Danube','offplan','mid',55.4150,25.1250,
   'Off-plan · handover ~Q4 2029',
   'Danube''s first large-scale villa/townhouse master community in Dubai International Academic City — 3–4 bedroom townhouses and 5-bedroom twin/semi-detached villas, marketed as Dubai''s first fully-furnished master villa project with a 1%-monthly plan.',
   'Value-focused investors and families wanting a furnished, new-build villa/townhouse with a low-entry, extended payment plan.',
   '{new-launch,gated-family,investment}','high',
   'Danube off-plan; first villa masterplan, configs & Q4 2029 handover from developer announcements (Jul 2026); prices pending confirmed figures.'),
  ('azizi-venice','azizi','Azizi Venice','offplan','premium',55.1500,24.8700,
   'Off-plan · handover from ~Q4 2026',
   'A large Azizi waterfront master community in Dubai South built around a lagoon and canals — predominantly apartments but with 200+ waterfront villas and mansions, near Al Maktoum International Airport.',
   'Investors wanting a waterfront villa in a large lifestyle-led Dubai South community with a payment plan and airport-corridor growth.',
   '{new-launch,waterfront,investment}','medium',
   'Azizi off-plan; villa component within a mostly-apartment masterplan, handover ~Q4 2026 from developer + aggregators (Jul 2026); prices pending confirmed figures.'),
  ('jumeirah-village-circle','nakheel','Jumeirah Village Circle','mixed','mid',55.2100,25.0600,
   'Ready / mixed · established',
   'A large, central Nakheel community (JVC) of 2,000+ villas and townhouses (incl. Nakheel Townhouses and boutique gated projects like Somerset Mews) alongside mid-rise apartments — one of Dubai''s most active, affordable family markets.',
   'Value-focused families and investors wanting an affordable, central townhouse or villa with easy access to both main highways.',
   '{established,central,schools-nearby,investment}','high',
   'Nakheel community; villa/TH count & clusters from Nakheel + area guides (Jul 2026); prices pending DLD confirmation.'),
  ('layan','dubai-holding','Layan','ready','mid',55.2900,25.0100,
   'Ready · established',
   'A Dubai Properties community in Dubailand of Mediterranean-inspired villas set among green spaces — a settled, family-oriented villa enclave.',
   'Families wanting an established, affordable Mediterranean-style villa with a garden in the Dubailand corridor.',
   '{established,gated-family,schools-nearby}','high',
   'Dubai Properties community; structural facts from developer (Dubai Residential) + area guides (Jul 2026); prices/counts pending confirmation.'),
  ('al-waha','dubai-holding','Al Waha','ready','mid',55.2850,25.0150,
   'Ready · established',
   'A Dubai Properties Dubailand community of single-storey and two-storey villas with landscaped courtyards, known for a quiet, garden-focused family setting.',
   'Families wanting a calm, established villa with a garden and courtyards at accessible pricing in Dubailand.',
   '{established,gated-family,schools-nearby}','high',
   'Dubai Properties community; structural facts from developer + area guides (Jul 2026); prices/counts pending confirmation.'),
  ('ghoroob','dubai-holding','Ghoroob','ready','accessible',55.4200,25.2200,
   'Ready · established',
   'A Dubai Properties community in Mirdif blending townhouses and low-rise apartments around courtyards and greenery, close to schools and malls.',
   'Families and first-time buyers wanting an affordable, established townhouse near Mirdif''s schools and retail.',
   '{established,gated-family,schools-nearby}','medium',
   'Dubai Properties community; townhouse component within a mixed masterplan, from developer + area guides (Jul 2026); prices/counts pending confirmation.'),
  ('villa-lantana','dubai-holding','Villa Lantana','ready','premium',55.2000,25.1050,
   'Ready · handover from ~2018',
   'A gated Dubai Holding (TECOM) villa community in Al Barsha South of contemporary 3–5 bedroom villas and townhouses around parks — central, green and family-oriented near Sheikh Zayed Road.',
   'Families wanting a modern, gated villa with a garden in a central location near schools and Sheikh Zayed Road.',
   '{established,gated-family,central,schools-nearby}','high',
   'Dubai Holding community; structural facts from developer + area guides (Jul 2026); prices/counts pending confirmation.'),
  ('jumeirah-bay-island','meraas','Jumeirah Bay Island','mixed','ultra_prime',55.2450,25.2050,
   'Mixed · established + new launches',
   'A Meraas seahorse-shaped island off Jumeirah 2 (home of the Bulgari Resort & Residences) with a limited collection of ultra-prime beachfront villas and mansions — among the most exclusive addresses in the city.',
   'Ultra-high-net-worth buyers seeking a trophy beachfront villa or mansion on a landmark private island minutes from the city.',
   '{ultra-luxury,waterfront,beach,prestige}','medium',
   'Meraas island; ultra-prime villa component per developer + market knowledge (Jul 2026); values vary per transaction — pending DLD confirmation.'),
  ('al-habtoor-polo-resort','al-habtoor','Al Habtoor Polo Resort & Club','offplan','prime',55.3050,24.9750,
   'Off-plan / mixed · phased',
   'An Al Habtoor equestrian-themed community in Dubailand spanning ~6 million sqft — 3–6 bedroom semi-detached and standalone villas around four polo fields, a riding school and a luxury hotel.',
   'Buyers wanting a differentiated, equestrian-lifestyle villa in a resort-branded gated community with a payment plan.',
   '{new-launch,gated-family,nature,prestige}','medium',
   'Al Habtoor community; villa configs & amenities from developer + aggregators (Jul 2026); handover/prices pending confirmed figures.'),
  ('mira-villas','meydan','Mira Villas by Bentley Home','offplan','ultra_prime',55.3200,25.1600,
   'Off-plan · branded villas',
   'A branded collection of 36 fully-furnished 5-bedroom villas and mansions by Bentley Home in District 11, Meydan (MBR City) — a turnkey ultra-luxury product with bespoke Bentley Home interiors.',
   'Ultra-high-net-worth buyers wanting a turnkey, branded, fully-furnished mansion in a central MBR City district.',
   '{new-launch,ultra-luxury,central,prestige}','medium',
   'Bentley Home / Meydan District 11; 36 branded villas per developer + aggregators (Jul 2026); prices pending confirmed figures.'),
  ('damac-sun-city','damac','DAMAC Sun City','offplan','premium',55.3000,24.9600,
   'Off-plan · handover ~Mar 2028',
   'A DAMAC wellness-themed community in Dubailand of 4–5 bedroom townhouses built around forest trails, outdoor yoga and recovery spaces.',
   'Wellness-minded families and investors wanting a new-build townhouse with a nature-and-recovery lifestyle and a payment plan.',
   '{new-launch,gated-family,wellness,nature,investment}','medium',
   'DAMAC off-plan; configs & Mar 2028 handover from developer + aggregators (Jul 2026); prices pending confirmed figures.')
) as v(slug, dev, name, status, tier, lng, lat, age, descr, who, tags, conf, note)
on conflict (slug) do update set
  age_or_handover  = excluded.age_or_handover,
  description_long = excluded.description_long,
  who_its_for_base = excluded.who_its_for_base,
  character_tags   = excluded.character_tags,
  is_placeholder   = false,
  data_confidence  = excluded.data_confidence,
  source_note      = excluded.source_note;

-- Sub-communities -------------------------------------------------------
insert into sub_communities
  (community_id, slug, name, status, is_placeholder, data_confidence, source_note)
select (select id from communities where slug=v.comm),
       v.slug, v.name, v.status::status_tag, true, v.conf, v.note
from (values
  -- Athlon — nine named clusters
  ('athlon','athlon-chion','Chion','offplan','high','Athlon cluster per Aldar (Jul 2026).'),
  ('athlon','athlon-delphi','Delphi','offplan','high','Athlon cluster per Aldar (Jul 2026).'),
  ('athlon','athlon-diagon','Diagon','offplan','high','Athlon cluster per Aldar (Jul 2026).'),
  ('athlon','athlon-leon','Leon','offplan','high','Athlon cluster per Aldar (Jul 2026).'),
  ('athlon','athlon-milon','Milon','offplan','high','Athlon cluster per Aldar (Jul 2026).'),
  ('athlon','athlon-olympia','Olympia','offplan','high','Athlon cluster per Aldar (Jul 2026).'),
  ('athlon','athlon-theon','Theon','offplan','high','Athlon cluster per Aldar (Jul 2026).'),
  ('athlon','athlon-vitalon','Vitalon','offplan','high','Athlon cluster per Aldar (Jul 2026).'),
  ('athlon','athlon-zeston','Zeston','offplan','high','Athlon cluster per Aldar (Jul 2026).'),
  -- JVC villa/townhouse clusters
  ('jumeirah-village-circle','nakheel-townhouses','Nakheel Townhouses','ready','high','JVC: Nakheel Townhouses (1–4BR) per Nakheel/area guides (Jul 2026).'),
  ('jumeirah-village-circle','somerset-mews','Somerset Mews','ready','medium','JVC: Ellington 4BR townhouse enclave (17 units) per developer (Jul 2026).'),
  -- Emaar Address Villas Hillcrest sits inside Dubai Hills Estate
  ('dubai-hills-estate','address-hillcrest','Address Villas — Hillcrest','ready','high','Emaar/Address branded 5BR lagoon villas within Dubai Hills Estate (Jul 2026); prices pending DLD confirmation.')
) as v(comm, slug, name, status, conf, note)
on conflict (community_id, slug) do update set
  name            = excluded.name,
  status          = excluded.status,
  data_confidence = excluded.data_confidence,
  source_note     = excluded.source_note;
