"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ASSET_BUCKET } from "@/lib/supabase/constants";
import type { PlanKind } from "@/lib/db/types";

type Scope = { communityId?: string; subCommunityId?: string };

/**
 * Admin uploader — the live edit loop for files. Uploads to Supabase Storage
 * and writes the row (plan_assets or documents) via the browser client, so
 * the dashboard reflects it immediately (router.refresh). Degrades to a
 * disabled note when Supabase is not configured.
 */
export function AssetUploader({
  scope,
  mode,
  planKind = "master_plan",
  label,
  compact = false,
}: {
  scope: Scope;
  mode: "plan" | "document";
  planKind?: PlanKind;
  label: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!supabase) {
    return (
      <p className="text-xs text-paper-700">
        Connect Supabase to upload {label.toLowerCase()}.
      </p>
    );
  }

  async function readImageSize(
    file: File,
  ): Promise<{ w: number | null; h: number | null }> {
    if (!file.type.startsWith("image/")) return { w: null, h: null };
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        resolve({ w: img.naturalWidth, h: img.naturalHeight });
        URL.revokeObjectURL(url);
      };
      img.onerror = () => resolve({ w: null, h: null });
      img.src = url;
    });
  }

  async function onFile(file: File) {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    try {
      const scopeKey =
        scope.communityId ?? scope.subCommunityId ?? "misc";
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
      const path = `${scopeKey}/${crypto.randomUUID()}.${ext}`;

      const up = await supabase.storage
        .from(ASSET_BUCKET)
        .upload(path, file, { upsert: false });
      if (up.error) throw up.error;

      // supabase-js's insert typing is over-strict against our hand-authored
      // Database types; use a minimal typed write handle for these two writes.
      const db = supabase as unknown as {
        from: (t: string) => {
          insert: (
            v: Record<string, unknown>,
          ) => Promise<{ error: { message: string } | null }>;
        };
      };

      if (mode === "plan") {
        const dims = await readImageSize(file);
        const { error } = await db.from("plan_assets").insert({
          community_id: scope.communityId ?? null,
          sub_community_id: scope.subCommunityId ?? null,
          kind: planKind,
          title: file.name,
          storage_path: path,
          natural_width: dims.w,
          natural_height: dims.h,
          is_placeholder: false,
        });
        if (error) throw error;
      } else {
        const { error } = await db.from("documents").insert({
          community_id: scope.communityId ?? null,
          sub_community_id: scope.subCommunityId ?? null,
          title: file.name,
          file_url: path,
          doc_type: file.type || "document",
        });
        if (error) throw error;
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={compact ? "" : "mt-2"}>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="rounded-lg border border-ink-500 bg-ink-800 px-4 py-2 text-sm text-paper-200 transition-colors hover:bg-ink-700 hover:text-paper-100 disabled:opacity-50"
      >
        {busy ? "Uploading…" : label}
      </button>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
