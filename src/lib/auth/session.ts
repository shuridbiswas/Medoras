import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  evaluateMfa,
  isRecentSignIn,
  mfaMode,
  type TwoFactorState,
} from "@/lib/auth/mfa";
import { isTwoFactorConfigured, isVerified } from "@/lib/auth/two-factor";
import type {
  OnboardingPreferencesRow,
  ProfileRow,
} from "@/lib/supabase/database.types";

/**
 * Data access layer. Every private page and action goes through these helpers so the
 * authorization check happens on the server, not only in the proxy or the client.
 */

/** The verified user, or null. Asks the Auth server (getUser), so a revoked session fails. */
export const getUser = cache(async (): Promise<User | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
});

export const getProfile = cache(
  async (userId: string): Promise<ProfileRow | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    return data;
  },
);

export const getPreferences = cache(
  async (userId: string): Promise<OnboardingPreferencesRow | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("onboarding_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    return data;
  },
);

/** The id of this sign-in session (from the verified token). Null if it cannot be read. */
export const getSessionId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const id = data?.claims?.session_id;
  return !error && typeof id === "string" ? id : null;
});

/**
 * Whether this sign-in session has been confirmed with an emailed code. When email codes are not
 * set up the step is not offered (`configured: false`). If the session id cannot be read this
 * throws: failing closed is safer than skipping the step.
 */
export const getTwoFactorState = cache(async (userId: string): Promise<TwoFactorState> => {
  if (!isTwoFactorConfigured()) return { configured: false, verified: false };
  const sessionId = await getSessionId();
  if (!sessionId) throw new Error("two_factor_state_unavailable");
  return { configured: true, verified: await isVerified(userId, sessionId) };
});

/**
 * How strictly a page applies the emailed-code step:
 *   "enforce"  the member must have confirmed this sign-in with a code (the default)
 *   "skip"     no check (the code page itself)
 */
export type MfaOption = "enforce" | "skip";

/** Requires a signed-in member with a verified email (and, per MFA_ENFORCEMENT, a confirmed sign-in). */
export async function requireUser(options: { mfa?: MfaOption } = {}): Promise<User> {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!user.email_confirmed_at) redirect("/login?error=verify_email");

  const mode = mfaMode();
  if ((options.mfa ?? "enforce") !== "skip" && mode !== "off") {
    if (evaluateMfa(mode, await getTwoFactorState(user.id)) === "challenge") redirect("/mfa/verify");
  }
  return user;
}

/** Requires a signed-in member who has NOT finished onboarding. Others go to the home page (/). */
export async function requireOnboardingPending() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  if (profile?.onboarding_completed) redirect("/");
  return { user, profile, preferences: await getPreferences(user.id) };
}

/**
 * "active" or "suspended". If the status table cannot be read (for example before the safety
 * migration is applied) the member is treated as active; the database also refuses a suspended
 * member's writes, so this is not the only defence.
 */
export const getMemberStatus = cache(async (userId: string): Promise<"active" | "suspended"> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("member_status")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return "active";
  return data?.status === "suspended" ? "suspended" : "active";
});

/**
 * Requires a signed-in member who finished onboarding. Others go to /onboarding, suspended
 * members to /suspended (where they can read the notice and appeal).
 */
export async function requireMember(
  options: { mfa?: MfaOption; allowSuspended?: boolean } = {},
) {
  const user = await requireUser({ mfa: options.mfa });
  const profile = await getProfile(user.id);
  if (!profile?.onboarding_completed) redirect("/onboarding");
  if (!options.allowSuspended && (await getMemberStatus(user.id)) === "suspended") {
    redirect("/suspended");
  }
  return { user, profile };
}

/** True when the member signed in recently enough to do something sensitive without re-entering a password. */
export const isRecentAuth = (user: Pick<User, "last_sign_in_at">) =>
  isRecentSignIn(user.last_sign_in_at);

/** For pages: send the member to /reauth (and back) unless they signed in recently. */
export function requireRecentAuth(user: Pick<User, "last_sign_in_at">, returnTo: string) {
  if (!isRecentAuth(user)) redirect(`/reauth?next=${encodeURIComponent(returnTo)}`);
}

/**
 * Administrators only. Anyone else gets a plain 404 (the admin area does not announce itself).
 * An administrator must always have confirmed this sign-in with an emailed code, whatever
 * MFA_ENFORCEMENT says; if email codes are not set up the admin area stays closed.
 */
export async function requireAdmin() {
  const { user, profile } = await requireMember();
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (data?.role !== "admin") notFound();

  if (!isTwoFactorConfigured()) redirect("/settings/security?admin_2fa=unavailable");
  if (!(await getTwoFactorState(user.id)).verified) redirect("/mfa/verify");
  return { user, profile };
}

export { avatarUrl, coverUrl, storageUrl } from "@/lib/storage-url";
