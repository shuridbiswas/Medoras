import { z } from "zod";
import { cleanText } from "@/features/network/schemas";
import { GROUP_MAX, MESSAGE_MAX } from "@/features/messaging/content";

export const idSchema = z.uuid();

const body = z
  .string()
  .trim()
  .min(1, "Write a message first.")
  .max(MESSAGE_MAX, `Use ${MESSAGE_MAX.toLocaleString("en-US")} characters or fewer.`);

export const startSchema = z.object({ otherId: idSchema, body });
export const sendSchema = z.object({ conversationId: idSchema, body });

export const groupSchema = z.object({
  title: z.string().trim().min(1, "Give the group a name.").max(80, "Use 80 characters or fewer."),
  memberIds: z
    .array(idSchema)
    .min(1, "Choose at least one person.")
    .max(GROUP_MAX - 1, `A group can have up to ${GROUP_MAX} people.`),
});

export type InboxParams = { tab: "inbox" | "requests"; q: string; to?: string };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseInboxParams(params: Record<string, string | string[] | undefined>): InboxParams {
  const to = first(params.to);
  return {
    tab: first(params.tab) === "requests" ? "requests" : "inbox",
    q: cleanText(first(params.q), 60),
    to: to && idSchema.safeParse(to).success ? to : undefined,
  };
}
