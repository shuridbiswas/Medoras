/** Report reasons. Values must match reports_reason_valid in the safety migration. */
export const REPORT_REASONS = [
  { value: "harassment", label: "Harassment or bullying" },
  { value: "hate_or_discrimination", label: "Hate or discrimination" },
  { value: "patient_privacy", label: "Identifiable patient or client information" },
  { value: "medical_misinformation", label: "Harmful medical misinformation" },
  { value: "spam", label: "Spam or scams" },
  { value: "impersonation", label: "Impersonation or a false identity" },
  { value: "inappropriate_content", label: "Inappropriate or unsafe content" },
  { value: "safety_concern", label: "Someone may be at risk of harm" },
  { value: "other", label: "Something else" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["value"];
export const REPORT_REASON_VALUES = REPORT_REASONS.map((r) => r.value) as [ReportReason, ...ReportReason[]];

export const reportReasonLabel = (value: string) =>
  REPORT_REASONS.find((r) => r.value === value)?.label ?? value;

export const REPORT_DETAILS_MAX = 1000;
export const APPEAL_MAX = 2000;

export const REPORT_TARGET_LABELS = {
  post: "post",
  comment: "comment",
  profile: "profile",
  question: "question",
  answer: "answer",
  reply: "reply",
  community: "community",
  message: "message",
  mentor: "mentor profile",
} as const;
