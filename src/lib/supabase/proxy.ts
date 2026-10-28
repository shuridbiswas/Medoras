import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabaseEnv } from "@/lib/supabase/env";
import {
  applySessionPolicy,
  SESSION_ONLY_COOKIE,
} from "@/lib/supabase/session-cookie";

export type SessionResult = {
  /** The response carrying any refreshed auth cookies. Return it, or copy its cookies. */
  response: NextResponse;
  /** Verified token claims, or null when signed out or Supabase is not configured. */
  claims: { sub?: string } | null;
  configured: boolean;
};

/**
 * Refreshes the Supabase session on each matched request and verifies it with getClaims()
 * (never trust getSession() on the server).
 */
export async function updateSession(
  request: NextRequest,
): Promise<SessionResult> {
  let response = NextResponse.next({ request });
  const env = getSupabaseEnv();
  if (!env) return { response, claims: null, configured: false };

  const sessionOnly = request.cookies.get(SESSION_ONLY_COOKIE)?.value === "1";

  const supabase = createServerClient<Database>(env.url, env.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(
            name,
            value,
            applySessionPolicy(options, sessionOnly),
          ),
        );
        Object.entries(headers ?? {}).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  return { response, claims: data?.claims ?? null, configured: true };
}

/** Redirect while keeping the refreshed auth cookies and no-cache headers. */
export function redirectWithSession(
  request: NextRequest,
  session: NextResponse,
  pathname: string,
  search?: Record<string, string>,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  Object.entries(search ?? {}).forEach(([key, value]) =>
    url.searchParams.set(key, value),
  );
  const redirect = NextResponse.redirect(url);
  session.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  session.headers.forEach((value, key) => {
    if (/^(cache-control|expires|pragma)$/i.test(key)) {
      redirect.headers.set(key, value);
    }
  });
  return redirect;
}
