/**
 * PRNG sfc32 (Small Fast Counter) — deterministic, state 4×uint32, serializable.
 * Engine never calls Math.random: mọi random đi qua RandomSource để replay được.
 */
export type RngState = readonly [number, number, number, number];

export interface RandomSource {
  /** Số nguyên trong [0, maxExclusive). */
  nextInt(maxExclusive: number): number;
  /** State hiện tại để lưu lại vào GameState. */
  getState(): RngState;
}

export function createRandomSource(state: RngState): RandomSource {
  let [a, b, c, d] = state;
  const nextUint32 = (): number => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    const t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    const r = (t + d) | 0;
    c = (c + r) | 0;
    return r >>> 0;
  };
  return {
    nextInt(maxExclusive: number): number {
      if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
        throw new Error(`nextInt: maxExclusive phải là số nguyên dương, nhận ${maxExclusive}`);
      }
      // Rejection sampling để tránh lệch modulo.
      const limit = Math.floor(0x1_0000_0000 / maxExclusive) * maxExclusive;
      for (;;) {
        const x = nextUint32();
        if (x < limit) return x % maxExclusive;
      }
    },
    getState: () => [a >>> 0, b >>> 0, c >>> 0, d >>> 0],
  };
}

/** Khởi tạo state từ seed số; trộn 12 vòng như khuyến nghị của sfc32. */
export function seedRng(seed: number): RngState {
  const src = createRandomSource([0x9e3779b9, 0x243f6a88, 0xb7e15162, seed >>> 0]);
  for (let i = 0; i < 12; i++) src.nextInt(2);
  return src.getState();
}

/** Seed mới cho ván, lấy từ crypto (chỉ dùng ở app layer, không ở engine). */
export function freshSeed(): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0]!;
}

export function shuffleInPlace<T>(items: T[], rng: RandomSource): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
  return items;
}
