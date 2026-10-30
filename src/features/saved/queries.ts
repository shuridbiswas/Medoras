import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getPostsByIds } from "@/features/feed/queries";
import type { FeedPost } from "@/features/feed/types";

export const SAVED_PAGE_SIZE = 10;

/**
 * The viewer's saved posts, most recently saved first. Saved items are private (row level
 * security shows each member only their own). A saved post that was deleted is removed by a
 * database trigger, so the list never points at nothing.
 */
export async function getSavedPosts(
  viewerId: string,
  page: number,
): Promise<{ posts: FeedPost[]; total: number; failed?: boolean }> {
  const supabase = await createClient();
  const from = (page - 1) * SAVED_PAGE_SIZE;
  const { data, error, count } = await supabase
    .from("saved_items")
    .select("item_id", { count: "exact" })
    .eq("user_id", viewerId)
    .eq("item_type", "post")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + SAVED_PAGE_SIZE - 1)
    .overrideTypes<{ item_id: string }[], { merge: false }>();

  if (error || !data) return { posts: [], total: 0, failed: true };

  const { posts, failed } = await getPostsByIds(
    viewerId,
    data.map((i) => i.item_id),
  );
  return { posts, total: count ?? posts.length, failed };
}
