import { ArrowRight } from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";
import { Container, Eyebrow } from "@/components/layout/section";
import { authLinks } from "@/lib/site";
import { HeroPreview } from "@/features/landing/hero-preview";

export function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative overflow-hidden border-b border-border/70"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-40 size-[34rem] rounded-full bg-maroon-50 blur-3xl"
      />
      <Container className="relative grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:gap-8 lg:py-28">
        <div>
          <Eyebrow>For healthcare and social services</Eyebrow>
          <h1
            id="hero-heading"
            className="mt-5 text-balance text-[2.6rem] font-bold leading-[1.04] text-maroon-900 sm:text-6xl lg:text-[4.1rem]"
          >
            Your Community.{" "}
            <span className="text-maroon-600">Your Career.</span> Your Journey.
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
            Medyra connects students, graduates and professionals across
            healthcare and social services through real relationships,
            mentorship, shared knowledge and meaningful opportunities.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <LinkButton href={authLinks.join} className="h-12 px-6 text-base">
              Join Medyra
              <ArrowRight className="size-4" aria-hidden="true" />
            </LinkButton>
            <LinkButton
              href="/#why"
              variant="outline"
              className="h-12 px-6 text-base"
            >
              Discover Medyra
            </LinkButton>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Connect. Learn. Grow. Belong.
          </p>
        </div>
        <HeroPreview />
      </Container>
    </section>
  );
}
