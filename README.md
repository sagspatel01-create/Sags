# Dubai Villa &amp; Townhouse Intelligence Engine

A private, single-admin intelligence engine for luxury Dubai villa and
townhouse communities. It works backwards from a client's budget to a
data-backed shortlist, with exhaustive side-by-side comparison, financing
and exit modelling, and a client-tailored "who it's for" layer. The UX is an
e-commerce store for communities; the aesthetic is dark, minimal, editorial —
built to look immaculate on camera.

> **Status: Phase 1 — foundation.** Project scaffold, database schema, and
> breadth seed are in place. The seven Phase 1 milestones (map → detail pages
> → client intake → comparison → tailored copy → filters → generation) are
> built in order, each confirmed before the next.

## Stack

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind v4**
- **Supabase** — Postgres + PostGIS, Auth, Storage
- **Google Maps JS API** — custom dark/editorial style (Milestone 1)
- **Anthropic API** — on-demand generation (Milestones 5 & 7)
- Deploy target: **Vercel**

## Getting started

```bash
npm install
cp .env.local.example .env.local   # fill in your keys
npm run dev
```

Without Supabase credentials the app runs in a **preview mode**: auth is not
enforced and the catalogue is empty, so the design can still be reviewed and
screen-recorded. With credentials, everything is behind a single-admin login.

### Database setup

1. Create a Supabase project.
2. Run the migrations in order (SQL editor or `supabase db push`):
   `supabase/migrations/0001…0010`. `0010` creates the private `assets`
   Storage bucket + policies — if your role can't touch `storage`, create the
   bucket from the dashboard (Storage → New bucket "assets", private).
3. Load breadth data: run `supabase/seed.sql`. Optionally run
   `supabase/seed_dubai_hills.sql` for the worked example.
4. Create the single admin user in **Auth → Users** (email/password). Set
   `ADMIN_EMAIL` to that address.

The migrations enable PostGIS, create the four-level taxonomy and all
supporting tables, lock every table behind RLS (authenticated-only), and add
trailing-6-month active views (the recency window for headline figures).

## Architecture notes

- **Four-level taxonomy** — developer → community → sub-community → unit
  archetype. All market data resolves to the sub-community level.
- **Live edit loop** — the admin surface writes to the same Supabase DB the
  front end reads, so edits are reflected with no redeploy.
- **Swappable sources** — every external source (DLD, Bayut, Property Finder,
  KHDA, Google Maps, infrastructure) is an isolated module in
  `src/lib/sources/` and a row in `data_sources`. Phase 1 runs **no**
  ingestion; data is entered manually via the admin surface. See the honesty
  note in the brief §9.
- **No invented data** — empty fields render as *visibly* empty
  (`components/ui/Empty`). The seed loads only structural facts (taxonomy,
  status, tier, approximate map coordinates); all market numbers stay NULL.

## Project layout

```
src/
  app/
    (app)/            protected shell (sidebar + topbar) — Overview, and
                      the milestone pages as they are built
    login/            single-admin sign-in
    auth/signout/     sign-out route
  proxy.ts            auth gate + session refresh (Next 16 convention)
  components/
    shell/            Sidebar, Topbar, nav config
    ui/               editorial primitives (Card, StatusBadge, Empty)
  lib/
    supabase/         browser + server clients, middleware helper
    db/types.ts       hand-authored DB types (regenerate once live)
    sources/          swappable source-module registry
    env.ts            non-throwing env access
  components/
    community/        dashboard sections, master-plan viewer, uploader
supabase/
  migrations/         0001…0010 schema (incl. plan assets + storage)
  seed.sql            breadth skeleton
  seed_dubai_hills.sql  worked-example content (authentic facts only)
```

## Milestones built

- **M1 — Map**: bespoke dark MapLibre map (free OpenFreeMap tiles), all
  communities pinned, click → detail panel → community dashboard.
- **M2 — Community dashboards**: per-community + per-sub-community pages;
  the **interactive master-plan viewer** (zoom/pan brochure image with
  clickable hotspots — navigation + Modon-style amenity layers); unit
  archetypes in the five categorized listing groups; the phase price-journey;
  and the admin **document/asset uploader** (live edit loop) backed by
  Supabase Storage.
