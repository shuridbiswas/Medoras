"use client";

import { useId, useState, useTransition } from "react";
import { FormAlert, Field } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { controlClass, labelClass, textareaClass } from "@/components/forms/controls";
import { askQuestion } from "@/features/forums/actions";
import { ANONYMITY, CONFIRM_LABEL } from "@/features/forums/content";
import { QUESTION_KINDS, QUESTION_MAX, TITLE_MAX } from "@/features/forums/options";
import { idleForumForm, type ForumFormState } from "@/features/forums/state";
import { AnonymityExplainer } from "@/features/forums/components/forum-notices";
import type { Topic } from "@/features/forums/types";

/**
 * Submitted from a handler (not a form action) so React never clears what the member typed when
 * a save fails. On success the server action redirects to the new question.
 */
export function AskForm({ topics, defaultTopic }: { topics: Topic[]; defaultTopic?: string }) {
  const id = useId();
  const [state, setState] = useState<ForumFormState>(idleForumForm);
  const [kind, setKind] = useState("");
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const err = (key: string) => state.fieldErrors?.[key]?.[0];
  const kindHint = QUESTION_KINDS.find((k) => k.value === kind)?.hint;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await askQuestion(state, data);
      if (result) setState(result);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-topic`} className={labelClass}>
            Topic
          </label>
          <select id={`${id}-topic`} name="topic" defaultValue={defaultTopic ?? ""} required className={controlClass}>
            <option value="" disabled>
              Choose a topic
            </option>
            {topics.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
          {err("topic") ? <p role="alert" className="mt-1 text-xs font-medium text-destructive">{err("topic")}</p> : null}
        </div>
        <div>
          <label htmlFor={`${id}-kind`} className={labelClass}>
            Kind of question
          </label>
          <select id={`${id}-kind`} name="kind" value={kind} onChange={(e) => setKind(e.target.value)} required className={controlClass}>
            <option value="" disabled>
              Choose one
            </option>
            {QUESTION_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          {kindHint ? <p className="mt-1 text-xs text-muted-foreground">{kindHint}</p> : null}
          {err("kind") ? <p role="alert" className="mt-1 text-xs font-medium text-destructive">{err("kind")}</p> : null}
        </div>
      </div>

      <Field
        label="Question"
        name="title"
        maxLength={TITLE_MAX}
        required
        hint="A clear, specific title helps the right people find it."
        error={err("title")}
      />

      <div>
        <label htmlFor={`${id}-body`} className={labelClass}>
          Details
        </label>
        <textarea
          id={`${id}-body`}
          name="body"
          rows={8}
          maxLength={QUESTION_MAX}
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
          aria-invalid={err("body") ? true : undefined}
          className={textareaClass}
          placeholder="What have you read or tried? What exactly are you unsure about? Describe situations in general or composite terms."
        />
        <p className="mt-1 text-right text-xs text-muted-foreground" aria-hidden="true">
          {body.length}/{QUESTION_MAX}
        </p>
        {err("body") ? <p role="alert" className="text-xs font-medium text-destructive">{err("body")}</p> : null}
      </div>

      <fieldset className="space-y-3 rounded-xl border border-border bg-surface p-4">
        <legend className="px-1 text-xs font-semibold text-maroon-900">Before you post</legend>
        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input type="checkbox" name="confirmed" className="mt-1 accent-maroon-700" aria-invalid={err("confirmed") ? true : undefined} />
          <span>{CONFIRM_LABEL}</span>
        </label>
        {err("confirmed") ? <p role="alert" className="text-xs font-medium text-destructive">{err("confirmed")}</p> : null}

        <div className="space-y-2 border-t border-border pt-3">
          <label className="flex cursor-pointer items-start gap-2.5 text-sm">
            <input type="checkbox" name="anonymous" className="mt-1 accent-maroon-700" />
            <span>
              <span className="font-medium text-maroon-900">{ANONYMITY.label}</span>
              <span className="block text-xs text-muted-foreground">{ANONYMITY.summary}</span>
            </span>
          </label>
          <AnonymityExplainer />
        </div>
      </fieldset>

      {state.status === "error" && state.message ? <FormAlert tone="error">{state.message}</FormAlert> : null}
      <Button type="submit" disabled={pending} className="h-11 px-6">
        {pending ? "Posting…" : "Post question"}
      </Button>
    </form>
  );
}
