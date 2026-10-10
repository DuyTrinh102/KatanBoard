import { describe, expect, it } from 'vitest';
import { buildTopology } from '../../src/games/catan-ck/board/topology';

// T-BRD-001: cấu trúc graph (hình học thuần, không phụ thuộc nguồn luật).
describe('T-BRD-001 topology', () => {
  const t = buildTopology(2);

  it('19 hex, 54 vertex, 72 edge, 30 edge ven biển; ID duy nhất', () => {
    expect(t.hexes.length).toBe(19);
    expect(t.vertices.length).toBe(54);
    expect(t.edges.length).toBe(72);
    expect(t.coastalEdges.length).toBe(30);
    expect(new Set(t.vertices).size).toBe(54);
    expect(new Set(t.edges).size).toBe(72);
  });

  it('mỗi hex có 6 vertex và 6 edge riêng biệt', () => {
    for (const h of t.hexes) {
      expect(new Set(t.hexVertices[h]).size).toBe(6);
      expect(new Set(t.hexEdges[h]).size).toBe(6);
    }
  });

  it('quan hệ đối xứng: hex↔vertex, vertex↔vertex, edge↔vertex', () => {
    for (const h of t.hexes) for (const v of t.hexVertices[h]!) expect(t.vertexHexes[v]).toContain(h);
    for (const v of t.vertices) {
      expect(t.vertexHexes[v]!.length).toBeGreaterThanOrEqual(1);
      expect(t.vertexHexes[v]!.length).toBeLessThanOrEqual(3);
      for (const h of t.vertexHexes[v]!) expect(t.hexVertices[h]).toContain(v);
      for (const n of t.vertexNeighbors[v]!) expect(t.vertexNeighbors[n]).toContain(v);
      expect(t.vertexNeighbors[v]!.length).toBe(t.vertexEdges[v]!.length);
      expect(t.vertexEdges[v]!.length).toBeGreaterThanOrEqual(2);
      expect(t.vertexEdges[v]!.length).toBeLessThanOrEqual(3);
    }
    for (const e of t.edges) {
      const [a, b] = t.edgeVertices[e]!;
      expect(a).not.toBe(b);
      expect(t.vertexEdges[a]).toContain(e);
      expect(t.vertexEdges[b]).toContain(e);
      expect(t.vertexNeighbors[a]).toContain(b);
    }
  });

  it('hàng xóm hex đối xứng; hex trung tâm có 6 hàng xóm', () => {
    for (const h of t.hexes) for (const n of t.hexNeighbors[h]!) expect(t.hexNeighbors[n]).toContain(h);
    expect(t.hexNeighbors['h:0,0']!.length).toBe(6);
  });

  it('ID ổn định giữa các lần build (cache và tính lại)', () => {
    expect(buildTopology(2)).toBe(t);
    expect(t.vertices[0]).toMatch(/^v:-?\d+,-?\d+\|/);
  });
});
