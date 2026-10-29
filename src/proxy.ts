import { NextResponse, type NextRequest } from "next/server";
import { redirectWithSession, updateSession } from "@/lib/supabase/proxy";

/** Routes that require a signed-in member. Pages re-check on the server as well. */
const PRIVATE_PREFIXES = [
  "/home",
  "/onboarding",
  "/reset-password",
  "/profile",
  "/settings",
  "/search",
  "/communities",
  "/mentorship",
  "/careers",
  "/saved",
];
/** Pages only for signed-out visitors. */
const GUEST_ONLY = ["/login", "/signup", "/forgot-password"];

const matches = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await updateSession(request);

  const isPrivate = PRIVATE_PREFIXES.some((p) => matches(pathname, p));
  const isGuestOnly = GUEST_ONLY.some((p) => matches(pathname, p));

  if (isPrivate && !session.claims) {
    if (matches(pathname, "/reset-password")) {
      return redirectWithSession(
        request,
        session.response,
        "/forgot-password",
        {
          error: "link_invalid",
        },
      );
    }
    return redirectWithSession(
      request,
      session.response,
      "/login",
      session.configured ? { next: pathname } : { error: "not_configured" },
    );
  }

  if (isGuestOnly && session.claims) {
    return redirectWithSession(request, session.response, "/home");
  }

  return session.response ?? NextResponse.next();
}

export const config = {
  matcher: [
    "/home/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/search/:path*",
    "/communities/:path*",
    "/mentorship/:path*",
    "/careers/:path*",
    "/saved/:path*",
    "/onboarding/:path*",
    "/reset-password/:path*",
    "/login",
    "/signup",
    "/forgot-password",
  ],
};
