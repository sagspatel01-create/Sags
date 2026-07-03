-- =====================================================================
-- 0010 — Storage bucket for project assets
-- Master plans, floor plans, brochures, and any documents the owner
-- uploads. Private bucket (single-admin tool); access via signed URLs.
--
-- Note: this touches the `storage` schema. Run it in the Supabase SQL
-- editor (or via `supabase db push`) as the project owner. If your role
-- lacks privileges on storage.objects, create the bucket + policies from
-- the Supabase dashboard (Storage → New bucket "assets", private) and
-- add authenticated-only policies.
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('assets', 'assets', false)
on conflict (id) do nothing;

-- Authenticated (the single owner) may read/write/update/delete objects
-- in the 'assets' bucket. Nothing is public.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'assets_authenticated_all'
  ) then
    create policy "assets_authenticated_all" on storage.objects
      for all to authenticated
      using (bucket_id = 'assets')
      with check (bucket_id = 'assets');
  end if;
end $$;
