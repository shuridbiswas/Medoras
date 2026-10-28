import { Container, Eyebrow } from "@/components/layout/section";

export function Vision() {
  return (
    <section
      id="vision"
      aria-labelledby="vision-heading"
      className="border-y border-border/70 bg-sand/50 py-24 sm:py-32"
    >
      <Container className="max-w-4xl text-center">
        <Eyebrow>Our vision</Eyebrow>
        <h2
          id="vision-heading"
          className="mt-5 text-balance text-3xl font-medium leading-[1.2] text-teal-900 sm:text-5xl"
        >
          A world where knowledge is shared, opportunities are accessible, and
          asking for help is a{" "}
          <span className="italic text-teal-600">sign of strength.</span>
        </h2>
        <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          We imagine healthcare and social services students who never feel lost
          at the start of their careers, and experienced professionals who
          inspire the next generation, with connections that reach beyond
          classrooms, hospitals, clinics and workplaces.
        </p>
      </Container>
    </section>
  );
}
