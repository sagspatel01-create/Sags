-- =====================================================================
-- 0014 — Community FAQs (area-guide "good part", à la Bayut)
-- A consolidated Q&A per community — location, price range, handover,
-- freehold status, schools, etc. Stored as an ordered JSON array of
-- {q, a}. Admin-authored (optionally Claude-drafted from the community's
-- own data, then reviewed) — never auto-published unreviewed.
-- =====================================================================

alter table communities
  add column if not exists faqs jsonb not null default '[]'::jsonb;
