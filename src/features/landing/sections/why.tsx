import { Container, SectionHeading } from "@/components/layout/section";
import { disciplines } from "@/features/landing/content";

export function Why() {
  return (
    <section id="why" aria-labelledby="why-heading" className="py-20 sm:py-28">
      <Container className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
        <SectionHeading
          id="why-heading"
          eyebrow="Why Medoras exists"
          title="No one should have to navigate their education, career, or challenges alone."
        />
        <div className="space-y-6 text-base leading-relaxed text-muted-foreground sm:text-lg">
          <p>
            Healthcare and social services are built on caring for others, yet
            the people doing the work often move through school, placements and
            early careers without a place to ask honest questions, find guidance
            or feel understood.
          </p>
          <p>
            Medoras is that place. It brings the whole community together, from
            a first-year student to a seasoned clinician, so knowledge flows in
            every direction, opportunities are easier to find, and asking for
            help is treated as a strength.
          </p>
          <div>
            <p className="text-sm font-semibold text-teal-900">
              Built for every discipline
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {disciplines.map((d) => (
                <li
                  key={d}
                  className="rounded-full border border-border bg-surface px-3 py-1 text-sm text-teal-900"
                >
                  {d}
                </li>
              ))}
              <li className="rounded-full border border-dashed border-teal-500/50 px-3 py-1 text-sm text-teal-700">
                and more
              </li>
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
}
