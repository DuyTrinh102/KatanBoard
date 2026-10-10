import { describe, expect, it } from 'vitest';
import { buildTopology, type HexId, type VertexId } from '../../src/games/catan-ck/board/topology';
import type { GameState } from '../../src/games/catan-ck/engine';
import { CARD_TYPES, type CardType } from '../../src/games/catan-ck/rules';
import { CK2025_UNVERIFIED as rs } from '../../src/games/catan-ck/rules/ck2025';
import { autoSetup, emptyHands, expectReject, giveFromBank, handTotal, newGame, play, rollWith } from './helpers';

const topo = buildTopology(2);

/** Oracle độc lập: sản lượng mong đợi khi bank đủ. */
function expectedYield(s: GameState, sum: number): Record<string, Partial<Record<CardType, number>>> {
  const out: Record<string, Partial<Record<CardType, number>>> = {};
  for (const h of topo.hexes) {
    const tile = s.board.hexes[h]!;
    if (tile.token !== sum || tile.terrain === 'desert' || h === s.board.robberHex) continue;
    for (const v of topo.hexVertices[h]!) {
      const b = s.buildings[v];
      if (!b) continue;
      const row = (out[b.owner] ??= {});
      const res = rs.terrainResource.value[tile.terrain];
      if (b.kind === 'settlement') row[res] = (row[res] ?? 0) + 1;
      else {
        const y = rs.cityYield.value[tile.terrain];
        row[res] = (row[res] ?? 0) + y.resource;
        if (y.commodity) row[y.commodity] = (row[y.commodity] ?? 0) + 1;
      }
    }
  }
  return out;
}

const split = (sum: number): [number, number] => (sum <= 7 ? [1, sum - 1] : [6, sum - 6]);

function diff(a: GameState, b: GameState, p: string): Partial<Record<CardType, number>> {
  const d: Partial<Record<CardType, number>> = {};
  for (const t of CARD_TYPES) {
    const x = b.players[p]!.hand[t] - a.players[p]!.hand[t];
    if (x !== 0) d[t] = x;
  }
  return d;
}

describe('T-PRD-001/002/004 production', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    it(`seed ${seed}: mọi tổng 2–12 (trừ 7) khớp oracle, gồm commodity của city`, () => {
      const base = emptyHands(autoSetup(newGame(seed, 4)));
      for (let sum = 2; sum <= 12; sum++) {
        if (sum === 7) continue;
        const [r, y] = split(sum);
        const after = rollWith(base, r, y);
        const exp = expectedYield(base, sum);
        for (const p of ['p1', 'p2', 'p3', 'p4']) expect(diff(base, after, p), `sum ${sum} ${p}`).toEqual(exp[p] ?? {});
        expect(after.turn.phase).toBe('ACTION');
      }
    });
  }

  it('city kề rừng nhận lumber + paper (PRD-002)', () => {
    for (let seed = 1; seed < 40; seed++) {
      const s = emptyHands(autoSetup(newGame(seed, 3)));
      const hit = Object.entries(s.buildings).find(([v, b]) =>
        b.kind === 'city' && topo.vertexHexes[v as VertexId]!.some((h) => s.board.hexes[h]!.terrain === 'forest' && h !== s.board.robberHex),
      );
      if (!hit) continue;
      const [v, b] = hit;
      const forest = topo.vertexHexes[v as VertexId]!.find((h) => s.board.hexes[h]!.terrain === 'forest')!;
      const [r, y] = split(s.board.hexes[forest]!.token!);
      const after = rollWith(s, r, y);
      expect(after.players[b.owner]!.hand.paper).toBeGreaterThanOrEqual(1);
      expect(after.players[b.owner]!.hand.lumber).toBeGreaterThanOrEqual(1);
      return;
    }
    throw new Error('không tìm được tình huống city kề rừng');
  });

  it('hex có robber không sản xuất (PRD-004)', () => {
    const s0 = emptyHands(autoSetup(newGame(2, 3)));
    const [hex] = Object.entries(s0.board.hexes).find(([h, t]) => t.token !== null && topo.hexVertices[h as HexId]!.some((v) => s0.buildings[v]))!;
    const s = structuredClone(s0);
    s.board.robberHex = hex as HexId; // test-only: đặt robber
    const [r, y] = split(s.board.hexes[hex as HexId]!.token!);
    const after = rollWith(s, r, y);
    // Oracle đã loại hex có robber → nhận đúng oracle nghĩa là hex bị chặn không sản xuất.
    for (const p of ['p1', 'p2', 'p3']) expect(diff(s, after, p)).toEqual(expectedYield(s, s.board.hexes[hex as HexId]!.token!)[p] ?? {});
  });
});

