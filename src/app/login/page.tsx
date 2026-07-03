"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createClient();
  const configured = supabase !== null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.replace(params.get("redirect") || "/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="text-eyebrow">Dubai Villa &amp; Townhouse Intelligence</p>
        <h1 className="mt-3 font-display text-3xl text-paper-100">
          Private access
        </h1>
        <p className="mt-2 text-sm text-paper-500">
          Single admin. There is no public sign-up.
        </p>

        {!configured ? (
          <div className="mt-8 rounded-xl border border-ink-500 bg-ink-800/50 p-5 text-sm text-paper-300">
            Supabase is not configured yet. Set{" "}
            <code className="text-paper-100">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="text-paper-100">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
            in <code>.env.local</code>, then reload.
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              autoComplete="email"
            />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 rounded-lg bg-accent-500 px-4 py-2.5 text-sm font-medium text-ink-900 transition-colors hover:bg-accent-400 disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Enter"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-eyebrow">{label}</span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        required
        className="rounded-lg border border-ink-500 bg-ink-800 px-3 py-2.5 text-sm text-paper-100 outline-none transition-colors focus:border-accent-500"
      />
    </label>
  );
}
