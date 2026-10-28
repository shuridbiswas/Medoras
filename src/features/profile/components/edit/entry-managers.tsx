"use client";

import { useActionState, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  Checkbox,
  Field,
  SelectField,
  TextAreaField,
} from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { EMPLOYMENT_TYPES } from "@/features/onboarding/options";
import {
  deleteEducation,
  deleteExperience,
  saveEducation,
  saveExperience,
} from "@/features/profile/actions";
import {
  FormStatus,
  SaveBar,
} from "@/features/profile/components/edit/form-parts";
import {
  formatMonthRange,
  formatYearRange,
  employmentTypeLabel,
} from "@/features/profile/format";
import {
  dateToMonth,
  idleState,
  type ProfileFormState,
} from "@/features/profile/schemas";
import type {
  EducationRow,
  ExperienceRow,
} from "@/lib/supabase/database.types";

type Action = (
  prev: ProfileFormState,
  formData: FormData,
) => Promise<ProfileFormState>;

/** Wraps a save action so the parent can close the editor once it succeeds. */
function useEntryAction(action: Action, onDone: () => void) {
  return useActionState<ProfileFormState, FormData>(async (prev, formData) => {
    const result = await action(prev, formData);
    if (result.status === "success") onDone();
    return result;
  }, idleState);
}

function DeleteButton({
  id,
  label,
  action,
}: {
  id: string;
  label: string;
  action: Action;
}) {
  const [state, formAction] = useActionState(action, idleState);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        className="h-8 px-2 text-xs text-destructive hover:text-destructive"
        onClick={() => setConfirming(true)}
        aria-label={`Delete ${label}`}
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
        Delete
      </Button>
    );
  }
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <span className="text-xs text-muted-foreground">Delete this entry?</span>
      <Button type="submit" variant="destructive" className="h-8 px-3 text-xs">
        Yes, delete
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="h-8 px-2 text-xs"
        onClick={() => setConfirming(false)}
      >
        Keep
      </Button>
      {state.status === "error" ? (
        <span role="alert" className="text-xs text-destructive">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}

function EntryRow({
  title,
  subtitle,
  meta,
  onEdit,
  children,
}: {
  title: string;
  subtitle: string;
  meta: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border p-4">
      <div className="min-w-0">
        <p className="font-semibold text-maroon-900">{title}</p>
        <p className="text-sm text-maroon-900/80">{subtitle}</p>
        <p className="text-xs text-muted-foreground">{meta}</p>
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          className="h-8 px-2 text-xs"
          onClick={onEdit}
          aria-label={`Edit ${title}`}
        >
          <Pencil className="size-3.5" aria-hidden="true" />
          Edit
        </Button>
        {children}
      </div>
    </li>
  );
}

/* ------------------------------ education ------------------------------ */

export function EducationManager({ items }: { items: EducationRow[] }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const current = items.find((i) => i.id === editing);

  return (
    <div className="space-y-4">
      {items.length ? (
        <ul className="space-y-3">
          {items.map((e) =>
            editing === e.id ? (
              <li key={e.id}>
                <EducationForm entry={e} onDone={() => setEditing(null)} />
              </li>
            ) : (
              <EntryRow
                key={e.id}
                title={e.institution}
                subtitle={[e.qualification, e.field_of_study]
                  .filter(Boolean)
                  .join(", ")}
                meta={
                  formatYearRange(
                    e.start_year,
                    e.end_year,
                    e.currently_studying,
                  ) ?? "No dates"
                }
                onEdit={() => setEditing(e.id)}
              >
                <DeleteButton
                  id={e.id}
                  label={e.institution}
                  action={deleteEducation}
                />
              </EntryRow>
            ),
          )}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No education added yet.</p>
      )}
      {editing === "new" && !current ? (
        <EducationForm onDone={() => setEditing(null)} />
      ) : (
        <Button
          type="button"
          variant="outline"
          className="h-10 px-4"
          onClick={() => setEditing("new")}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add education
        </Button>
      )}
    </div>
  );
}

function EducationForm({
  entry,
  onDone,
}: {
  entry?: EducationRow;
  onDone: () => void;
}) {
  const [state, action] = useEntryAction(saveEducation, onDone);
  const [studying, setStudying] = useState(entry?.currently_studying ?? false);
  const e = state.fieldErrors ?? {};

  return (
    <form
      action={action}
      noValidate
      className="space-y-4 rounded-xl border border-maroon-200 bg-maroon-50/50 p-4 sm:p-5"
    >
      <input type="hidden" name="id" value={entry?.id ?? ""} />
      <FormStatus state={state} />
      <Field
        label="Institution"
        name="institution"
        defaultValue={entry?.institution}
        error={e.institution?.[0]}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Degree or qualification"
          name="qualification"
          defaultValue={entry?.qualification}
          error={e.qualification?.[0]}
        />
        <Field
          label="Field of study"
          name="fieldOfStudy"
          optional
          defaultValue={entry?.field_of_study ?? ""}
          error={e.fieldOfStudy?.[0]}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Start year"
          name="startYear"
          optional
          inputMode="numeric"
          maxLength={4}
          placeholder="2022"
          defaultValue={entry?.start_year ?? ""}
          error={e.startYear?.[0]}
        />
        <Field
          label="End year"
          name="endYear"
          optional
          inputMode="numeric"
          maxLength={4}
          placeholder="2026"
          defaultValue={entry?.end_year ?? ""}
          disabled={studying}
          error={e.endYear?.[0]}
        />
      </div>
      <Checkbox
        name="currentlyStudying"
        label="I'm currently studying here"
        checked={studying}
        onChange={(ev) => setStudying(ev.target.checked)}
      />
      <TextAreaField
        label="Description"
        name="description"
        optional
        maxLength={1000}
        defaultValue={entry?.description ?? ""}
        error={e.description?.[0]}
      />
      <SaveBar
        label={entry ? "Save education" : "Add education"}
        onCancel={onDone}
      />
    </form>
  );
}

/* ------------------------------ experience ------------------------------ */

export function ExperienceManager({ items }: { items: ExperienceRow[] }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);

  return (
    <div className="space-y-4">
      {items.length ? (
        <ul className="space-y-3">
          {items.map((x) =>
            editing === x.id ? (
              <li key={x.id}>
                <ExperienceForm entry={x} onDone={() => setEditing(null)} />
              </li>
            ) : (
              <EntryRow
                key={x.id}
                title={x.title}
                subtitle={[
                  x.organization,
                  employmentTypeLabel(x.employment_type),
                ]
                  .filter(Boolean)
                  .join(" · ")}
                meta={formatMonthRange(x.start_date, x.end_date, x.is_current)}
                onEdit={() => setEditing(x.id)}
              >
                <DeleteButton
                  id={x.id}
                  label={x.title}
                  action={deleteExperience}
                />
              </EntryRow>
            ),
          )}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No experience added yet.
        </p>
      )}
      {editing === "new" ? (
        <ExperienceForm onDone={() => setEditing(null)} />
      ) : (
        <Button
          type="button"
          variant="outline"
          className="h-10 px-4"
          onClick={() => setEditing("new")}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add experience
        </Button>
      )}
    </div>
  );
}

