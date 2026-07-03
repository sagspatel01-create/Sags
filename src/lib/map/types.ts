import type { StatusTag, PositioningTier } from "@/lib/db/types";

/** Minimal shape the map needs for each community marker. */
export interface CommunityPin {
  id: string;
  name: string;
  slug: string;
  status: StatusTag;
  positioning_tier: PositioningTier | null;
  developer_name: string | null;
  lng: number;
  lat: number;
  sub_community_count: number;
  is_placeholder: boolean;
}

// Dubai bounds — a sensible default framing for the map.
export const DUBAI_CENTER: [number, number] = [55.2, 25.08];
export const DUBAI_ZOOM = 9.4;
