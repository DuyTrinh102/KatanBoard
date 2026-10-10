import { describe, expect, it } from 'vitest';
import { buildTopology } from '../../src/games/catan-ck/board/topology';
import { getLegalActions, validateCommand, type GameState } from '../../src/games/catan-ck/engine';
import { autoSetup, cmd, emptyHands, expectReject, giveFromBank, newGame, play, rollWith } from './helpers';

const topo = buildTopology(2);

function actionState(seed = 3): GameState {
  // Tung 2+... chọn tổng không phải 7 và xóa tay để kiểm soát tài nguyên.
  let s = autoSetup(newGame(seed, 3));
  s = rollWith(s, 1, 1);
  return emptyHands(s);
}

describe('T-CON-001..003, 006 xây dựng', () => {
  it('road: cần chi phí, phải nối mạng; trả đúng chi phí về bank', () => {
    let s = actionState();
    const target = getLegalActions(s, 'p1').find((a) => a.type === 'buildRoad')!;
    expect(target.enabled).toBe(false);
    expect(target.reason).toBe('Không đủ tài nguyên');
    expect(target.privateReason).toMatch(/Thiếu/);
    s = giveFromBank(s, 'p1', { brick: 1, lumber: 1 });
    const legal = getLegalActions(s, 'p1').find((a) => a.type === 'buildRoad')!;
    expect(legal.enabled).toBe(true);
    const notConnected = topo.edges.find((e) => !legal.targets!.includes(e) && !s.roads[e])!;
    expectReject(s, 'p1', { type: 'buildRoad', edge: notConnected }, 'INVALID_TARGET');
    const bankBefore = s.bank.brick;
    s = play(s, 'p1', { type: 'buildRoad', edge: legal.targets![0] as never });
    expect(s.bank.brick).toBe(bankBefore + 1);
    expect(s.players.p1!.hand.brick).toBe(0);
  });

  it('target UI (getLegalActions) trùng khớp với engine validate cho mọi edge/vertex', () => {
    let s = actionState(8);
    s = giveFromBank(s, 'p1', { brick: 3, lumber: 3, wool: 2, grain: 4, ore: 3 });
    const acts = getLegalActions(s, 'p1');
    const roads = new Set(acts.find((a) => a.type === 'buildRoad')!.targets);
    for (const e of topo.edges) {
      expect(validateCommand(s, cmd(s, 'p1', { type: 'buildRoad', edge: e })).ok, e).toBe(roads.has(e));
    }
    const cities = new Set(acts.find((a) => a.type === 'buildCity')!.targets);
    const settlements = new Set(acts.find((a) => a.type === 'buildSettlement')!.targets);
    for (const v of topo.vertices) {
      expect(validateCommand(s, cmd(s, 'p1', { type: 'buildCity', vertex: v })).ok).toBe(cities.has(v));
      expect(validateCommand(s, cmd(s, 'p1', { type: 'buildSettlement', vertex: v })).ok).toBe(settlements.has(v));
    }
  });

  it('settlement cần road của mình và luật khoảng cách; city nâng settlement và trả settlement về kho', () => {
    let s = actionState(9);
    s = giveFromBank(s, 'p1', { brick: 3, lumber: 3, wool: 1, grain: 3, ore: 3 });
    // Mở rộng 2 road để có chỗ settlement hợp lệ.
    for (let i = 0; i < 2; i++) {
      const settle = getLegalActions(s, 'p1').find((a) => a.type === 'buildSettlement')!;
      if (settle.targets!.length > 0) break;
      const r = getLegalActions(s, 'p1').find((a) => a.type === 'buildRoad')!;
      // Ưu tiên edge đi xa công trình nhất (thử lần lượt tới khi có chỗ settlement).
      let built = false;
      for (const e of r.targets!) {
        const next = play(s, 'p1', { type: 'buildRoad', edge: e as never });
        if (getLegalActions(next, 'p1').find((a) => a.type === 'buildSettlement')!.targets!.length > 0 || i === 1) {
          s = next;
          built = true;
          break;
        }
      }
      if (!built) s = play(s, 'p1', { type: 'buildRoad', edge: r.targets![0] as never });
    }
    const spot = getLegalActions(s, 'p1').find((a) => a.type === 'buildSettlement')!.targets![0]!;
    for (const n of topo.vertexNeighbors[spot as never]!) expect(s.buildings[n]).toBeUndefined();
    s = play(s, 'p1', { type: 'buildSettlement', vertex: spot as never });
    expect(s.players.p1!.stock.settlements).toBe(3);
    s = play(s, 'p1', { type: 'buildCity', vertex: spot as never });
    expect(s.buildings[spot as never]!.kind).toBe('city');
    expect(s.players.p1!.stock.settlements).toBe(4);
    expect(s.players.p1!.stock.cities).toBe(2);
    expectReject(s, 'p1', { type: 'buildCity', vertex: spot as never }, 'INVALID_TARGET');
  });

  it('hết road trong kho → NO_STOCK', () => {
    let s = actionState(10);
    s = giveFromBank(s, 'p1', { brick: 14, lumber: 14 });
    while (s.players.p1!.stock.roads > 0) {
      const r = getLegalActions(s, 'p1').find((a) => a.type === 'buildRoad')!;
      s = play(s, 'p1', { type: 'buildRoad', edge: r.targets![0] as never });
    }
    const anyEdge = topo.edges.find((e) => !s.roads[e])!;
    expectReject(s, 'p1', { type: 'buildRoad', edge: anyEdge }, 'NO_STOCK');
  });

  it('chưa tung xúc xắc / không phải lượt → bị từ chối với lý do cụ thể', () => {
    let s = autoSetup(newGame(3, 3));
    s = giveFromBank(emptyHands(s), 'p1', { brick: 1, lumber: 1 });
    const a = getLegalActions(s, 'p1').find((x) => x.type === 'buildRoad')!;
    expect(a.enabled).toBe(false);
    expect(a.reason).toBe('Chưa tung xúc xắc');
    expect(getLegalActions(s, 'p2').find((x) => x.type === 'buildRoad')!.reason).toBe('Không phải lượt của bạn');
  });
});
