import { Heart, MessagesSquare, Users } from "lucide-react";
import { Logo } from "@/components/brand/logo";

const points = [
  { icon: Users, text: "Connect with students, graduates and professionals" },
  { icon: MessagesSquare, text: "Find mentors and ask honest questions" },
  { icon: Heart, text: "Belong to a community that cares" },
] as const;

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden overflow-hidden bg-maroon-700 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <svg
          aria-hidden="true"
          viewBox="0 0 400 400"
          className="pointer-events-none absolute -bottom-20 -right-20 size-[34rem] opacity-[0.12]"
          fill="none"
          stroke="white"
        >
          <circle cx="200" cy="200" r="60" />
          <circle cx="200" cy="200" r="110" />
          <circle cx="200" cy="200" r="160" />
          <circle cx="200" cy="200" r="210" />
        </svg>
        <Logo tone="light" />
        <div className="relative max-w-md">
          <h2 className="text-4xl font-bold leading-[1.1]">
            Where future professionals find their direction.
          </h2>
          <ul className="mt-8 space-y-4">
            {points.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-white/85">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-white/60">
          Connect. Learn. Grow. Belong.
        </p>
      </aside>

      <main id="main" className="flex flex-col px-5 py-8 sm:px-10">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <h1 className="text-3xl font-bold leading-tight text-maroon-900">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-2 text-base text-muted-foreground">{subtitle}</p>
          ) : null}
          <div className="mt-8">{children}</div>
          {footer ? (
            <div className="mt-8 text-center text-sm text-muted-foreground">
              {footer}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}

export function FormSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading form" className="space-y-5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 w-24 animate-pulse rounded bg-sand motion-reduce:animate-none" />
          <div className="h-11 animate-pulse rounded-lg bg-sand motion-reduce:animate-none" />
        </div>
      ))}
      <div className="h-11 animate-pulse rounded-lg bg-maroon-100 motion-reduce:animate-none" />
    </div>
  );
}

export const authErrorMessages: Record<string, string> = {
  link_invalid:
    "That link is invalid or has expired. Request a new one and try again.",
  verify_email: "Please verify your email address to continue.",
  not_configured:
    "Authentication isn't configured on this server yet. See the README for setup steps.",
};
