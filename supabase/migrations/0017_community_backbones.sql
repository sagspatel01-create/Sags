-- =====================================================================
-- 0017 — Community backbones + provenance
--
-- Fills the descriptive "backbone" (handover text, narrative, who-it's-for,
-- character tags) for every remaining skeleton community, and adds two
-- provenance columns carried on every backbone row:
--   data_confidence  high | medium | low   — how firm the row's facts are
--   source_note      free text             — where the facts came from
--
-- Honesty rules (owner's brief):
--  * Idempotent — an upsert on `slug`. Re-running only refreshes the
--    backbone fields; developer, name, status and tier are left as seeded.
--  * NO prices here. Community backbones are structural/qualitative only;
--    launch prices land later via confirmed developer figures / DLD, never
--    invented. Counts also stay null until DLD/developer-confirmed.
--  * Every row is graded. Established communities → high; off-plan launches
--    with public developer positioning → medium; genuinely fuzzy → low.
--  * The 5 communities already carrying depth (dubai-hills-estate, lunaya,
--    nad-al-sheba-gardens, sobha-reserve, the-meadows) are intentionally
--    excluded so their tailored copy is not overwritten.
-- =====================================================================

-- 1. Provenance columns -------------------------------------------------
alter table communities
  add column if not exists data_confidence text,
  add column if not exists source_note     text;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'communities_data_confidence_chk'
  ) then
    alter table communities
      add constraint communities_data_confidence_chk
      check (data_confidence is null or data_confidence in ('high','medium','low'));
  end if;
end $$;

-- 2. Backbone upsert ----------------------------------------------------
-- Keyed on slug. The INSERT branch carries developer/name/status/tier so a
-- fresh database still builds cleanly; on the live (already-seeded) database
-- every row hits ON CONFLICT and only the backbone fields are refreshed.
insert into communities
  (slug, developer_id, name, status, positioning_tier,
   age_or_handover, description_long, who_its_for_base, character_tags,
   is_placeholder, data_confidence, source_note)
select
  v.slug,
  (select id from developers where slug = v.dev),
  v.name,
  v.status::status_tag,
  v.tier::positioning_tier,
  v.age, v.descr, v.who, v.tags::text[],
  false, v.conf, v.note
