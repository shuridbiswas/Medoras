"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/monitoring/report";
import {
  commentSchema,
  editPostSchema,
  feedRequestSchema,
  idSchema,
  postSchema,
} from "@/features/feed/schemas";
import {
  getComments,
  getFeedPage,
  getPostCounts,
} from "@/features/feed/queries";
import type {
  ActionResult,
  FeedComment,
  FeedPage,
  FormState,
} from "@/features/feed/types";

/**
 * Every action starts with requireMember(): signed in, email verified, onboarding complete.
 * Ownership always comes from that verified user id, never from the form or arguments, and the
 * `.eq("author_id", user.id)` filters and row level security enforce it a second time.
 */

const GENERIC_ERROR = "Something went wrong. Please try again.";
const NOT_YOURS = "That item no longer exists, or it isn't yours to change.";

const str = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

function invalid(error: z.ZodError): FormState {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return {
    status: "error",
    fieldErrors,
    message: "Please fix the highlighted fields.",
  };
}

/** The database rate limit raises a readable message; anything else stays generic. */
const friendly = (error: { message?: string } | null | undefined) =>
  error?.message && /too quickly/i.test(error.message)
    ? error.message
    : GENERIC_ERROR;

function refresh(username: string | null) {
  revalidatePath("/");
  if (username) revalidatePath(`/profile/${username}`);
}

const fail = (error: string): { ok: false; error: string } => ({
  ok: false,
  error,
});

export async function createPost(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user, profile } = await requireMember();
  const parsed = postSchema.safeParse({
    category: str(formData, "category"),
    body: str(formData, "body"),
    communityId: str(formData, "communityId") || undefined,
  });
  if (!parsed.success) return invalid(parsed.error);

  const limited = await checkRateLimit("post", user.id);
  if (!limited.ok) return { status: "error", message: limited.message };

  const supabase = await createClient();
  const { error } = await supabase.from("posts").insert({
    author_id: user.id,
    category: parsed.data.category,
    body: parsed.data.body,
    ...(parsed.data.communityId ? { community_id: parsed.data.communityId } : {}),
  });
  if (error) {
    // 42501: not a member of that community (or it was closed). Say so without detail.
    if (error.code === "42501" && parsed.data.communityId) {
      return { status: "error", message: "You can only post in communities you have joined." };
    }
    reportError("posts.insert", error);
    return { status: "error", message: friendly(error) };
  }

  if (parsed.data.communityId) revalidatePath("/communities/[slug]", "page");
  refresh(profile.username);
  return { status: "success", message: "Posted.", nonce: Date.now() };
}

export async function updatePost(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user, profile } = await requireMember();
  const parsed = editPostSchema.safeParse({
    id: str(formData, "id"),
    category: str(formData, "category"),
    body: str(formData, "body"),
  });
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .update({ category: parsed.data.category, body: parsed.data.body })
    .eq("id", parsed.data.id)
    .eq("author_id", user.id)
    .select("id");
  if (error) {
    reportError("posts.update", error);
    return { status: "error", message: friendly(error) };
  }
  if (!data || data.length === 0)
    return { status: "error", message: NOT_YOURS };

  refresh(profile.username);
  return {
    status: "success",
    message: "Post updated.",
    nonce: Date.now(),
    saved: {
      category: parsed.data.category,
      body: parsed.data.body,
      editedAt: new Date().toISOString(),
    },
  };
}

export async function deletePost(postId: string): Promise<ActionResult> {
  const { user, profile } = await requireMember();
  if (!idSchema.safeParse(postId).success) return fail(NOT_YOURS);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .delete()
    .eq("id", postId)
    .eq("author_id", user.id)
    .select("id");
  if (error) {
    reportError("posts.delete", error);
    return fail(GENERIC_ERROR);
  }
  if (!data || data.length === 0) return fail(NOT_YOURS);

  refresh(profile.username);
  return { ok: true };
}

