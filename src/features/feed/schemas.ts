import { z } from "zod";
import {
  COMMENT_MAX_LENGTH,
  POST_CATEGORY_VALUES,
  POST_MAX_LENGTH,
} from "@/features/feed/options";

const body = (max: number, empty: string) =>
  z
    .string()
    .trim()
    .min(1, empty)
    .max(max, `Use ${max.toLocaleString("en-US")} characters or fewer.`);

export const categorySchema = z.enum(POST_CATEGORY_VALUES, {
  error: "Choose a category.",
});

export const postSchema = z.object({
  category: categorySchema,
  body: body(POST_MAX_LENGTH, "Write something to share."),
});

export const editPostSchema = postSchema.extend({
  id: z.uuid("That post is not valid."),
});

export const commentSchema = z.object({
  postId: z.uuid("That post is not valid."),
  body: body(COMMENT_MAX_LENGTH, "Write a comment first."),
});

export const idSchema = z.uuid();

/**
 * Cursor = "<created_at>|<post id>" of the last post on the previous page. It is interpolated
 * into a PostgREST filter, so only this exact shape is accepted.
 */
export const CURSOR_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})\|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const feedRequestSchema = z.object({
  cursor: z.string().regex(CURSOR_PATTERN).optional(),
  category: categorySchema.optional(),
  authorId: z.uuid().optional(),
  scope: z.literal("following").optional(),
});

export type FeedRequest = z.infer<typeof feedRequestSchema>;
