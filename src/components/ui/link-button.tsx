import Link from "next/link";
import type { VariantProps } from "class-variance-authority";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** A real anchor styled as a button, so links keep link semantics. */
export function LinkButton({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>) {
  return (
    <Link
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
