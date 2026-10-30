import { z } from "zod";
import { cleanText } from "@/features/network/schemas";

const message = (empty: string) => z.string().trim().min(1, empty).max(1000, "Use 1,000 characters or fewer.");
const optionalNote = z.string().trim().max(1000, "Use 1,000 characters or fewer.").optional();

export const moderateSchema = z
  .object({
    reportId: z.uuid(),
    decision: z.enum(["dismiss", "warn", "remove_content", "suspend"], { error: "Choose a decision." }),
    note: optionalNote,
    memberMessage: z.string().trim().max(1000, "Use 1,000 characters or fewer.").optional(),
  })
  .refine((v) => v.decision === "dismiss" || Boolean(v.memberMessage), {
    path: ["memberMessage"],
    message: "Write the message the member will see.",
  });

export const memberStatusSchema = z.object({
  memberId: z.uuid(),
  status: z.enum(["active", "suspended"], { error: "Choose a status." }),
  reason: optionalNote,
  message: message("Write the message the member will see."),
});

export const appealDecisionSchema = z.object({
  appealId: z.uuid(),
  decision: z.enum(["upheld", "overturned"], { error: "Choose a decision." }),
  note: message("Write the note the member will see."),
});

export const retentionSchema = z.object({
  key: z.enum(["read_notifications", "resolved_reports", "audit_logs", "recovery_attempts", "completed_data_requests"]),
  days: z.coerce.number().int("Use a whole number of days.").min(1, "Use at least 1 day.").max(3650, "Use 3,650 days or fewer."),
});

export const idSchema = z.uuid();

export const REPORT_FILTERS = ["open", "reviewing", "resolved", "all"] as const;
export type ReportFilter = (typeof REPORT_FILTERS)[number];

export function parseReportFilter(value: string | undefined): ReportFilter {
  return (REPORT_FILTERS as readonly string[]).includes(value ?? "") ? (value as ReportFilter) : "open";
}

export const userSearchTerms = (q: string | undefined) => cleanText(q, 60).split(" ").filter(Boolean).slice(0, 3);

export type AdminFormState = { status: "idle" | "success" | "error"; message?: string };
