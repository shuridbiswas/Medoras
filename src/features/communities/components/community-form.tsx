"use client";

import { useId, useState, useTransition } from "react";
import { FormAlert, Field } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { controlClass, labelClass, textareaClass } from "@/components/forms/controls";
import { createCommunity, updateCommunity } from "@/features/communities/actions";
import { idleCommunityForm, type CommunityFormState } from "@/features/communities/types";
import { COMMUNITY_KINDS, RULES_MAX, VISIBILITIES } from "@/features/communities/options";
import { COUNTRY_CODES } from "@/features/onboarding/options";
import { countryName } from "@/features/profile/format";
import type { CommunityRow } from "@/lib/supabase/database.types";

type Initial = Pick<CommunityRow, "id" | "name" | "description" | "kind" | "visibility" | "rules" | "institution" | "region_label" | "country">;

const countries = COUNTRY_CODES.map((code) => ({ code, name: countryName(code) ?? code })).sort((a, b) =>
  a.name.localeCompare(b.name),
);

/**
 * Create a community, or (for the owner) change its settings. The form is submitted from a handler
 * rather than a form action so React never clears what the member typed when saving fails.
 */
export function CommunityForm({ initial }: { initial?: Initial }) {
  const id = useId();
  const editing = Boolean(initial);
  const [state, setState] = useState<CommunityFormState>(idleCommunityForm);
  const [visibility, setVisibility] = useState(initial?.visibility ?? "public");
  const [pending, startTransition] = useTransition();
  const err = (key: string) => state.fieldErrors?.[key]?.[0];

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      setState(await (editing ? updateCommunity : createCommunity)(state, data));
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {initial ? <input type="hidden" name="communityId" value={initial.id} /> : null}
      <Field label="Name" name="name" defaultValue={initial?.name} maxLength={80} required error={err("name")} />

      <div>
        <label htmlFor={`${id}-description`} className={labelClass}>
          What is this community for?
        </label>
        <textarea
          id={`${id}-description`}
          name="description"
          defaultValue={initial?.description}
          rows={3}
          maxLength={600}
          required
          aria-invalid={err("description") ? true : undefined}
          className={textareaClass}
        />
        {err("description") ? <p role="alert" className="mt-1 text-xs font-medium text-destructive">{err("description")}</p> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-kind`} className={labelClass}>
            Kind of community
          </label>
          <select id={`${id}-kind`} name="kind" defaultValue={initial?.kind ?? ""} required disabled={editing} className={controlClass}>
            <option value="" disabled>
              Choose one
            </option>
            {COMMUNITY_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          {editing ? <input type="hidden" name="kind" value={initial?.kind} /> : null}
          {err("kind") ? <p role="alert" className="mt-1 text-xs font-medium text-destructive">{err("kind")}</p> : null}
        </div>
        <Field label="Institution or organisation" name="institution" defaultValue={initial?.institution ?? ""} maxLength={120} optional />
        <Field label="Region (city or area)" name="regionLabel" defaultValue={initial?.region_label ?? ""} maxLength={80} optional hint="General places only, never an address." />
        <div>
          <label htmlFor={`${id}-country`} className={labelClass}>
            Country <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <select id={`${id}-country`} name="country" defaultValue={initial?.country ?? ""} className={controlClass}>
            <option value="">Not specified</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
          {err("country") ? <p role="alert" className="mt-1 text-xs font-medium text-destructive">{err("country")}</p> : null}
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold text-maroon-900">Who can see inside?</legend>
        {VISIBILITIES.map((v) => (
          <label key={v.value} className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-surface p-3 has-[:checked]:border-maroon-400 has-[:checked]:bg-maroon-50/60">
            <input
              type="radio"
              name="visibility"
              value={v.value}
              checked={visibility === v.value}
              onChange={() => setVisibility(v.value)}
              className="mt-1 accent-maroon-700"
            />
            <span>
              <span className="block text-sm font-semibold text-maroon-900">{v.label}</span>
              <span className="block text-xs leading-relaxed text-muted-foreground">{v.hint}</span>
            </span>
          </label>
        ))}
        {err("visibility") ? <p role="alert" className="text-xs font-medium text-destructive">{err("visibility")}</p> : null}
      </fieldset>

      <div>
        <label htmlFor={`${id}-rules`} className={labelClass}>
          Community rules <span className="font-normal text-muted-foreground">(optional, shown to everyone who finds the community)</span>
        </label>
        <textarea
          id={`${id}-rules`}
          name="rules"
          defaultValue={initial?.rules ?? ""}
          rows={5}
          maxLength={RULES_MAX}
          className={textareaClass}
          placeholder="For example: be respectful, no identifiable patient information, no advertising."
        />
        {err("rules") ? <p role="alert" className="mt-1 text-xs font-medium text-destructive">{err("rules")}</p> : null}
      </div>

      <p className="rounded-xl bg-maroon-50 p-3 text-xs leading-relaxed text-maroon-900">
        Community rules sit on top of the Medyra community guidelines; they can&apos;t replace them. You become the
        community&apos;s owner and are responsible for appointing moderators and responding to reports. Medyra staff can
        still review and close any community that breaks the guidelines.
      </p>

      {state.status === "error" && state.message ? <FormAlert tone="error">{state.message}</FormAlert> : null}
      {state.status === "success" ? <FormAlert tone="success">{state.message}</FormAlert> : null}
      <Button type="submit" disabled={pending} className="h-11 px-6">
        {pending ? "Saving…" : editing ? "Save changes" : "Create community"}
      </Button>
    </form>
  );
}
