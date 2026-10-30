import { Container, SectionHeading } from "@/components/layout/section";
import { stages } from "@/features/landing/content";

export function Stages() {
  return (
    <section
      id="community"
      aria-labelledby="stages-heading"
      className="border-y border-border/70 bg-sand/50 py-20 sm:py-28"
    >
      <Container>
        <SectionHeading
          id="stages-heading"
          eyebrow="Community"
          title="One community, every career stage."
        >
          A career is a long path. Medyra keeps you connected to the people
          behind you, beside you and ahead of you along the way.
        </SectionHeading>

        <ol className="relative mt-14 grid gap-10 md:grid-cols-5 md:gap-6">
          <div
            aria-hidden="true"
            className="absolute left-[0.72rem] top-3 hidden h-[calc(100%-1.5rem)] w-px bg-maroon-200 max-md:block md:left-0 md:right-0 md:top-[0.72rem] md:h-px md:w-full"
          />
          {stages.map((stage, i) => (
            <li key={stage.label} className="relative pl-10 md:pl-0 md:pt-10">
              <span
                aria-hidden="true"
                className="absolute left-0 top-1 flex size-6 items-center justify-center rounded-full border-2 border-maroon-600 bg-canvas text-[0.65rem] font-semibold text-maroon-700 md:top-0"
              >
                {i + 1}
              </span>
              <h3 className="text-xl font-semibold text-maroon-900">
                {stage.label}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {stage.text}
              </p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
