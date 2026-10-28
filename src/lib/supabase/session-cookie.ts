import type { CookieOptions } from "@supabase/ssr";

/**
 * "Keep me signed in" support. Supabase cookies are persistent by default. When a member
 * signs in without ticking the box we set this flag cookie, and every Supabase cookie
 * write then drops its expiry so the session ends when the browser closes.
 */
export const SESSION_ONLY_COOKIE = "medoras-session-only";

export function applySessionPolicy(
  options: CookieOptions,
  sessionOnly: boolean,
): CookieOptions {
  // maxAge 0 (or less) is a deletion and must be left alone.
  if (!sessionOnly || options.maxAge === undefined || options.maxAge <= 0) {
    return options;
  }
  const { maxAge, expires, ...rest } = options;
  void maxAge;
  void expires;
  return rest;
}
