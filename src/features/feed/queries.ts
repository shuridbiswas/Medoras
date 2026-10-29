import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  COMMENT_PAGE_LIMIT,
  FEED_PAGE_SIZE,
} from "@/features/feed/options";
import type { FeedRequest } from "@/features/feed/schemas";
import type {
  FeedComment,
  FeedPage,
  FeedPost,
  PostAuthor,
} from "@/features/feed/types";

/**
 * Reads go through the member's own session, so row level security decides what is visible.
 * `viewerId` is only used to mark which posts are the viewer's own and which they have liked.
 */

const AUTHOR =
  "author:profiles!posts_author_id_fkey(id, username, first_name, last_name, headline, avatar_path)";
const POST_SELECT = `id, category, body, created_at, edited_at, ${AUTHOR}, likes:post_likes(count), comments:post_comments(count)`;

type PostQueryRow = {
  id: string;
  category: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  author: PostAuthor | null;
  likes: { count: number }[];
  comments: { count: number }[];
};

type CommentQueryRow = {
  id: string;
  post_id: string;
  body: string;
  created_at: string;
  author: PostAuthor | null;
};

const count = (rows: { count: number }[] | null | undefined) =>
  rows?.[0]?.count ?? 0;

export const encodeCursor = (post: { created_at: string; id: string }) =>
  `${post.created_at}|${post.id}`;

export async function getFeedPage(
  viewerId: string,
  { cursor, category, authorId }: FeedRequest = {},
  pageSize = FEED_PAGE_SIZE,
): Promise<FeedPage & { failed?: boolean }> {
  const supabase = await createClient();

  let query = supabase.from("posts").select(POST_SELECT);
  if (category) query = query.eq("category", category);
  if (authorId) query = query.eq("author_id", authorId);
  if (cursor) {
    // Strictly older than the last post seen; the id breaks ties between equal timestamps.
    const [createdAt, id] = cursor.split("|");
    query = query.or(
      `created_at.lt."${createdAt}",and(created_at.eq."${createdAt}",id.lt.${id})`,
    );
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(pageSize + 1)
    .overrideTypes<PostQueryRow[], { merge: false }>();

  if (error || !data) return { posts: [], nextCursor: null, failed: true };

  const rows = data.filter((r) => r.author !== null);
  const hasMore = data.length > pageSize;
  const pageRows = rows.slice(0, pageSize);

  let liked = new Set<string>();
  if (pageRows.length > 0) {
    const { data: mine } = await supabase
      .from("post_likes")
      .select("post_id")
      .eq("user_id", viewerId)
      .in(
        "post_id",
        pageRows.map((r) => r.id),
      );
    liked = new Set((mine ?? []).map((l) => l.post_id));
  }

  const posts: FeedPost[] = pageRows.map((r) => ({
    id: r.id,
    category: r.category,
    body: r.body,
    created_at: r.created_at,
    edited_at: r.edited_at,
    author: r.author as PostAuthor,
    likeCount: count(r.likes),
    commentCount: count(r.comments),
    likedByMe: liked.has(r.id),
    isOwn: r.author?.id === viewerId,
  }));

  const last = pageRows.at(-1);
  return {
    posts,
    nextCursor: hasMore && last ? encodeCursor(last) : null,
  };
}

/** Oldest first, so a conversation reads top to bottom. */
export async function getComments(
  viewerId: string,
  postId: string,
): Promise<{ comments: FeedComment[]; failed?: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("post_comments")
    .select(
      "id, post_id, body, created_at, author:profiles!post_comments_author_id_fkey(id, username, first_name, last_name, headline, avatar_path)",
    )
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(COMMENT_PAGE_LIMIT)
    .overrideTypes<CommentQueryRow[], { merge: false }>();

  if (error || !data) return { comments: [], failed: true };
  return {
    comments: data
      .filter((c) => c.author !== null)
      .map((c) => ({
        id: c.id,
        post_id: c.post_id,
        body: c.body,
        created_at: c.created_at,
        author: c.author as PostAuthor,
        isOwn: c.author?.id === viewerId,
      })),
  };
}

/** Authoritative counts straight from the rows, used after a like or comment changes them. */
export async function getPostCounts(
  postId: string,
): Promise<{ likeCount: number; commentCount: number } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select("likes:post_likes(count), comments:post_comments(count)")
    .eq("id", postId)
    .maybeSingle()
    .overrideTypes<
      { likes: { count: number }[]; comments: { count: number }[] },
      { merge: false }
    >();
  if (error || !data) return null;
  return { likeCount: count(data.likes), commentCount: count(data.comments) };
}
