import type { EdgeId, Topology, VertexId } from './topology';

/**
 * Độ dài đường liên tục dài nhất (trail: không dùng lại edge, được đi qua lại vertex — xử lý vòng).
 * Không đi xuyên vertex có quân của đối thủ (BRD-003/004, UNRESOLVED; knight thêm ở M2).
 */
export function longestRoadLength(
  topo: Topology,
  roads: Readonly<Record<EdgeId, string>>,
  occupants: Readonly<Record<VertexId, string>>,
  playerId: string,
): number {
  const mine = new Set<EdgeId>();
  for (const [e, owner] of Object.entries(roads) as [EdgeId, string][]) if (owner === playerId) mine.add(e);
  if (mine.size === 0) return 0;

  const blocked = (v: VertexId): boolean => {
    const occ = occupants[v];
    return occ !== undefined && occ !== playerId;
  };

  let best = 0;
  const used = new Set<EdgeId>();
  const walk = (at: VertexId, length: number): void => {
    if (length > best) best = length;
    if (blocked(at)) return;
    for (const e of topo.vertexEdges[at] ?? []) {
      if (!mine.has(e) || used.has(e)) continue;
      const [a, b] = topo.edgeVertices[e]!;
      used.add(e);
      walk(a === at ? b : a, length + 1);
      used.delete(e);
    }
  };

  for (const e of mine) {
    const [a, b] = topo.edgeVertices[e]!;
    used.add(e);
    walk(a, 1);
    walk(b, 1);
    used.delete(e);
  }
  return best;
}

/**
 * Chủ danh hiệu mới (SCO-002/003, UNRESOLVED):
 * - chủ cũ vẫn bằng max → giữ;
 * - ngược lại, đúng một người đạt max ≥ ngưỡng → người đó; hòa → không ai.
 */
export function resolveLongestRoadHolder(
  lengths: Readonly<Record<string, number>>,
  currentHolder: string | null,
  minLength: number,
): string | null {
  const max = Math.max(0, ...Object.values(lengths));
  if (max < minLength) return null;
  if (currentHolder !== null && lengths[currentHolder] === max) return currentHolder;
  const leaders = Object.keys(lengths).filter((p) => lengths[p] === max);
  return leaders.length === 1 ? leaders[0]! : null;
}
