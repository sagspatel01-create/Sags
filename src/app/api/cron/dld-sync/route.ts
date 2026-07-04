import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { syncDldWeekly } from "@/lib/sources/dld-sync";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Weekly DLD refresh, triggered by Vercel Cron. Guarded by CRON_SECRET so
 * only the scheduler can run it. No-ops cleanly until the Dubai Pulse API
 * keys are configured.
 */
export async function GET(req: Request) {
  if (env.cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${env.cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  const result = await syncDldWeekly(6);
  return NextResponse.json(result);
}
