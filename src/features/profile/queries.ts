import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type {
  EducationRow,
  ExperienceRow,
  ProfileRow,
  SkillRow,
} from "@/lib/supabase/database.types";

export type FullProfile = {
  profile: ProfileRow;
  education: EducationRow[];
  experience: ExperienceRow[];
  skills: SkillRow[];
};

/** Same rules as the database constraint; anything else can't be a username, so skip the query. */
export const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

async function loadRelated(profile: ProfileRow): Promise<FullProfile> {
  const supabase = await createClient();
  const [education, experience, skills] = await Promise.all([
    supabase
      .from("profile_education")
      .select("*")
      .eq("profile_id", profile.id)
      .order("currently_studying", { ascending: false })
      .order("start_year", { ascending: false, nullsFirst: false }),
    supabase
      .from("profile_experience")
      .select("*")
      .eq("profile_id", profile.id)
      .order("start_date", { ascending: false }),
    supabase
      .from("profile_skills")
      .select("*")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: true }),
  ]);

  return {
    profile,
    education: education.data ?? [],
    experience: experience.data ?? [],
    skills: skills.data ?? [],
  };
}

/**
 * Row level security decides what the viewer may see: their own profile always, anyone else's
 * only after onboarding. Returns null for unknown, malformed or not-yet-visible usernames.
 */
export const getProfileByUsername = cache(
  async (username: string): Promise<FullProfile | null> => {
    const normalized = username.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(normalized)) return null;

    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("username", normalized)
      .maybeSingle();
    return data ? loadRelated(data) : null;
  },
);

export const getProfileById = cache(
  async (id: string): Promise<FullProfile | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return data ? loadRelated(data) : null;
  },
);
