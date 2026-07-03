-- =====================================================================
-- 0001 — Extensions & enums
-- Dubai Villa & Townhouse Intelligence Engine
-- =====================================================================

-- PostGIS for geo boundaries, points, distance/commute work (Phase 2+).
create extension if not exists postgis;
-- gen_random_uuid()
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Enums (shared vocabulary — every level tagged Ready/Offplan/Mixed)
-- ---------------------------------------------------------------------

-- Ready / Offplan / Mixed status, used at every taxonomy level.
create type status_tag as enum ('ready', 'offplan', 'mixed');

-- Villa vs townhouse.
create type unit_type as enum ('villa', 'townhouse');

-- Kitchen configuration (a first-class, comparable listing field).
create type kitchen_type as enum ('open', 'closed', 'semi_open');

-- Furnishing status (mirrors Bayut/PF listing field).
create type furnishing_status as enum ('unfurnished', 'semi_furnished', 'furnished');

-- Buyer type for the client profile that drives tailoring.
create type buyer_type as enum ('family', 'investor', 'enduser');

-- Positioning tier — the luxury-first delivery order (AED 5M+ prioritised).
create type positioning_tier as enum ('ultra_prime', 'prime', 'premium', 'mid', 'accessible');

-- ---------------------------------------------------------------------
-- Shared trigger: keep updated_at fresh on every row update.
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
