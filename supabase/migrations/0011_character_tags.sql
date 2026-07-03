-- =====================================================================
-- 0011 — Community character tags
-- Powers the "who it's for" / character filter in the store. Tags are
-- broad, verifiable characteristics (golf, waterfront, gated-family, …),
-- not market data.
-- =====================================================================

alter table communities
  add column if not exists character_tags text[] not null default '{}';

create index if not exists communities_character_tags_idx
  on communities using gin (character_tags);
