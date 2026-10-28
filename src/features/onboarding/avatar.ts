import { AVATAR_MAX_BYTES, AVATAR_TYPES } from "@/features/onboarding/schemas";

export type AvatarCheck =
  | {
      ok: true;
      extension: "jpg" | "png" | "webp";
      contentType: (typeof AVATAR_TYPES)[number];
    }
  | { ok: false; message: string };

/** Detect the real image type from the first bytes, not from the (spoofable) file name or MIME type. */
export function sniffImage(bytes: Uint8Array) {
  const startsWith = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (startsWith(0xff, 0xd8, 0xff))
    return { extension: "jpg", contentType: "image/jpeg" } as const;
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) {
    return { extension: "png", contentType: "image/png" } as const;
  }
  if (
    startsWith(0x52, 0x49, 0x46, 0x46) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { extension: "webp", contentType: "image/webp" } as const;
  }
  return null;
}

export async function checkAvatar(file: File): Promise<AvatarCheck> {
  if (file.size === 0) return { ok: false, message: "That file is empty." };
  if (file.size > AVATAR_MAX_BYTES) {
    return { ok: false, message: "Choose an image under 2 MB." };
  }
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const detected = sniffImage(head);
  if (!detected) {
    return { ok: false, message: "Use a JPEG, PNG or WebP image." };
  }
  return { ok: true, ...detected };
}
