-- =====================================================================
-- 0006 — Row Level Security
-- Single-admin private tool: every table is locked to authenticated
-- users only. There is no public access. The service_role key (used by
-- trusted server code / seeding) bypasses RLS.
-- =====================================================================

do $$
declare
  t text;
  tables text[] := array[
    'developers','communities','sub_communities','phases','unit_archetypes',
    'transactions','listings','price_history','capital_growth','rental_data',
    'absorption','payment_plans','schools','amenities','commute_times',
    'infrastructure_projects','documents','client_profiles','data_sources',
    'filter_definitions','generated_content'
  ];
begin
  foreach t in array tables loop
    execute format('alter table %I enable row level security;', t);

    -- Read + write for any authenticated user (the single owner).
    execute format($f$
      create policy "authenticated_all_%1$s" on %1$I
        for all
        to authenticated
        using (true)
        with check (true);
    $f$, t);
  end loop;
end $$;
