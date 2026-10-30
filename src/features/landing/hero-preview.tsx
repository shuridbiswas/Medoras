import { BadgeCheck, Check, MapPin, Users } from "lucide-react";

const tags = ["Psychology", "Neuroscience", "Mental Health", "Research"];

const strength = [
  { label: "Add a profile photo", done: true },
  { label: "Write a summary", done: true },
  { label: "Add education details", done: true },
  { label: "Add certifications", done: false },
];

const goals = [
  { label: "Join a study group", done: true },
  { label: "Find a research opportunity", done: false },
  { label: "Connect with a mentor", done: false },
];

/**
 * Original, illustrative product preview. Clearly not live data: it uses a
 * generic persona and a visible label.
 */
export function HeroPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[34rem]">
      <div
        role="img"
        aria-label="Illustrative preview of a Medyra member profile, profile strength, network and goals"
        className="space-y-4"
      >
        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_24px_60px_-30px_rgba(110,16,38,0.45)]">
          <div className="relative h-24 bg-maroon-700">
            <svg
              aria-hidden="true"
              viewBox="0 0 400 96"
              preserveAspectRatio="xMidYMid slice"
              className="absolute inset-0 size-full opacity-25"
              fill="none"
              stroke="white"
              strokeWidth="1"
            >
              <circle cx="320" cy="20" r="46" />
              <circle cx="320" cy="20" r="72" />
              <circle cx="320" cy="20" r="100" />
              <path d="M0 78c60-30 110 18 190-8s120-8 210-34" />
            </svg>
          </div>
          <div className="px-5 pb-5">
            <div className="relative -mt-9 flex items-end justify-between">
              <span className="flex size-[4.5rem] items-center justify-center rounded-full border-4 border-white bg-maroon-100 font-display text-2xl font-bold text-maroon-700">
                P
              </span>
              <span className="mb-1 rounded-lg border border-maroon-200 px-3 py-1.5 text-xs font-semibold text-maroon-700">
                Edit Profile
              </span>
            </div>
            <p className="mt-3 text-lg font-bold text-maroon-900">
              A psychology student
            </p>
            <p className="text-sm text-muted-foreground">
              Third-year undergraduate
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden="true" /> Your city
              </span>
              <span className="inline-flex items-center gap-1 text-maroon-700">
                <BadgeCheck className="size-3.5" aria-hidden="true" /> Open to
                opportunities
              </span>
            </p>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <li
                  key={t}
                  className="rounded-full bg-maroon-50 px-2.5 py-1 text-[0.7rem] font-medium text-maroon-700"
                >
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-sm font-bold text-maroon-900">
              Profile Strength
            </p>
            <div className="mt-3 flex items-center gap-4">
              <div className="relative size-16 shrink-0">
                <svg viewBox="0 0 36 36" className="size-full -rotate-90">
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    strokeWidth="4"
                    className="stroke-maroon-100"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray="83 97.4"
                    className="stroke-maroon-600"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-maroon-900">
                  85%
                </span>
              </div>
              <ul className="space-y-1.5">
                {strength.map((s) => (
                  <Item key={s.label} {...s} />
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-sm font-bold text-maroon-900">My Goals</p>
            <ul className="mt-3 space-y-2">
              {goals.map((g) => (
                <Item key={g.label} {...g} />
              ))}
            </ul>
            <p className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
              <Users className="size-4 text-maroon-600" aria-hidden="true" />
              Connections, mentors and groups in one place
            </p>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Illustrative preview. Not a real member or live data.
      </p>
    </div>
  );
}

function Item({ label, done }: { label: string; done: boolean }) {
  return (
    <li className="flex items-center gap-2 text-xs text-maroon-900/80">
      <span
        aria-hidden="true"
        className={`flex size-4 shrink-0 items-center justify-center rounded-full ${
          done ? "bg-maroon-600 text-white" : "border border-border"
        }`}
      >
        {done ? <Check className="size-3" strokeWidth={3} /> : null}
      </span>
      {label}
    </li>
  );
}
