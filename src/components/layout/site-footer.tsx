import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { footerLinks, siteConfig } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-sand/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr]">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {siteConfig.secondaryTagline} A professional and social network for
            the healthcare and social services community.
          </p>
        </div>
        <nav
          aria-label="Footer"
          className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-3"
        >
          {footerLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="w-fit text-maroon-900/80 underline-offset-4 transition-colors hover:text-maroon-900 hover:underline"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="border-t border-border/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-5 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:px-8">
          <p>
            &copy; {siteConfig.copyrightYear} {siteConfig.name}. All rights
            reserved.
          </p>
          <p>
            Medyra is a community platform and does not provide medical advice
            or emergency services.
          </p>
        </div>
      </div>
    </footer>
  );
}