/** Idempotent: liking twice or unliking twice leaves the same state. */
export async function setLike(
  postId: string,
  liked: boolean,
): Promise<ActionResult<{ liked: boolean; likeCount: number }>> {
  const { user } = await requireMember();
  if (!idSchema.safeParse(postId).success) return fail(GENERIC_ERROR);

  const limited = await checkRateLimit("like", user.id);
  if (!limited.ok) return fail(limited.message);

  const supabase = await createClient();
  if (liked) {
    const { error } = await supabase
      .from("post_likes")
      .insert({ post_id: postId, user_id: user.id });
    // 23505: already liked. 23503 / 42501: the post was deleted or is no longer visible to this member.
    if (error && error.code !== "23505") {
      const gone = error.code === "23503" || error.code === "42501";
      if (!gone) reportError("post_likes.insert", error);
      return fail(gone ? "That post is no longer available." : GENERIC_ERROR);
    }
  } else {
    const { error } = await supabase
      .from("post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", user.id);
    if (error) return fail(GENERIC_ERROR);
  }

  const counts = await getPostCounts(postId);
  if (!counts) return fail("That post is no longer available.");
  return { ok: true, liked, likeCount: counts.likeCount };
}

export async function addComment(
  postId: string,
  text: string,
): Promise<ActionResult<{ comment: FeedComment; commentCount: number }>> {
  const { user, profile } = await requireMember();
  const parsed = commentSchema.safeParse({ postId, body: text });
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);

  const limited = await checkRateLimit("comment", user.id);
  if (!limited.ok) return fail(limited.message);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("post_comments")
    .insert({
      post_id: parsed.data.postId,
      author_id: user.id,
      body: parsed.data.body,
    })
    .select("id, post_id, body, created_at")
    .single();
  if (error || !data) {
    const gone = error?.code === "23503" || error?.code === "42501";
    if (error && !gone) reportError("post_comments.insert", error);
    return fail(
      gone
        ? "That post is no longer available."
        : friendly(error),
    );
  }

  const counts = await getPostCounts(parsed.data.postId);
  return {
    ok: true,
    commentCount: counts?.commentCount ?? 0,
    comment: {
      ...data,
      isOwn: true,
      author: {
        id: profile.id,
        username: profile.username,
        first_name: profile.first_name,
        last_name: profile.last_name,
        headline: profile.headline,
        avatar_path: profile.avatar_path,
      },
    },
  };
}

export async function deleteComment(
  commentId: string,
  postId: string,
): Promise<ActionResult<{ commentCount: number }>> {
  const { user } = await requireMember();
  if (!idSchema.safeParse(commentId).success || !idSchema.safeParse(postId).success)
    return fail(NOT_YOURS);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("post_comments")
    .delete()
    .eq("id", commentId)
    .eq("author_id", user.id)
    .select("id");
  if (error) return fail(GENERIC_ERROR);
  if (!data || data.length === 0) return fail(NOT_YOURS);

  const counts = await getPostCounts(postId);
  return { ok: true, commentCount: counts?.commentCount ?? 0 };
}

export async function loadMorePosts(
  request: unknown,
): Promise<ActionResult<{ page: FeedPage }>> {
  const { user } = await requireMember();
  const parsed = feedRequestSchema.safeParse(request);
  if (!parsed.success) return fail(GENERIC_ERROR);

  const limited = await checkRateLimit("api", user.id);
  if (!limited.ok) return fail(limited.message);

  const { failed, ...page } = await getFeedPage(user.id, parsed.data);
  if (failed) return fail("We couldn't load more posts. Please try again.");
  return { ok: true, page };
}

export async function loadComments(
  postId: string,
): Promise<ActionResult<{ comments: FeedComment[] }>> {
  const { user } = await requireMember();
  if (!idSchema.safeParse(postId).success) return fail(GENERIC_ERROR);

  const { comments, failed } = await getComments(user.id, postId);
  if (failed) return fail("We couldn't load the comments. Please try again.");
  return { ok: true, comments };
}
