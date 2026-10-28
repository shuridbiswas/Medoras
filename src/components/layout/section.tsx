import { cn } from "@/lib/utils";

export function Container({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mx-auto max-w-6xl px-5 sm:px-8", className)}
      {...props}
    />
  );
}

export function Eyebrow({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "text-xs font-semibold uppercase tracking-[0.16em] text-teal-700",
        className,
      )}
      {...props}
    />
  );
}

export function SectionHeading({
  eyebrow,
  title,
  children,
  className,
  id,
}: {
  eyebrow: string;
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div className={cn("max-w-2xl", className)}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2
        id={id}
        className="mt-3 text-balance text-3xl font-medium leading-[1.12] text-teal-900 sm:text-4xl lg:text-[2.6rem]"
      >
        {title}
      </h2>
      {children ? (
        <p className="mt-5 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
          {children}
        </p>
      ) : null}
    </div>
  );
}
