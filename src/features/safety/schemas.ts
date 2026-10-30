import { z } from "zod";
import { APPEAL_MAX, REPORT_DETAILS_MAX, REPORT_REASON_VALUES } from "@/features/safety/options";

export const reportSchema = z.object({
  targetType: z.enum(["post", "comment", "profile"], { error: "Choose what you are reporting." }),
  targetId: z.uuid("That item is not valid."),
  reason: z.enum(REPORT_REASON_VALUES, { error: "Choose a reason." }),
  details: z
    .string()
    .trim()
    .max(REPORT_DETAILS_MAX, `Use ${REPORT_DETAILS_MAX.toLocaleString("en-US")} characters or fewer.`)
    .optional(),
});

export const appealSchema = z.object({
  noticeId: z.uuid("That notice is not valid."),
  message: z
    .string()
    .trim()
    .min(1, "Tell us why you disagree.")
    .max(APPEAL_MAX, `Use ${APPEAL_MAX.toLocaleString("en-US")} characters or fewer.`),
});

export type ReportInput = z.infer<typeof reportSchema>;
