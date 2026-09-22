/** Uniform selection with rejection sampling; no modulo bias. */
export function selectWinner(pool: number[], fill: (buffer: Uint32Array) => void = buffer => { crypto.getRandomValues(buffer); }): number {
  if (!pool.length) throw new Error('No eligible participants');
  const limit = Math.floor(4294967296 / pool.length) * pool.length;
  const buffer = new Uint32Array(1);
  do { fill(buffer); } while (buffer[0] >= limit);
  return pool[buffer[0] % pool.length];
}


