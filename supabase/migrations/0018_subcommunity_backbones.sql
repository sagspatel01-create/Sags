-- =====================================================================
-- 0018 — Sub-community backbones + provenance (batch 1: flagships)
--
-- The level below the master community — the individual clusters a client
-- actually chooses between. Mirrors 0017: adds data_confidence/source_note
-- to sub_communities (the live database already carries them; this keeps a
-- fresh build in sync) and fills real backbones for the first batch of
-- high-value, well-documented clusters.
--
-- Honesty rules (unchanged): idempotent upsert on (community_id, slug); no
-- invented prices or counts; every backbone row graded + sourced. Obscure
-- clusters are deliberately left untouched (unverified) rather than guessed.
-- Batch 1 covers Arabian Ranches 2, Dubai Hills Estate, Jumeirah Park and
-- The Springs — later batches extend cluster by cluster.
-- =====================================================================

-- 1. Provenance columns on sub_communities ------------------------------
alter table sub_communities
  add column if not exists data_confidence text,
  add column if not exists source_note     text;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'sub_communities_data_confidence_chk'
  ) then
    alter table sub_communities
      add constraint sub_communities_data_confidence_chk
      check (data_confidence is null or data_confidence in ('high','medium','low','unverified'));
  end if;
end $$;

-- 2. Backbone upsert ----------------------------------------------------
insert into sub_communities
  (community_id, slug, name, status,
   description_long, who_its_for_base,
   is_placeholder, data_confidence, source_note)
select
  (select id from communities where slug = v.comm),
  v.slug, v.name, v.status::status_tag,
  v.descr, v.who,
  false, v.conf, v.note
