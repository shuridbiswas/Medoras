import Link from "next/link";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { signOut } from "@/features/auth/actions";

/** Header for signed-in pages. Pass the member's username so "Profile" links to their page. */
export function AppHeader({ username }: { username?: string | null }) {
  const links = [
    { href: "/home", label: "Home" },
    ...(username ? [{ href: `/profile/${username}`, label: "Profile" }] : []),
    { href: "/settings", label: "Settings" },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="flex items-center gap-0.5 sm:gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-2.5 py-2 text-sm font-medium text-maroon-900/80 transition-colors hover:bg-maroon-50 hover:text-maroon-900 sm:px-3"
            >
              {link.label}
            </Link>
          ))}
          <form action={signOut}>
            <Button
              type="submit"
              variant="ghost"
              size="icon-lg"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="size-4" aria-hidden="true" />
            </Button>
          </form>
        </nav>
      </div>
    </header>
  );
}
