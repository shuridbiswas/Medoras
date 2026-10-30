import "server-only";
import { Pinecone } from "@pinecone-database/pinecone";

/**
 * Pinecone (vector database) for FUTURE semantic search. Nothing in the app calls it yet and it
 * is disabled unless PINECONE_API_KEY and PINECONE_INDEX are set. Server-side only.
 *
 * Embedding model: PINECONE_EMBEDDING_MODEL, default "multilingual-e5-large" (1024 dimensions,
 * multilingual, which suits a Canadian audience). The index MUST be created with the same
 * dimension and cosine metric. See ARCHITECTURE.md ("Pinecone").
 */

export const PINECONE_NAMESPACES = {
  profiles: "profiles",
  // "posts" is intentionally absent: free-text posts can contain sensitive disclosures and
  // verification/moderation are not active. Add it only after a documented policy decision.
} as const;

export type PineconeNamespace =
  (typeof PINECONE_NAMESPACES)[keyof typeof PINECONE_NAMESPACES];

export const embeddingModel = () =>
  process.env.PINECONE_EMBEDDING_MODEL || "multilingual-e5-large";

export const EMBEDDING_DIMENSIONS = 1024;

export function isPineconeEnabled(): boolean {
  return Boolean(process.env.PINECONE_API_KEY && process.env.PINECONE_INDEX);
}

let client: Pinecone | null | undefined;

export function getPinecone(): Pinecone | null {
  if (client !== undefined) return client;
  const apiKey = process.env.PINECONE_API_KEY;
  client = apiKey && process.env.PINECONE_INDEX ? new Pinecone({ apiKey }) : null;
  return client;
}

export function resetPineconeForTests() {
  client = undefined;
}
