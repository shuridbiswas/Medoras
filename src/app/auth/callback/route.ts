import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { safeNextPath } from "@/lib/auth/redirect";

/** The only email link types this route will verify. */
const ALLOWED_TYPES: EmailOtpType[] = ["email", "signup", "recovery"];

/**
 * Handles links from Supabase emails (verification and password reset).
 *  - token_hash + type: works from any device or browser (recommended email templates).
 *  - code: the PKCE flow from the default templates; works in the browser that requested it.
 * `next` is validated against an allowlist, so this can never redirect off-site.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const go = (path: string) => NextResponse.redirect(new URL(path, origin));

  if (!isSupabaseConfigured()) return go("/login?error=not_configured");

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const isRecovery = type === "recovery";
  const failure = isRecovery
    ? "/forgot-password?error=link_invalid"
    : "/login?error=link_invalid";

  const supabase = await createClient();

  if (tokenHash && type) {
    if (!ALLOWED_TYPES.includes(type)) return go(failure);
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (error) return go(failure);
    return go(
      isRecovery
        ? "/reset-password"
        : safeNextPath(searchParams.get("next"), "/onboarding"),
    );
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return go(failure);
    return go(safeNextPath(searchParams.get("next"), "/onboarding"));
  }

  return go(failure);
}
