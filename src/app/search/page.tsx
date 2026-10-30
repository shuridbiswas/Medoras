import { redirect } from "next/navigation";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Member search moved into the Network directory; old links keep working. */
export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = new URLSearchParams();
  const q = first(params.q);
  const field = first(params.field);
  if (q) next.set("q", q);
  if (field) next.set("field", field);
  if (first(params.mentors) === "1") next.set("mentorship", "offering");
  const query = next.toString();
  redirect(query ? `/network?${query}` : "/network");
}
