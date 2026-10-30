/**
 * Safe post-login destinations. Only same-site paths under these prefixes are allowed,
 * so `?next=` can never send a member to another site (open redirect).
 */
const ALLOWED_PREFIXES = [
  "/onboarding",
  "/reset-password",
  "/profile",
  "/settings",
  "/search",
  "/network",
  "/notifications",
  "/saved",
  "/post",
] as const;

export function safeNextPath(
  next: string | null | undefined,
  fallback = "/",
): string {
  if (!next || typeof next !== "string") return fallback;
  // Reject protocol-relative ("//evil"), backslash tricks, schemes and control characters.
  if (
    !next.startsWith("/") ||
    next.startsWith("//") ||
    /[\\\u0000-\u001f]/.test(next)
  ) {
    return fallback;
  }
  let url: URL;
  try {
    url = new URL(next, "http://medyra.invalid");
  } catch {
    return fallback;
  }
  if (url.origin !== "http://medyra.invalid") return fallback;

  const { pathname } = url;
  const allowed =
    pathname === "/" ||
    ALLOWED_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
  // The query string is dropped on purpose: destinations never need it.
  return allowed ? pathname : fallback;
}
