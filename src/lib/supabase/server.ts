import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabaseEnv } from "@/lib/supabase/env";
import {
  applySessionPolicy,
  SESSION_ONLY_COOKIE,
} from "@/lib/supabase/session-cookie";

/**
 * Server Supabase client for Server Components, Route Handlers and Server Actions.
 * Create one per request; it reads and writes the request's auth cookies.
 *
 * `sessionOnly` overrides the cookie flag, for the moment a login action has just
 * decided it but the flag cookie has not round-tripped yet.
 */
export async function createClient(options: { sessionOnly?: boolean } = {}) {
  const env = getSupabaseEnv();
  if (!env) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and fill in your project values.",
    );
  }
  // Supabase reads the clock to check token expiry. Mark this as request-time work so Next
  // never tries to prerender it (Cache Components rejects unstable time values).
  await connection();
  const cookieStore = await cookies();
  const sessionOnly =
    options.sessionOnly ?? cookieStore.get(SESSION_ONLY_COOKIE)?.value === "1";

  return createServerClient<Database>(env.url, env.key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options: cookieOptions }) =>
            cookieStore.set(
              name,
              value,
              applySessionPolicy(cookieOptions, sessionOnly),
            ),
          );
        } catch {
          // Called from a Server Component, which cannot write cookies. The proxy refreshes sessions.
        }
      },
    },
  });
}
