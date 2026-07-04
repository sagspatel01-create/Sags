# Go-live runbook

Everything is built and pushed. These are the only steps that need your
accounts (they require your login, which I can't do for you). ~15 minutes.

## 1. Supabase (one paste)

1. Open your project → **SQL Editor** → New query.
2. Paste the entire contents of [`supabase/setup.sql`](supabase/setup.sql) and
   **Run**. This applies all migrations (0001–0011) and loads the seeds
   (breadth catalogue — 64 communities, Dubai Hills content, character tags).
   - **Fully idempotent.** Safe to paste and run in one go, as many times as
     you like, on a fresh **or** partially-applied project — no "already
     exists" errors, nothing gets dropped. (Verified end-to-end on
     Postgres 16 + PostGIS.)
3. **Storage**: the paste creates the private `assets` bucket. If your role
   couldn't touch `storage`, create it manually: Storage → New bucket →
   name `assets`, **not public**.
4. **Auth → Users → Add user**: create your single admin (email + password).
   No public sign-up is enabled.
5. **Settings → API**: copy the **Project URL** and the **anon public** key.
   (The `service_role` key is optional — only for trusted server scripts.)

## 2. Environment variables

Local (`.env.local`) and on Vercel, set:

```
NEXT_PUBLIC_SUPABASE_URL=<your project url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your anon key>
ADMIN_EMAIL=<the admin email you created>
ANTHROPIC_API_KEY=<your key>          # already in .env.local locally
# optional — the map works without these (OpenFreeMap):
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=
```

## 3. Deploy to Vercel

1. **vercel.com → Add New → Project → Import** the GitHub repo, branch
   `claude/dubai-engine-phase-1-w4angn` (or merge it to `main` first).
2. Framework preset: **Next.js** (auto-detected). No build overrides needed.
3. Add the environment variables from step 2.
4. **Deploy**, then open the URL and sign in as your admin.

## 4. First data

The tool runs immediately on the seeded breadth. To fill depth without waiting
for Phase 2 pipelines, use the built-in **Admin** section (in the sidebar) to
edit communities, sub-communities, phases and unit archetypes — every edit is
live (writes to the same DB the front end reads). Upload master plans and
documents from each community's dashboard.

## Notes

- `.env.local` is git-ignored; never commit real keys. Vercel env vars are the
  production source.
- The map needs no key. Add Google Maps keys only if you later want to swap the
  basemap provider.
