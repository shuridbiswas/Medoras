export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading posts</span>
      <ul className="space-y-4" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <li
            key={i}
            className="animate-pulse rounded-2xl border border-border bg-surface p-5 motion-reduce:animate-none"
          >
            <div className="flex items-center gap-3">
              <span className="size-10 rounded-full bg-maroon-100" />
              <div className="flex-1 space-y-2">
                <span className="block h-3.5 w-1/3 rounded bg-maroon-100" />
                <span className="block h-3 w-1/2 rounded bg-sand" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <span className="block h-3.5 w-full rounded bg-sand" />
              <span className="block h-3.5 w-11/12 rounded bg-sand" />
              <span className="block h-3.5 w-2/3 rounded bg-sand" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
