import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  AppealRow,
  AuditLogRow,
  DataRequestRow,
  ReportRow,
  RetentionPolicyRow,
} from "@/lib/supabase/database.types";
import { userSearchTerms, type ReportFilter } from "@/features/admin/schemas";

/**
 * Staff reads. They run under the administrator's own session: row level security only returns
 * these rows to administrators, so a non-admin who somehow reached this code would get nothing.
 */

export const ADMIN_PAGE_SIZE = 20;

type Person = { id: string; username: string | null; first_name: string; last_name: string };
const PERSON = "id, username, first_name, last_name";
export const personName = (p: Pick<Person, "first_name" | "last_name"> | null) =>
  p ? [p.first_name, p.last_name].filter(Boolean).join(" ") : "Deleted member";

const countOf = async (query: PromiseLike<{ count: number | null; error: unknown }>) => {
  const { count, error } = await query;
  return error ? 0 : (count ?? 0);
};

export async function getAdminSummary() {
  const supabase = await createClient();
  const [open, reviewing, appeals, suspended, deletions] = await Promise.all([
    countOf(supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "open")),
    countOf(supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "reviewing")),
    countOf(supabase.from("appeals").select("id", { count: "exact", head: true }).eq("status", "open")),
    countOf(supabase.from("member_status").select("user_id", { count: "exact", head: true }).eq("status", "suspended")),
    countOf(supabase.from("data_requests").select("id", { count: "exact", head: true }).eq("kind", "deletion").eq("status", "requested")),
  ]);
  return { open, reviewing, appeals, suspended, deletions };
}

export type ReportItem = ReportRow & { reporter: Person | null; target: Person | null };

export async function listReports(
  filter: ReportFilter,
  page: number,
): Promise<{ reports: ReportItem[]; total: number; failed?: boolean }> {
  const supabase = await createClient();
  const from = (page - 1) * ADMIN_PAGE_SIZE;
  let query = supabase
    .from("reports")
    .select(
      `*, reporter:profiles!reports_reporter_id_fkey(${PERSON}), target:profiles!reports_target_member_id_fkey(${PERSON})`,
      { count: "exact" },
    );
  if (filter === "open") query = query.eq("status", "open");
  else if (filter === "reviewing") query = query.eq("status", "reviewing");
  else if (filter === "resolved") query = query.in("status", ["actioned", "dismissed"]);

  const { data, error, count } = await query
    .order("created_at", { ascending: filter === "open" || filter === "reviewing" })
    .order("id", { ascending: true })
    .range(from, from + ADMIN_PAGE_SIZE - 1)
    .overrideTypes<ReportItem[], { merge: false }>();
  if (error || !data) return { reports: [], total: 0, failed: true };
  return { reports: data, total: count ?? data.length };
}

export type AppealItem = AppealRow & { member: Person | null; notice: { kind: string; message: string } | null };

export async function listAppeals(status: "open" | "all" = "open"): Promise<AppealItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("appeals")
    .select(`*, member:profiles!appeals_member_id_fkey(${PERSON}), notice:member_notices!appeals_notice_id_fkey(kind, message)`);
  if (status === "open") query = query.eq("status", "open");
  const { data } = await query
    .order("created_at", { ascending: true })
    .limit(ADMIN_PAGE_SIZE)
    .overrideTypes<AppealItem[], { merge: false }>();
  return data ?? [];
}

export type AdminUser = Person & { status: "active" | "suspended"; reason: string | null; created_at: string; member_type: string | null };

export async function searchUsers(q: string | undefined, page: number): Promise<{ users: AdminUser[]; total: number; failed?: boolean }> {
  const supabase = await createClient();
  const from = (page - 1) * ADMIN_PAGE_SIZE;
  let query = supabase
    .from("profiles")
    .select(`${PERSON}, created_at, member_type`, { count: "exact" })
    .eq("onboarding_completed", true);
  for (const term of userSearchTerms(q)) {
    query = query.or(`username.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%`);
  }
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, from + ADMIN_PAGE_SIZE - 1)
    .overrideTypes<(Person & { created_at: string; member_type: string | null })[], { merge: false }>();
  if (error || !data) return { users: [], total: 0, failed: true };

  const ids = data.map((u) => u.id);
  const { data: statuses } = ids.length
    ? await supabase
        .from("member_status")
        .select("user_id, status, reason")
        .in("user_id", ids)
        .overrideTypes<{ user_id: string; status: "active" | "suspended"; reason: string | null }[], { merge: false }>()
    : { data: [] };
  const byId = new Map((statuses ?? []).map((s) => [s.user_id, s]));
  return {
    users: data.map((u) => ({
      ...u,
      status: byId.get(u.id)?.status ?? "active",
      reason: byId.get(u.id)?.reason ?? null,
    })),
    total: count ?? data.length,
  };
}

export type AuditItem = AuditLogRow & { actor: Person | null };

export async function listAudit(limit = 25): Promise<AuditItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_logs")
    .select(`*, actor:profiles!audit_logs_actor_id_fkey(${PERSON})`)
    .order("created_at", { ascending: false })
    .limit(limit)
    .overrideTypes<AuditItem[], { merge: false }>();
  return data ?? [];
}

export type DeletionItem = DataRequestRow & { member: Person | null; due: boolean };

export async function listDeletionRequests(): Promise<DeletionItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("data_requests")
    .select(`*, member:profiles!data_requests_user_id_fkey(${PERSON})`)
    .eq("kind", "deletion")
    .eq("status", "requested")
    .order("scheduled_for", { ascending: true })
    .limit(ADMIN_PAGE_SIZE)
    .overrideTypes<(DataRequestRow & { member: Person | null })[], { merge: false }>();
  const now = Date.now();
  return (data ?? []).map((d) => ({ ...d, due: Date.parse(d.scheduled_for) <= now }));
}

export async function listRetention(): Promise<RetentionPolicyRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("retention_policies")
    .select("key, days, description")
    .order("key", { ascending: true })
    .overrideTypes<RetentionPolicyRow[], { merge: false }>();
  return data ?? [];
}
