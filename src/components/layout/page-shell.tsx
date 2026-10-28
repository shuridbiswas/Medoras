import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Container, Eyebrow } from "@/components/layout/section";

export function PageShell({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1 py-16 sm:py-24">
        <Container className="max-w-3xl">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="mt-3 text-balance text-4xl font-bold leading-tight text-maroon-900 sm:text-5xl">
            {title}
          </h1>
          <div className="mt-8 space-y-5 text-lg leading-relaxed text-muted-foreground">
            {children}
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
