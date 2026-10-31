/** State for the community forms (kept out of actions.ts: a "use server" file may only export functions). */
export type CommunityFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  nonce?: number;
};

export const idleCommunityForm: CommunityFormState = { status: "idle" };

export type ActionOutcome<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };
