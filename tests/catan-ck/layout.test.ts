import { describe, expect, it } from 'vitest';
import { generateRandomBoard } from '../../src/games/catan-ck/board/layout';
import { buildTopology } from '../../src/games/catan-ck/board/topology';
import { CK2025_UNVERIFIED as rs } from '../../src/games/catan-ck/rules/ck2025';
import { createRandomSource, seedRng } from '../../src/shared/random';

describe('T-SET-002..005 board ngẫu nhiên (số liệu từ ruleset, UNRESOLVED)', () => {
  const topo = buildTopology(2);
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    it(`seed ${seed}: số lượng địa hình/token/cảng đúng theo ruleset, 6/8 không kề nhau`, () => {
      const b = generateRandomBoard(rs, createRandomSource(seedRng(seed)));
      const counts: Record<string, number> = {};
      for (const h of topo.hexes) counts[b.hexes[h]!.terrain] = (counts[b.hexes[h]!.terrain] ?? 0) + 1;
      expect(counts).toEqual(rs.terrainCounts.value);
      const tokens = topo.hexes.map((h) => b.hexes[h]!.token).filter((t): t is number => t !== null).sort((x, y) => x - y);
      expect(tokens).toEqual([...rs.numberTokens.value].sort((x, y) => x - y));
      expect(b.hexes[b.robberHex]!.terrain).toBe('desert');
      for (const h of topo.hexes) {
        const t = b.hexes[h]!.token;
        if (t === 6 || t === 8) for (const n of topo.hexNeighbors[h]!) expect([6, 8]).not.toContain(b.hexes[n]!.token);
      }
      expect(b.harbors.length).toBe(rs.harbors.value.length);
      const harborVertices = b.harbors.flatMap((h) => h.vertices);
      expect(new Set(harborVertices).size).toBe(harborVertices.length);
      for (const h of b.harbors) expect(topo.coastalEdges).toContain(h.edge);
    });
  }

  it('cùng seed → cùng board', () => {
    const a = generateRandomBoard(rs, createRandomSource(seedRng(11)));
    const b = generateRandomBoard(rs, createRandomSource(seedRng(11)));
    expect(a).toEqual(b);
  });
});
