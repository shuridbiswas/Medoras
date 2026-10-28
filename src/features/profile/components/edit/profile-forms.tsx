"use client";

import { useActionState, useState } from "react";
import { Field, SelectField, TextAreaField } from "@/components/forms/fields";
import {
  FormStatus,
  SaveBar,
} from "@/features/profile/components/edit/form-parts";
import {
  updateAbout,
  updateBasics,
  updateMentorship,
} from "@/features/profile/actions";
import {
  CAREER_STAGES,
  FIELDS,
  MEMBER_TYPES,
} from "@/features/onboarding/options";
import { idleState } from "@/features/profile/schemas";

export type BasicsValues = {
  firstName: string;
  lastName: string;
  headline: string;
  locationLabel: string;
  memberType: string;
  fields: string[];
  institution: string;
  qualification: string;
  specialty: string;
  careerStage: string;
};

export function BasicsForm({
  initial,
  cancelHref,
}: {
  initial: BasicsValues;
  cancelHref: string;
}) {
  const [state, action] = useActionState(updateBasics, idleState);
  const [fields, setFields] = useState(initial.fields);
  const e = state.fieldErrors ?? {};

  const toggle = (value: string) =>
    setFields((current) =>
      current.includes(value)
        ? current.filter((f) => f !== value)
        : current.length < 5
          ? [...current, value]
          : current,
    );

  return (
    <form action={action} noValidate className="space-y-5">
      <FormStatus state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="First name"
          name="firstName"
          autoComplete="given-name"
          defaultValue={initial.firstName}
          error={e.firstName?.[0]}
        />
        <Field
          label="Last name"
          name="lastName"
          autoComplete="family-name"
          defaultValue={initial.lastName}
          error={e.lastName?.[0]}
        />
      </div>
      <Field
        label="Professional headline"
        name="headline"
        maxLength={120}
        defaultValue={initial.headline}
        hint="For example: Third-year nursing student at McGill"
        error={e.headline?.[0]}
      />
      <SelectField
        label="I am a…"
        name="memberType"
        defaultValue={initial.memberType}
        options={MEMBER_TYPES}
        error={e.memberType?.[0]}
      />
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-maroon-900">
          Fields (up to 5)
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <label
              key={f.value}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm has-[:checked]:border-maroon-600 has-[:checked]:bg-maroon-50"
            >
              <input
                type="checkbox"
                name="fields"
                value={f.value}
                checked={fields.includes(f.value)}
                onChange={() => toggle(f.value)}
                className="size-4 accent-maroon-700"
              />
              {f.label}
            </label>
          ))}
        </div>
        {e.fields?.[0] ? (
          <p role="alert" className="text-xs font-medium text-destructive">
            {e.fields[0]}
          </p>
        ) : null}
      </fieldset>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Institution or organization"
          name="institution"
          autoComplete="organization"
          defaultValue={initial.institution}
          error={e.institution?.[0]}
        />
        <Field
          label="Current education or qualification"
          name="qualification"
          defaultValue={initial.qualification}
          error={e.qualification?.[0]}
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Specialty"
          name="specialty"
          optional
          defaultValue={initial.specialty}
          error={e.specialty?.[0]}
        />
        <SelectField
          label="Career stage"
          name="careerStage"
          defaultValue={initial.careerStage}
          options={CAREER_STAGES}
          error={e.careerStage?.[0]}
        />
      </div>
      <Field
        label="Location to show"
        name="locationLabel"
        optional
        maxLength={80}
        defaultValue={initial.locationLabel}
        hint="A city or region only, for example “Montreal, QC”. Never an address. Leave blank to show only your country."
        error={e.locationLabel?.[0]}
      />
      <SaveBar cancelHref={cancelHref} />
    </form>
  );
}

export function AboutForm({
  initial,
  cancelHref,
}: {
  initial: {
    bio: string;
    professionalJourney: string;
    careerAspirations: string;
  };
  cancelHref: string;
}) {
  const [state, action] = useActionState(updateAbout, idleState);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} noValidate className="space-y-5">
      <FormStatus state={state} />
      <TextAreaField
        label="Bio"
        name="bio"
        optional
        maxLength={1000}
        defaultValue={initial.bio}
        error={e.bio?.[0]}
        hint="A short introduction."
      />
      <TextAreaField
        label="Professional journey"
        name="professionalJourney"
        optional
        rows={6}
        maxLength={2000}
        defaultValue={initial.professionalJourney}
        error={e.professionalJourney?.[0]}
        hint="How you got here, and what shaped you."
      />
      <TextAreaField
        label="Career aspirations"
        name="careerAspirations"
        optional
        maxLength={1000}
        defaultValue={initial.careerAspirations}
        error={e.careerAspirations?.[0]}
        hint="Where you want to go next."
      />
      <SaveBar cancelHref={cancelHref} />
    </form>
  );
}

export function MentorshipForm({
  initial,
  cancelHref,
}: {
  initial: { lookingForMentorship: boolean; openToMentor: boolean };
  cancelHref: string;
}) {
  const [state, action] = useActionState(updateMentorship, idleState);
  return (
    <form action={action} className="space-y-4">
      <FormStatus state={state} />
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 has-[:checked]:border-maroon-600 has-[:checked]:bg-maroon-50">
        <input
          type="checkbox"
          name="lookingForMentorship"
          defaultChecked={initial.lookingForMentorship}
          className="mt-0.5 size-4 accent-maroon-700"
        />
        <span>
          <span className="block text-sm font-semibold text-maroon-900">
            I&apos;m looking for mentorship
          </span>
          <span className="block text-xs text-muted-foreground">
            Shows on your profile that you&apos;d welcome a mentor.
          </span>
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 has-[:checked]:border-maroon-600 has-[:checked]:bg-maroon-50">
        <input
          type="checkbox"
          name="openToMentor"
          defaultChecked={initial.openToMentor}
          className="mt-0.5 size-4 accent-maroon-700"
        />
        <span>
          <span className="block text-sm font-semibold text-maroon-900">
            I&apos;m interested in becoming a mentor
          </span>
          <span className="block text-xs text-muted-foreground">
            Shows that you&apos;re open to guiding others.
          </span>
        </span>
      </label>
      <p className="text-xs text-muted-foreground">
        These are self-reported preferences, not verified professional
        credentials. Add your areas of expertise or interest below.
      </p>
      <SaveBar cancelHref={cancelHref} />
    </form>
  );
}
