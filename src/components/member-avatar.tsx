import { cn } from "@/lib/utils";

/** Round member photo with an initial fallback. Decorative: the member's name is always next to it. */
export function MemberAvatar({
  name,
  src,
  className,
}: {
  name: string;
  src: string | null;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-maroon-100 text-sm font-bold text-maroon-700",
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        (name.trim().slice(0, 1) || "?").toUpperCase()
      )}
    </span>
  );
}
