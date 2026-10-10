import { describe, expect, it } from 'vitest';
import { createRandomSource, seedRng, shuffleInPlace } from '../../src/shared/random';

describe('PRNG sfc32', () => {
  it('cùng seed → cùng chuỗi; state serializable tiếp tục đúng chỗ', () => {
    const a = createRandomSource(seedRng(42));
    const b = createRandomSource(seedRng(42));
    const seqA = Array.from({ length: 20 }, () => a.nextInt(1000));
    const seqB = Array.from({ length: 10 }, () => b.nextInt(1000));
    const resumed = createRandomSource(JSON.parse(JSON.stringify(b.getState())));
    seqB.push(...Array.from({ length: 10 }, () => resumed.nextInt(1000)));
    expect(seqB).toEqual(seqA);
  });

  it('test vector cố định (phát hiện thay đổi thuật toán làm hỏng save cũ)', () => {
    const r = createRandomSource(seedRng(1));
    expect(Array.from({ length: 6 }, () => r.nextInt(6))).toMatchInlineSnapshot(`
      [
        2,
        2,
        1,
        5,
        2,
        3,
      ]
    `);
  });

  it('seed khác → chuỗi khác; giá trị trong khoảng', () => {
    const a = createRandomSource(seedRng(1));
    const b = createRandomSource(seedRng(2));
    const xs = Array.from({ length: 50 }, () => a.nextInt(6));
    expect(xs).not.toEqual(Array.from({ length: 50 }, () => b.nextInt(6)));
    expect(xs.every((x) => x >= 0 && x < 6)).toBe(true);
  });

  it('shuffle giữ nguyên phần tử', () => {
    const arr = shuffleInPlace([1, 2, 3, 4, 5, 6, 7], createRandomSource(seedRng(3)));
    expect([...arr].sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});
