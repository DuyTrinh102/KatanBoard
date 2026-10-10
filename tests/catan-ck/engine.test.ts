import { describe, expect, it } from 'vitest';
import { buildTopology, type VertexId } from '../../src/games/catan-ck/board/topology';
import { applyCommand, checkInvariants, computeScore, replay, type GameState } from '../../src/games/catan-ck/engine';
import { randomPlaythrough } from './driver';
import { autoSetup, cmd, emptyHands, expectReject, giveFromBank, newGame, play, rollWith } from './helpers';

describe('T-ENG-REPLAY / T-ENG-INV fuzz', () => {
  for (const [seed, n] of [[1, 3], [2, 4], [3, 3], [4, 4], [5, 3], [6, 4]] as const) {
    it(`seed ${seed}, ${n} người: invariants giữ suốt ván; replay(initial, log) == state`, () => {
      const { initial, commands, state } = randomPlaythrough(seed, n, 1500);
      expect(commands.length).toBeGreaterThan(100);
      expect(checkInvariants(state)).toEqual([]);
      const again = replay(initial, commands);
      expect(JSON.stringify(again)).toBe(JSON.stringify(state));
      // revision tăng đúng 1 mỗi command chấp nhận
      expect(state.revision).toBe(commands.length);
    });
  }

});

describe('command idempotent / revision', () => {
  it('commandId lặp không đổi state; expectedRevision cũ → STALE', () => {
    const s = autoSetup(newGame(1, 3));
    const c = cmd(s, 'p1', { type: 'rollDice' }, 'dup-1');
    const r1 = applyCommand(s, c);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    const r2 = applyCommand(r1.state, c);
    expect(r2.ok && r2.duplicate).toBe(true);
    if (r2.ok) expect(r2.state).toBe(r1.state);
    const stale = applyCommand(r1.state, { ...cmd(s, 'p1', { type: 'endTurn' }), expectedRevision: s.revision });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.code).toBe('STALE');
  });

  it('command bị từ chối không đổi state đầu vào', () => {
    const s = autoSetup(newGame(1, 3));
    const before = JSON.stringify(s);
    expectReject(s, 'p2', { type: 'rollDice' }, 'NOT_YOUR_TURN');
    expect(JSON.stringify(s)).toBe(before);
  });

  it('reload giữa roll resolution không tung lại: kết quả đã nằm trong state', () => {
    let s = emptyHands(autoSetup(newGame(4, 3)));
    s.players.p2!.hand.ore = 0;
    s = rollWith(s, 3, 4);
    const roll = s.turn.lastRoll;
    const reloaded = JSON.parse(JSON.stringify(s)) as GameState;
    expect(reloaded.turn.lastRoll).toEqual(roll);
    expectReject(reloaded, 'p1', { type: 'rollDice' }, 'WRONG_PHASE');
  });
});

describe('T-SCO-007 thời điểm thắng (UNRESOLVED: chỉ trong lượt của mình)', () => {
  /** Test-only: dựng p2 có đủ 13 VP bằng công trình hợp lệ khoảng cách. */
  function p2AtThirteen(): GameState {
    const topo = buildTopology(2);
    const s = structuredClone(rollWith(emptyHands(autoSetup(newGame(21, 3))), 1, 1));
    for (const [v, b] of Object.entries(s.buildings)) if (b.owner === 'p2') delete s.buildings[v as VertexId];
    const plan: ('city' | 'settlement')[] = ['city', 'city', 'city', 'city', 'settlement', 'settlement', 'settlement', 'settlement', 'settlement'];
    for (const kind of plan) {
      const v = topo.vertices.find((x) => !s.buildings[x] && topo.vertexNeighbors[x]!.every((n) => !s.buildings[n]))!;
      s.buildings[v] = { owner: 'p2', kind };
    }
    s.players.p2!.stock = { ...s.players.p2!.stock, settlements: 0, cities: 0 };
    expect(computeScore(s).p2!.total).toBe(13);
    return s;
  }

  it('người trong lượt đạt ngưỡng bằng một hành động → GAME_OVER ngay sau transaction', () => {
    const topo = buildTopology(2);
    let s = structuredClone(rollWith(emptyHands(autoSetup(newGame(22, 3))), 1, 1));
    for (const [v, b] of Object.entries(s.buildings)) if (b.owner === 'p1') delete s.buildings[v as VertexId];
    const plan: ('city' | 'settlement')[] = ['city', 'city', 'city', 'settlement', 'settlement', 'settlement', 'settlement'];
    let lastSettlement: VertexId | null = null;
    for (const kind of plan) {
      const v = topo.vertices.find((x) => !s.buildings[x] && topo.vertexNeighbors[x]!.every((n) => !s.buildings[n]))!;
      s.buildings[v] = { owner: 'p1', kind };
      if (kind === 'settlement') lastSettlement = v;
    }
    s.players.p1!.stock = { ...s.players.p1!.stock, settlements: 1, cities: 1 };
    s.titles.longestRoad = 'p1'; // test-only: giữ danh hiệu (+2)
    s = giveFromBank(s, 'p1', { grain: 2, ore: 3 });
    expect(computeScore(s).p1!.total).toBe(12);
    s = play(s, 'p1', { type: 'buildCity', vertex: lastSettlement! });
    expect(s.winner).toBe('p1');
    expect(s.turn.phase).toBe('GAME_OVER');
    expectReject(s, 'p1', { type: 'endTurn' }, 'GAME_OVER');
  });

  it('đạt ngưỡng ngoài lượt không kết thúc ngay; thắng khi tới lượt mình', () => {
    let s = p2AtThirteen();
    expect(s.turn.activePlayerId).toBe('p1');
    s = play(s, 'p1', { type: 'endTurn' });
    expect(s.winner).toBe('p2');
    expect(s.turn.phase).toBe('GAME_OVER');
  });
});
