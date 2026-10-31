/** State for the mentorship forms (kept out of actions.ts: a "use server" file may only export functions). */
export type MentorFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const idleMentorForm: MentorFormState = { status: "idle" };

export type Outcome<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };
