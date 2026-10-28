"use client";

import { useId, useState } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FieldProps = Omit<React.ComponentProps<"input">, "id"> & {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
};

export function Field({
  label,
  error,
  hint,
  optional,
  className,
  ...props
}: FieldProps) {
  const id = useId();
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-semibold text-maroon-900">
        {label}
        {optional ? (
          <span className="font-normal text-muted-foreground"> (optional)</span>
        ) : null}
      </Label>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={cn("h-11 bg-surface px-3 text-base", className)}
        {...props}
      />
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-xs font-medium text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function PasswordField({
  label,
  error,
  hint,
  ...props
}: Omit<FieldProps, "type" | "optional">) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-semibold text-maroon-900">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className="h-11 bg-surface px-3 pr-11 text-base"
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-maroon-700"
        >
          {visible ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-xs font-medium text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Checkbox({
  label,
  error,
  ...props
}: Omit<React.ComponentProps<"input">, "type" | "id"> & {
  label: React.ReactNode;
  error?: string;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-2.5">
        <input
          id={id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-border accent-maroon-700"
          {...props}
        />
        <label
          htmlFor={id}
          className="cursor-pointer text-sm leading-snug text-maroon-900/85"
        >
          {label}
        </label>
      </div>
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-xs font-medium text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function SubmitButton({
  children,
  pendingLabel,
  className,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={cn("h-11 w-full text-base", className)}
    >
      {pending ? (
        <>
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none"
          />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

export function FormAlert({
  tone,
  children,
}: {
  tone: "error" | "success" | "info";
  children: React.ReactNode;
}) {
  const Icon = tone === "success" ? CheckCircle2 : AlertCircle;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex gap-2.5 rounded-xl border px-3.5 py-3 text-sm",
        tone === "error" &&
          "border-destructive/30 bg-destructive/5 text-destructive",
        tone === "success" && "border-maroon-200 bg-maroon-50 text-maroon-900",
        tone === "info" && "border-border bg-sand text-maroon-900",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
