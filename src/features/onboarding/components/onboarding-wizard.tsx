"use client";

import { useActionState, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Camera, Check } from "lucide-react";
import {
  Field,
  FormAlert,
  SelectField,
  SubmitButton,
} from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { completeOnboarding } from "@/features/onboarding/actions";
import {
  CAREER_STAGES,
  COUNTRY_CODES,
  FIELDS,
  MEMBER_TYPES,
  PURPOSES,
} from "@/features/onboarding/options";
import {
  AVATAR_MAX_BYTES,
  AVATAR_TYPES,
  STEP_SCHEMAS,
  type OnboardingState,
} from "@/features/onboarding/schemas";
import { cn } from "@/lib/utils";

export type OnboardingInitial = {
  firstName: string;
  memberType: string;
  fields: string[];
  institution: string;
  qualification: string;
  specialty: string;
  careerStage: string;
  country: string;
  city: string;
  purposes: string[];
  username: string;
  headline: string;
  bio: string;
};

const STEPS = [
  { title: "Who are you?", blurb: "Tell us where you are in your journey." },
  {
    title: "Your field",
    blurb: "Choose up to five areas you study or work in.",
  },
  {
    title: "Education and career",
    blurb: "Where you learn or work, and where you're based.",
  },
  {
    title: "Your purpose on Medoras",
    blurb: "Pick everything that applies. You can change it later.",
  },
  {
    title: "Set up your profile",
    blurb: "How other members will find and recognize you.",
  },
] as const;

const initialState: OnboardingState = { status: "idle" };

