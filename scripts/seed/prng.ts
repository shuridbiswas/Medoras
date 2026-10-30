/** Small seeded PRNG so every run of the seed tool produces the same data. */

export type Rng = {
  next: () => number;
  int: (min: number, max: number) => number;
  chance: (p: number) => boolean;
  pick: <T>(items: readonly T[]) => T;
  sample: <T>(items: readonly T[], count: number) => T[];
  shuffle: <T>(items: readonly T[]) => T[];
  uuid: () => string;
};

/** mulberry32: tiny, fast, good enough for test data (NOT for anything security related). */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) =>
    min + Math.floor(next() * (max - min + 1));
  const pick = <T>(items: readonly T[]): T => items[int(0, items.length - 1)];
  const shuffle = <T>(items: readonly T[]): T[] => {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(0, i);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  const hex = (n: number) =>
    Array.from({ length: n }, () => int(0, 15).toString(16)).join("");
  return {
    next,
    int,
    chance: (p) => next() < p,
    pick,
    sample: (items, count) => shuffle(items).slice(0, count),
    shuffle,
    // Valid RFC 4122 version-4 shaped id, deterministic for a given seed.
    uuid: () =>
      `${hex(8)}-${hex(4)}-4${hex(3)}-${"89ab"[int(0, 3)]}${hex(3)}-${hex(12)}`,
  };
}

/** Cut text to exactly `length` characters, ending in an ellipsis when it had to be shortened. */
export function exactLength(text: string, length: number): string {
  if (text.length === length) return text;
  if (text.length > length) return text.slice(0, length - 1) + "…";
  throw new Error(`Text is ${text.length} characters, needs at least ${length}`);
}
