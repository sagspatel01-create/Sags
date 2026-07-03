-- =====================================================================
-- SEED (example) — Dubai Hills Estate content
--
-- Worked example for a ready community. Populates only authentic,
-- verifiable, non-volatile descriptive facts (developer, master-plan
-- features, character) sourced from public developer/portal information.
-- All market numbers, counts, unit specs and prices are LEFT NULL — they
-- render as visibly empty until real data is entered. No fabrication.
--
-- Idempotent. Run after seed.sql.
-- =====================================================================

update communities set
  age_or_handover = 'Established · villa districts handed over from 2019',
  is_placeholder = false,
  master_plan_features = '[
    "18-hole championship golf course (Troon, par-72)",
    "Dubai Hills Park — one of the city''s largest residential parks",
    "Dubai Hills Mall (600+ stores, VOX Cinemas)",
    "Dubai Hills Boulevard",
    "Direct access via Al Khail Road (E44)"
  ]'::jsonb,
  description_long =
    'Dubai Hills Estate is a 2,700-acre master community developed as a '
    || 'joint venture between Emaar Properties and Meraas, positioned '
    || 'between Downtown Dubai and the emirate''s newer growth corridors '
    || 'with direct access via Al Khail Road. It is built around an '
    || '18-hole championship golf course and Dubai Hills Park, and anchored '
    || 'by Dubai Hills Mall. The estate is known for its wide, green, '
    || 'low-rise villa and townhouse districts — a self-contained '
    || '"city within a city" that has become one of the most established '
    || 'and liquid family communities in central Dubai.',
  who_its_for_base =
    'Families and end-users who want an established, green, master-planned '
    || 'address within easy reach of Downtown — golf, parks, schools and a '
    || 'major mall on the doorstep — without the density of the older '
    || 'central districts. It also suits investors who prioritise liquidity '
    || 'and a proven Emaar track record over frontier upside: a community '
    || 'with deep resale demand and a broad range of villa and townhouse '
    || 'product.'
where slug = 'dubai-hills-estate';

-- Fill in the two remaining well-known villa districts (others seeded).
insert into sub_communities (community_id, name, slug, status) values
  ((select id from communities where slug='dubai-hills-estate'),'Majestic Vistas','majestic-vistas','ready'),
  ((select id from communities where slug='dubai-hills-estate'),'Emerald Hills','emerald-hills','mixed')
on conflict (community_id, slug) do nothing;

-- Authentic character notes for the flagship villa/townhouse districts
-- (bedroom ranges are the developer''s published configurations).
update sub_communities set
  description_long = 'Sidra is a premium villa district of contemporary 3–5 bedroom homes '
    || 'arranged around landscaped streets and pocket parks, within walking '
    || 'reach of Dubai Hills Park and the estate''s schools.',
  who_its_for_base = 'Families wanting a modern, move-in villa in an established, amenity-rich '
    || 'setting close to central Dubai.',
  is_placeholder = false
where slug = 'sidra'
  and community_id = (select id from communities where slug='dubai-hills-estate');

update sub_communities set
  description_long = 'Maple is a large townhouse district of 3–4 bedroom homes with private '
    || 'gardens and shared amenities — one of the estate''s most in-demand '
    || 'entry points into Dubai Hills for growing families.',
  who_its_for_base = 'First-time villa/townhouse buyers and families seeking value and '
    || 'community amenities within a blue-chip master plan.',
  is_placeholder = false
where slug = 'maple'
  and community_id = (select id from communities where slug='dubai-hills-estate');
