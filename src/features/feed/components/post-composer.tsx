"use client";

import { useActionState, useId, useState } from "react";
import { Send } from "lucide-react";
import { useFormStatus } from "react-dom";
import { MemberAvatar } from "@/components/member-avatar";
import { FormAlert } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { createPost } from "@/features/feed/actions";
import {
  POST_CATEGORIES,
  POST_MAX_LENGTH,
} from "@/features/feed/options";
import { SafetyNotice } from "@/features/feed/components/safety-notice";
import { idleForm, type FormState } from "@/features/feed/types";

function PostButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="h-10 px-5"
    >
      {pending ? (
        <>
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none"
          />
          Posting…
        </>
      ) : (
        <>
          <Send className="size-4" aria-hidden="true" />
          Post
        </>
      )}
    </Button>
  );
}

export function PostComposer({
  name,
  avatarSrc,
  communityId,
}: {
  name: string;
  avatarSrc: string | null;
  /** Posts into this community instead of the home feed. */
  communityId?: string;
}) {
  // Controlled fields: React clears uncontrolled forms after every submit, even a failed one,
  // and a member must never lose what they wrote because publishing failed.
  const [text, setText] = useState("");
  const [category, setCategory] = useState("general_discussion");
  const [state, action] = useActionState(
    async (prev: FormState, formData: FormData) => {
      const result = await createPost(prev, formData);
      if (result.status === "success") setText("");
      return result;
    },
    idleForm,
  );
  const id = useId();

  const bodyError = state.fieldErrors?.body?.[0];
  const categoryError = state.fieldErrors?.category?.[0];

  return (
    <section
      id="composer"
      aria-labelledby={`${id}-title`}
      className="scroll-mt-24 rounded-2xl border border-border bg-surface p-4 shadow-xs sm:p-5"
    >
      <h2 id={`${id}-title`} className="sr-only">
        Share with the community
      </h2>
      <form action={action} className="flex gap-3" noValidate>
        {communityId ? <input type="hidden" name="communityId" value={communityId} /> : null}
        <MemberAvatar name={name} src={avatarSrc} className="hidden sm:flex" />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <label htmlFor={`${id}-body`} className="sr-only">
              What would you like to share?
            </label>
            <textarea
              id={`${id}-body`}
              name="body"
              rows={3}
              maxLength={POST_MAX_LENGTH}
              required
              placeholder="What would you like to share or ask?"
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-invalid={bodyError ? true : undefined}
              aria-describedby={bodyError ? `${id}-body-error` : undefined}
              className="w-full resize-y rounded-xl border border-input bg-sand/40 px-3.5 py-3 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:bg-surface focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            {bodyError ? (
              <p
                id={`${id}-body-error`}
                role="alert"
                className="mt-1 text-xs font-medium text-destructive"
              >
                {bodyError}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="w-full sm:w-auto sm:min-w-56">
              <label
                htmlFor={`${id}-category`}
                className="mb-1 block text-xs font-semibold text-maroon-900"
              >
                Category
              </label>
              <select
                id={`${id}-category`}
                name="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                aria-invalid={categoryError ? true : undefined}
                className="h-10 w-full rounded-lg border border-input bg-surface px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {POST_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              {categoryError ? (
                <p role="alert" className="mt-1 text-xs font-medium text-destructive">
                  {categoryError}
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <span
                className="text-xs text-muted-foreground"
                aria-hidden="true"
              >
                {text.length}/{POST_MAX_LENGTH}
              </span>
              <PostButton />
            </div>
          </div>

          {state.status === "error" && !state.fieldErrors ? (
            <FormAlert tone="error">{state.message}</FormAlert>
          ) : null}
          <div role="status" className="sr-only">
            {state.status === "success" ? "Your post was published." : ""}
          </div>
          <SafetyNotice compact />
        </div>
      </form>
    </section>
  );
}
