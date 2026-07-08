/**
 * Centralised, non-throwing access to environment configuration.
 *
 * The engine must remain viewable (and screen-recordable) before Supabase,
 * Google Maps, or Anthropic credentials are wired in. Nothing here throws;
 * callers branch on the `*Configured` booleans and degrade gracefully with
 * a visible "not configured" state rather than crashing.
 */

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  // Server-only. Never expose to the browser.
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
  googleMapsMapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  // Generation model — overridable so the owner can change it without code edits.
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8",
  // Restricts sign-in to the single owner. Optional; when set, only this
  // email may authenticate.
  adminEmail: process.env.ADMIN_EMAIL ?? "",
  // Digital Dubai (DDA) iPaaS open-data API — powers the weekly automated
  // DLD transaction refresh. Server-only. Absent = manual CSV import only.
  // client_id / client_secret + the mandatory app identifier header.
  dubaipulseKey: process.env.DUBAIPULSE_API_KEY ?? "",       // client_id
  dubaipulseSecret: process.env.DUBAIPULSE_API_SECRET ?? "", // client_secret
  dubaipulseAppId: process.env.DUBAIPULSE_APP_ID ?? "",      // x-DDA-SecurityApplicationIdentifier
  // 'prod' → https://apis.data.dubai ; anything else → staging (channel test).
  dubaipulseEnv: process.env.DUBAIPULSE_ENV ?? "prod",
  // Shared secret Vercel Cron sends so only the scheduler can trigger sync.
  cronSecret: process.env.CRON_SECRET ?? "",
  // Bayut (RapidAPI "UAE Real Estate") DLD transactions — globally callable
  // alternative source (no UAE-egress requirement). Static API key.
  rapidApiKey: process.env.RAPIDAPI_KEY ?? "",
};

export const isBayutApiConfigured = (): boolean => Boolean(env.rapidApiKey);

export const isDldApiConfigured = (): boolean =>
  Boolean(env.dubaipulseKey && env.dubaipulseSecret && env.dubaipulseAppId);

export const isSupabaseConfigured = (): boolean =>
  Boolean(env.supabaseUrl && env.supabaseAnonKey);

export const isMapsConfigured = (): boolean =>
  Boolean(env.googleMapsApiKey);

export const isAnthropicConfigured = (): boolean =>
  Boolean(env.anthropicApiKey);
