import type { RandomSource } from '../../../shared/random';
import { shuffleInPlace } from '../../../shared/random';
import type { HarborKind, Ruleset, Terrain } from '../rules';
import { buildTopology, type EdgeId, type HexId, type VertexId } from './topology';

export interface HexTile {
  readonly terrain: Terrain;
  readonly token: number | null;
}

export interface Harbor {
  readonly edge: EdgeId;
  readonly kind: HarborKind;
  readonly vertices: readonly [VertexId, VertexId];
}

export interface BoardSetup {
  readonly layoutId: string;
  readonly hexes: Record<HexId, HexTile>;
  readonly robberHex: HexId;
  readonly harbors: readonly Harbor[];
}

/**
 * Board ngẫu nhiên theo số lượng của ruleset; token 6/8 không kề nhau (SET-004, UNRESOLVED).
 * Vị trí cảng: 9 edge ven biển cách đều nhau — đây là xấp xỉ số hóa, KHÔNG phải vị trí khung
 * chính thức (cần đối chiếu SRC-BASE25). Layout "beginner" cố định sẽ thêm khi có nguồn.
 */
export function generateRandomBoard(ruleset: Ruleset, rng: RandomSource): BoardSetup {
  const topo = buildTopology(2);
  const terrains: Terrain[] = [];
  for (const [t, n] of Object.entries(ruleset.terrainCounts.value) as [Terrain, number][]) {
    for (let i = 0; i < n; i++) terrains.push(t);
  }
  if (terrains.length !== topo.hexes.length) {
    throw new Error(`Số địa hình (${terrains.length}) không khớp số hex (${topo.hexes.length})`);
  }
  const red = new Set(ruleset.redNumbersNotAdjacent.value);

  for (let attempt = 0; attempt < 1000; attempt++) {
    shuffleInPlace(terrains, rng);
    const tokens = shuffleInPlace([...ruleset.numberTokens.value], rng);
    const hexes = {} as Record<HexId, HexTile>;
    let robberHex: HexId | null = null;
    let ti = 0;
    topo.hexes.forEach((h, i) => {
      const terrain = terrains[i]!;
      if (terrain === ruleset.robberStart.value && robberHex === null) robberHex = h;
      hexes[h] = { terrain, token: terrain === 'desert' ? null : tokens[ti++]! };
    });
    const ok = topo.hexes.every((h) => {
      const t = hexes[h]!.token;
      if (t === null || !red.has(t)) return true;
      return topo.hexNeighbors[h]!.every((n) => {
        const nt = hexes[n]!.token;
        return nt === null || !red.has(nt);
      });
    });
    if (!ok || robberHex === null) continue;

    const kinds = shuffleInPlace([...ruleset.harbors.value], rng);
    const coast = topo.coastalEdges;
    const harbors: Harbor[] = kinds.map((kind, i) => {
      const edge = coast[Math.round((i * coast.length) / kinds.length) % coast.length]!;
      return { edge, kind, vertices: topo.edgeVertices[edge]! };
    });
    return { layoutId: 'random-v1', hexes, robberHex, harbors };
  }
  throw new Error('Không sinh được board hợp lệ sau 1000 lần thử');
}
