import Link from "next/link";
import { Search } from "lucide-react";
import { COUNTRY_CODES, FIELDS } from "@/features/onboarding/options";
import { countryName } from "@/features/profile/format";
import { MEMBER_GROUPS, MENTORSHIP_FILTERS } from "@/features/network/options";
import type { DirectoryFilters } from "@/features/network/schemas";
import { hasActiveFilters } from "@/features/network/schemas";

const control =
  "h-10 w-full rounded-lg border border-input bg-surface px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-maroon-900">
        {label}
      </label>
      {children}
    </div>
  );
}

/** A plain GET form, so every filtered view is a shareable URL and works without JavaScript. */
export function DirectoryFiltersForm({ filters }: { filters: DirectoryFilters }) {
  const countries = COUNTRY_CODES.map((code) => ({
    code,
    name: countryName(code) ?? code,
  })).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <form
      role="search"
      aria-label="Find members"
      action="/network"
      method="get"
      className="space-y-3 rounded-2xl border border-border bg-surface p-4 sm:p-5"
    >
      <Field id="dir-q" label="Name or username">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            id="dir-q"
            name="q"
            type="search"
            defaultValue={filters.q}
            maxLength={60}
            placeholder="Search by name"
            className={`${control} pl-9`}
          />
        </div>
      </Field>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field id="dir-group" label="Member type">
          <select id="dir-group" name="group" defaultValue={filters.group ?? ""} className={control}>
            <option value="">Everyone</option>
            {MEMBER_GROUPS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </Field>
        <Field id="dir-field" label="Profession or specialty area">
          <select id="dir-field" name="field" defaultValue={filters.field ?? ""} className={control}>
            <option value="">All fields</option>
            {FIELDS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </Field>
        <Field id="dir-mentorship" label="Mentorship">
          <select
            id="dir-mentorship"
            name="mentorship"
            defaultValue={filters.mentorship ?? ""}
            className={control}
          >
            <option value="">Any</option>
            {MENTORSHIP_FILTERS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
        <Field id="dir-institution" label="Institution">
          <input
            id="dir-institution"
            name="institution"
            defaultValue={filters.institution}
            maxLength={60}
            placeholder="e.g. a university or hospital"
            className={control}
          />
        </Field>
        <Field id="dir-country" label="Country">
          <select id="dir-country" name="country" defaultValue={filters.country ?? ""} className={control}>
            <option value="">Anywhere</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="dir-region" label="City or region">
          <input
            id="dir-region"
            name="region"
            defaultValue={filters.region}
            maxLength={60}
            placeholder="As members describe it"
            className={control}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Search className="size-4" aria-hidden="true" />
          Search
        </button>
        {hasActiveFilters(filters) ? (
          <Link
            href="/network"
            className="text-sm font-medium text-maroon-700 underline-offset-4 hover:underline"
          >
            Clear filters
          </Link>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Mentorship and profile details are self-reported by members and are not verified.
      </p>
    </form>
  );
}
