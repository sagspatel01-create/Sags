-- =====================================================================
-- 0015 — Area intelligence / growth catalysts (the USP)
-- What Bayut / PF don't show: the *why behind the price* — the roads,
-- highways, metro, schools, master-plan completion and government projects
-- in and around a community that drive value, with timelines and an
-- impact note. Stored as an ordered JSON array of
-- {title, category, timeline, note}. Admin-authored (optionally
-- Claude-drafted), reviewed before publish.
-- =====================================================================

alter table communities
  add column if not exists catalysts jsonb not null default '[]'::jsonb;
