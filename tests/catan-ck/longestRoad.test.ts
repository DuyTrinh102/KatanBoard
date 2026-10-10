import { describe, expect, it } from 'vitest';
import { longestRoadLength, resolveLongestRoadHolder } from '../../src/games/catan-ck/board/longestRoad';
import { buildTopology, type EdgeId, type VertexId } from '../../src/games/catan-ck/board/topology';

const topo = buildTopology(2);

/** Đường đi đơn giản n edge từ vertex start, không lặp vertex. */
function path(start: VertexId, n: number): { edges: EdgeId[]; vertices: VertexId[] } {
  const vertices = [start];
  const edges: EdgeId[] = [];
  let at = start;
  const dfs = (): boolean => {
    if (edges.length === n) return true;
    for (const e of topo.vertexEdges[at]!) {
      const [a, b] = topo.edgeVertices[e]!;
      const nxt = a === at ? b : a;
      if (vertices.includes(nxt)) continue;
      const prev = at;
      edges.push(e); vertices.push(nxt); at = nxt;
      if (dfs()) return true;
      edges.pop(); vertices.pop(); at = prev;
    }
    return false;
  };
  if (!dfs()) throw new Error('không dựng được path');
  return { edges, vertices };
}

const own = (edges: EdgeId[], p = 'p1'): Record<EdgeId, string> => Object.fromEntries(edges.map((e) => [e, p]));

describe('T-SCO-002/003 Longest Road', () => {
  it('chuỗi thẳng 5 đoạn = 5', () => {
    const { edges } = path(topo.vertices[10]!, 5);
    expect(longestRoadLength(topo, own(edges), {}, 'p1')).toBe(5);
  });

  it('vòng quanh một hex = 6; vòng + nhánh = 7', () => {
    const ring = [...topo.hexEdges['h:0,0']!];
    expect(longestRoadLength(topo, own(ring), {}, 'p1')).toBe(6);
    const ringVertices = new Set(topo.hexVertices['h:0,0']);
    const spur = topo.edges.find((e) => !ring.includes(e) && topo.edgeVertices[e]!.some((v) => ringVertices.has(v)))!;
    expect(longestRoadLength(topo, own([...ring, spur]), {}, 'p1')).toBe(7);
  });

  it('nhánh chữ Y: lấy nhánh dài nhất qua giao điểm', () => {
    const center = topo.vertices.find((v) => topo.vertexEdges[v]!.length === 3 && topo.vertexHexes[v]!.length === 3)!;
    const [e1, e2, e3] = topo.vertexEdges[center]!;
    expect(longestRoadLength(topo, own([e1!, e2!, e3!]), {}, 'p1')).toBe(2);
  });

  it('công trình đối thủ ở giữa cắt đường; công trình của mình thì không', () => {
    const { edges, vertices } = path(topo.vertices[20]!, 5);
    const mid = vertices[2]!; // sau 2 edge
    expect(longestRoadLength(topo, own(edges), { [mid]: 'p2' }, 'p1')).toBe(3);
    expect(longestRoadLength(topo, own(edges), { [mid]: 'p1' }, 'p1')).toBe(5);
  });

  it('chủ danh hiệu: ngưỡng, hòa giữ chủ cũ, vượt thì chuyển, chủ cũ bị cắt + hòa → không ai', () => {
    expect(resolveLongestRoadHolder({ p1: 4, p2: 3 }, null, 5)).toBeNull();
    expect(resolveLongestRoadHolder({ p1: 5, p2: 3 }, null, 5)).toBe('p1');
    expect(resolveLongestRoadHolder({ p1: 6, p2: 6 }, 'p1', 5)).toBe('p1');
    expect(resolveLongestRoadHolder({ p1: 6, p2: 7 }, 'p1', 5)).toBe('p2');
    expect(resolveLongestRoadHolder({ p1: 4, p2: 6, p3: 6 }, 'p1', 5)).toBeNull();
    expect(resolveLongestRoadHolder({ p1: 4, p2: 6, p3: 5 }, 'p1', 5)).toBe('p2');
    expect(resolveLongestRoadHolder({ p1: 6, p2: 6 }, null, 5)).toBeNull();
  });
});
