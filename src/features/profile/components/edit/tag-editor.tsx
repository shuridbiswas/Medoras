"use client";

import { useActionState, useId, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveSkills } from "@/features/profile/actions";
import {
  FormStatus,
  SaveBar,
} from "@/features/profile/components/edit/form-parts";
import { idleState, tagSchema } from "@/features/profile/schemas";

/** Edit a list of short labels (skills, interests or mentorship areas) and save it as one set. */
export function TagEditor({
  kind,
  label,
  hint,
  initial,
  limit,
  placeholder,
}: {
  kind: "skill" | "interest" | "mentorship_area";
  label: string;
  hint: string;
  initial: string[];
  limit: number;
  placeholder: string;
}) {
  const id = useId();
  const [state, action] = useActionState(saveSkills, idleState);
  const [tags, setTags] = useState(initial);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string>();

  function add() {
    if (!draft.trim()) return;
    const parsed = tagSchema.safeParse(draft);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    if (tags.some((t) => t.toLowerCase() === parsed.data.toLowerCase())) {
      return setError("That's already on your list.");
    }
    if (tags.length >= limit)
      return setError(`You can add up to ${limit} items.`);
    setTags([...tags, parsed.data]);
    setDraft("");
    setError(undefined);
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="kind" value={kind} />
      {tags.map((t) => (
        <input key={t} type="hidden" name="names" value={t} />
      ))}

      <Label htmlFor={id} className="text-sm font-semibold text-maroon-900">
        {label}
      </Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          maxLength={40}
          placeholder={placeholder}
          aria-describedby={`${id}-hint`}
          aria-invalid={error ? true : undefined}
          className="h-10 bg-surface"
          onChange={(e) => {
            setDraft(e.target.value);
            setError(undefined);
          }}
          onKeyDown={(e) => {
            // Enter adds the tag instead of submitting the whole form.
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="h-10 px-3"
          onClick={add}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add
        </Button>
      </div>
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        {hint} {tags.length}/{limit}
      </p>
      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}

      {tags.length ? (
        <ul aria-label={label} className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <li
              key={t}
              className="flex items-center gap-1 rounded-full bg-maroon-50 py-1 pl-3 pr-1 text-sm font-medium text-maroon-700"
            >
              {t}
              <button
                type="button"
                onClick={() => setTags(tags.filter((x) => x !== t))}
                aria-label={`Remove ${t}`}
                className="flex size-6 items-center justify-center rounded-full hover:bg-maroon-100"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <FormStatus state={state} />
      <SaveBar label="Save" />
    </form>
  );
}
