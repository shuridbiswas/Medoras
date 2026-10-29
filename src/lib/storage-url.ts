/** Public storage URLs. Safe in client components: only the public project URL is used. */
export function storageUrl(
  bucket: "avatars" | "covers",
  path: string | null,
): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!path || !base) return null;
  return `${base}/storage/v1/object/public/${bucket}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

export const avatarUrl = (path: string | null) => storageUrl("avatars", path);
export const coverUrl = (path: string | null) => storageUrl("covers", path);
