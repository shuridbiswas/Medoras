import { PageShell } from "@/components/layout/page-shell";
import { LinkButton } from "@/components/ui/link-button";

export default function NotFound() {
  return (
    <PageShell eyebrow="404" title="We couldn't find that page.">
      <p>The page may have moved, or it may not exist yet.</p>
      <LinkButton href="/" className="h-11 px-5">
        Return home
      </LinkButton>
    </PageShell>
  );
}
