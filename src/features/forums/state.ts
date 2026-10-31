/** State for the ask form (kept out of actions.ts: a "use server" file may only export functions). */
export type ForumFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const idleForumForm: ForumFormState = { status: "idle" };