from (values
  -- ---- Established, ready villa/townhouse communities (high) ----------
  ('the-springs','emaar','The Springs','ready','premium',
   'Ready · first handover ~2004',
   'One of Emaar''s original townhouse communities in Emirates Living — gated, tree-lined clusters of 2–4 bedroom townhouses around lakes and parks, consistently one of Dubai''s most liquid family resale markets.',
   'End-user families and investors who want an affordable, established gated townhouse with a garden, walkable to schools and 15 minutes from Dubai Marina via Al Khail Road.',
   '{established,gated-family,schools-nearby,investment}','high',
   'Established Emaar community; structural & character facts from public market knowledge (Jul 2026); counts/prices pending DLD & developer confirmation.'),

  ('the-lakes','emaar','The Lakes','ready','prime',
   'Ready · handover from ~2006',
   'An upgraded, leafy Emirates Living community of detached and semi-detached villas set around lakes, quieter and greener than its Springs/Meadows neighbours, popular with long-term end users.',
   'Families wanting a mature, detached villa with a garden in a calm, gated setting close to Dubai Marina, Downtown and top schools.',
   '{established,gated-family,prestige,schools-nearby}','high',
   'Established Emaar community; facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('emirates-hills','emaar','Emirates Hills','ready','ultra_prime',
   'Ready · established (custom plots)',
   'Dubai''s original ultra-prime custom-villa address — large freehold plots around the Montgomerie golf course where owners build bespoke mansions. The benchmark for trophy villa land value in the city.',
   'Ultra-high-net-worth buyers seeking a landmark custom mansion or a prime plot to build on, in Dubai''s most prestigious gated golf community.',
   '{ultra-luxury,gated-family,prestige,established,golf,custom-plot}','high',
   'Established custom-plot community; land-value story from public market knowledge (Jul 2026); plot/build figures vary per transaction — pending DLD confirmation.'),

  ('jumeirah-park','nakheel','Jumeirah Park','ready','premium',
   'Ready · handover from ~2011',
   'A large Nakheel community of detached villas on generous landscaped plots, arranged in numbered districts with parks and a community centre — a reliable family villa market near Dubai Marina and JLT.',
   'Families wanting a detached villa with a real garden and flexible layouts, centrally located between Marina, JLT and Sheikh Zayed Road.',
   '{established,gated-family,schools-nearby,central}','high',
   'Established Nakheel community; facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('jumeirah-islands','nakheel','Jumeirah Islands','ready','prime',
   'Ready · handover from ~2006',
   'A prestigious Nakheel community of villas set on 46 landscaped islands surrounded by lakes, known for mature landscaping, water views and a strong owner-occupier base.',
   'End-user families and investors after a detached, waterfront-feel villa in an established, tranquil gated community close to the Marina corridor.',
   '{established,gated-family,prestige,waterfront}','high',
   'Established Nakheel community; facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('al-furjan','nakheel','Al Furjan','ready','mid',
   'Ready · handover from ~2014',
   'A well-connected Nakheel district of villas and townhouses near Discovery Gardens and two metro stations, with steady handovers and a mix of Nakheel and third-party clusters.',
   'Value-focused families and investors who want a modern townhouse or villa with metro access and headroom on price, west of the city.',
   '{established,schools-nearby,investment,central}','high',
   'Established Nakheel district; facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('mudon','dubai-holding','Mudon','ready','mid',
   'Ready · handover from ~2015 (Al Ranim ongoing)',
   'A Dubai Holding family community in Dubailand built around a central park and cycling/running loops, blending established villas with newer Mudon Al Ranim townhouse phases.',
   'Families wanting an active, open-space community with a modern villa or townhouse and good value in the Dubailand corridor.',
   '{established,gated-family,nature,schools-nearby}','high',
   'Dubai Holding community; facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('serena','dubai-holding','Serena','ready','mid',
   'Ready · handover from ~2018',
   'A Mediterranean-themed Dubai Holding townhouse community (Bella Casa, Casa Dora, Casa Viva) in Dubailand, fully handed over and popular with young families for its value and gardens.',
   'First-time villa buyers and families wanting an affordable, gated townhouse with a garden in a completed, amenity-rich community.',
   '{established,gated-family,schools-nearby}','high',
   'Dubai Holding community; facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('villanova','dubai-holding','Villanova','mixed','mid',
   'Ready · phased handovers from ~2018',
   'A large Dubai Holding master community in Dubailand (Amaranta, La Rosa and others) of townhouses and villas, delivered in phases with parks, retail and schools.',
   'Families wanting a modern, affordable townhouse or villa with a garden in a phased, amenity-led community on Al Ain Road.',
   '{established,gated-family,schools-nearby,investment}','high',
   'Dubai Holding community; facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('the-villa','dubai-holding','The Villa','ready','premium',
   'Ready · established',
   'A low-density Dubailand community of large Arabesque/Spanish-style villas on generous plots, known for space and privacy with a more traditional, non-clustered layout.',
   'Families who prioritise plot size, privacy and a detached villa with room to extend, over new-build amenities.',
   '{established,gated-family,schools-nearby}','high',
   'Community facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('victory-heights','union-properties','Victory Heights','ready','premium',
   'Ready · established (Els Golf Club)',
   'An established golf-course villa community in Dubai Sports City with Mediterranean-style detached villas around the Els Club, well-regarded for space, schools and mature landscaping.',
   'Families wanting a spacious detached golf-community villa with schools inside the gates and good value versus prime golf estates.',
   '{established,gated-family,golf,schools-nearby}','high',
   'Community facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('the-sustainable-city','diamond-developers','The Sustainable City','ready','premium',
   'Ready · handover from ~2016',
   'Dubai''s pioneering net-positive community by Diamond Developers — solar-powered villas, car-free residential clusters, urban farms and zero service-charge economics that draw a committed owner base.',
   'Values-driven families wanting a genuinely sustainable, low-running-cost villa with a strong community ethos.',
   '{established,gated-family,wellness,nature,sustainable}','high',
   'Distinctive community; facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('arabian-ranches-2','emaar','Arabian Ranches 2','ready','premium',
   'Ready · handover from ~2015',
   'The second phase of Emaar''s flagship desert-suburb brand — detached villas across themed clusters (Palma, Rosa, Lila, Camelia) around a community centre, pools and schools.',
   'Families wanting an established, detached Emaar villa with a garden in a proven, amenity-complete master community off Sheikh Mohammed Bin Zayed Road.',
   '{established,gated-family,schools-nearby,prestige}','high',
   'Established Emaar community; facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('damac-hills','damac','DAMAC Hills','mixed','premium',
   'Ready · phased (Trump Golf Course)',
   'A large DAMAC master community around the Trump International Golf Club, mixing established villa and townhouse clusters with newer launches, parks and a retail spine.',
   'Families and investors wanting a golf-community villa or townhouse with extensive amenities and a range of entry points.',
   '{established,gated-family,golf,schools-nearby,investment}','high',
   'DAMAC community; facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('palm-jumeirah','nakheel','Palm Jumeirah','mixed','ultra_prime',
   'Ready · established (fronds + new launches)',
   'Dubai''s iconic man-made island — beachfront frond villas (Garden Homes, Signature Villas) plus ultra-prime new launches, the benchmark for waterfront villa prestige and price.',
   'Ultra-high-net-worth buyers seeking a beachfront villa on Dubai''s most recognisable address, for lifestyle and trophy-asset appreciation.',
   '{ultra-luxury,waterfront,prestige,established,beach}','high',
   'Iconic waterfront community; facts from public market knowledge (Jul 2026); frond-plot values vary per transaction — pending DLD confirmation.'),

  ('al-barari','al-barari-developers','Al Barari','mixed','ultra_prime',
   'Ready · phased (Nayaat / new phases)',
   'A green, low-density luxury community off Al Ain Road famed for botanical landscaping, themed lush villas and a wellness-led lifestyle — among the most private ultra-prime villa addresses in Dubai.',
   'Ultra-high-net-worth end users who prize nature, privacy and wellness over a central location, in a signature landscaped estate.',
   '{ultra-luxury,nature,wellness,prestige,established}','high',
   'Distinctive luxury community; facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  -- ---- Prime / established golf & waterfront (high–medium) ------------
  ('jumeirah-golf-estates','dubai-holding','Jumeirah Golf Estates','mixed','prime',
   'Ready · phased (Earth & Fire courses)',
   'A prestigious gated golf community home to two championship courses (host of the DP World Tour Championship), with established villa districts and newer luxury phases.',
   'Golf-loving families and investors wanting a prime, gated villa on a world-class course with strong brand prestige.',
   '{established,gated-family,golf,prestige,nature}','high',
   'Prime golf community; facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('sobha-hartland','sobha','Sobha Hartland','mixed','prime',
   'Ready · phased (MBR City)',
   'A Sobha waterfront community in Mohammed Bin Rashid City with villas and townhouses beside greenery and the Ras Al Khor sanctuary, minutes from Downtown with Sobha''s in-house build quality.',
   'Buyers wanting a centrally located, high-quality villa or townhouse close to Downtown with a green, waterfront setting.',
   '{central,gated-family,waterfront,prestige}','high',
   'Sobha community; facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('tilal-al-ghaf','majid-al-futtaim','Tilal Al Ghaf','mixed','prime',
   'Mixed · ready + off-plan (final phases to ~2027)',
   'Majid Al Futtaim''s flagship lagoon community of ~4,000+ homes — townhouses (Elan) through bespoke villas (Harmony, Aura) to ultra-luxury mansions (Elysian, Lanai Islands) around a recreational crystal lagoon. One of Dubai''s strongest villa-price performers.',
   'Families and investors wanting a lifestyle-led, lagoon-front community with a clear ladder from townhouses to mansions and a proven appreciation record.',
   '{gated-family,waterfront,nature,investment,prestige}','high',
   'Developer + area-guide research (tilalalghaf.com, aggregators, Jul 2026); clusters/handover confirmed; counts approximate; prices pending confirmed launch/DLD figures.'),

  ('district-one','meydan','District One (MBR City)','mixed','ultra_prime',
   'Mixed · phased (Crystal Lagoon)',
   'A gated ultra-prime community in Mohammed Bin Rashid City built around one of the world''s largest crystal lagoons, with mansions and villas minutes from Downtown Dubai and Meydan.',
   'Ultra-high-net-worth buyers wanting a central, gated waterfront mansion or villa within minutes of Downtown.',
   '{ultra-luxury,central,waterfront,prestige,gated-family}','high',
   'Prime MBR City community; facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  -- ---- Off-plan launches, developer-positioned (medium) --------------
  ('the-valley','emaar','The Valley','offplan','premium',
   'Off-plan · phased handovers ~2027–2028 (Rivera/Velora)',
   'An Emaar town on the Dubai–Al Ain Road built around a "town centre", sports village and schools, expanding through Phase 2 (Rivera, Velora) with 4,500+ contemporary townhouses and villas.',
   'Value-seeking families and investors who want a new-build Emaar townhouse or twin villa with a payment plan on the growth corridor toward Al Maktoum Airport.',
   '{new-launch,gated-family,schools-nearby,investment}','medium',
   'Emaar off-plan; positioning & handover window confirmed via developer + listing aggregators (Jul 2026); prices pending confirmed launch figures.'),

  ('the-valley-2','emaar','The Valley 2 (Rivera / Velora)','offplan','premium',
   'Off-plan · handover ~2027–2028',
   'The Phase 2 expansion of Emaar''s The Valley — Rivera twin villas and Velora townhouses on the community''s best-positioned plots, with 80/20 payment plans.',
   'Investors and end users wanting the newest Valley product with a long payment runway and green, park-fronting plots.',
   '{new-launch,gated-family,investment}','medium',
   'Emaar off-plan; Rivera/Velora clusters & handover per developer + aggregators (Jul 2026); prices pending confirmed launch figures.'),

  ('the-oasis','emaar','The Oasis','offplan','ultra_prime',
   'Off-plan · handover ~Q4 2027–Q1 2029',
   'Emaar''s ~100-million-sqft ultra-luxury villa destination west of the city — 4–7 bedroom villas and mansions (Palmiera, Mirage, Lavita) around lakes and water channels, positioned as a successor to Emirates Hills.',
   'Ultra-high-net-worth buyers wanting a large new-build luxury villa or mansion with a payment plan in Emaar''s flagship prime launch.',
   '{new-launch,ultra-luxury,waterfront,nature,prestige}','medium',
   'Emaar off-plan; collections & handover (Palmiera Q4 2027, Lavita ~Q1 2029) confirmed via developer + aggregators (Jul 2026); prices pending confirmed launch figures.'),

  ('grand-polo-club','emaar','Grand Polo Club & Resort','offplan','ultra_prime',
   'Off-plan · handover ~2029 (Selvara / Equiterra)',
   'A ~60-million-sqft Emaar equestrian-themed community near Dubai Investment Park with polo fields, stables and 22 residential clusters of villas and townhouses (Selvara, Equiterra).',
   'Buyers seeking a differentiated, nature-and-equestrian luxury community with a long off-plan runway and Emaar delivery credibility.',
   '{new-launch,ultra-luxury,nature,prestige,gated-family}','medium',
   'Emaar off-plan; clusters, 80/20 plan & ~2029 handover confirmed via developer + aggregators (Jul 2026); prices pending confirmed launch figures.'),

  ('arabian-ranches-3','emaar','Arabian Ranches 3','offplan','premium',
   'Off-plan · phased handovers from ~2024 (ongoing)',
   'The newest Emaar Ranches phase of contemporary townhouses and villas (Sun, Joy, Bliss, Anya, Raya) around a central lagoon and amenities, extending the established Ranches brand.',
   'Families wanting a brand-new Emaar townhouse or villa with a payment plan inside a proven master-brand community.',
   '{new-launch,gated-family,schools-nearby,investment}','medium',
   'Emaar off-plan; clusters/positioning from developer + aggregators (Jul 2026); handover approximate; prices pending confirmed figures.'),

  ('the-acres','meraas','The Acres','offplan','prime',
   'Off-plan · handover ~2027',
   'A Meraas community of standalone villas amid landscaped valleys, swimmable lagoons and orchards off Sheikh Zayed Bin Hamdan Al Nahyan Street, positioned as nature-led family living.',
   'Families and investors wanting a detached, nature-immersed villa with a payment plan in a central-south Meraas launch.',
   '{new-launch,gated-family,nature,investment}','medium',
   'Meraas off-plan; positioning from developer + aggregators (Jul 2026); handover approximate; prices pending confirmed figures.'),

  ('the-cove-creek','emaar','The Cove (Creek Harbour)','offplan','prime',
   'Off-plan · phased handovers ~2027+',
   'Waterfront townhouse/villa elements within Emaar''s Dubai Creek Harbour master plan, offering low-rise family homes beside the creek, marina and Creek Tower district.',
   'Buyers wanting a rare townhouse/villa product inside a prime waterfront high-rise district close to Downtown.',
   '{new-launch,waterfront,central,investment}','medium',
   'Emaar off-plan within Creek Harbour; positioning from developer (Jul 2026); handover approximate; prices pending confirmed figures.'),

  ('sobha-hartland-2','sobha','Sobha Hartland II','offplan','prime',
   'Off-plan · handover ~2027+',
   'The second Sobha Hartland masterplan in MBR City — lagoon-centred villas and townhouses to Sobha''s in-house build standard, extending the central, green waterfront positioning.',
   'Quality-focused buyers wanting a new, centrally located Sobha villa near Downtown with a payment plan.',
   '{new-launch,central,waterfront,prestige}','medium',
   'Sobha off-plan; positioning from developer (Jul 2026); handover approximate; prices pending confirmed figures.'),

  ('sobha-elwood','sobha','Sobha Elwood','offplan','prime',
   'Off-plan · handover ~2028',
   'A Sobha nature-themed villa community on Dubai–Al Ain Road organised around thousands of trees and themed zones, offering 4–5 bedroom detached villas to Sobha''s build standard.',
   'Families wanting a new, tree-dense detached Sobha villa with a payment plan on the eastern growth corridor.',
   '{new-launch,gated-family,nature,investment}','medium',
   'Sobha off-plan; positioning from developer + aggregators (Jul 2026); handover approximate; prices pending confirmed figures.'),

  ('damac-lagoons','damac','DAMAC Lagoons','offplan','premium',
   'Off-plan · phased handovers ~2025–2027',
   'A large DAMAC Mediterranean-themed community of townhouses and villas around swimmable lagoons (Malta, Venice, Portofino and more), opposite DAMAC Hills.',
   'Investors and families wanting a lifestyle-led, lagoon-themed townhouse or villa with a payment plan and a lower entry point than prime lagoon communities.',
   '{new-launch,waterfront,gated-family,investment}','medium',
   'DAMAC off-plan; themed clusters from developer + aggregators (Jul 2026); handover approximate; prices pending confirmed figures.'),

  ('damac-islands','damac','DAMAC Islands','offplan','premium',
   'Off-plan · handover ~2027–2028',
   'A DAMAC community of townhouses and villas themed around tropical islands (Bora Bora, Maldives, Seychelles) with water features and resort amenities, southwest of the city.',
   'Investors wanting a distinctive, resort-themed townhouse or villa with a long payment plan and value pricing.',
   '{new-launch,waterfront,gated-family,investment}','medium',
   'DAMAC off-plan; theming from developer + aggregators (Jul 2026); handover approximate; prices pending confirmed figures.'),

  ('damac-riverside','damac','DAMAC Riverside','offplan','mid',
   'Off-plan · handover ~2027–2028',
   'A DAMAC waterfront-themed townhouse community in Dubai Investment Park 2 built around water and green "portals", positioned as accessible lifestyle living.',
   'Value-focused investors and families wanting a new townhouse with a payment plan and waterfront theming at a low entry point.',
   '{new-launch,waterfront,investment}','medium',
   'DAMAC off-plan; positioning from developer + aggregators (Jul 2026); handover approximate; prices pending confirmed figures.'),

  ('haven-by-aldar','aldar','Haven by Aldar','offplan','premium',
   'Off-plan · handover ~2027–2028',
   'Aldar''s first Dubai master community, a wellness-themed development of villas and townhouses around a central "wadi" and green corridors off Sheikh Mohammed Bin Zayed Road.',
   'Families wanting a wellness-led, new-build villa or townhouse from Aldar with a payment plan in a nature-focused setting.',
   '{new-launch,gated-family,wellness,nature,investment}','medium',
   'Aldar off-plan; wellness positioning from developer (Jul 2026); handover approximate; prices pending confirmed figures.'),

  ('the-sanctuary-by-aldar','aldar','The Sanctuary by Aldar','offplan','ultra_prime',
   'Off-plan · handover ~2027+',
   'An Aldar low-density plotted/villa community positioned at the luxury end, emphasising large plots and privacy in the western Dubai growth corridor.',
   'High-net-worth buyers wanting a large-plot luxury villa or build-ready plot from Aldar with a payment plan.',
   '{new-launch,ultra-luxury,nature,prestige,custom-plot}','medium',
   'Aldar off-plan; positioning from developer (Jul 2026); product mix & handover to verify; prices pending confirmed figures.'),

  ('south-bay','dubai-south','South Bay','offplan','premium',
   'Off-plan · phased handovers ~2026–2028',
   'A Dubai South waterfront community (by Dubai South Properties) of townhouses, semi-detached and detached villas plus mansions around a central crystal lagoon, near Al Maktoum International Airport.',
   'Investors and families betting on the Dubai South / airport growth story who want a lagoon-front villa or townhouse with a payment plan.',
   '{new-launch,waterfront,gated-family,investment}','medium',
   'Dubai South off-plan; positioning from developer + aggregators (Jul 2026); handover approximate; prices pending confirmed figures.'),

  ('the-wilds','ellington','The Wilds','offplan','premium',
   'Off-plan · handover ~2028',
   'An Ellington Properties nature-led villa/townhouse community off Sheikh Mohammed Bin Zayed Road, applying the developer''s design-forward reputation to low-rise family homes.',
   'Design-conscious families and investors wanting a boutique, nature-themed villa or townhouse from a design-led developer.',
   '{new-launch,gated-family,nature,investment}','medium',
   'Ellington off-plan; positioning from developer + aggregators (Jul 2026); handover approximate; prices pending confirmed figures.'),

  ('alma','emaar','Alma (Dubai Hills)','offplan','premium',
   'Off-plan · handover ~2028',
   'A newer Emaar villa/townhouse launch within the Dubai Hills Estate golf-and-park master community, extending the established, high-performing address with contemporary product.',
   'Buyers wanting brand-new Emaar product inside a proven, amenity-complete master community with a payment plan.',
   '{new-launch,golf,gated-family,investment}','medium',
   'Emaar off-plan within Dubai Hills; positioning from developer (Jul 2026); handover approximate; prices pending confirmed figures.'),

  ('palm-jebel-ali','nakheel','Palm Jebel Ali','offplan','ultra_prime',
   'Off-plan · phased handovers ~2027+',
   'Nakheel''s revived second palm island, master-planned for beachfront frond villas at a scale larger than Palm Jumeirah — a flagship ultra-prime waterfront bet for the next cycle.',
   'Ultra-high-net-worth buyers wanting an early position in Dubai''s next iconic beachfront villa island.',
   '{new-launch,ultra-luxury,waterfront,prestige,beach}','medium',
   'Nakheel off-plan; master-plan positioning public (Jul 2026); handover & product detail evolving; prices pending confirmed figures.'),

  ('pearl-jumeirah','pearl-jumeirah','Pearl Jumeirah','offplan','ultra_prime',
   'Off-plan / mixed · phased',
   'A gated island community off Jumeirah 1 (Nikki Beach district) with beachfront plots and luxury villas close to the city and coast, positioned at the ultra-prime end.',
   'High-net-worth buyers wanting a central beachfront villa or plot minutes from the city and Jumeirah lifestyle.',
   '{ultra-luxury,waterfront,central,prestige,beach}','low',
   'Backbone from general market knowledge (Jul 2026); developer program, product mix & handover to verify; prices pending confirmed figures.'),

  ('nad-al-sheba-villas','wasl','Nad Al Sheba Villas','mixed','premium',
   'Mixed · established + new phases',
   'A central Nad Al Sheba community (largely wasl/government-linked) of villas close to Meydan and Downtown, blending established stock with newer releases.',
   'Families wanting a central, well-connected villa near Meydan and Downtown with a range of entry points.',
   '{central,gated-family,schools-nearby}','low',
   'Backbone from general market knowledge (Jul 2026); developer program & counts to verify; prices pending confirmed figures.'),

  ('tilal-al-furjan','nakheel','Tilal Al Furjan','mixed','premium',
   'Ready / mixed · phased',
   'A premium villa enclave within the wider Al Furjan district by Nakheel, offering larger contemporary detached villas with more space and privacy than the surrounding townhouse clusters.',
   'Families wanting a larger, detached villa with metro access and value in the established Al Furjan corridor.',
   '{gated-family,schools-nearby,central}','low',
   'Backbone from general market knowledge (Jul 2026); counts/handover to verify; prices pending confirmed figures.'),

  ('jebel-ali-village','nakheel','Jebel Ali Village','mixed','premium',
   'Mixed · heritage + new villa phases',
   'A revived Nakheel community on the site of the original Jebel Ali Village, delivering new detached villas amid mature trees and generous plots in the western corridor.',
   'Families wanting a spacious, green detached villa in the west with a payment plan and heritage-district character.',
   '{gated-family,nature,new-launch}','low',
   'Backbone from general market knowledge (Jul 2026); product mix & handover to verify; prices pending confirmed figures.'),

  ('meydan-gardens','meydan','Meydan Gardens (Polo Homes)','mixed','prime',
   'Mixed · Meydan / Nad Al Sheba',
   'Villa product within the Meydan / Nad Al Sheba district close to the racecourse and Downtown, part of Meydan''s central, prestige-positioned residential offer.',
   'Buyers wanting a central, prestige-adjacent villa near Meydan and Downtown.',
   '{central,gated-family,prestige}','low',
   'Backbone from general market knowledge (Jul 2026); exact product mix, counts & handover to verify; prices pending confirmed figures.'),

  -- ---- Mid / accessible communities (medium–low) ---------------------
  ('reem-mira','emaar','Reem (Mira)','ready','mid',
   'Ready · handover from ~2015',
   'An Emaar community (Mira and Mira Oasis) of affordable townhouses around parks and a town centre in Reem, Dubailand — a popular, well-established value family market.',
   'First-time buyers and families wanting an affordable, established Emaar townhouse with a garden and community amenities.',
   '{established,gated-family,schools-nearby,investment}','high',
   'Established Emaar community; facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('town-square','nshama','Town Square','mixed','accessible',
   'Mixed · phased handovers from ~2018',
   'Nshama''s value-led master community (Zahra, Hayat, Warda townhouses) around a large central park, one of Dubai''s most accessible new townhouse markets.',
   'First-time buyers and investors wanting the lowest-entry new townhouse with a garden in an amenity-rich, park-centred community.',
   '{established,gated-family,schools-nearby,investment}','high',
   'Nshama community; facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('emaar-south','emaar','Emaar South','mixed','mid',
   'Mixed · phased handovers ~2020+',
   'An Emaar golf-anchored community beside Al Maktoum International Airport in Dubai South, with townhouses and villas positioned on the airport/Expo growth corridor.',
   'Investors and families betting on the Dubai South growth story who want an affordable Emaar townhouse or villa with a payment plan.',
   '{gated-family,golf,schools-nearby,investment}','medium',
   'Emaar community; positioning from public knowledge (Jul 2026); counts/handover to confirm; prices pending confirmed figures.'),

  ('jumeirah-village-triangle','nakheel','Jumeirah Village Triangle','mixed','mid',
   'Ready · established',
   'A central Nakheel community (JVT) of villas and townhouses on a compact triangular grid between Al Khail Road and Sheikh Mohammed Bin Zayed Road, popular for value and location.',
   'Value-focused families and investors wanting a central townhouse or villa with easy access to both main highways.',
   '{established,central,schools-nearby,investment}','high',
   'Nakheel community; facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('uptown-mirdif','dubai-holding','Uptown Mirdif','ready','mid',
   'Ready / mixed · established Mirdif',
   'Villa and townhouse product in the established, family-oriented Mirdif district (Dubai Holding / Dubai Properties), known for schools, parks and proximity to the airport.',
   'End-user families wanting a settled, school-rich district near the airport with a range of villa options.',
   '{established,gated-family,schools-nearby}','low',
   'Backbone from general market knowledge (Jul 2026); exact product mix & counts to verify; prices pending confirmed figures.'),

  ('green-community-dip','union-properties','Green Community (DIP)','ready','mid',
   'Ready · established',
   'A mature, low-density Union Properties community in Dubai Investment Park, known for dense greenery, lakes and independent villas away from the city bustle.',
   'Families wanting a quiet, green, established detached villa with mature landscaping in the west.',
   '{established,gated-family,nature,schools-nearby}','medium',
   'Community facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('green-community-motor-city','union-properties','Green Community (Motor City)','ready','mid',
   'Ready · established',
   'The Motor City extension of Green Community by Union Properties — leafy villas and townhouses near Dubai Autodrome, blending greenery with a central Dubailand location.',
   'Families wanting an established, green villa or townhouse with amenities in a central Dubailand setting.',
   '{established,gated-family,nature,schools-nearby}','medium',
   'Community facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('cherrywoods','emaar','Cherrywoods','ready','mid',
   'Ready · handover from ~2019',
   'A compact Emaar townhouse community on Al Qudra Road with contemporary 3–4 bedroom townhouses around a community centre and pools, delivered and settled.',
   'Families wanting an affordable, modern Emaar townhouse with a garden in a smaller, quieter community.',
   '{established,gated-family,schools-nearby}','medium',
   'Emaar community; facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('living-legends','tanmiyat','Living Legends','ready','premium',
   'Ready · established',
   'A Tanmiyat community in Dubailand of independent villas and towers around a golf course and lakes, offering large detached villas at accessible pricing.',
   'Families wanting a large detached villa with golf-and-lake surroundings and strong value in Dubailand.',
   '{established,gated-family,golf,nature}','low',
   'Backbone from general market knowledge (Jul 2026); counts & amenities to verify; prices pending confirmed figures.'),

  ('the-pulse','dubai-south','The Pulse','mixed','accessible',
   'Mixed · phased handovers ~2021+',
   'A Dubai South community (townhouses, villas and beachfront elements) positioned as accessible living near Al Maktoum International Airport and Expo City.',
   'Value-focused investors and families betting on Dubai South growth who want a low-entry townhouse or villa.',
   '{new-launch,gated-family,investment}','low',
   'Backbone from general market knowledge (Jul 2026); product mix, counts & handover to verify; prices pending confirmed figures.'),

  ('damac-hills-2','damac','DAMAC Hills 2','mixed','accessible',
   'Mixed · phased handovers ~2019+',
   'A large, value-led DAMAC community (formerly Akoya) far south of the city with themed townhouses and villas, water attractions and its own amenities — Dubai''s most accessible villa entry point.',
   'First-time buyers and yield-focused investors wanting the lowest-entry new villa or townhouse, accepting a peripheral location.',
   '{established,gated-family,investment}','medium',
   'DAMAC community; facts from public market knowledge (Jul 2026); counts/prices pending confirmation.'),

  ('verdana','reportage','Verdana','offplan','accessible',
   'Off-plan · phased handovers ~2026+',
   'A Reportage Properties community in Dubai Investment Park of value townhouses and villas, marketed on very low entry prices and long payment plans.',
   'Budget-first investors and first-time buyers wanting the lowest-entry new villa/townhouse with an extended payment plan.',
   '{new-launch,investment}','low',
   'Backbone from general market knowledge (Jul 2026); counts & handover to verify; prices pending confirmed launch figures.'),

  ('rukan','reportage','Rukan','mixed','accessible',
   'Mixed · phased',
   'A value-oriented community in Wadi Al Safa (Dubailand) of townhouses and terraced homes at accessible pricing with payment plans.',
   'Budget-focused buyers wanting an affordable townhouse with a payment plan in the Dubailand corridor.',
   '{gated-family,investment}','low',
   'Backbone from general market knowledge (Jul 2026); developer program, counts & handover to verify; prices pending confirmed figures.'),

  ('falcon-city','dubai-holding','Falcon City of Wonders','mixed','mid',
   'Mixed · established + phases',
   'A themed Dubailand community of large villas (some replica-landmark designs) on generous plots, offering space and novelty at mid-market pricing.',
   'Families wanting a large detached villa on a big plot with value pricing in a themed Dubailand setting.',
   '{established,gated-family,schools-nearby}','low',
   'Backbone from general market knowledge (Jul 2026); counts & product mix to verify; prices pending confirmed figures.'),

  ('wasl-gate','wasl','Wasl Gate','mixed','mid',
   'Mixed · phased',
   'A wasl community near Jebel Ali with townhouses and low-rise homes beside retail (including a large park and mall district) on Sheikh Zayed Road.',
   'Value-focused families wanting a townhouse with retail and highway access in the western corridor.',
   '{new-launch,central,investment}','low',
   'Backbone from general market knowledge (Jul 2026); product mix, counts & handover to verify; prices pending confirmed figures.'),

  ('warsan-village','nakheel','Warsan Village','ready','accessible',
   'Ready · established',
   'A compact, established Nakheel townhouse community in International City / Warsan, among the most accessible ready townhouse options in the city.',
   'First-time buyers and yield-focused investors wanting a very-low-entry ready townhouse.',
   '{established,investment}','low',
   'Backbone from general market knowledge (Jul 2026); counts to verify; prices pending confirmed figures.')
) as v(slug, dev, name, status, tier, age, descr, who, tags, conf, note)
on conflict (slug) do update set
  age_or_handover  = excluded.age_or_handover,
  description_long = excluded.description_long,
  who_its_for_base = excluded.who_its_for_base,
  character_tags   = excluded.character_tags,
  is_placeholder   = false,
  data_confidence  = excluded.data_confidence,
  source_note      = excluded.source_note;
