-- =====================================================================
-- 0024 — Community dossier depth, batch 1 (highest-liquidity communities)
--
-- Sourced, non-volatile community-level facts (description, master-plan
-- anchors, product bedroom/size ranges, positioning, handover status) for the
-- six most-transacted villa/townhouse communities. Developer/portal-sourced,
-- verified Jul 2026. No prices or invented figures — market numbers stay in
-- market_snapshots (DLD). Idempotent: UPDATE by slug.
-- =====================================================================

update communities set
  description_long = 'The Valley is Emaar''s family-oriented master community on the Dubai–Al Ain Road (E66), launched in 2019 and built around a Golden Beach, landscaped pavilions and a planned Town Centre. Its product is 3–4 bedroom townhouses (roughly 1,988–2,311 sq ft), semi-detached 4–5 bedroom villas, and larger standalone villas in the newer Phase-2 clusters, which carry larger plots and a more premium positioning. A gated, low-rise, green community aimed at value-conscious end-user families reaching for the Emaar brand outside the central corridor.',
  who_its_for_base = 'Value-conscious end-user families who want a new, gated, green Emaar townhouse/villa community with resort-style amenities, accepting a further-out location on the Al Ain Road for a lower entry price.',
  age_or_handover = 'Master community launched 2019 · Phase-1 clusters (Eden, Talia, Nara, Alana) handed over / near handover; Phase 2 to 2028–2030',
  positioning_tier = 'mid',
  master_plan_features = '["Golden Beach & swimmable water feature","The Pavilion (gardens & relaxation)","Sports Village (cycling & fitness tracks)","Kids'' Dale adventure playgrounds","Planned Town Centre retail & dining","Dubai–Al Ain Road (E66) access"]'::jsonb,
  is_placeholder = false,
  data_confidence = 'high',
  source_note = 'Emaar published community facts + master-plan (developer site & major portals), verified Jul 2026.',
  updated_at = now()
where slug = 'the-valley';

update communities set
  description_long = 'Arabian Ranches 3 is Emaar''s third-generation Ranches master community in Dubailand — over 4,000 villas and townhouses in 3–5 bedroom configurations across themed clusters (Sun, Joy, Ruba, Bliss, Caya, Spring, Anya, May, June, Raya and the Elie Saab villa line). It centres on a ~7.5-acre central park with a cycling track, cricket field, sports courts, skate park and adventure zones, with schools, a mosque and a shopping plaza planned within the community. A contemporary, amenity-dense family address that extends the blue-chip Ranches brand.',
  who_its_for_base = 'Families wanting a modern, amenity-rich gated Emaar villa/townhouse community with a strong central park and the established Arabian Ranches pedigree.',
  age_or_handover = 'Phased handovers from ~2022; several clusters delivered, newer clusters ongoing',
  positioning_tier = 'premium',
  master_plan_features = '["~7.5-acre central park","Cycling track & cricket field","15+ sports courts, skate park, parkour","Themed architectural clusters","Community schools, mosque & shopping plaza"]'::jsonb,
  is_placeholder = false,
  data_confidence = 'high',
  source_note = 'Emaar published community facts + master-plan (developer site & major portals), verified Jul 2026.',
  updated_at = now()
where slug = 'arabian-ranches-3';

update communities set
  description_long = 'DAMAC Lagoons is a 45-million-sq-ft villa-and-townhouse master community in Dubailand built around man-made crystal lagoons and water features, with Mediterranean-themed clusters — Santorini, Costa Brava, Nice, Portofino, Venice, Malta, Marbella, Morocco, Monte Carlo, Mykonos and Ibiza — each with a distinct architectural language. Product spans 4–7 bedroom townhouses and villas (no apartments), a deliberate lower-density, family-and-space positioning. Early clusters were delivered in Q4 2024 with remaining phases handing over through ~2027.',
  who_its_for_base = 'Families and investors seeking a themed, water-led townhouse/villa community at an accessible-to-mid entry price, with a large amenity spine and strong off-plan supply.',
  age_or_handover = '45M sq ft master plan; early clusters (Portofino, Nice, Costa Brava) delivered Q4 2024; remaining phases through ~2027',
  positioning_tier = 'mid',
  master_plan_features = '["Crystal lagoons & beaches across clusters","Mediterranean-themed cluster architecture","Villa/townhouse only (no apartments)","Central retail & dining spine","Community parks & water sports"]'::jsonb,
  is_placeholder = false,
  data_confidence = 'high',
  source_note = 'DAMAC published community facts + master-plan (developer site & major portals), verified Jul 2026.',
  updated_at = now()
