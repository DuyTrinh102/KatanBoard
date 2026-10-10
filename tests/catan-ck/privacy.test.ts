import { describe, expect, it } from 'vitest';
import { buildTopology } from '../../src/games/catan-ck/board/topology';
import { getPrivateView, getPublicView } from '../../src/games/catan-ck/projections/views';
import { autoSetup, emptyHands, giveFromBank, newGame, play, rollWith } from './helpers';

const topo = buildTopology(2);

/** Tình huống: p1 cướp 1 lá của p2 (robber đã hoạt động), p2/p3 bỏ bài. */
function scenario(openTable = false) {
  let s = emptyHands(autoSetup(newGame(6, 3, openTable)));
  s = giveFromBank(s, 'p2', { cloth: 9 });
  s.barbarian.attacksResolved = 1; // test-only
  s = rollWith(s, 3, 4);
  const d = s.pending[0]!;
  s = play(s, 'p2', { type: 'submitDiscard', pendingId: d.id, cards: { cloth: 4 } });
  const r = s.pending[0]!;
  const hex = topo.hexes.find((h) => h !== s.board.robberHex && topo.hexVertices[h]!.some((v) => s.buildings[v]?.owner === 'p2'))!;
  s = play(s, 'p1', { type: 'moveRobber', pendingId: r.id, hex, victim: 'p2' });
  return s;
}

describe('T-PRIV projections (DIG-001)', () => {
  it('public view không chứa tay bài, loại lá bị cướp/bỏ, rng, lựa chọn đang thu', () => {
    const s = scenario();
    const pub = getPublicView(s);
    const json = JSON.stringify(pub);
    // p2 chỉ có cloth → loại lá bị cướp là cloth; không được xuất hiện trong dữ liệu công khai.
    expect(json).not.toContain('"card"');
    expect(json).not.toMatch(/"cards"/);
    expect(json).not.toContain('"hand"');
    expect(json).not.toContain('"openHand"');
    expect(json).not.toContain('"rng"');
    expect(json).not.toContain('"collected"');
    expect(pub.players.find((p) => p.id === 'p1')!.handCount).toBe(1);
    expect(pub.players.find((p) => p.id === 'p2')!.handCount).toBe(4);
  });

  it('pending discard công khai chỉ "ai đang chờ" và số lá, không lộ lựa chọn đã nộp', () => {
    let s = emptyHands(autoSetup(newGame(6, 3)));
    s = giveFromBank(s, 'p2', { cloth: 9 });
    s = giveFromBank(s, 'p3', { ore: 8 });
    s = rollWith(s, 3, 4);
    s = play(s, 'p2', { type: 'submitDiscard', pendingId: s.pending[0]!.id, cards: { cloth: 4 } });
    const pub = getPublicView(s);
    expect(pub.pending).toEqual({ id: s.pending[0]!.id, kind: 'discard', waitingFor: ['p3'], required: { p2: 4, p3: 4 } });
    expect(JSON.stringify(pub)).not.toContain('cloth":4');
  });

  it('private view: người bị cướp và người cướp thấy loại lá; người thứ ba không', () => {
    const s = scenario();
    const seen = (p: string) => getPrivateView(s, p).secretLog.filter((e) => e.kind === 'robber');
    expect(seen('p1')[0]!.data.card).toBe('cloth');
    expect(seen('p2')[0]!.data.card).toBe('cloth');
    expect(seen('p3')).toEqual([]);
    expect(getPrivateView(s, 'p1').hand.cloth).toBe(1);
  });

  it('Open Table: thông tin riêng được công khai có chủ đích', () => {
    const s = scenario(true);
    const pub = getPublicView(s);
    expect(pub.openTable).toBe(true);
    expect(pub.players.find((p) => p.id === 'p1')!.openHand!.cloth).toBe(1);
    expect(pub.log.find((e) => e.kind === 'robber')!.data.card).toBe('cloth');
  });

  it('public view gắn nhãn ruleset chưa kiểm chứng', () => {
    const pub = getPublicView(newGame(1, 3));
    expect(pub.rulesetVerified).toBe(false);
    expect(pub.rulesetLabel).toMatch(/CHƯA KIỂM CHỨNG/);
  });
});
