-- =====================================================================
-- 0019 — Coverage expansion: close the registry gaps
--
-- Fills named gaps so no villa/townhouse community or cluster is missing:
--  * The Springs   — all 15 numbered districts (had 5)
--  * The Meadows   — all 9 numbered districts (had 4)
--  * Jumeirah Islands — the theme clusters (European, Oasis, Entertainment Foyer)
--  * Dubai Islands (Nakheel) — NEW master + the Bay-series villa/TH communities
--  * Bayn by Ora  — NEW off-plan master (Ora Developers)
--
-- Structural facts only (name, developer, ready/offplan, tier); idempotent
-- upsert; provenance on every row; no invented prices or counts. Truly
-- exhaustive city-wide coverage (every registered project + new launches)
-- is the job of the DLD Projects registry sync — this closes the known,
-- high-value gaps now.
-- =====================================================================

-- New developer: Ora Developers (Bayn) --------------------------------
insert into developers (name, slug) values ('Ora Developers','ora')
on conflict (slug) do nothing;

-- New master communities ----------------------------------------------
insert into communities
  (slug, developer_id, name, status, positioning_tier, geo_center,
   age_or_handover, description_long, who_its_for_base, character_tags,
   is_placeholder, data_confidence, source_note)
select v.slug, (select id from developers where slug=v.dev), v.name,
       v.status::status_tag, v.tier::positioning_tier,
       case when v.lng is not null then ST_SetSRID(ST_MakePoint(v.lng,v.lat),4326)::geography end,
       v.age, v.descr, v.who, v.tags::text[], false, v.conf, v.note
from (values
  ('dubai-islands','nakheel','Dubai Islands','offplan','prime', 55.3400, 25.2900,
   'Off-plan · phased handovers ~2027+',
   'Nakheel''s five-island, ~17 sqkm master plan transforming Dubai''s northern shoreline (formerly Deira Islands) — beachfront villa and townhouse collections (the Bay series) alongside branded resorts and marinas.',
   'Investors and end-users wanting an early beachfront position in Dubai''s major new northern waterfront district, with a developer payment plan.',
   '{new-launch,waterfront,beach,investment,prestige}','medium',
   'Nakheel off-plan; master-plan & Bay-series collections from developer + aggregators (Jul 2026); handover/prices pending confirmed figures.'),
  ('bayn','ora','Bayn by Ora','offplan','prime', null, null,
   'Off-plan · handover ~2028+',
   'An Ora Developers (Naguib Sawiris) master community positioned as a nature-and-wellness-led villa/townhouse destination — one of the newer branded launches in the Dubai growth corridor.',
   'Investors and end-users seeking a differentiated, wellness-led branded community with a long off-plan payment runway.',
   '{new-launch,nature,wellness,investment}','low',
   'Ora off-plan; positioning from developer launch info (Jul 2026); location, product mix, handover & prices to verify.')
) as v(slug, dev, name, status, tier, lng, lat, age, descr, who, tags, conf, note)
on conflict (slug) do update set
  age_or_handover  = excluded.age_or_handover,
  description_long = excluded.description_long,
  who_its_for_base = excluded.who_its_for_base,
  character_tags   = excluded.character_tags,
  is_placeholder   = false,
  data_confidence  = excluded.data_confidence,
  source_note      = excluded.source_note;

-- New sub-communities (structural registry rows) ----------------------
insert into sub_communities
  (community_id, slug, name, status, is_placeholder, data_confidence, source_note)
select (select id from communities where slug=v.comm),
       v.slug, v.name, v.status::status_tag, true, v.conf, v.note
