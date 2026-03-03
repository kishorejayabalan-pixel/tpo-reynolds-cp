/**
 * Reproducible seeded RNG (Mulberry32) for demo stability.
 * Unit-testable: same seed => same sequence.
 */
export function createSeededRng(seed: number): () => number {
  return function next(): number {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
