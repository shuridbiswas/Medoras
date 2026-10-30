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
  type MfaState,
} from "@/lib/auth/mfa";
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

/**
 * What the session has proven about a second factor. Read from the Supabase session (no extra
 * round trip). If it cannot be read, this throws: failing closed is safer than skipping MFA.
 */
export const getMfaState = cache(async (): Promise<MfaState> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) throw new Error("mfa_state_unavailable");
  return {
    enrolled: data.nextLevel === "aal2",
    level: data.currentLevel === "aal2" ? "aal2" : "aal1",
  };
});

/**
 * How strictly a page applies MFA:
 *   "enforce"          challenge enrolled members, and send members without a factor to set one up
 *   "allow-enrollment" challenge enrolled members, but let members without a factor in (the setup page)
 *   "skip"             no MFA check (the challenge page itself)
 */
export type MfaOption = "enforce" | "allow-enrollment" | "skip";

/** Requires a signed-in member with a verified email (and, per MFA_ENFORCEMENT, a second factor). */
export async function requireUser(options: { mfa?: MfaOption } = {}): Promise<User> {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!user.email_confirmed_at) redirect("/login?error=verify_email");

  const option = options.mfa ?? "enforce";
  const mode = mfaMode();
  if (option !== "skip" && mode !== "off") {
    const gate = evaluateMfa(mode, await getMfaState());
    if (gate === "challenge") redirect("/mfa/verify");
    if (gate === "enroll" && option === "enforce") redirect("/settings/security?setup=1");
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
 * Administrators only. Anyone else gets a plain 404 (the admin area does not announce itself),
 * and an administrator must always have passed a second factor, whatever MFA_ENFORCEMENT says.
 */
export async function requireAdmin() {
  const { user, profile } = await requireMember({ mfa: "allow-enrollment" });
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (data?.role !== "admin") notFound();

  const state = await getMfaState();
  if (!state.enrolled) redirect("/settings/security?setup=1");
  if (state.level !== "aal2") redirect("/mfa/verify");
  return { user, profile };
}

export { avatarUrl, coverUrl, storageUrl } from "@/lib/storage-url";
