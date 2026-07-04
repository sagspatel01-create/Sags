-- =====================================================================
-- 0012 — API role privileges
-- RLS governs which ROWS the API roles see; Postgres still needs
-- table-level GRANTs for the role to touch a table at all. Supabase's
-- managed default privileges don't always cover tables created by a
-- migration, so grant explicitly here (runs last, after every table and
-- view exists). Row access stays gated by the RLS policies in 0006 —
-- `authenticated` has an allow-all policy; `anon` has none, so it sees
-- nothing until sign-in even though the grant is present.
-- Idempotent: GRANT is a no-op when the privilege already exists.
-- =====================================================================

grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;

-- Cover anything created later (e.g. via the admin surface at runtime).
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
