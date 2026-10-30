import "server-only";
import { createClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/monitoring/report";
import {
  embeddingModel,
  getPinecone,
  PINECONE_NAMESPACES,
  type PineconeNamespace,
} from "@/lib/pinecone/client";
import { parseVectorId, type EmbeddableDocument } from "@/lib/pinecone/records";

/**
 * Server-side Pinecone operations. Every function is safe to call when Pinecone is not
 * configured (it does nothing / returns nothing) and never throws: semantic search is an
 * enhancement, never a dependency of registration or the feed.
 *
 * Nothing calls these yet. Planned sync (ARCHITECTURE.md): upsert after a member finishes
 * onboarding or edits profile tags; delete when they delete their account or leave onboarding.
 */

const BATCH = 90;

async function embed(texts: string[], inputType: "passage" | "query") {
  const pc = getPinecone();
  if (!pc) return null;
  const result = await pc.inference.embed({
    model: embeddingModel(),
    inputs: texts,
    parameters: { inputType, truncate: "END" },
  });
  return result.data.map((d) => ("values" in d ? (d.values as number[]) : []));
}

function indexFor(namespace: PineconeNamespace) {
  const pc = getPinecone();
  const name = process.env.PINECONE_INDEX;
  return pc && name ? pc.index({ name, namespace }) : null;
}

export async function upsertDocuments(
  namespace: PineconeNamespace,
  docs: EmbeddableDocument[],
): Promise<{ enabled: boolean; upserted: number }> {
  const index = indexFor(namespace);
  if (!index || docs.length === 0) return { enabled: Boolean(index), upserted: 0 };

  let upserted = 0;
  try {
    for (let i = 0; i < docs.length; i += BATCH) {
      const batch = docs.slice(i, i + BATCH);
      const vectors = await embed(
        batch.map((d) => d.text),
        "passage",
      );
      if (!vectors) return { enabled: false, upserted };
      await index.upsert({
        records: batch.map((d, n) => ({
          id: d.id,
          values: vectors[n],
          metadata: d.metadata,
        })),
      });
      upserted += batch.length;
    }
  } catch (error) {
    reportError("pinecone.upsert", error);
  }
  return { enabled: true, upserted };
}

export async function deleteDocuments(
  namespace: PineconeNamespace,
  ids: string[],
): Promise<void> {
  const index = indexFor(namespace);
  if (!index || ids.length === 0) return;
  try {
    await index.deleteMany({ ids });
  } catch (error) {
    reportError("pinecone.delete", error);
  }
}

/**
 * Semantic search over member profiles. Returns ONLY ids that PostgreSQL (under the viewer's
 * row level security) confirms the viewer may see right now, so a stale or leaked vector can
 * never expose a profile the viewer isn't allowed to read.
 */
export async function searchProfileIds(
  queryText: string,
  topK = 10,
): Promise<{ enabled: boolean; ids: string[] }> {
  const index = indexFor(PINECONE_NAMESPACES.profiles);
  const text = queryText.trim().slice(0, 500);
  if (!index || !text) return { enabled: Boolean(index), ids: [] };

  try {
    const vectors = await embed([text], "query");
    if (!vectors?.[0]) return { enabled: false, ids: [] };
    const result = await index.query({
      vector: vectors[0],
      topK: Math.min(Math.max(topK, 1), 25),
      includeMetadata: false,
      filter: { visibility: { $eq: "members" } },
    });
    const candidates = (result.matches ?? [])
      .map((m) => parseVectorId(m.id)?.id)
      .filter((id): id is string => Boolean(id));
    if (candidates.length === 0) return { enabled: true, ids: [] };

    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .in("id", candidates)
      .eq("onboarding_completed", true);
    const allowed = new Set((data ?? []).map((r) => r.id));
    return { enabled: true, ids: candidates.filter((id) => allowed.has(id)) };
  } catch (error) {
    reportError("pinecone.query", error);
    return { enabled: true, ids: [] };
  }
}
