import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
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

/** Requires a signed-in member with a verified email. */
export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!user.email_confirmed_at) redirect("/login?error=verify_email");
  return user;
}

/** Requires a signed-in member who has NOT finished onboarding. Others go to /home. */
export async function requireOnboardingPending() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  if (profile?.onboarding_completed) redirect("/home");
  return { user, profile, preferences: await getPreferences(user.id) };
}

/** Requires a signed-in member who finished onboarding. Others go to /onboarding. */
export async function requireMember() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  if (!profile?.onboarding_completed) redirect("/onboarding");
  return { user, profile };
}

export { avatarUrl, coverUrl, storageUrl } from "@/lib/storage-url";
