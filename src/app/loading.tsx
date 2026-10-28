export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-1 items-center justify-center py-32"
    >
      <span className="size-8 animate-spin rounded-full border-2 border-maroon-200 border-t-maroon-700 motion-reduce:animate-none" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
