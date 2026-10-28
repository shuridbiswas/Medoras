import { Container, SectionHeading } from "@/components/layout/section";
import { features } from "@/features/landing/content";

export function WhatYouCanDo() {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className="py-20 sm:py-28"
    >
      <Container>
        <SectionHeading
          id="features-heading"
          eyebrow="What you can do"
          title="Everything a healthcare career needs, in one welcoming place."
        >
          Medoras is being built in stages. These are the experiences we are
          designing the community around.
        </SectionHeading>

        <ul className="mt-14 grid border-t border-border sm:grid-cols-2">
          {features.map((f, i) => (
            <li
              key={f.id}
              id={f.id === "careers" || f.id === "support" ? f.id : undefined}
              className={`group flex gap-5 border-b border-border py-8 sm:pr-8 ${
                i % 2 === 1 ? "sm:border-l sm:pl-8" : ""
              }`}
            >
              <span className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-xl bg-maroon-50 text-maroon-700 transition-colors group-hover:bg-maroon-800 group-hover:text-white">
                <f.icon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-xl font-semibold text-maroon-900">
                  {f.title}
                </h3>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-muted-foreground">
                  {f.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
