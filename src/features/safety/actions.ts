"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/monitoring/report";
import { appealSchema, reportSchema } from "@/features/safety/schemas";

/**
 * Reports go through the submit_report database function, which checks the target exists, is not
 * the reporter's own, and stores a short snapshot. The reporter is always the signed-in member.
 * Nothing here ever returns who else reported something or what a moderator decided.
 */

const GENERIC_ERROR = "Something went wrong. Please try again.";

type Result<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export async function submitReport(input: unknown): Promise<Result> {
  const { user } = await requireMember();
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);

  const limited = await checkRateLimit("report", user.id);
  if (!limited.ok) return fail(limited.message);

  const { targetType, targetId, reason, details } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_report", {
    p_target_type: targetType,
    p_target_id: targetId,
    p_reason: reason,
    p_details: details || null,
  });

  if (error) {
    const message = error.message ?? "";
    // A repeat of a report that is still being reviewed is the outcome the member wanted.
    if (error.code === "23505") return { ok: true };
    if (/your own content/i.test(message)) return fail("You can't report your own content.");
    if (/no longer available/i.test(message)) return fail("That content is no longer available.");
    if (/too quickly/i.test(message)) return fail(message);
    reportError("reports.submit", error);
    return fail(GENERIC_ERROR);
  }
  return { ok: true };
}

/** Muting hides a member's posts and comments from you and silences their notifications. Private. */
export async function setMute(memberId: string, mute: boolean): Promise<Result> {
  const { user } = await requireMember();
  const parsed = reportSchema.shape.targetId.safeParse(memberId);
  if (!parsed.success) return fail(GENERIC_ERROR);
  if (parsed.data === user.id) return fail("You can't mute yourself.");

  const limited = await checkRateLimit("network", user.id);
  if (!limited.ok) return fail(limited.message);

  const supabase = await createClient();
  if (mute) {
    const { error } = await supabase.from("member_mutes").insert({ muter_id: user.id, muted_id: parsed.data });
    if (error && error.code !== "23505") {
      reportError("member_mutes.insert", error);
      return fail(GENERIC_ERROR);
    }
  } else {
    const { error } = await supabase
      .from("member_mutes")
      .delete()
      .eq("muter_id", user.id)
      .eq("muted_id", parsed.data);
    if (error) {
      reportError("member_mutes.delete", error);
      return fail(GENERIC_ERROR);
    }
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export type AppealState = { status: "idle" | "success" | "error"; message?: string };

/** A member appeals a notice about their own account or content. One appeal per notice. */
export async function submitAppeal(_prev: AppealState, formData: FormData): Promise<AppealState> {
  // Suspended members must be able to appeal.
  const { user } = await requireMember({ allowSuspended: true });
  const parsed = appealSchema.safeParse({
    noticeId: formData.get("noticeId"),
    message: formData.get("message"),
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? GENERIC_ERROR };

  const limited = await checkRateLimit("report", user.id);
  if (!limited.ok) return { status: "error", message: limited.message };

  const supabase = await createClient();
  const { error } = await supabase.from("appeals").insert({
    notice_id: parsed.data.noticeId,
    member_id: user.id,
    message: parsed.data.message,
  });
  if (error) {
    if (error.code === "23505") return { status: "error", message: "You have already appealed this decision." };
    // 42501: not their notice (or not an appealable one).
    if (error.code === "42501") return { status: "error", message: "That decision can't be appealed." };
    reportError("appeals.insert", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidatePath("/suspended");
  revalidatePath("/notifications");
  return { status: "success", message: "Your appeal was sent. A person will review it." };
}
