import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/lib/supabase/database.types";
import { POST_CATEGORIES } from "@/features/feed/options";
import { cached } from "@/lib/cache";

/**
 * Right-rail data. Everything here is real: other onboarded members, and counts from real
 * posts. When there is nothing to show the rail says so instead of inventing content.
 */

export type MemberSummary = Pick<
  ProfileRow,
  "id" | "username" | "first_name" | "last_name" | "headline" | "avatar_path"
>;

const MEMBER_COLUMNS =
  "id, username, first_name, last_name, headline, avatar_path";

/** The most recently joined members other than the viewer. Nobody is ranked or scored. */
export async function getNewMembers(
  viewerId: string,
  limit = 4,
): Promise<MemberSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select(MEMBER_COLUMNS)
    .eq("onboarding_completed", true)
    .neq("id", viewerId)
    .not("username", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit)
    .overrideTypes<MemberSummary[], { merge: false }>();
  return data ?? [];
}

/** Members who say they are open to mentoring (self-reported; not verified). */
export async function getOpenMentors(
  viewerId: string,
  limit = 3,
): Promise<MemberSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select(MEMBER_COLUMNS)
    .eq("onboarding_completed", true)
    .eq("open_to_mentor", true)
    .neq("id", viewerId)
    .not("username", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit)
    .overrideTypes<MemberSummary[], { merge: false }>();
  return data ?? [];
}

/** Post counts per category over the last seven days, most active first. */
export async function getActiveCategories(
  limit = 4,
): Promise<{ value: string; label: string; count: number }[]> {
  // Same numbers for every member (public aggregates, no personal data), so a 60 second shared
  // cache is safe. Redis is optional: without it this simply queries the database.
  return cached(`active-categories:${limit}`, 60, () => loadActiveCategories(limit));
}

async function loadActiveCategories(
  limit: number,
): Promise<{ value: string; label: string; count: number }[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("posts")
    .select("category")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500);

  const counts = new Map<string, number>();
  for (const row of data ?? [])
    counts.set(row.category, (counts.get(row.category) ?? 0) + 1);

  return POST_CATEGORIES.filter((c) => counts.has(c.value))
    .map((c) => ({
      value: c.value,
      label: c.label,
      count: counts.get(c.value) ?? 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
