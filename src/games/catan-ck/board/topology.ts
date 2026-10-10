/**
 * Graph hex–vertex–edge với ID ổn định, sinh từ tọa độ axial nguyên (không dùng pixel/float).
 *
 * - Hex: `h:q,r` (pointy-top, axial).
 * - Vertex: giao của 3 hex (kể cả hex biển ngoài board) → `v:` + 3 khóa hex đã sắp xếp.
 * - Edge: ranh giới của 2 hex → `e:` + 2 khóa hex đã sắp xếp.
 * Chỉ giữ vertex/edge chạm ít nhất một hex đất.
 */
export type HexId = `h:${string}`;
export type VertexId = `v:${string}`;
export type EdgeId = `e:${string}`;

export interface Axial {
  readonly q: number;
  readonly r: number;
}

/** Hướng hàng xóm i; góc màn hình (y hướng xuống) = -60°·i. */
export const DIRECTIONS: readonly Axial[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

const key = (a: Axial): string => `${a.q},${a.r}`;
const add = (a: Axial, b: Axial): Axial => ({ q: a.q + b.q, r: a.r + b.r });
export const hexId = (a: Axial): HexId => `h:${key(a)}`;

export function parseHexId(id: HexId): Axial {
  const [q, r] = id.slice(2).split(',').map(Number);
  return { q: q!, r: r! };
}

function sortedKeys(...hexes: Axial[]): string {
  return hexes
    .map(key)
    .sort((x, y) => (x < y ? -1 : x > y ? 1 : 0))
    .join('|');
}

/** Vertex i của hex nằm giữa hướng i và i+1. */
export function vertexOf(hex: Axial, corner: number): VertexId {
  const a = DIRECTIONS[corner % 6]!;
  const b = DIRECTIONS[(corner + 1) % 6]!;
  return `v:${sortedKeys(hex, add(hex, a), add(hex, b))}`;
}

/** Edge i của hex là ranh giới với hàng xóm theo hướng i; nối vertex (i-1) và i. */
export function edgeOf(hex: Axial, side: number): EdgeId {
  return `e:${sortedKeys(hex, add(hex, DIRECTIONS[side % 6]!))}`;
}

export interface Topology {
  readonly radius: number;
  readonly hexes: readonly HexId[];
  readonly vertices: readonly VertexId[];
  readonly edges: readonly EdgeId[];
  readonly hexVertices: Readonly<Record<HexId, readonly VertexId[]>>;
  readonly hexEdges: Readonly<Record<HexId, readonly EdgeId[]>>;
  readonly hexNeighbors: Readonly<Record<HexId, readonly HexId[]>>;
  readonly vertexHexes: Readonly<Record<VertexId, readonly HexId[]>>;
  readonly vertexEdges: Readonly<Record<VertexId, readonly EdgeId[]>>;
  readonly vertexNeighbors: Readonly<Record<VertexId, readonly VertexId[]>>;
  readonly edgeVertices: Readonly<Record<EdgeId, readonly [VertexId, VertexId]>>;
  /** Edge giáp biển (một phía là hex ngoài board), theo thứ tự góc quanh tâm. */
  readonly coastalEdges: readonly EdgeId[];
}

function push<K extends string, V>(map: Record<K, V[]>, k: K, v: V): void {
  const arr = (map[k] ??= []);
  if (!arr.includes(v)) arr.push(v);
}

const cache = new Map<number, Topology>();

export function buildTopology(radius = 2): Topology {
  const cached = cache.get(radius);
  if (cached) return cached;

  const land: Axial[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
      land.push({ q, r });
    }
  }
  const landSet = new Set(land.map(hexId));

  const hexVertices = {} as Record<HexId, VertexId[]>;
  const hexEdges = {} as Record<HexId, EdgeId[]>;
  const hexNeighbors = {} as Record<HexId, HexId[]>;
  const vertexHexes = {} as Record<VertexId, HexId[]>;
  const vertexEdges = {} as Record<VertexId, EdgeId[]>;
  const vertexNeighbors = {} as Record<VertexId, VertexId[]>;
  const edgeVertices = {} as Record<EdgeId, [VertexId, VertexId]>;
  const coastal = new Set<EdgeId>();

  for (const h of land) {
    const hid = hexId(h);
    hexVertices[hid] = [];
    hexEdges[hid] = [];
    hexNeighbors[hid] = [];
    for (let i = 0; i < 6; i++) {
      const v = vertexOf(h, i);
      hexVertices[hid].push(v);
      push(vertexHexes, v, hid);
      const n = add(h, DIRECTIONS[i]!);
      if (landSet.has(hexId(n))) hexNeighbors[hid].push(hexId(n));
    }
    for (let i = 0; i < 6; i++) {
      const e = edgeOf(h, i);
      hexEdges[hid].push(e);
      const v1 = vertexOf(h, (i + 5) % 6);
      const v2 = vertexOf(h, i);
      const pair: [VertexId, VertexId] = v1 < v2 ? [v1, v2] : [v2, v1];
      edgeVertices[e] = pair;
      push(vertexEdges, v1, e);
      push(vertexEdges, v2, e);
      push(vertexNeighbors, v1, v2);
      push(vertexNeighbors, v2, v1);
      if (!landSet.has(hexId(add(h, DIRECTIONS[i]!)))) coastal.add(e);
    }
  }

  const vertices = Object.keys(vertexHexes).sort() as VertexId[];
  const edges = Object.keys(edgeVertices).sort() as EdgeId[];

  // Sắp xếp edge ven biển theo góc quanh tâm (dùng tọa độ hex nguyên → trung điểm cố định).
  const angleOf = (e: EdgeId): number => {
    const [a, b] = e.slice(2).split('|').map((s) => s.split(',').map(Number));
    const q = (a![0]! + b![0]!) / 2;
    const r = (a![1]! + b![1]!) / 2;
    const x = Math.sqrt(3) * (q + r / 2);
    const y = 1.5 * r;
    return Math.atan2(y, x);
  };
  const coastalEdges = [...coastal].sort((a, b) => angleOf(a) - angleOf(b) || (a < b ? -1 : 1));

  const topo: Topology = {
    radius,
    hexes: land.map(hexId),
    vertices,
    edges,
    hexVertices,
    hexEdges,
    hexNeighbors,
    vertexHexes,
    vertexEdges,
    vertexNeighbors,
    edgeVertices,
    coastalEdges,
  };
  cache.set(radius, topo);
  return topo;
}

/** Tọa độ pixel — CHỈ dùng cho UI. */
export function hexCenter(id: HexId, size: number): { x: number; y: number } {
  const { q, r } = parseHexId(id);
  return { x: size * Math.sqrt(3) * (q + r / 2), y: size * 1.5 * r };
}

export function vertexPoint(id: VertexId, size: number): { x: number; y: number } {
  const hexes = id.slice(2).split('|').map((s) => s.split(',').map(Number));
  let x = 0;
  let y = 0;
  for (const [q, r] of hexes) {
    x += size * Math.sqrt(3) * (q! + r! / 2);
    y += size * 1.5 * r!;
  }
  return { x: x / 3, y: y / 3 };
}
