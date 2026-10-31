"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/monitoring/report";
import { answerSchema, askSchema, idSchema, replySchema } from "@/features/forums/schemas";
import type { ForumFormState } from "@/features/forums/state";

/**
 * Every action starts with requireMember(). The acting member comes only from that verified
 * session. Content is created by database functions that write the content and its private
 * identity record together, so an anonymous question, answer or reply never carries an author id.
 * Edits, deletes and "accept" are authorised by the database (row level security checks the
 * private identity record), and a change that touches no row is reported as an error, not success.
 */

const GENERIC_ERROR = "Something went wrong. Please try again.";
const NOT_YOURS = "That item no longer exists, or it isn't yours to change.";
const GONE = "That is no longer available.";

type Result<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

const str = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

function invalid(error: z.ZodError): ForumFormState {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) (fieldErrors[String(issue.path[0] ?? "form")] ??= []).push(issue.message);
  return { status: "error", fieldErrors, message: "Please fix the highlighted fields." };
}

/** Database messages written for members (rate limits, unavailable content) are safe to show. */
function friendly(error: { code?: string; message?: string } | null | undefined): string {
  const message = error?.message ?? "";
  if (/too quickly/i.test(message)) return message;
  if (/no longer available/i.test(message)) return GONE;
  if (/identifiable patient/i.test(message)) return message;
  return GENERIC_ERROR;
}

function refresh() {
  revalidatePath("/forums", "layout");
  revalidatePath("/saved");
}

export async function askQuestion(_prev: ForumFormState, formData: FormData): Promise<ForumFormState> {
  const { user } = await requireMember();
  const parsed = askSchema.safeParse({
    topic: str(formData, "topic"),
    kind: str(formData, "kind"),
    title: str(formData, "title"),
    body: str(formData, "body"),
    anonymous: formData.get("anonymous") === "on",
    confirmed: formData.get("confirmed") === "on",
  });
  if (!parsed.success) return invalid(parsed.error);

  const limited = await checkRateLimit("forum", user.id);
  if (!limited.ok) return { status: "error", message: limited.message };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ask_question", {
    p_topic: parsed.data.topic,
    p_kind: parsed.data.kind,
    p_title: parsed.data.title,
    p_body: parsed.data.body,
    p_anonymous: parsed.data.anonymous,
    p_confirmed: parsed.data.confirmed,
  });
  if (error || !data) {
    // 23503: the topic does not exist. Everything else gets a generic message.
    if (error && error.code !== "23503" && !/too quickly/i.test(error.message ?? "")) reportError("forum.ask_question", error);
    return { status: "error", message: friendly(error) };
  }
  refresh();
  redirect(`/forums/${data}`);
}

export async function postAnswer(questionId: string, body: string, anonymous: boolean): Promise<Result> {
  const { user } = await requireMember();
  const parsed = answerSchema.safeParse({ questionId, body, anonymous });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);

  const limited = await checkRateLimit("forum", user.id);
  if (!limited.ok) return fail(limited.message);

  const supabase = await createClient();
  const { error } = await supabase.rpc("post_answer", {
    p_question: parsed.data.questionId,
    p_body: parsed.data.body,
    p_anonymous: parsed.data.anonymous,
  });
  if (error) {
    if (error.code !== "P0002" && !/too quickly/i.test(error.message ?? "")) reportError("forum.post_answer", error);
    return fail(friendly(error));
  }
  refresh();
  return { ok: true };
}

export async function postReply(answerId: string, body: string, anonymous: boolean): Promise<Result> {
  const { user } = await requireMember();
  const parsed = replySchema.safeParse({ answerId, body, anonymous });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);

  const limited = await checkRateLimit("forum", user.id);
  if (!limited.ok) return fail(limited.message);

  const supabase = await createClient();
  const { error } = await supabase.rpc("post_reply", {
    p_answer: parsed.data.answerId,
    p_body: parsed.data.body,
    p_anonymous: parsed.data.anonymous,
  });
  if (error) {
    if (error.code !== "P0002" && !/too quickly/i.test(error.message ?? "")) reportError("forum.post_reply", error);
    return fail(friendly(error));
  }
  refresh();
  return { ok: true };
}

