import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/database.types";

/** Server Supabase client (Server Components, Route Handlers, Server Actions). */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and fill in your project values.",
    );
  }
  const cookieStore = await cookies();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component; session refresh is handled in Phase 2.
        }
      },
    },
  });
}
