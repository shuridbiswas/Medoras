import { LogoMark } from "@/components/brand/logo";

/**
 * The welcome banner at the top of the home page. Purely decorative artwork (the brand leaves),
 * no photos and no claims: it describes what the community is for, not who is in it.
 */
export function HeroBanner({ firstName }: { firstName: string }) {
  return (
    <section
      aria-labelledby="home-hero"
      className="relative overflow-hidden rounded-3xl border border-maroon-100 bg-maroon-50 px-6 py-7 sm:px-9 sm:py-9"
    >
      <LogoMark
        className="pointer-events-none absolute -top-4 -right-8 h-40 w-auto opacity-[0.12] sm:-top-6 sm:right-4 sm:h-64"
      />
      <div className="relative max-w-md">
        <p className="text-xs font-semibold tracking-[0.2em] text-maroon-700">
          CONNECT · LEARN · GROW
        </p>
        <h1
          id="home-hero"
          className="mt-3 font-display text-3xl leading-tight font-bold text-maroon-800 sm:text-4xl"
        >
          A community for healthcare minds.
        </h1>
        <p className="mt-3 text-[0.95rem] leading-relaxed text-maroon-900/75">
          Welcome back, {firstName}. Share what you&apos;re learning, ask for advice and meet people
          at every stage of their career.
        </p>
      </div>
    </section>
  );
}
