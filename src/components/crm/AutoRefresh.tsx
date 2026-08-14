"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps a server-rendered CRM screen live: re-fetches on an interval and
 * whenever the tab regains focus, so the morning dashboard reflects new
 * notes, follow-ups, and stage moves without a manual reload.
 */
export function AutoRefresh({ seconds = 120 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    const onFocus = () => router.refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [router, seconds]);
  return null;
}
