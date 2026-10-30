import { cn } from "@/lib/utils";

/**
 * Page wrapper for signed-in pages. On large screens it leaves room for the fixed sidebar that
 * AppHeader renders; on phones it leaves room for the bottom tab bar.
 */
export function AppFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-h-dvh bg-sand/50 pb-20 md:pb-0 lg:pl-60", className)}>
      {children}
    </div>
  );
}
