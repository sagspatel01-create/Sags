# DLD → Supabase puller (UAE-egress runner)

The Digital Dubai (DDA) API only accepts requests **originating inside the UAE**.
Vercel's serverless egress is not in the UAE, so the DLD pull runs as this
standalone job on a **UAE-based host**. It has no Next.js dependency and reuses
the app's exact aggregation logic (`src/lib/sources/dld.ts`).

## Free host (recommended): Oracle Cloud Always-Free VM in the UAE
1. Create an Oracle Cloud account; set **home region = UAE (Dubai / me-dubai-1)**.
2. Launch an **Always-Free** VM (Ampere/AMD micro) — $0 forever.
3. Reserve a **public IP** (free) — this is the static UAE IP to give DDA to
   whitelist for production.
4. Install Node 22 + this repo (or just this script + `src/lib/sources/dld.ts`).

## Run (weekly cron)
```
DUBAIPULSE_APP_ID=...        # x-DDA-SecurityApplicationIdentifier
DUBAIPULSE_API_KEY=...       # client_id
DUBAIPULSE_API_SECRET=...    # client_secret
DUBAIPULSE_ENV=prod          # prod = apis.data.dubai
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_KEY=...     # service/secret key (writes market_snapshots)
npx tsx scripts/dld-pull.ts
# or: node --experimental-strip-types scripts/dld-pull.ts
```
Crontab (Mondays 06:00 GST): `0 6 * * 1 cd /path/repo && node --experimental-strip-types scripts/dld-pull.ts >> /var/log/dld.log 2>&1`

It authenticates, pulls the last 6 months of villa/townhouse sales, aggregates
per community + cluster, and writes the live Trends + last-transactions.
