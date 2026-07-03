import { createClient } from "@/lib/supabase/server";
import { MapView } from "@/components/map/MapView";
import type { CommunityPin } from "@/lib/map/types";

// The map depends on request-time data + client rendering.
export const dynamic = "force-dynamic";

async function getPins(): Promise<CommunityPin[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("community_pins")
    .select("*")
    .order("name");
  if (error || !data) return [];
  return data as CommunityPin[];
}

export default async function MapPage() {
  const pins = await getPins();
  return (
    <div className="h-full w-full">
      <MapView pins={pins} />
    </div>
  );
}
