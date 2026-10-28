/**
 * Supabase environment. Only the URL and the publishable (anon) key are used by the app,
 * and both are safe to expose to the browser. The service-role/secret key is never read here.
 */
export function getSupabaseEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseEnv() !== null;
}

export const NOT_CONFIGURED_MESSAGE =
  "Authentication isn't configured on this server yet. Add your Supabase project values to .env.local (see README).";