export function OnboardingWizard({ initial }: { initial: OnboardingInitial }) {
  const [state, action] = useActionState(completeOnboarding, initialState);
  const [step, setStep] = useState(0);
  const [values, setValues] = useState(initial);
  const [clientErrors, setClientErrors] = useState<
    Record<string, string[] | undefined>
  >({});
  const [handled, setHandled] = useState(state);
  const [photo, setPhoto] = useState<{ url: string; error?: string } | null>(
    null,
  );

  // A server-side validation error sends the member back to the step that owns the field.
  if (state !== handled) {
    setHandled(state);
    if (state.step !== undefined) setStep(state.step);
    setClientErrors({});
  }

  const errors = { ...state.fieldErrors, ...clientErrors };
  const last = step === STEPS.length - 1;

  const set = <K extends keyof OnboardingInitial>(
    key: K,
    value: OnboardingInitial[K],
  ) => {
    setValues((v) => ({ ...v, [key]: value }));
    setClientErrors((e) => ({ ...e, [key]: undefined }));
  };

  const toggle = (key: "fields" | "purposes", value: string, max: number) => {
    const current = values[key];
    if (current.includes(value)) {
      set(
        key,
        current.filter((v) => v !== value),
      );
    } else if (current.length < max) {
      set(key, [...current, value]);
    }
  };

  function validateStep(): boolean {
    const result = STEP_SCHEMAS[step].safeParse(values);
    if (result.success) {
      setClientErrors({});
      return true;
    }
    const next: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? "form");
      (next[key] ??= []).push(issue.message);
    }
    setClientErrors(next);
    return false;
  }

  function goNext() {
    if (validateStep()) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function onPhoto(file: File | undefined) {
    if (photo?.url) URL.revokeObjectURL(photo.url);
    if (!file) return setPhoto(null);
    if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) {
      return setPhoto({ url: "", error: "Use a JPEG, PNG or WebP image." });
    }
    if (file.size > AVATAR_MAX_BYTES) {
      return setPhoto({ url: "", error: "Choose an image under 2 MB." });
    }
    setPhoto({ url: URL.createObjectURL(file) });
  }

  const countries = useMemo(() => {
    const names = new Intl.DisplayNames(["en"], { type: "region" });
    return COUNTRY_CODES.map((code) => ({
      code,
      name: names.of(code) ?? code,
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  return (
    <form
      action={action}
      noValidate
      onSubmit={(event) => {
        // Pressing Enter on an earlier step moves forward instead of submitting everything.
        if (!last) {
          event.preventDefault();
          goNext();
        } else if (!validateStep()) {
          event.preventDefault();
        }
      }}
      className="space-y-8"
    >
      {/* The submitted values. Visible text inputs have no name; choice inputs are named only for radio grouping and ignored by the server. */}
      <input type="hidden" name="memberType" value={values.memberType} />
      {values.fields.map((f) => (
        <input key={f} type="hidden" name="fields" value={f} />
      ))}
      <input type="hidden" name="institution" value={values.institution} />
      <input type="hidden" name="qualification" value={values.qualification} />
      <input type="hidden" name="specialty" value={values.specialty} />
      <input type="hidden" name="careerStage" value={values.careerStage} />
      <input type="hidden" name="country" value={values.country} />
      <input type="hidden" name="city" value={values.city} />
      {values.purposes.map((p) => (
        <input key={p} type="hidden" name="purposes" value={p} />
      ))}
      <input type="hidden" name="username" value={values.username} />
      <input type="hidden" name="headline" value={values.headline} />
      <input type="hidden" name="bio" value={values.bio} />

      <div>
        <div className="flex items-center justify-between text-sm">
          <p className="font-semibold text-maroon-700">
            Step {step + 1} of {STEPS.length}
          </p>
          <p className="text-muted-foreground">Welcome, {initial.firstName}</p>
        </div>
        <div
          role="progressbar"
          aria-label="Onboarding progress"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={step + 1}
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-maroon-100"
        >
          <div
            className="h-full rounded-full bg-maroon-600 transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <div>
        <h1 className="text-3xl font-bold leading-tight text-maroon-900">
          {STEPS[step].title}
        </h1>
        <p className="mt-2 text-muted-foreground">{STEPS[step].blurb}</p>
      </div>

      {state.status === "error" && state.message ? (
        <FormAlert tone="error">{state.message}</FormAlert>
      ) : null}

      {step === 0 && (
        <Choices
          legend="I am a…"
          type="radio"
          options={MEMBER_TYPES}
          selected={[values.memberType]}
          onChange={(v) => set("memberType", v)}
          error={errors.memberType?.[0]}
        />
      )}

      {step === 1 && (
        <Choices
          legend="Fields"
          type="checkbox"
          options={FIELDS}
          selected={values.fields}
          onChange={(v) => toggle("fields", v, 5)}
          error={errors.fields?.[0]}
          columns
        />
      )}

      {step === 2 && (
        <div className="space-y-5">
          <Field
            label="Institution or organization"
            autoComplete="organization"
            value={values.institution}
            onChange={(e) => set("institution", e.target.value)}
            error={errors.institution?.[0]}
          />
          <Field
            label="Current education or qualification"
            hint="For example: BSc Nursing, MSW, Registered Pharmacist"
            value={values.qualification}
            onChange={(e) => set("qualification", e.target.value)}
            error={errors.qualification?.[0]}
          />
          <Field
            label="Specialty"
            optional
            value={values.specialty}
            onChange={(e) => set("specialty", e.target.value)}
            error={errors.specialty?.[0]}
          />
          <SelectField
            label="Career stage"
            value={values.careerStage}
            onChange={(v) => set("careerStage", v)}
            error={errors.careerStage?.[0]}
            options={CAREER_STAGES.map((c) => ({
              value: c.value,
              label: c.label,
            }))}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField
              label="Country"
              value={values.country}
              onChange={(v) => set("country", v)}
              error={errors.country?.[0]}
              options={countries.map((c) => ({ value: c.code, label: c.name }))}
              autoComplete="country"
            />
            <Field
              label="City"
              optional
              autoComplete="address-level2"
              value={values.city}
              onChange={(e) => set("city", e.target.value)}
              error={errors.city?.[0]}
              hint="Kept private. Used later to suggest nearby communities."
            />
          </div>
        </div>
      )}

      {step === 3 && (
        <Choices
          legend="I'm here to…"
          type="checkbox"
          options={PURPOSES}
          selected={values.purposes}
          onChange={(v) => toggle("purposes", v, PURPOSES.length)}
          error={errors.purposes?.[0]}
        />
      )}

      {step === 4 && (
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-maroon-50 text-maroon-600">
              {photo?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo.url}
                  alt="Your selected profile photo"
                  className="size-full object-cover"
                />
              ) : (
                <Camera className="size-6" aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0 space-y-1">
              <Label
                htmlFor="avatar"
                className="text-sm font-semibold text-maroon-900"
              >
                Profile photo{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <input
                id="avatar"
                name="avatar"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => onPhoto(e.target.files?.[0])}
                aria-describedby="avatar-hint"
                className="block w-full text-sm text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-maroon-700"
              />
              <p id="avatar-hint" className="text-xs text-muted-foreground">
                JPEG, PNG or WebP, up to 2 MB.
              </p>
              {(photo?.error || errors.avatar?.[0]) && (
                <p
                  role="alert"
                  className="text-xs font-medium text-destructive"
                >
                  {photo?.error ?? errors.avatar?.[0]}
                </p>
              )}
            </div>
          </div>
          <Field
            label="Username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={values.username}
            onChange={(e) => set("username", e.target.value.toLowerCase())}
            hint="3 to 30 characters: lowercase letters, numbers and underscores."
            error={errors.username?.[0]}
          />
          <Field
            label="Professional headline"
            hint="For example: Third-year nursing student at McGill"
            maxLength={120}
            value={values.headline}
            onChange={(e) => set("headline", e.target.value)}
            error={errors.headline?.[0]}
          />
          <div className="space-y-1.5">
            <Label
              htmlFor="bio"
              className="text-sm font-semibold text-maroon-900"
            >
              Bio{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <textarea
              id="bio"
              rows={4}
              maxLength={1000}
              value={values.bio}
              onChange={(e) => set("bio", e.target.value)}
              aria-invalid={errors.bio ? true : undefined}
              className="w-full rounded-lg border border-input bg-surface px-3 py-2 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <p className="text-xs text-muted-foreground">
              {values.bio.length}/1000
            </p>
            {errors.bio?.[0] && (
              <p role="alert" className="text-xs font-medium text-destructive">
                {errors.bio[0]}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-border pt-6">
        <Button
          type="button"
          variant="ghost"
          className="h-11 px-4"
          onClick={() => setStep((s) => Math.max(s - 1, 0))}
          disabled={step === 0}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back
        </Button>
        {last ? (
          <SubmitButton pendingLabel="Saving…" className="w-auto px-6">
            Finish setup
            <Check className="size-4" aria-hidden="true" />
          </SubmitButton>
        ) : (
          <Button
            type="button"
            className="h-11 px-6 text-base"
            onClick={goNext}
          >
            Continue
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    </form>
  );
}

function Choices({
  legend,
  type,
  options,
  selected,
  onChange,
  error,
  columns,
}: {
  legend: string;
  type: "radio" | "checkbox";
  options: readonly { value: string; label: string; hint?: string }[];
  selected: string[];
  onChange: (value: string) => void;
  error?: string;
  columns?: boolean;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="sr-only">{legend}</legend>
      <div className={cn("grid gap-3", columns && "sm:grid-cols-2")}>
        {options.map((option) => {
          const checked = selected.includes(option.value);
          return (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border bg-surface p-4 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                checked
                  ? "border-maroon-600 bg-maroon-50"
                  : "border-border hover:border-maroon-200",
              )}
            >
              <input
                type={type}
                name={`${legend}-ui`}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="mt-0.5 size-4 shrink-0 accent-maroon-700"
              />
              <span>
                <span className="block text-sm font-semibold text-maroon-900">
                  {option.label}
                </span>
                {option.hint ? (
                  <span className="block text-xs text-muted-foreground">
                    {option.hint}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