describe('T-PRD-003 ngân hàng thiếu (UNRESOLVED: none-unless-single-recipient)', () => {
  /** Tìm tổng xúc xắc mà một loại có ≥2 người nhận / đúng 1 người nhận. */
  function find(seedFrom: number, recipients: 'multi' | 'single') {
    for (let seed = seedFrom; seed < seedFrom + 200; seed++) {
      const s = emptyHands(autoSetup(newGame(seed, 4)));
      for (let sum = 2; sum <= 12; sum++) {
        if (sum === 7) continue;
        const exp = expectedYield(s, sum);
        for (const t of ['lumber', 'brick', 'wool', 'grain', 'ore'] as CardType[]) {
          const who = Object.keys(exp).filter((p) => (exp[p]![t] ?? 0) > 0);
          const total = who.reduce((a, p) => a + exp[p]![t]!, 0);
          if (recipients === 'multi' ? who.length >= 2 && who.length < 4 : who.length === 1 && total >= 2) return { s, sum, t, who, total };
        }
      }
    }
    throw new Error('không tìm được tình huống');
  }

  it('nhiều người nhận mà bank không đủ → không ai nhận loại đó', () => {
    const { s, sum, t, who, total } = find(1, 'multi');
    // Dồn bớt lá loại t sang người không nhận để bank chỉ còn total-1.
    const outsider = ['p1', 'p2', 'p3', 'p4'].find((p) => !who.includes(p))!;
    const s2 = giveFromBank(s, outsider, { [t]: s.bank[t] - (total - 1) });
    const [r, y] = split(sum);
    const after = rollWith(s2, r, y);
    for (const p of who) expect(after.players[p]!.hand[t]).toBe(s2.players[p]!.hand[t]);
    const log = after.log.at(-1)!;
    expect(log.kind).toBe('production');
    expect(log.data.shortages).toContain(t);
  });

  it('một người nhận mà bank không đủ → nhận phần còn lại', () => {
    const { s, sum, t, who, total } = find(1, 'single');
    const outsider = ['p1', 'p2', 'p3', 'p4'].find((p) => p !== who[0])!;
    const s2 = giveFromBank(s, outsider, { [t]: s.bank[t] - (total - 1) });
    const [r, y] = split(sum);
    const after = rollWith(s2, r, y);
    expect(after.players[who[0]!]!.hand[t]).toBe(s2.players[who[0]!]!.hand[t] + total - 1);
    expect(after.bank[t]).toBe(0);
  });
});

