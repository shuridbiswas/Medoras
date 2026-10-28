import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { MobileNav } from "@/components/layout/mobile-nav";
import { LinkButton } from "@/components/ui/link-button";
import { authLinks, navLinks } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-canvas/90 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
        <Logo />
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-maroon-900/80 transition-colors hover:bg-maroon-50 hover:text-maroon-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LinkButton
            href={authLinks.signIn}
            variant="ghost"
            className="hidden h-9 px-3.5 text-sm md:inline-flex"
          >
            Sign In
          </LinkButton>
          <LinkButton
            href={authLinks.join}
            className="hidden h-9 px-4 text-sm md:inline-flex"
          >
            Join Medoras
          </LinkButton>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
