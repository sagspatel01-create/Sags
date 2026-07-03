-- =====================================================================
-- SEED (tags) — authentic community character tags
-- Broad, verifiable characteristics used by the store's character filter.
-- Conservative on purpose; communities not listed keep an empty tag set.
-- Run after seed.sql.
-- =====================================================================

update communities set character_tags = '{golf,established,central,schools-nearby}'      where slug='dubai-hills-estate';
update communities set character_tags = '{gated-family,established,schools-nearby}'       where slug='arabian-ranches-2';
update communities set character_tags = '{gated-family,new-launch,schools-nearby}'        where slug='arabian-ranches-3';
update communities set character_tags = '{new-launch,gated-family,nature}'                 where slug='the-valley';
update communities set character_tags = '{golf,new-launch,value-entry}'                    where slug='emaar-south';
update communities set character_tags = '{ultra-luxury,waterfront,new-launch}'             where slug='the-oasis';
update communities set character_tags = '{gated-family,established,value-entry}'           where slug='reem-mira';
update communities set character_tags = '{ultra-luxury,waterfront,beach,established}'      where slug='palm-jumeirah';
update communities set character_tags = '{established,gated-family}'                        where slug='jumeirah-park';
update communities set character_tags = '{waterfront,established,prestige}'                 where slug='jumeirah-islands';
update communities set character_tags = '{ultra-luxury,waterfront,beach,new-launch}'       where slug='palm-jebel-ali';
update communities set character_tags = '{established,value-entry}'                         where slug='al-furjan';
update communities set character_tags = '{waterfront,new-launch,prestige}'                 where slug='nad-al-sheba-gardens';
update communities set character_tags = '{new-launch,nature,gated-family}'                 where slug='the-acres';
update communities set character_tags = '{golf,established,prestige}'                       where slug='jumeirah-golf-estates';
update communities set character_tags = '{gated-family,established,schools-nearby}'         where slug='mudon';
update communities set character_tags = '{gated-family,value-entry}'                        where slug='serena';
update communities set character_tags = '{gated-family,value-entry}'                        where slug='villanova';
update communities set character_tags = '{established,gated-family}'                        where slug='the-villa';
update communities set character_tags = '{waterfront,wellness,new-launch}'                  where slug='tilal-al-ghaf';
update communities set character_tags = '{golf,gated-family,established}'                   where slug='damac-hills';
update communities set character_tags = '{gated-family,value-entry}'                        where slug='damac-hills-2';
update communities set character_tags = '{waterfront,new-launch}'                           where slug='damac-lagoons';
update communities set character_tags = '{waterfront,new-launch}'                           where slug='damac-islands';
update communities set character_tags = '{wellness,new-launch,nature}'                      where slug='haven-by-aldar';
update communities set character_tags = '{ultra-luxury,new-launch,prestige}'               where slug='the-sanctuary-by-aldar';
update communities set character_tags = '{waterfront,central,established}'                  where slug='sobha-hartland';
update communities set character_tags = '{waterfront,central,new-launch}'                   where slug='sobha-hartland-2';
update communities set character_tags = '{new-launch,nature}'                               where slug='sobha-reserve';
update communities set character_tags = '{gated-family,value-entry}'                        where slug='town-square';
update communities set character_tags = '{ultra-luxury,waterfront,central}'                where slug='district-one';
update communities set character_tags = '{ultra-luxury,beach,waterfront,new-launch}'       where slug='pearl-jumeirah';
