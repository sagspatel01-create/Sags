import { cookies } from "next/headers";
import {
  ACTIVE_PROFILE_COOKIE,
  type ClientProfileSnapshot,
} from "@/lib/client-profile";

/**
 * Server-side access to the active session's client profile. The active
 * profile is session-scoped, so the cookie holds the working snapshot;
 * the DB (client_profiles) is the durable history. Any page can read the
 * active profile without a DB round-trip.
 */
export async function getActiveProfile(): Promise<ClientProfileSnapshot | null> {
  const store = await cookies();
  const raw = store.get(ACTIVE_PROFILE_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ClientProfileSnapshot;
  } catch {
    return null;
  }
}

export async function setActiveProfile(
  profile: ClientProfileSnapshot,
): Promise<void> {
  const store = await cookies();
  store.set(ACTIVE_PROFILE_COOKIE, JSON.stringify(profile), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearActiveProfile(): Promise<void> {
  const store = await cookies();
  store.delete(ACTIVE_PROFILE_COOKIE);
}
