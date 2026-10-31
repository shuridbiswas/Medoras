"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Field, FormAlert } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { controlClass, labelClass, textareaClass } from "@/components/forms/controls";
import {
  addAvailability,
  removeAvailability,
  removeMentorProfile,
  saveMentorProfile,
} from "@/features/mentorship/actions";
import { MENTOR_ACKNOWLEDGEMENT } from "@/features/mentorship/content";
import { BIO_MAX, MENTOR_FORMATS, minutesToTime, WEEKDAYS } from "@/features/mentorship/options";
import { idleMentorForm, type MentorFormState } from "@/features/mentorship/state";
import type { MentorAvailabilityRow, MentorProfileRow } from "@/lib/supabase/database.types";

type Initial = Pick<
  MentorProfileRow,
  "bio" | "expertise" | "experience_years" | "organization" | "topics" | "languages" | "capacity" | "session_formats" | "accepting"
>;

/** Create or edit the mentor listing. Submitted from a handler so a failed save keeps what was typed. */
export function MentorForm({ initial }: { initial?: Initial }) {
  const id = useId();
  const [state, setState] = useState<MentorFormState>(idleMentorForm);
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [pending, startTransition] = useTransition();
  const err = (key: string) => state.fieldErrors?.[key]?.[0];
  const fieldError = (key: string) => (err(key) ? <p role="alert" className="mt-1 text-xs font-medium text-destructive">{err(key)}</p> : null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(async () => setState(await saveMentorProfile(state, data)));
      }}
      className="space-y-5"
      noValidate
    >
      <div>
        <label htmlFor={`${id}-bio`} className={labelClass}>
          About you as a mentor
        </label>
        <textarea id={`${id}-bio`} name="bio" rows={5} maxLength={BIO_MAX} value={bio} onChange={(e) => setBio(e.target.value)} className={textareaClass} aria-invalid={err("bio") ? true : undefined} />
        <p className="mt-1 text-right text-xs text-muted-foreground" aria-hidden="true">{bio.length}/{BIO_MAX}</p>
        {fieldError("bio")}
      </div>
      <Field label="Area of expertise (self-declared)" name="expertise" defaultValue={initial?.expertise} maxLength={200} error={err("expertise")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Years of experience (self-declared)" name="experienceYears" type="number" min={0} max={60} defaultValue={initial?.experience_years ?? ""} error={err("experienceYears")} />
        <Field label="Institution or professional organisation" name="organization" defaultValue={initial?.organization ?? ""} maxLength={120} optional />
      </div>
      <Field label="Topics you can help with" name="topics" defaultValue={initial?.topics.join(", ")} hint="Separate with commas, for example: placements, exam preparation, research methods." error={err("topics")} />
      <Field label="Languages you can mentor in" name="languages" defaultValue={initial?.languages.join(", ")} hint="Separate with commas." error={err("languages")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-capacity`} className={labelClass}>
            How many mentees at a time?
          </label>
          <select id={`${id}-capacity`} name="capacity" defaultValue={String(initial?.capacity ?? 3)} className={controlClass}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          {fieldError("capacity")}
        </div>
        <fieldset>
          <legend className={labelClass}>Session formats you offer</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {MENTOR_FORMATS.map((f) => (
              <label key={f.value} className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" name="formats" value={f.value} defaultChecked={initial?.session_formats.includes(f.value)} className="accent-maroon-700" />
                {f.label}
              </label>
            ))}
          </div>
          {fieldError("formats")}
        </fieldset>
      </div>
      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <input type="checkbox" name="accepting" defaultChecked={initial?.accepting ?? true} className="accent-maroon-700" />
        <span>
          <span className="font-medium text-maroon-900">Accepting new requests</span>
          <span className="block text-xs text-muted-foreground">Turn off to pause your listing without deleting it.</span>
        </span>
      </label>
      <div className="rounded-xl border border-border bg-sand/50 p-4">
        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input type="checkbox" name="acknowledged" defaultChecked={Boolean(initial)} className="mt-1 accent-maroon-700" aria-invalid={err("acknowledged") ? true : undefined} />
          <span>{MENTOR_ACKNOWLEDGEMENT}</span>
        </label>
        {fieldError("acknowledged")}
      </div>
      {state.status === "error" && state.message ? <FormAlert tone="error">{state.message}</FormAlert> : null}
      {state.status === "success" ? <FormAlert tone="success">{state.message}</FormAlert> : null}
      <Button type="submit" disabled={pending} className="h-11 px-6">
        {pending ? "Saving…" : initial ? "Save changes" : "List me as a mentor"}
      </Button>
    </form>
  );
}

export function RemoveListingButton() {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div>
      {confirm ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Remove your listing? Open requests are removed; existing mentorships continue.</span>
          <Button type="button" variant="outline" disabled={pending} className="h-9 px-4" onClick={() => startTransition(async () => { const r = await removeMentorProfile(); if (r.ok) router.refresh(); else setError(r.error); })}>
            Yes, remove
          </Button>
          <Button type="button" variant="ghost" className="h-9 px-3" onClick={() => setConfirm(false)}>Keep</Button>
        </div>
      ) : (
        <Button type="button" variant="ghost" className="h-9 px-3 text-muted-foreground" onClick={() => setConfirm(true)}>Remove my mentor listing</Button>
      )}
      {error ? <p role="alert" className="mt-1 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

/** Weekly windows when the mentor is usually free. Internal: no calendar is connected. */
export function AvailabilityEditor({ windows }: { windows: MentorAvailabilityRow[] }) {
  const id = useId();
  const router = useRouter();
  const [state, setState] = useState<MentorFormState>(idleMentorForm);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const defaultZone = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "";
    }
  })();

  return (
    <div className="space-y-4">
      {windows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No times listed yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {windows.map((w) => (
            <li key={w.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span>
                <span className="font-medium text-maroon-900">{WEEKDAYS[w.weekday]}</span> {minutesToTime(w.start_minute)}–{minutesToTime(w.end_minute)}{" "}
                <span className="text-muted-foreground">({w.timezone})</span>
              </span>
              <button
                type="button"
                disabled={pending}
                aria-label={`Remove ${WEEKDAYS[w.weekday]} ${minutesToTime(w.start_minute)}`}
                onClick={() => startTransition(async () => { const r = await removeAvailability(w.id); if (r.ok) router.refresh(); else setError(r.error); })}
                className="text-muted-foreground hover:text-destructive focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const data = new FormData(form);
          startTransition(async () => {
            const result = await addAvailability(state, data);
            setState(result);
            if (result.status === "success") router.refresh();
          });
        }}
        className="grid gap-3 sm:grid-cols-[1fr_auto_auto_1fr_auto]"
        noValidate
      >
        <div>
          <label htmlFor={`${id}-day`} className={labelClass}>Day</label>
          <select id={`${id}-day`} name="weekday" defaultValue="1" className={controlClass}>
            {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-start`} className={labelClass}>From</label>
          <input id={`${id}-start`} name="start" type="time" defaultValue="09:00" className={controlClass} />
        </div>
        <div>
          <label htmlFor={`${id}-end`} className={labelClass}>To</label>
          <input id={`${id}-end`} name="end" type="time" defaultValue="10:00" className={controlClass} />
        </div>
        <div>
          <label htmlFor={`${id}-tz`} className={labelClass}>Time zone</label>
          <input id={`${id}-tz`} name="timezone" defaultValue={defaultZone} className={controlClass} />
        </div>
        <div className="flex items-end">
          <Button type="submit" variant="outline" disabled={pending} className="h-10 px-4">Add</Button>
        </div>
      </form>
      {state.status === "error" ? <FormAlert tone="error">{state.fieldErrors?.timezone?.[0] ?? state.fieldErrors?.end?.[0] ?? state.message}</FormAlert> : null}
    </div>
  );
}
