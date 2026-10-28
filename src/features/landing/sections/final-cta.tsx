import { ArrowRight } from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";
import { Container } from "@/components/layout/section";
import { authLinks } from "@/lib/site";

export function FinalCta() {
  return (
    <section aria-labelledby="cta-heading" className="py-20 sm:py-28">
      <Container>
        <div className="relative overflow-hidden rounded-[2rem] bg-teal-800 px-6 py-16 text-center text-white sm:px-16 sm:py-20">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-24 -top-24 size-80 rounded-full border border-white/10"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-32 -right-16 size-96 rounded-full border border-white/10"
          />
          <h2
            id="cta-heading"
            className="relative mx-auto max-w-2xl text-balance text-3xl font-medium leading-tight sm:text-5xl"
          >
            Help shape the future of healthcare and social services networking.
          </h2>
          <p className="relative mx-auto mt-5 max-w-xl text-lg text-white/75">
            Where future professionals find their direction, established
            professionals share their wisdom, and everyone finds a community
            that understands them.
          </p>
          <div className="relative mt-9 flex justify-center">
            <LinkButton
              href={authLinks.join}
              size="lg"
              className="h-12 bg-white px-7 text-base text-teal-900 hover:bg-teal-50"
            >
              Join Medoras
              <ArrowRight className="size-4" aria-hidden="true" />
            </LinkButton>
          </div>
        </div>
      </Container>
    </section>
  );
}