/** Idempotent: voting twice or removing twice leaves the same state. */
export async function setHelpful(answerId: string, on: boolean): Promise<Result<{ on: boolean }>> {
  const { user } = await requireMember();
  if (!idSchema.safeParse(answerId).success) return fail(GENERIC_ERROR);
  const limited = await checkRateLimit("like", user.id);
  if (!limited.ok) return fail(limited.message);

  const supabase = await createClient();
  if (on) {
    const { error } = await supabase.from("forum_votes").insert({ answer_id: answerId, user_id: user.id });
    if (error && error.code !== "23505") {
      // 42501: your own answer, or one that is gone.
      if (error.code === "42501") return fail("You can't mark your own answer helpful.");
      reportError("forum_votes.insert", error);
      return fail(GENERIC_ERROR);
    }
  } else {
    const { error } = await supabase.from("forum_votes").delete().eq("answer_id", answerId).eq("user_id", user.id);
    if (error) {
      reportError("forum_votes.delete", error);
      return fail(GENERIC_ERROR);
    }
  }
  refresh();
  return { ok: true, on };
}

/** Only the asker can accept; the database checks that through the private identity record. */
export async function acceptAnswer(questionId: string, answerId: string | null): Promise<Result> {
  await requireMember();
  if (!idSchema.safeParse(questionId).success || (answerId !== null && !idSchema.safeParse(answerId).success)) {
    return fail(GENERIC_ERROR);
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("forum_questions")
    .update({ accepted_answer_id: answerId })
    .eq("id", questionId)
    .select("id");
  if (error) {
    if (error.code === "42501") return fail("That answer doesn't belong to this question.");
    reportError("forum_questions.accept", error);
    return fail(GENERIC_ERROR);
  }
  if (!data || data.length === 0) return fail("Only the person who asked can choose an accepted answer.");
  refresh();
  return { ok: true };
}

export async function setFollow(questionId: string, on: boolean): Promise<Result<{ on: boolean }>> {
  const { user } = await requireMember();
  if (!idSchema.safeParse(questionId).success) return fail(GENERIC_ERROR);
  const limited = await checkRateLimit("like", user.id);
  if (!limited.ok) return fail(limited.message);

  const supabase = await createClient();
  if (on) {
    const { error } = await supabase.from("forum_follows").insert({ question_id: questionId, user_id: user.id });
    if (error && error.code !== "23505") {
      if (error.code === "42501") return fail(GONE);
      reportError("forum_follows.insert", error);
      return fail(GENERIC_ERROR);
    }
  } else {
    const { error } = await supabase.from("forum_follows").delete().eq("question_id", questionId).eq("user_id", user.id);
    if (error) {
      reportError("forum_follows.delete", error);
      return fail(GENERIC_ERROR);
    }
  }
  refresh();
  return { ok: true, on };
}

/** Saving a question or an answer reuses the shared bookmarks (saved_items). */
export async function setSavedForum(
  type: "forum_question" | "forum_answer",
  id: string,
  saved: boolean,
): Promise<Result<{ saved: boolean }>> {
  const { user } = await requireMember();
  if (!idSchema.safeParse(id).success || (type !== "forum_question" && type !== "forum_answer")) return fail(GENERIC_ERROR);
  const limited = await checkRateLimit("like", user.id);
  if (!limited.ok) return fail(limited.message);

  const supabase = await createClient();
  if (saved) {
    const { error } = await supabase.from("saved_items").insert({ user_id: user.id, item_type: type, item_id: id });
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
      .eq("item_type", type)
      .eq("item_id", id);
    if (error) {
      reportError("saved_items.delete", error);
      return fail(GENERIC_ERROR);
    }
  }
  refresh();
  return { ok: true, saved };
}

async function removeOwn(table: "forum_questions" | "forum_answers" | "forum_replies", id: string): Promise<Result> {
  await requireMember();
  if (!idSchema.safeParse(id).success) return fail(NOT_YOURS);
  const supabase = await createClient();
  // The policy lets the writer (public or anonymous) delete; anyone else matches no row.
  const { data, error } = await supabase.from(table).delete().eq("id", id).select("id");
  if (error) {
    reportError(`${table}.delete`, error);
    return fail(GENERIC_ERROR);
  }
  if (!data || data.length === 0) return fail(NOT_YOURS);
  refresh();
  return { ok: true };
}

export const deleteQuestion = async (id: string) => removeOwn("forum_questions", id);
export const deleteAnswer = async (id: string) => removeOwn("forum_answers", id);
export const deleteReply = async (id: string) => removeOwn("forum_replies", id);
