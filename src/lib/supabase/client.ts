import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabaseEnv } from "@/lib/supabase/env";

/** Browser Supabase client (Client Components). Uses the publishable key only. */
export function createClient() {
  const env = getSupabaseEnv();
  if (!env) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and fill in your project values.",
    );
  }
  return createBrowserClient<Database>(env.url, env.key);
}
