"use client";

import { useActionState, useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FormStatus } from "@/features/profile/components/edit/form-parts";
import { idleState, type ProfileFormState } from "@/features/profile/schemas";
import { cn } from "@/lib/utils";

type Action = (
  prev: ProfileFormState,
  formData: FormData,
) => Promise<ProfileFormState>;
type RemoveAction = (prev: ProfileFormState) => Promise<ProfileFormState>;

const TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Upload (and remove) one image. Files are re-checked on the server by their real bytes. */
export function ImageCard({
  id,
  label,
  shape,
  currentSrc,
  fallback,
  maxMb,
  upload,
  remove,
}: {
  id: string;
  label: string;
  shape: "avatar" | "cover";
  currentSrc: string | null;
  fallback: string;
  maxMb: number;
  upload: Action;
  remove: RemoveAction;
}) {
  const [uploadState, uploadAction] = useActionState(upload, idleState);
  const [removeState, removeAction] = useActionState(remove, idleState);
  const [preview, setPreview] = useState<{ url?: string; error?: string }>({});
  const inputRef = useRef<HTMLInputElement>(null);

  function onChange(file: File | undefined) {
    if (preview.url) URL.revokeObjectURL(preview.url);
    if (!file) return setPreview({});
    if (!TYPES.includes(file.type))
      return setPreview({ error: "Use a JPEG, PNG or WebP image." });
    if (file.size > maxMb * 1024 * 1024)
      return setPreview({ error: `Choose an image under ${maxMb} MB.` });
    setPreview({ url: URL.createObjectURL(file) });
  }

  const shown = preview.url ?? currentSrc;
  const status = uploadState.status !== "idle" ? uploadState : removeState;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id} className="text-sm font-semibold text-maroon-900">
          {label}
        </Label>
        <span className="text-xs text-muted-foreground">
          JPEG, PNG or WebP, up to {maxMb} MB
        </span>
      </div>

      <div
        className={cn(
          "flex items-center justify-center overflow-hidden border border-border bg-maroon-50 text-maroon-600",
          shape === "avatar"
            ? "size-28 rounded-full"
            : "h-32 w-full rounded-xl sm:h-40",
        )}
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shown}
            alt={`Current ${label.toLowerCase()}`}
            className="size-full object-cover"
          />
        ) : (
          <span className="flex flex-col items-center gap-1 text-xs">
            <Camera className="size-5" aria-hidden="true" />
            {fallback}
          </span>
        )}
      </div>

      <form action={uploadAction} className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          id={id}
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          onChange={(e) => onChange(e.target.files?.[0])}
          className="block min-w-0 flex-1 text-sm text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-maroon-700"
        />
        <Button
          type="submit"
          className="h-9 px-4 text-sm"
          disabled={Boolean(preview.error) || !preview.url}
        >
          Upload
        </Button>
      </form>

      {currentSrc ? (
        <form action={removeAction}>
          <Button
            type="submit"
            variant="ghost"
            className="h-8 px-2 text-xs text-destructive hover:text-destructive"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            Remove {label.toLowerCase()}
          </Button>
        </form>
      ) : null}

      {preview.error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {preview.error}
        </p>
      ) : null}
      <FormStatus state={status} />
    </div>
  );
}
