import { getAnthropic, GENERATION_MODEL } from "@/lib/anthropic";
import { getCommunitiesForCompare } from "@/lib/data/compare";
import { buildCompareModel } from "@/lib/compare-model";
import { buildComparisonReportPrompt } from "@/lib/compare-report";
import { getActiveProfile } from "@/lib/client-profile.server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Streams a client-ready comparison brief for 2–4 communities. Text is piped
 * to the client as it generates (live typing on a call); the finished brief is
 * persisted to generated_content so it can be reopened and edited.
 */
export async function POST(req: Request) {
  const client = getAnthropic();
  if (!client) {
    return Response.json(
      { error: "Add ANTHROPIC_API_KEY to enable generation." },
      { status: 400 },
    );
  }

  const { ids } = (await req.json().catch(() => ({}))) as { ids?: string[] };
  const slugs = (ids ?? []).map((s) => String(s)).slice(0, 4);
  if (slugs.length < 2) {
    return Response.json(
      { error: "Select at least two communities." },
      { status: 400 },
    );
  }

  const [communities, profile] = await Promise.all([
    getCommunitiesForCompare(slugs),
    getActiveProfile(),
  ]);
  if (communities.length < 2) {
    return Response.json({ error: "Communities not found." }, { status: 400 });
  }

  const model = buildCompareModel(communities, profile);
  const { system, prompt } = buildComparisonReportPrompt(model, profile);

  const anthropicStream = client.messages.stream({
    model: GENERATION_MODEL,
    max_tokens: 2000,
    system,
    messages: [{ role: "user", content: prompt }],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      anthropicStream.on("text", (delta: string) => {
        controller.enqueue(encoder.encode(delta));
      });
      try {
        const final = await anthropicStream.finalMessage();
        const text = final.content
          .filter((b) => b.type === "text")
          .map((b) => (b as { text: string }).text)
          .join("");
        await persist({
          body: text,
          profileId: profile?.id ?? null,
          subjectSlugs: [...slugs].sort(),
          prompt,
        });
      } catch {
        controller.enqueue(encoder.encode("\n\n[Generation was interrupted.]"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

async function persist(args: {
  body: string;
  profileId: string | null;
  subjectSlugs: string[];
  prompt: string;
}) {
  if (!args.body) return;
  const supabase = await createClient();
  if (!supabase) return;
  const db = supabase as unknown as {
    from: (t: string) => {
      insert: (v: Record<string, unknown>) => Promise<{ error: unknown }>;
    };
  };
  await db.from("generated_content").insert({
    content_type: "comparison_report",
    client_profile_id: args.profileId,
    subject_ids: args.subjectSlugs,
    body: args.body,
    prompt_snapshot: args.prompt,
    model: GENERATION_MODEL,
    is_owner_edited: false,
  });
}