from (values
  -- The Springs — remaining numbered districts (1,3,7,14,15 already present)
  ('the-springs','springs-2','Springs 2','ready','high','Emirates Living numbered district; structural fact (Emaar, ready) from ECM/area guides (Jul 2026).'),
  ('the-springs','springs-4','Springs 4','ready','high','Emirates Living numbered district; structural fact (Emaar, ready) from ECM/area guides (Jul 2026).'),
  ('the-springs','springs-5','Springs 5','ready','high','Emirates Living numbered district; structural fact (Emaar, ready) from ECM/area guides (Jul 2026).'),
  ('the-springs','springs-6','Springs 6','ready','high','Emirates Living numbered district; structural fact (Emaar, ready) from ECM/area guides (Jul 2026).'),
  ('the-springs','springs-8','Springs 8','ready','high','Emirates Living numbered district; structural fact (Emaar, ready) from ECM/area guides (Jul 2026).'),
  ('the-springs','springs-9','Springs 9','ready','high','Emirates Living numbered district; structural fact (Emaar, ready) from ECM/area guides (Jul 2026).'),
  ('the-springs','springs-10','Springs 10','ready','high','Emirates Living numbered district; structural fact (Emaar, ready) from ECM/area guides (Jul 2026).'),
  ('the-springs','springs-11','Springs 11','ready','high','Emirates Living numbered district; structural fact (Emaar, ready) from ECM/area guides (Jul 2026).'),
  ('the-springs','springs-12','Springs 12','ready','high','Emirates Living numbered district; structural fact (Emaar, ready) from ECM/area guides (Jul 2026).'),
  ('the-springs','springs-13','Springs 13','ready','medium','Emirates Living numbered district; existence to confirm against ECM registry (Jul 2026).'),
  -- The Meadows — remaining numbered districts (1,4,8,9 already present)
  ('the-meadows','meadows-2','Meadows 2','ready','high','Emirates Living numbered district; structural fact (Emaar, ready) from ECM/area guides (Jul 2026).'),
  ('the-meadows','meadows-3','Meadows 3','ready','high','Emirates Living numbered district; structural fact (Emaar, ready) from ECM/area guides (Jul 2026).'),
  ('the-meadows','meadows-5','Meadows 5','ready','high','Emirates Living numbered district; structural fact (Emaar, ready) from ECM/area guides (Jul 2026).'),
  ('the-meadows','meadows-6','Meadows 6','ready','high','Emirates Living numbered district; structural fact (Emaar, ready) from ECM/area guides (Jul 2026).'),
  ('the-meadows','meadows-7','Meadows 7','ready','high','Emirates Living numbered district; structural fact (Emaar, ready) from ECM/area guides (Jul 2026).'),
  -- Jumeirah Islands — theme clusters (garden-hall, master-views, mediterranean already present)
  ('jumeirah-islands','european-clusters','European Clusters','ready','high','Jumeirah Islands theme cluster; from Nakheel/area guides (Jul 2026).'),
  ('jumeirah-islands','oasis-clusters','Oasis Clusters','ready','high','Jumeirah Islands theme cluster; from Nakheel/area guides (Jul 2026).'),
  ('jumeirah-islands','entertainment-foyer','Entertainment Foyer','ready','high','Jumeirah Islands villa style/cluster; from Nakheel/area guides (Jul 2026).'),
  -- Tilal Al Furjan — two gated phases (villas already present as one row)
  ('tilal-al-furjan','tilal-al-furjan-phase-1','Tilal Al Furjan — Phase 1','ready','medium','Nakheel: Tilal Al Furjan comprises two gated phases of 4–5BR villas (Jul 2026); cluster naming to confirm.'),
  ('tilal-al-furjan','tilal-al-furjan-phase-2','Tilal Al Furjan — Phase 2','ready','medium','Nakheel: Tilal Al Furjan comprises two gated phases of 4–5BR villas (Jul 2026); cluster naming to confirm.'),
  -- Dubai Islands — Bay-series villa/townhouse communities
  ('dubai-islands','bay-villas','Bay Villas','offplan','medium','Nakheel Dubai Islands: 3–6BR beachfront villas/townhouses (Jul 2026); prices/handover pending confirmed figures.'),
  ('dubai-islands','bay-collection','Bay Collection','offplan','medium','Nakheel Dubai Islands: premium beachfront villa/townhouse collection (Jul 2026); prices/handover pending confirmed figures.'),
  ('dubai-islands','bay-estate','Bay Estate','offplan','low','Nakheel Dubai Islands: exclusive villa community (Island E) per aggregators (Jul 2026); details to confirm.'),
  ('dubai-islands','bay-collective','Bay Collective','offplan','low','Nakheel Dubai Islands: waterfront villa/townhouse community (Islands B&C) per aggregators (Jul 2026); details to confirm.')
) as v(comm, slug, name, status, conf, note)
on conflict (community_id, slug) do update set
  name            = excluded.name,
  status          = excluded.status,
  data_confidence = excluded.data_confidence,
  source_note     = excluded.source_note;
