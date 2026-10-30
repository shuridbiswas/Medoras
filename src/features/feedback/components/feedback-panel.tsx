import Link from "next/link";
import { ExternalLink, Lightbulb, Map, ScrollText, ShieldAlert } from "lucide-react";
import type { FeedbackLinks } from "@/features/feedback/config";

const external = {
  target: "_blank",
  rel: "noopener noreferrer",
} as const;

function LinkCard({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: typeof Lightbulb;
  title: string;
  description: string;
}) {
  return (
    <a
      href={href}
      {...external}
      className="group flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-maroon-200 hover:bg-maroon-50/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-maroon-50 text-maroon-700">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 font-semibold text-maroon-900">
          {title}
          <ExternalLink className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">(opens ProductBridge in a new tab)</span>
        </span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>
      </span>
    </a>
  );
}

/** Product feedback entry points. Safety reports are deliberately a separate section. */
export function FeedbackPanel({ links }: { links: FeedbackLinks | null }) {
  return (
    <div className="space-y-6">
      {links ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          <li>
            <LinkCard
              href={links.feedback}
              icon={Lightbulb}
              title="Share feedback"
              description="Request a feature, report a bug, or suggest an improvement. You can also vote on ideas from other members."
            />
          </li>
          <li>
            <LinkCard
              href={links.roadmap}
              icon={Map}
              title="Public roadmap"
              description="See what is planned, in progress and shipped."
            />
          </li>
          <li>
            <LinkCard
              href={links.changelog}
              icon={ScrollText}
              title="What's new"
              description="Recent updates to Medyra."
            />
          </li>
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-maroon-200 bg-maroon-50 p-5 text-sm text-maroon-900">
          The feedback portal isn&apos;t connected yet. Until it is, please send ideas
          and bug reports through the{" "}
          <Link href="/contact" className="font-medium underline underline-offset-2">
            contact page
          </Link>
          .
        </p>
      )}

      <section
        aria-labelledby="feedback-privacy"
        className="rounded-2xl border border-border bg-surface p-5 text-sm leading-relaxed text-maroon-900/85"
      >
        <h2 id="feedback-privacy" className="font-semibold text-maroon-900">
          Before you send feedback
        </h2>
        <p className="mt-1">
          The feedback portal is run by ProductBridge, a separate service with its own
          privacy terms. Medyra does not send it your profile or account details. Feedback
          you post there may be visible to others. Please don&apos;t include patient or
          client information, personal health details, or anything confidential.
        </p>
      </section>

      <section
        aria-labelledby="feedback-safety"
        className="flex gap-3 rounded-2xl border border-border bg-surface p-5 text-sm leading-relaxed"
      >
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-maroon-700" aria-hidden="true" />
        <div>
          <h2 id="feedback-safety" className="font-semibold text-maroon-900">
            Reporting a person or a post?
          </h2>
          <p className="mt-1 text-maroon-900/85">
            Product feedback is separate from community safety. Reporting tools are
            not built yet (you can block a member from their profile). To raise a safety concern now, use the{" "}
            <Link href="/contact" className="font-medium text-maroon-700 underline underline-offset-2">
              contact page
            </Link>
            , and see the{" "}
            <Link
              href="/community-guidelines"
              className="font-medium text-maroon-700 underline underline-offset-2"
            >
              community guidelines
            </Link>
            . If someone is in immediate danger, contact your local emergency number.
          </p>
        </div>
      </section>
    </div>
  );
}
