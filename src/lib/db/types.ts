/**
 * Hand-authored database types mirroring supabase/migrations.
 *
 * These can be regenerated once a Supabase project exists with:
 *   npx supabase gen types typescript --project-id <id> > src/lib/db/types.ts
 * Until then this file is the source of truth for the client generics.
 */

// ---- Enums -----------------------------------------------------------
export type StatusTag = "ready" | "offplan" | "mixed";
export type UnitType = "villa" | "townhouse";
export type KitchenType = "open" | "closed" | "semi_open";
export type FurnishingStatus = "unfurnished" | "semi_furnished" | "furnished";
export type BuyerType = "family" | "investor" | "enduser";
export type PositioningTier =
  | "ultra_prime"
  | "prime"
  | "premium"
  | "mid"
  | "accessible";

// ---- Row shapes ------------------------------------------------------
export interface Developer {
  id: string;
  name: string;
  slug: string;
  track_record_notes: string | null;
  delivery_reputation: string | null;
  logo_url: string | null;
  website_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Community {
  id: string;
  developer_id: string | null;
  name: string;
  slug: string;
  status: StatusTag;
  positioning_tier: PositioningTier | null;
  age_or_handover: string | null;
  sub_community_count: number | null;
  villa_count: number | null;
  townhouse_count: number | null;
  total_units: number | null;
  master_plan_features: unknown;
  description_long: string | null;
  who_its_for_base: string | null;
  hero_image_url: string | null;
  geo_center: unknown;
  geo_boundary: unknown;
  is_placeholder: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubCommunity {
  id: string;
  community_id: string;
  name: string;
  slug: string;
  status: StatusTag;
  villa_count: number | null;
  townhouse_count: number | null;
  total_units: number | null;
  description_long: string | null;
  who_its_for_base: string | null;
  hero_image_url: string | null;
  geo_center: unknown;
  geo_boundary: unknown;
  is_placeholder: boolean;
  created_at: string;
  updated_at: string;
}

export interface Phase {
  id: string;
  sub_community_id: string;
  phase_name: string;
  status: StatusTag;
  launch_date: string | null;
  launch_price_per_sqft: number | null;
  current_price_per_sqft: number | null;
  units_in_phase: number | null;
  created_at: string;
  updated_at: string;
}

export interface UnitArchetype {
  id: string;
  sub_community_id: string;
  phase_id: string | null;
  name: string | null;
  unit_type: UnitType;
  bedrooms: number | null;
  bathrooms: number | null;
  furnishing: FurnishingStatus | null;
  completion_status: StatusTag | null;
  bua_sqft: number | null;
  plot_sqft: number | null;
  internal_sqft: number | null;
  external_sqft: number | null;
  kitchen_type: KitchenType | null;
  config_flags: Record<string, boolean>;
  floors: number | null;
  parking_spaces: number | null;
  view_orientation: string | null;
  has_pool: boolean | null;
  has_garden: boolean | null;
  has_balcony: boolean | null;
  price: number | null;
  service_charge_per_sqft: number | null;
  condition: string | null;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  sub_community_id: string;
  phase_id: string | null;
  price: number | null;
  price_per_sqft: number | null;
  unit_type: UnitType | null;
  bedrooms: number | null;
  bua_sqft: number | null;
  transaction_date: string;
  source: string | null;
  created_at: string;
}

export interface Listing {
  id: string;
  sub_community_id: string;
  phase_id: string | null;
  asking_price: number | null;
  service_charge_per_sqft: number | null;
  unit_type: UnitType | null;
  bedrooms: number | null;
  bua_sqft: number | null;
  plot_sqft: number | null;
  kitchen_type: KitchenType | null;
  view_orientation: string | null;
  condition: string | null;
  source: string | null;
  date_seen: string | null;
  url: string | null;
  created_at: string;
}

export interface PriceHistory {
  id: string;
  sub_community_id: string;
  unit_type: UnitType | null;
  week_start_date: string;
  avg_price_per_sqft: number | null;
  median_price: number | null;
  transaction_count: number | null;
  created_at: string;
}

export interface CapitalGrowth {
  id: string;
  sub_community_id: string;
  unit_type: UnitType | null;
  period: string | null;
  pct_change: number | null;
  calculated_at: string;
}

export interface RentalData {
  id: string;
  sub_community_id: string;
  unit_type: UnitType | null;
  achieved_rent: number | null;
  gross_yield_pct: number | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}

export interface Absorption {
  id: string;
  sub_community_id: string;
  phase_name: string | null;
  units_released: number | null;
  units_sold: number | null;
  absorption_rate: number | null;
  sales_velocity: number | null;
  launch_price_movement: number | null;
  as_of_date: string | null;
  created_at: string;
}

export interface PaymentPlan {
  id: string;
  community_id: string;
  plan_type: string | null;
  construction_pct: number | null;
  handover_pct: number | null;
  construction_years: number | null;
  milestones: unknown;
  created_at: string;
  updated_at: string;
}

export interface School {
  id: string;
  name: string;
  geo_point: unknown;
  khda_rating: string | null;
  curriculum: string | null;
  fee_min: number | null;
  fee_max: number | null;
  created_at: string;
  updated_at: string;
}

export interface Amenity {
  id: string;
  name: string;
  category: string | null;
  geo_point: unknown;
  created_at: string;
}

export interface CommuteTime {
  id: string;
  community_id: string;
  destination_name: string;
  minutes_driving: number | null;
  created_at: string;
  updated_at: string;
}

export interface InfrastructureProject {
  id: string;
  name: string;
  description: string | null;
  geo_point: unknown;
  status: string | null;
  est_completion: string | null;
  value_impact_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  community_id: string | null;
  sub_community_id: string | null;
  title: string;
  file_url: string | null;
  doc_type: string | null;
  created_at: string;
}

export interface ClientProfile {
  id: string;
  session_label: string | null;
  budget: number | null;
  financing_approach: string | null;
  buyer_type: BuyerType | null;
  goals: string | null;
  priorities: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DataSource {
  id: string;
  key: string;
  label: string;
  category: string | null;
  is_enabled: boolean;
  cadence: string | null;
  reliability_notes: string | null;
  last_run_at: string | null;
  last_status: string | null;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface FilterDefinition {
  id: string;
  key: string;
  label: string;
  control: string;
  data_path: string | null;
  unit: string | null;
  options: unknown;
  min_value: number | null;
  max_value: number | null;
  step: number | null;
  group_label: string | null;
  sort_order: number;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface GeneratedContent {
  id: string;
  content_type: string;
  client_profile_id: string | null;
  community_id: string | null;
  sub_community_id: string | null;
  subject_ids: unknown;
  body: string | null;
  is_owner_edited: boolean;
  prompt_snapshot: string | null;
  model: string | null;
  created_at: string;
  updated_at: string;
}

// ---- Database generic (Supabase-compatible shape) --------------------
type TableShape<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      developers: TableShape<Developer>;
      communities: TableShape<Community>;
      sub_communities: TableShape<SubCommunity>;
      phases: TableShape<Phase>;
      unit_archetypes: TableShape<UnitArchetype>;
      transactions: TableShape<Transaction>;
      listings: TableShape<Listing>;
      price_history: TableShape<PriceHistory>;
      capital_growth: TableShape<CapitalGrowth>;
      rental_data: TableShape<RentalData>;
      absorption: TableShape<Absorption>;
      payment_plans: TableShape<PaymentPlan>;
      schools: TableShape<School>;
      amenities: TableShape<Amenity>;
      commute_times: TableShape<CommuteTime>;
      infrastructure_projects: TableShape<InfrastructureProject>;
      documents: TableShape<Document>;
      client_profiles: TableShape<ClientProfile>;
      data_sources: TableShape<DataSource>;
      filter_definitions: TableShape<FilterDefinition>;
      generated_content: TableShape<GeneratedContent>;
    };
    Views: {
      active_transactions: { Row: Transaction; Relationships: [] };
      active_transactions_3m: { Row: Transaction; Relationships: [] };
      sub_community_market_6m: {
        Row: {
          sub_community_id: string;
          transaction_count: number;
          avg_price_per_sqft: number | null;
          median_price: number | null;
          avg_price: number | null;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: {
      status_tag: StatusTag;
      unit_type: UnitType;
      kitchen_type: KitchenType;
      furnishing_status: FurnishingStatus;
      buyer_type: BuyerType;
      positioning_tier: PositioningTier;
    };
  };
}
