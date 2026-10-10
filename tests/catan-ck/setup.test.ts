import { describe, expect, it } from 'vitest';
import { buildTopology } from '../../src/games/catan-ck/board/topology';
import { getLegalActions } from '../../src/games/catan-ck/engine';
import { autoSetup, expectReject, handTotal, newGame, play } from './helpers';

const topo = buildTopology(2);

describe('T-SET-011/012 setup (candidate rules, UNRESOLVED)', () => {
  for (const n of [3, 4] as const) {
    it(`${n} người: thứ tự rắn, settlement vòng 1, city vòng 2, 2 road mỗi người`, () => {
      let s = newGame(5, n);
      const seq: string[] = [];
      while (s.turn.phase === 'SETUP') {
        seq.push(s.turn.activePlayerId);
        const actor = s.turn.activePlayerId;
        const a = getLegalActions(s, actor);
        const step = s.turn.setup!.step;
        const t = a.find((x) => x.type === (step === 'building' ? 'placeSetupBuilding' : 'placeSetupRoad'))!.targets![0]!;
        s = play(s, actor, step === 'building' ? { type: 'placeSetupBuilding', vertex: t as never } : { type: 'placeSetupRoad', edge: t as never });
      }
      const ids = ['p1', 'p2', 'p3', 'p4'].slice(0, n);
      const expected = [...ids, ...[...ids].reverse()].flatMap((p) => [p, p]);
      expect(seq).toEqual(expected);
      expect(s.turn.phase).toBe('PRE_ROLL');
      expect(s.turn.activePlayerId).toBe('p1');
      for (const p of ids) {
        const mine = Object.values(s.buildings).filter((b) => b.owner === p);
        expect(mine.map((b) => b.kind).sort()).toEqual(['city', 'settlement']);
        expect(Object.values(s.roads).filter((o) => o === p).length).toBe(2);
      }
    });
  }

  it('city vòng 2 cho 1 tài nguyên mỗi hex đất (trừ sa mạc) kề nó; settlement vòng 1 không cho gì', () => {
    let s = autoSetup(newGame(7, 3));
    for (const p of ['p1', 'p2', 'p3']) {
      const cityV = Object.entries(s.buildings).find(([, b]) => b.owner === p && b.kind === 'city')![0];
      const yielding = topo.vertexHexes[cityV as never]!.filter((h) => s.board.hexes[h]!.terrain !== 'desert').length;
      expect(handTotal(s, p)).toBe(yielding);
    }
    expect(s.players.p1!.hand.paper + s.players.p1!.hand.cloth + s.players.p1!.hand.coin).toBe(0);
  });

  it('luật khoảng cách và road phải nối công trình vừa đặt', () => {
    let s = newGame(3, 3);
    const v = topo.vertices.find((x) => topo.vertexHexes[x]!.length === 3)!;
    s = play(s, 'p1', { type: 'placeSetupBuilding', vertex: v });
    const farEdge = topo.edges.find((e) => !topo.edgeVertices[e]!.includes(v))!;
    expectReject(s, 'p1', { type: 'placeSetupRoad', edge: farEdge }, 'INVALID_TARGET');
    s = play(s, 'p1', { type: 'placeSetupRoad', edge: topo.vertexEdges[v]![0]! });
    expectReject(s, 'p2', { type: 'placeSetupBuilding', vertex: topo.vertexNeighbors[v]![0]! }, 'INVALID_TARGET');
    expectReject(s, 'p2', { type: 'placeSetupBuilding', vertex: v }, 'INVALID_TARGET');
    expectReject(s, 'p3', { type: 'placeSetupBuilding', vertex: topo.vertices[0]! }, 'NOT_YOUR_TURN');
  });

  it('không tung xúc xắc/xây trong SETUP', () => {
    const s = newGame(3, 3);
    expectReject(s, 'p1', { type: 'rollDice' }, 'WRONG_PHASE');
    expectReject(s, 'p1', { type: 'endTurn' }, 'WRONG_PHASE');
  });
});
