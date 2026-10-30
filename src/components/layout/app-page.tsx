import { Suspense } from "react";
import { AppFrame } from "@/components/layout/app-frame";

/** Shell for a signed-in page whose content reads cookies: frame, spinner fallback, Suspense. */
export function AppPage({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <AppFrame>
      <Suspense
        fallback={
          <div role="status" className="flex min-h-dvh items-center justify-center">
            <span className="size-8 animate-spin rounded-full border-2 border-maroon-200 border-t-maroon-700 motion-reduce:animate-none" />
            <span className="sr-only">Loading {label}</span>
          </div>
        }
      >
        {children}
      </Suspense>
    </AppFrame>
  );
}