describe('T-PRD-005/007/008 tung 7, bỏ bài, robber', () => {
  function sevenState(seed = 4) {
    let s = emptyHands(autoSetup(newGame(seed, 3)));
    s = giveFromBank(s, 'p2', { lumber: 4, brick: 4, paper: 1 }); // 9 lá → bỏ 4
    s = giveFromBank(s, 'p3', { ore: 8 }); // 8 lá → bỏ 4
    s = giveFromBank(s, 'p1', { wool: 7 }); // 7 lá → không bỏ
    return s;
  }

  it('chỉ người vượt giới hạn phải bỏ một nửa (làm tròn xuống); chặn mọi hành động khác', () => {
    const s = rollWith(sevenState(), 3, 4);
    expect(s.turn.phase).toBe('ROLL_RESOLUTION');
    const head = s.pending[0]!;
    expect(head.kind).toBe('discard');
    if (head.kind !== 'discard') return;
    expect(head.required).toEqual({ p2: 4, p3: 4 });
    expectReject(s, 'p1', { type: 'endTurn' }, 'PENDING_RESOLUTION');
    expectReject(s, 'p1', { type: 'bankTrade', give: 'wool', get: 'ore' }, 'PENDING_RESOLUTION');
    expectReject(s, 'p1', { type: 'submitDiscard', pendingId: head.id, cards: { wool: 3 } }, 'NOT_DECISION_OWNER');
    expectReject(s, 'p2', { type: 'submitDiscard', pendingId: head.id, cards: { lumber: 3 } }, 'INVALID_INPUT');
    expectReject(s, 'p2', { type: 'submitDiscard', pendingId: head.id, cards: { ore: 4 } }, 'INVALID_INPUT');
  });

  it('commit một lần khi đủ tất cả; robber "ngủ" trước trận barbarian đầu → về ACTION', () => {
    let s = rollWith(sevenState(), 3, 4);
    const id = s.pending[0]!.id;
    s = play(s, 'p3', { type: 'submitDiscard', pendingId: id, cards: { ore: 4 } });
    expect(handTotal(s, 'p3')).toBe(8); // chưa commit
    expect(s.pending[0]!.decisionOwnerIds).toEqual(['p2']);
    s = play(s, 'p2', { type: 'submitDiscard', pendingId: id, cards: { lumber: 2, brick: 1, paper: 1 } });
    expect(handTotal(s, 'p3')).toBe(4);
    expect(handTotal(s, 'p2')).toBe(5);
    expect(s.pending).toEqual([]);
    expect(s.turn.phase).toBe('ACTION');
    expect(s.log.some((e) => e.kind === 'robberAsleep')).toBe(true);
  });

  it('robber đã hoạt động: di chuyển + lấy ngẫu nhiên 1 lá của người có công trình kề', () => {
    let s = sevenState(6);
    s.barbarian.attacksResolved = 1; // test-only: giả lập sau trận đầu (M2 sẽ đi qua battle pipeline)
    s = rollWith(s, 3, 4);
    const d = s.pending[0]!;
    s = play(s, 'p2', { type: 'submitDiscard', pendingId: d.id, cards: { lumber: 4 } });
    s = play(s, 'p3', { type: 'submitDiscard', pendingId: d.id, cards: { ore: 4 } });
    const r = s.pending[0]!;
    expect(r.kind).toBe('moveRobber');
    const target = topo.hexes.find((h) => h !== s.board.robberHex && topo.hexVertices[h]!.some((v) => s.buildings[v]?.owner === 'p2'))!;
    expectReject(s, 'p1', { type: 'moveRobber', pendingId: r.id, hex: s.board.robberHex, victim: null }, 'INVALID_TARGET');
    expectReject(s, 'p1', { type: 'moveRobber', pendingId: r.id, hex: target, victim: null }, 'INVALID_TARGET');
    expectReject(s, 'p2', { type: 'moveRobber', pendingId: r.id, hex: target, victim: 'p2' }, 'NOT_DECISION_OWNER');
    const before = handTotal(s, 'p1');
    const after = play(s, 'p1', { type: 'moveRobber', pendingId: r.id, hex: target, victim: 'p2' });
    expect(after.board.robberHex).toBe(target);
    expect(handTotal(after, 'p1')).toBe(before + 1);
    expect(handTotal(after, 'p2')).toBe(handTotal(s, 'p2') - 1);
    const entry = after.log.at(-1)!;
    expect(entry.kind).toBe('robber');
    expect(entry.data).not.toHaveProperty('card');
    expect(entry.secret?.visibleTo).toEqual(['p1', 'p2']);
    expect(after.turn.phase).toBe('ACTION');
  });
});
