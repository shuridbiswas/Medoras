"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/monitoring/report";
import {
  appealDecisionSchema,
  idSchema,
  memberStatusSchema,
  moderateSchema,
  retentionSchema,
  type AdminFormState,
} from "@/features/admin/schemas";

/**
 * Every action starts with requireAdmin() (a 404 for anyone else, and a second factor always).
 * The decision itself happens inside a security definer database function that re-checks that the
 * caller is an administrator and writes the audit log in the same transaction, so neither this
 * file nor a forged request can skip the log. Errors shown to staff never include row contents.
 */

const GENERIC = "Something went wrong. Please try again.";
const str = (formData: FormData, key: string) => {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
};

/** Postgres raises readable messages from our functions; show those, hide everything else. */
function friendly(error: { code?: string; message?: string }) {
  const m = error.message ?? "";
  if (/not allowed/i.test(m)) return "You are not allowed to do that.";
  if (
    /(not open|cannot be suspended|cannot be removed|message for the member|note for the member|No such member|cooling-off|staff role|not an open deletion)/i.test(m)
  )
    return m;
  return GENERIC;
}

async function guard() {
  const { user } = await requireAdmin();
  const limited = await checkRateLimit("api", user.id);
  return { user, limited: limited.ok ? null : limited.message };
}

function refresh() {
  revalidatePath("/admin", "layout");
}

export async function claimReport(reportId: string): Promise<{ ok: boolean; error?: string }> {
  const { limited } = await guard();
  if (limited) return { ok: false, error: limited };
  if (!idSchema.safeParse(reportId).success) return { ok: false, error: GENERIC };
  const supabase = await createClient();
  const { error } = await supabase.rpc("claim_report", { p_report: reportId });
  if (error) {
    reportError("admin.claim_report", error);
    return { ok: false, error: friendly(error) };
  }
  refresh();
  return { ok: true };
}

export async function moderateReport(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const { limited } = await guard();
  if (limited) return { status: "error", message: limited };
  const parsed = moderateSchema.safeParse({
    reportId: str(formData, "reportId"),
    decision: str(formData, "decision"),
    note: str(formData, "note"),
    memberMessage: str(formData, "memberMessage"),
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? GENERIC };

  const supabase = await createClient();
  const { error } = await supabase.rpc("moderate_report", {
    p_report: parsed.data.reportId,
    p_decision: parsed.data.decision,
    p_note: parsed.data.note || null,
    p_member_message: parsed.data.memberMessage || null,
  });
  if (error) {
    reportError("admin.moderate_report", error);
    return { status: "error", message: friendly(error) };
  }
  refresh();
  return { status: "success", message: "Decision recorded." };
}

export async function setMemberStatus(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const { limited } = await guard();
  if (limited) return { status: "error", message: limited };
  const parsed = memberStatusSchema.safeParse({
    memberId: str(formData, "memberId"),
    status: str(formData, "status"),
    reason: str(formData, "reason"),
    message: str(formData, "message"),
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? GENERIC };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_status", {
    p_member: parsed.data.memberId,
    p_status: parsed.data.status,
    p_reason: parsed.data.reason || null,
    p_message: parsed.data.message,
  });
  if (error) {
    reportError("admin.set_member_status", error);
    return { status: "error", message: friendly(error) };
  }
  refresh();
  return { status: "success", message: parsed.data.status === "suspended" ? "Member suspended." : "Member restored." };
}

export async function decideAppeal(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const { limited } = await guard();
  if (limited) return { status: "error", message: limited };
  const parsed = appealDecisionSchema.safeParse({
    appealId: str(formData, "appealId"),
    decision: str(formData, "decision"),
    note: str(formData, "note"),
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? GENERIC };

  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_appeal", {
    p_appeal: parsed.data.appealId,
    p_decision: parsed.data.decision,
    p_note: parsed.data.note,
  });
  if (error) {
    reportError("admin.decide_appeal", error);
    return { status: "error", message: friendly(error) };
  }
  refresh();
  return { status: "success", message: "Appeal decided." };
}

export async function executeDeletion(requestId: string): Promise<{ ok: boolean; error?: string }> {
  const { limited } = await guard();
  if (limited) return { ok: false, error: limited };
  if (!idSchema.safeParse(requestId).success) return { ok: false, error: GENERIC };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_execute_deletion", { p_request: requestId });
  if (error) {
    reportError("admin.execute_deletion", error);
    return { ok: false, error: friendly(error) };
  }
  refresh();
  return { ok: true };
}

export async function setRetention(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const { limited } = await guard();
  if (limited) return { status: "error", message: limited };
  const parsed = retentionSchema.safeParse({ key: str(formData, "key"), days: str(formData, "days") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? GENERIC };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_retention_days", { p_key: parsed.data.key, p_days: parsed.data.days });
  if (error) {
    reportError("admin.set_retention", error);
    return { status: "error", message: friendly(error) };
  }
  refresh();
  return { status: "success", message: "Saved." };
}