where slug = 'damac-lagoons';

update communities set
  description_long = 'Emaar South is Emaar''s master community in Dubai South, adjacent to Al Maktoum International Airport (DWC) and the Expo district, arranged around an 18-hole championship golf course. The masterplan spans 15,000+ homes — 1–3 bedroom apartments, 3-bedroom townhouses, and 4–5 bedroom golf-fronting villas (Golf Links, Golf Links, Golf Lane and related lines) — with retail, community parks and a planned branded hotel. Positioned as an accessible-to-mid golf-and-airport growth corridor with strong off-plan supply.',
  who_its_for_base = 'Investors and end-users betting on the Dubai South / Al Maktoum airport growth corridor who want golf-fronting Emaar villas or townhouses at a lower entry price than central Dubai.',
  age_or_handover = 'Master plan around an 18-hole golf course; townhouse phases delivered, many villa clusters off-plan with handovers ~2026–2029',
  positioning_tier = 'mid',
  master_plan_features = '["18-hole championship golf course","Adjacent to Al Maktoum Intl (DWC) & Expo City","Golf-fronting villa collections","Community parks & retail","Planned branded hotel"]'::jsonb,
  is_placeholder = false,
  data_confidence = 'high',
  source_note = 'Emaar published community facts + master-plan (developer site & major portals), verified Jul 2026.',
  updated_at = now()
where slug = 'emaar-south';

update communities set
  description_long = 'DAMAC Islands is a 30-million-sq-ft island-inspired master community in Dubailand, launched in November 2024 with six tropical-themed clusters — Maldives, Bora Bora, Fiji, Seychelles, Bali and Hawaii. Current releases centre on 4–5 bedroom townhouses and villas (roughly 2,200–5,000+ sq ft) plus larger 6–7 bedroom luxury villas, wrapped in crystal lagoons, private beaches, an aqua dome, wave pools, a wellness spa and a clubhouse. Its Phase-1 launch sold out in 24 hours for AED 10.2bn, a Guinness record for a single-day real-estate launch.',
  who_its_for_base = 'Off-plan investors and space-seeking families drawn to a resort-themed, waterfront DAMAC community with record launch momentum and a full-amenity island concept.',
  age_or_handover = 'Launched Nov 2024 (Phase 1 sold out in 24h — Guinness record AED 10.2B); off-plan, handovers from ~2028',
  positioning_tier = 'premium',
  master_plan_features = '["Six tropical-themed clusters","Crystal lagoons & private beaches","Aqua dome, wave pools & wellness spa","Villa/townhouse resort concept","Record-setting launch demand"]'::jsonb,
  is_placeholder = false,
  data_confidence = 'high',
  source_note = 'DAMAC published community facts + master-plan (developer site & major portals), verified Jul 2026.',
  updated_at = now()
where slug = 'damac-islands';

update communities set
  description_long = 'DAMAC Hills 2 (formerly Akoya Oxygen) is a self-contained 42-million-sq-ft DAMAC master community in Dubailand with 3–6 bedroom villas and townhouses — 3-bedroom townhouses roughly 1,232–1,979 sq ft and 4-bedroom townhouses roughly 2,352–3,369 sq ft, many with maid''s rooms, rooftop terraces and private gardens. It is organised around five themed leisure zones (Motor Town, Water Town, Down Town, Equestrian Town, Sports Town) plus a Malibu Beach wave pool, floating cinema and fishing lake. Dubai''s most affordable large villa/townhouse address, favoured for high rental yield and accessible entry pricing.',
  who_its_for_base = 'Yield-focused investors and first-rung villa buyers who want the lowest entry price into a full-amenity DAMAC villa/townhouse community, accepting the far-out Dubailand location.',
  age_or_handover = '42M sq ft master community (formerly Akoya Oxygen); largely delivered with ongoing releases',
  positioning_tier = 'accessible',
  master_plan_features = '["Five themed leisure zones (Motor/Water/Down/Equestrian/Sports Town)","Malibu Beach wave pool & Splash Pad","Floating cinema & fishing lake","3–6 BR villas & townhouses","Dubai''s most accessible large villa community"]'::jsonb,
  is_placeholder = false,
  data_confidence = 'high',
  source_note = 'DAMAC published community facts + master-plan (developer site & major portals), verified Jul 2026.',
  updated_at = now()
where slug = 'damac-hills-2';
