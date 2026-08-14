-- =====================================================================
-- 0025 — CRM / Pipeline (Trust Mortgage)
-- A lightweight mortgage CRM layered onto the same Supabase project the
-- intelligence engine already uses. Models the one thing a generic CRM
-- gets wrong for mortgages: the work happens now, but the deal (and the
-- commission) disburses months later. So a deal carries TWO timelines —
--   • stage        = where the work is right now
--   • close_month  = the month the loan actually disburses and counts
-- The forecast buckets money by close_month, not by when work started.
--
--   crm_contacts   — the person (a lead, later a repeat/real-estate client)
--   crm_deals      — one contact can have many deals over time
--   crm_notes      — running call/activity log (per contact, optional deal)
--   crm_followups  — reminders that surface in the morning "Today" queue
--   crm_targets    — per-month disbursement target (default AED 10M)
-- =====================================================================

-- ---- Enums ----------------------------------------------------------

-- Where the work sits right now. Editable set; app labels these.
create type crm_stage as enum (
  'new_lead',
  'contacted',
  'qualified',
  'docs_collected',
  'submitted',
  'approved',
  'disbursed',
  'lost',
  'dormant'
);

-- Product line. 'other' carries a free-text label in product_other.
create type crm_product as enum (
  'new_purchase',
  'handover_offplan',
  'equity_release',
  'buyout_transfer',
  'other'
);

-- Where the lead came from. 'meta_ads' is first-class so ad ROI is
-- measurable once the Meta integration is wired in later.
create type crm_lead_source as enum (
  'meta_ads',
  'referral',
  'website',
  'walk_in',
  'manual',
  'other'
);

-- Reminder channel — a note to self about how to follow up (no auto-send).
create type crm_channel as enum ('whatsapp', 'call', 'email', 'other');

-- ---- Tables ---------------------------------------------------------

create table crm_contacts (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null,
  phone         text,
  email         text,
  source        crm_lead_source not null default 'manual',
  source_detail text,                       -- campaign / ad / referrer name
  notes         text,                       -- quick standing note
  is_client     boolean not null default false, -- became a real-estate/repeat client
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table crm_deals (
  id             uuid primary key default gen_random_uuid(),
  contact_id     uuid not null references crm_contacts(id) on delete cascade,
  title          text,                      -- short human label
  product        crm_product not null default 'new_purchase',
  product_other  text,                      -- used when product = 'other'
  stage          crm_stage not null default 'new_lead',
  -- Money. property_value is the rough total; loan_amount is what counts
  -- toward the monthly disbursement target. commission_amount is manual
  -- (auto-derived from loan_amount * commission_pct when left blank).
  property_value    numeric(14,2),
  loan_amount       numeric(14,2),
  commission_pct    numeric(6,3),
  commission_amount numeric(14,2),
  -- The month the loan is expected to disburse & count (stored as 1st).
  close_month    date,
  -- Confidence, 0–100. Seeded from stage but editable per deal.
  probability    integer not null default 5 check (probability between 0 and 100),
  closed_at      timestamptz,               -- set when disbursed/lost
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table crm_notes (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid not null references crm_contacts(id) on delete cascade,
  deal_id     uuid references crm_deals(id) on delete cascade,
  body        text not null,
  created_at  timestamptz not null default now()
);

create table crm_followups (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid not null references crm_contacts(id) on delete cascade,
  deal_id     uuid references crm_deals(id) on delete set null,
  due_on      date not null,
  channel     crm_channel not null default 'whatsapp',
  note        text,
  done        boolean not null default false,
  done_at     timestamptz,
  created_at  timestamptz not null default now()
);

create table crm_targets (
  month          date primary key,          -- first of month
  target_amount  numeric(14,2) not null default 10000000,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---- Indexes --------------------------------------------------------

create index crm_deals_contact_idx  on crm_deals(contact_id);
create index crm_deals_stage_idx    on crm_deals(stage);
create index crm_deals_month_idx    on crm_deals(close_month);
create index crm_notes_contact_idx  on crm_notes(contact_id, created_at desc);
create index crm_notes_deal_idx     on crm_notes(deal_id);
create index crm_followups_due_idx  on crm_followups(due_on) where done = false;
create index crm_followups_contact_idx on crm_followups(contact_id);

-- ---- updated_at triggers (reuse the shared function from 0001) -------

create trigger set_updated_at_crm_contacts before update on crm_contacts
  for each row execute function set_updated_at();
create trigger set_updated_at_crm_deals before update on crm_deals
  for each row execute function set_updated_at();
create trigger set_updated_at_crm_targets before update on crm_targets
  for each row execute function set_updated_at();

-- ---- Row Level Security (single-admin: authenticated only) -----------

do $$
declare
  t text;
  tables text[] := array[
    'crm_contacts','crm_deals','crm_notes','crm_followups','crm_targets'
  ];
begin
  foreach t in array tables loop
    execute format('alter table %I enable row level security;', t);
    execute format($f$
      create policy "authenticated_all_%1$s" on %1$I
        for all
        to authenticated
        using (true)
        with check (true);
    $f$, t);
  end loop;
end $$;