from (values
  -- ---- Arabian Ranches 2 (established, ready) ------------------------
  ('arabian-ranches-2','palma','Palma','ready',
   'Arabesque-styled detached 4–6 bedroom villas — among Arabian Ranches 2''s larger, more private layouts on generous plots.',
   'Families wanting a spacious, traditional-styled detached villa with a big garden in an established Ranches cluster.',
   'high','Established cluster; layout/character from public market knowledge & developer info (Jul 2026); counts/prices pending DLD confirmation.'),
  ('arabian-ranches-2','rosa','Rosa','ready',
   'Spanish-inspired 3–5 bedroom detached villas around parks and pools — one of AR2''s most popular family clusters.',
   'Families wanting a detached villa with a garden in a sought-after, amenity-close Ranches cluster.',
   'high','Established cluster; layout/character from public market knowledge & developer info (Jul 2026); counts/prices pending DLD confirmation.'),
  ('arabian-ranches-2','lila','Lila','ready',
   'Contemporary 3–5 bedroom detached villas with clean lines, family-oriented and centrally placed within AR2.',
   'Families wanting a modern detached villa with a garden close to the community centre and schools.',
   'high','Established cluster; layout/character from public market knowledge & developer info (Jul 2026); counts/prices pending DLD confirmation.'),
  ('arabian-ranches-2','camelia','Camelia','ready',
   '3–4 bedroom townhouses and semi-detached villas — an efficient, more accessible entry point within Arabian Ranches 2.',
   'Buyers wanting a lower-entry townhouse or semi-detached home inside an established, prestige master community.',
   'high','Established cluster; layout/character from public market knowledge & developer info (Jul 2026); counts/prices pending DLD confirmation.'),
  ('arabian-ranches-2','azalea','Azalea','ready',
   '3–4 bedroom townhouses arranged around shared pools and parks — AR2''s value family cluster.',
   'First-time villa buyers and families wanting an affordable townhouse with a garden in the Ranches.',
   'high','Established cluster; layout/character from public market knowledge & developer info (Jul 2026); counts/prices pending DLD confirmation.'),

  -- ---- Dubai Hills Estate (mixed) -----------------------------------
  ('dubai-hills-estate','emerald-hills','Emerald Hills','offplan',
   'A custom-plot district for bespoke mansions — buyers acquire land and build to their own design. The ultra-prime tier of Dubai Hills.',
   'Ultra-high-net-worth buyers who want to build a bespoke mansion on a prime plot inside a proven master community.',
   'high','Custom-plot district; land-and-build model from developer info & public knowledge (Jul 2026); plot/build values vary per transaction — pending DLD confirmation.'),
  ('dubai-hills-estate','golf-place','Golf Place','ready',
   'Premium detached 4–6 bedroom villas near or overlooking the championship golf course — one of Dubai Hills'' most prestigious ready clusters.',
   'Families and investors wanting a prestigious, golf-adjacent detached villa with a strong resale record.',
   'high','Established cluster; layout/character from public market knowledge & developer info (Jul 2026); counts/prices pending DLD confirmation.'),
  ('dubai-hills-estate','fairway-vistas','Fairway Vistas','ready',
   'Large golf-fronting detached villas with premium positioning along the fairways of Dubai Hills.',
   'Buyers wanting a large, golf-fronting detached villa at the premium end of the ready market.',
   'high','Established cluster; layout/character from public market knowledge & developer info (Jul 2026); counts/prices pending DLD confirmation.'),
  ('dubai-hills-estate','parkway-vistas','Parkway Vistas','ready',
   'Spacious detached villas oriented to the central park and green spine of Dubai Hills Estate.',
   'Families wanting a large detached villa fronting parkland rather than the golf course.',
   'high','Established cluster; layout/character from public market knowledge & developer info (Jul 2026); counts/prices pending DLD confirmation.'),
  ('dubai-hills-estate','majestic-vistas','Majestic Vistas','ready',
   'The largest detached villas in Dubai Hills — expansive plots and premium layouts at the top of the standard (non-custom) range.',
   'Buyers wanting maximum space and a large plot in a ready, gated golf-and-park community.',
   'high','Established cluster; layout/character from public market knowledge & developer info (Jul 2026); counts/prices pending DLD confirmation.'),
  ('dubai-hills-estate','club-villas','Club Villas','ready',
   'Contemporary townhouse-style villas near the golf clubhouse and amenities — a more accessible entry into the Dubai Hills address.',
   'Buyers wanting a lower-entry, low-maintenance home with a garden inside a prime master community.',
   'high','Established cluster; layout/character from public market knowledge & developer info (Jul 2026); counts/prices pending DLD confirmation.'),

  -- ---- Jumeirah Park (established, ready) ----------------------------
  ('jumeirah-park','legacy','Legacy','ready',
   'The Legacy villa style — modern detached 3–5 bedroom family villas, the most common layout across Jumeirah Park.',
   'Families wanting a detached villa with a garden in a central, established Nakheel community near the Marina corridor.',
   'high','Established villa style; character from public market knowledge (Jul 2026); counts/prices pending DLD confirmation.'),
  ('jumeirah-park','heritage','Heritage','ready',
   'The Heritage villa style — more traditional detached family villas on generous plots within Jumeirah Park.',
   'Families wanting a traditional-styled detached villa with space and a large garden, centrally located.',
   'high','Established villa style; character from public market knowledge (Jul 2026); counts/prices pending DLD confirmation.'),
  ('jumeirah-park','regional','Regional','ready',
   'The Regional villa style — Mediterranean-influenced detached villas, a distinct architectural line in Jumeirah Park.',
   'Families wanting a characterful, Mediterranean-style detached villa in an established central community.',
   'high','Established villa style; character from public market knowledge (Jul 2026); counts/prices pending DLD confirmation.'),
  ('jumeirah-park','legacy-nova','Legacy Nova','ready',
   'A newer Legacy Nova line of detached villas with updated layouts within the established Jumeirah Park grid.',
   'Families wanting a more recent detached-villa layout inside a mature, central community.',
   'medium','Villa style from public market knowledge (Jul 2026); layout specifics to verify; counts/prices pending DLD confirmation.'),

  -- ---- The Springs (established, ready) — numbered lake districts -----
  ('the-springs','springs-1','Springs 1','ready',
   'One of The Springs'' numbered lake districts of 2–4 bedroom townhouses with gardens; districts differ mainly by townhouse type and proximity to the lakes and community centre.',
   'Families and investors wanting an affordable, established gated townhouse with a garden near Dubai Marina.',
   'medium','Established district; per-district type mix varies — general facts from public market knowledge (Jul 2026); counts/prices pending DLD confirmation.'),
  ('the-springs','springs-3','Springs 3','ready',
   'A numbered lake district of 2–4 bedroom townhouses in The Springs; districts vary by townhouse type and lake/park position.',
   'Families and investors wanting an affordable, established gated townhouse with a garden near Dubai Marina.',
   'medium','Established district; per-district type mix varies — general facts from public market knowledge (Jul 2026); counts/prices pending DLD confirmation.'),
  ('the-springs','springs-7','Springs 7','ready',
   'A numbered lake district of 2–4 bedroom townhouses in The Springs; districts vary by townhouse type and lake/park position.',
   'Families and investors wanting an affordable, established gated townhouse with a garden near Dubai Marina.',
   'medium','Established district; per-district type mix varies — general facts from public market knowledge (Jul 2026); counts/prices pending DLD confirmation.'),
  ('the-springs','springs-14','Springs 14','ready',
   'A numbered lake district of 2–4 bedroom townhouses in The Springs; districts vary by townhouse type and lake/park position.',
   'Families and investors wanting an affordable, established gated townhouse with a garden near Dubai Marina.',
   'medium','Established district; per-district type mix varies — general facts from public market knowledge (Jul 2026); counts/prices pending DLD confirmation.'),
  ('the-springs','springs-15','Springs 15','ready',
   'A numbered lake district of 2–4 bedroom townhouses in The Springs; districts vary by townhouse type and lake/park position.',
   'Families and investors wanting an affordable, established gated townhouse with a garden near Dubai Marina.',
   'medium','Established district; per-district type mix varies — general facts from public market knowledge (Jul 2026); counts/prices pending DLD confirmation.')
) as v(comm, slug, name, status, descr, who, conf, note)
on conflict (community_id, slug) do update set
  description_long = excluded.description_long,
  who_its_for_base = excluded.who_its_for_base,
  status           = excluded.status,
  is_placeholder   = false,
  data_confidence  = excluded.data_confidence,
  source_note      = excluded.source_note;
