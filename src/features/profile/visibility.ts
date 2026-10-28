import type { ProfileRow } from "@/lib/supabase/database.types";

/**
 * The single place that decides which profile fields reach the UI of other members.
 * Every column listed here is also readable by any signed-in member in the database, so adding
 * a column to `profiles` does NOT make it visible in the app until it is added to this list,
 * and a future privacy setting can be applied here (per field) without touching components.
 *
 * Email is never part of a profile; the owner's email is read from the auth session in /settings.
 */
export const PUBLIC_PROFILE_FIELDS = [
  "id",
  "username",
  "first_name",
  "last_name",
  "headline",
  "bio",
  "avatar_path",
  "cover_path",
  "location_label",
  "professional_journey",
  "career_aspirations",
  "looking_for_mentorship",
  "open_to_mentor",
  "member_type",
  "fields",
  "institution",
  "qualification",
  "specialty",
  "career_stage",
  "country",
  "created_at",
] as const;

export type PublicProfile = Pick<
  ProfileRow,
  (typeof PUBLIC_PROFILE_FIELDS)[number]
>;

export function toPublicProfile(row: ProfileRow): PublicProfile {
  const out: Partial<Record<keyof PublicProfile, unknown>> = {};
  for (const key of PUBLIC_PROFILE_FIELDS) out[key] = row[key];
  return out as PublicProfile;
}

export const fullName = (p: Pick<PublicProfile, "first_name" | "last_name">) =>
  [p.first_name, p.last_name].filter(Boolean).join(" ");
