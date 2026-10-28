import { Check } from "lucide-react";
import { Container, Eyebrow } from "@/components/layout/section";
import { mentorshipPoints } from "@/features/landing/content";

export function Mentorship() {
  return (
    <section
      id="mentorship"
      aria-labelledby="mentorship-heading"
      className="bg-teal-900 py-20 text-white sm:py-28"
    >
      <Container className="grid items-center gap-14 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
        <div>
          <Eyebrow className="text-teal-200">Mentorship</Eyebrow>
          <h2
            id="mentorship-heading"
            className="mt-3 text-balance text-4xl font-medium leading-[1.08] sm:text-5xl"
          >
            Every professional was once a{" "}
            <span className="italic text-teal-200">beginner.</span>
          </h2>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75">
            Medoras will connect students and recent graduates with experienced
            professionals who want to share what they know, through one-on-one
            guidance, group discussions and structured sessions.
          </p>
          <ul className="mt-8 space-y-3.5">
            {mentorshipPoints.map((p) => (
              <li key={p} className="flex gap-3 text-white/90">
                <Check
                  className="mt-1 size-4 shrink-0 text-clay"
                  aria-hidden="true"
                />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>

        <figure
          className="relative rounded-3xl border border-white/10 bg-white/[0.04] p-8 sm:p-10"
          aria-label="How mentor matching will work"
        >
          <figcaption className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-200">
            How matching will work
          </figcaption>
          <ol className="mt-6 space-y-7">
            {[
              [
                "Tell us where you are",
                "Your profession, interests and what you hope to learn.",
              ],
              [
                "Meet suitable mentors",
                "Matched on profession, career interests, experience and availability.",
              ],
              [
                "Grow at your own pace",
                "Individual meetings, group conversations or structured sessions.",
              ],
            ].map(([title, text], i) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 font-display text-sm text-teal-100">
                  {i + 1}
                </span>
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-white/65">
                    {text}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </figure>
      </Container>
    </section>
  );
}