function ExperienceForm({
  entry,
  onDone,
}: {
  entry?: ExperienceRow;
  onDone: () => void;
}) {
  const [state, action] = useEntryAction(saveExperience, onDone);
  const [current, setCurrent] = useState(entry?.is_current ?? false);
  const e = state.fieldErrors ?? {};

  return (
    <form
      action={action}
      noValidate
      className="space-y-4 rounded-xl border border-maroon-200 bg-maroon-50/50 p-4 sm:p-5"
    >
      <input type="hidden" name="id" value={entry?.id ?? ""} />
      <FormStatus state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Job title"
          name="title"
          defaultValue={entry?.title}
          error={e.title?.[0]}
        />
        <Field
          label="Organization"
          name="organization"
          defaultValue={entry?.organization}
          error={e.organization?.[0]}
        />
      </div>
      <SelectField
        label="Employment type"
        name="employmentType"
        optional
        defaultValue={entry?.employment_type ?? ""}
        options={EMPLOYMENT_TYPES}
        error={e.employmentType?.[0]}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Start date"
          name="startMonth"
          type="month"
          defaultValue={dateToMonth(entry?.start_date ?? null)}
          error={e.startMonth?.[0]}
        />
        <Field
          label="End date"
          name="endMonth"
          type="month"
          optional
          defaultValue={dateToMonth(entry?.end_date ?? null)}
          disabled={current}
          error={e.endMonth?.[0]}
        />
      </div>
      <Checkbox
        name="isCurrent"
        label="I currently work here"
        checked={current}
        onChange={(ev) => setCurrent(ev.target.checked)}
      />
      <TextAreaField
        label="Description"
        name="description"
        optional
        maxLength={2000}
        defaultValue={entry?.description ?? ""}
        error={e.description?.[0]}
      />
      <SaveBar
        label={entry ? "Save experience" : "Add experience"}
        onCancel={onDone}
      />
    </form>
  );
}
