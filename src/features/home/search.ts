import "server-only";
import { createClient } from "@/lib/supabase/server";
import { FIELDS } from "@/features/onboarding/options";
import type { MemberSummary } from "@/features/home/queries";

export type SearchRequest = {
  q?: string;
  field?: string;
  mentors?: boolean;
};

export const SEARCH_LIMIT = 24;

/** Remove characters that have meaning in PostgREST filters or LIKE patterns. */
export function cleanTerms(q: string | undefined): string[] {
  return (q ?? "")
    .replace(/[%_,()\\*"'.:;]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.slice(0, 30))
    .slice(0, 3);
}

export const validField = (field: string | undefined) =>
  FIELDS.find((f) => f.value === field)?.value;

/**
 * Member search by name or username, optionally narrowed to one field or to members who say
 * they are open to mentoring. Row level security limits it to onboarded members.
 */
export async function searchMembers(
  viewerId: string,
  { q, field, mentors }: SearchRequest,
): Promise<{ members: MemberSummary[]; failed?: boolean }> {
  const terms = cleanTerms(q);
  const fieldValue = validField(field);

  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select("id, username, first_name, last_name, headline, avatar_path")
    .eq("onboarding_completed", true)
    .not("username", "is", null);

  // Every term must match the name or username (multiple .or() calls are ANDed).
  for (const term of terms) {
    query = query.or(
      `username.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%`,
    );
  }
  if (fieldValue) query = query.contains("fields", [fieldValue]);
  if (mentors) query = query.eq("open_to_mentor", true);

  const { data, error } = await query
    .order("first_name", { ascending: true })
    .order("id", { ascending: true })
    .limit(SEARCH_LIMIT)
    .overrideTypes<MemberSummary[], { merge: false }>();

  if (error || !data) return { members: [], failed: true };
  return { members: data.filter((m) => m.id !== viewerId) };
}
