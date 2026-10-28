import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";

/** Browser Supabase client. Phase 2+ only; the welcome page does not use it. */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and fill in your project values.",
    );
  }
  return createBrowserClient<Database>(url, key);
}
