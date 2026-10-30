"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/monitoring/report";
import { idSchema } from "@/features/feed/schemas";
import type { ActionResult } from "@/features/feed/types";

const GENERIC_ERROR = "Something went wrong. Please try again.";
const GONE = "That post is no longer available.";

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/**
 * Idempotent: saving twice or removing twice leaves the same state. The owner always comes from
 * the verified session, and row level security allows only your own saves.
 */
export async function setSaved(
  postId: string,
  saved: boolean,
): Promise<ActionResult<{ saved: boolean }>> {
  const { user } = await requireMember();
  if (!idSchema.safeParse(postId).success) return fail(GENERIC_ERROR);

  const limited = await checkRateLimit("like", user.id);
  if (!limited.ok) return fail(limited.message);

  const supabase = await createClient();
  if (saved) {
    const { error } = await supabase
      .from("saved_items")
      .insert({ user_id: user.id, item_type: "post", item_id: postId });
    // 23505: already saved. 42501: the post does not exist (the policy checks it).
    if (error && error.code !== "23505") {
      if (error.code === "42501") return fail(GONE);
      reportError("saved_items.insert", error);
      return fail(GENERIC_ERROR);
    }
  } else {
    const { error } = await supabase
      .from("saved_items")
      .delete()
      .eq("user_id", user.id)
      .eq("item_type", "post")
      .eq("item_id", postId);
    if (error) {
      reportError("saved_items.delete", error);
      return fail(GENERIC_ERROR);
    }
  }

  revalidatePath("/saved");
  return { ok: true, saved };
}
