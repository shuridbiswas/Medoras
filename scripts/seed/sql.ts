import type { SeedComment, SeedLike, SeedPost } from "./plan.ts";

/** SQL string helpers for the privileged content inserts (the Management API takes plain SQL). */

export function literal(value: string | number | boolean | null): string {
  if (value === null) return "null";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  // Standard conforming strings: only single quotes need escaping.
  return `'${value.replace(/'/g, "''")}'`;
}

const chunks = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

type IdMap = Map<string, string>;

const need = (ids: IdMap, slug: string) => {
  const id = ids.get(slug);
  if (!id) throw new Error(`No account id for ${slug}`);
  return literal(id);
};

/** Idempotent: rows have fixed ids / keys and `on conflict do nothing`. */
export function postStatements(posts: SeedPost[], ids: IdMap): string[] {
  return chunks(posts, 20).map(
    (batch) =>
      `insert into public.posts (id, author_id, category, body, created_at, updated_at, edited_at) values\n` +
      batch
        .map(
          (p) =>
            `(${literal(p.id)}, ${need(ids, p.authorSlug)}, ${literal(p.category)}, ${literal(p.body)}, ` +
            `${literal(p.createdAt)}, ${literal(p.editedAt ?? p.createdAt)}, ${literal(p.editedAt)})`,
        )
        .join(",\n") +
      `\non conflict (id) do nothing;`,
  );
}

export function commentStatements(comments: SeedComment[], ids: IdMap): string[] {
  return chunks(comments, 25).map(
    (batch) =>
      `insert into public.post_comments (id, post_id, author_id, body, created_at) values\n` +
      batch
        .map(
          (c) =>
            `(${literal(c.id)}, ${literal(c.postId)}, ${need(ids, c.authorSlug)}, ${literal(c.body)}, ${literal(c.createdAt)})`,
        )
        .join(",\n") +
      `\non conflict (id) do nothing;`,
  );
}

export function likeStatements(likes: SeedLike[], ids: IdMap): string[] {
  return chunks(likes, 100).map(
    (batch) =>
      `insert into public.post_likes (post_id, user_id, created_at) values\n` +
      batch
        .map((l) => `(${literal(l.postId)}, ${need(ids, l.userSlug)}, ${literal(l.createdAt)})`)
        .join(",\n") +
      `\non conflict (post_id, user_id) do nothing;`,
  );
}

/** Management API: run SQL on the project with a scoped personal access token. */
export async function managementQuery<T = unknown>(
  ref: string,
  token: string,
  query: string,
): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (response.ok) return (await response.json()) as T;
    if (response.status === 429 || response.status >= 500) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    // Never echo the token; the server's message is about the SQL, not the credentials.
    throw new Error(`Management API ${response.status}: ${(await response.text()).slice(0, 400)}`);
  }
  throw new Error("Management API kept failing after several attempts.");
}

/** Row counts for the seed accounts only (matched by the fictional email pattern). */
export const COUNT_SQL = `
select
  (select count(*) from auth.users where email like 'seed+%@example.com')::int as accounts,
  (select count(*) from public.profiles p join auth.users u on u.id = p.id where u.email like 'seed+%@example.com' and p.onboarding_completed)::int as completed_profiles,
  (select count(*) from public.profiles p join auth.users u on u.id = p.id where u.email like 'seed+%@example.com' and not p.onboarding_completed)::int as incomplete_profiles,
  (select count(*) from public.profile_education e join auth.users u on u.id = e.profile_id where u.email like 'seed+%@example.com')::int as education,
  (select count(*) from public.profile_experience e join auth.users u on u.id = e.profile_id where u.email like 'seed+%@example.com')::int as experience,
  (select count(*) from public.profile_skills s join auth.users u on u.id = s.profile_id where u.email like 'seed+%@example.com')::int as tags,
  (select count(*) from public.posts p join auth.users u on u.id = p.author_id where u.email like 'seed+%@example.com')::int as posts,
  (select count(*) from public.post_comments c join auth.users u on u.id = c.author_id where u.email like 'seed+%@example.com')::int as comments,
  (select count(*) from public.post_likes l join auth.users u on u.id = l.user_id where u.email like 'seed+%@example.com')::int as likes,
  (select count(*) from storage.objects o join auth.users u on (storage.foldername(o.name))[1] = u.id::text where u.email like 'seed+%@example.com')::int as images
`;
