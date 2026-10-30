import type { Rng } from "./prng.ts";

/** Text helpers for the seed generator: similarity, French agreement, least-used picking. */

const words = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

/** Word trigrams, used to catch near-duplicate texts. */
export function trigrams(text: string): Set<string> {
  const w = words(text);
  const out = new Set<string>();
  if (w.length < 3) {
    if (w.length > 0) out.add(w.join(" "));
    return out;
  }
  for (let i = 0; i + 2 < w.length; i++) out.add(`${w[i]} ${w[i + 1]} ${w[i + 2]}`);
  return out;
}

/** Jaccard similarity of the two texts' word trigrams (0 = nothing shared, 1 = identical). */
export function similarity(a: string, b: string): number {
  const x = trigrams(a);
  const y = trigrams(b);
  if (x.size === 0 || y.size === 0) return 0;
  let shared = 0;
  for (const t of x) if (y.has(t)) shared++;
  return shared / (x.size + y.size - shared);
}

/** Keeps track of what has been used so sentences are spread out instead of repeated. */
export class LeastUsed {
  private uses = new Map<string, number>();
  private rng: Rng;
  constructor(rng: Rng) {
    this.rng = rng;
  }
  pick(items: readonly string[], avoid: readonly string[] = []): string {
    const pool = items.filter((i) => !avoid.includes(i));
    const list = pool.length > 0 ? pool : [...items];
    const min = Math.min(...list.map((i) => this.uses.get(i) ?? 0));
    const best = list.filter((i) => (this.uses.get(i) ?? 0) === min);
    const chosen = this.rng.pick(best);
    this.uses.set(chosen, (this.uses.get(chosen) ?? 0) + 1);
    return chosen;
  }
  /** Give back a use when a candidate text was rejected. */
  release(item: string) {
    this.uses.set(item, Math.max(0, (this.uses.get(item) ?? 1) - 1));
  }
}

// --- French agreement ------------------------------------------------------------------------
// The corpus is written once. First-person adjectives and participles are adjusted to the
// fictional author's grammatical gender, and a few "you" forms to the person being answered.

const SPEAKER: [feminine: string, masculine: string][] = [
  ["fière", "fier"], ["fatiguée", "fatigué"], ["soulagée", "soulagé"], ["convaincue", "convaincu"],
  ["curieuse", "curieux"], ["impressionnée", "impressionné"], ["fascinée", "fasciné"],
  ["heureuse", "heureux"], ["contente", "content"], ["preneuse", "preneur"],
  ["reconnaissante", "reconnaissant"], ["prête", "prêt"], ["certaine", "certain"],
  ["le plus aidée", "le plus aidé"], ["m'a sauvée", "m'a sauvé"], ["ramenée", "ramené"],
  ["ressortie", "ressorti"], ["étrangement détendue", "étrangement détendu"], ["touchée", "touché"],
  ["accueillie", "accueilli"], ["guidée", "guidé"], ["menée", "mené"], ["suis passée", "suis passé"],
  ["suis ouverte", "suis ouvert"], ["me suis surprise", "me suis surpris"],
  ["d'assistante de recherche", "d'assistant de recherche"], ["Je suis infirmière", "Je suis infirmier"],
  ["débutante", "débutant"], ["observatrice", "observateur"], ["pas seule", "pas seul"],
  ["moins seule", "moins seul"], ["étais fascinée", "étais fasciné"], ["suis rassurée", "suis rassuré"],
];

const ADDRESSEE: [feminine: string, masculine: string][] = [
  ["en être fière", "en être fier"],
  ["bien organisée", "bien organisé"],
  ["plus avancée", "plus avancé"],
];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordRe = (s: string) => new RegExp(`(?<![\\p{L}'’])${escapeRe(s)}(?![\\p{L}])`, "gu");

/** speaker: gender of the writer; addressee: gender of the post author being answered (optional). */
export function agreeFrench(text: string, speaker: "f" | "m", addressee?: "f" | "m"): string {
  let out = text;
  const holds: string[] = [];
  if (addressee) {
    for (const [f, m] of ADDRESSEE) {
      out = out.replace(wordRe(f), () => {
        holds.push(addressee === "f" ? f : m);
        return `\u0001${holds.length - 1}\u0002`;
      });
    }
  }
  for (const [f, m] of SPEAKER) {
    const from = speaker === "m" ? f : m;
    const to = speaker === "m" ? m : f;
    out = out.replace(wordRe(from), to);
  }
  return out.replace(/\u0001(\d+)\u0002/g, (_, i: string) => holds[Number(i)]);
}
