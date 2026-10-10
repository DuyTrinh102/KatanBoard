import { describe, expect, it } from 'vitest';
import { applyCommand, bankRatio, type GameState } from '../../src/games/catan-ck/engine';
import { autoSetup, cmd, emptyHands, expectReject, giveFromBank, newGame, play, rollWith } from './helpers';

function actionState(): GameState {
  return emptyHands(rollWith(autoSetup(newGame(12, 3)), 1, 1));
}

/** Test-only: đặt công trình lên vertex (giảm kho để giữ invariant). */
function placeAt(s0: GameState, p: string, v: string): GameState {
  const s = structuredClone(s0);
  for (const [vid, b] of Object.entries(s.buildings)) if (b.owner === p && b.kind === 'settlement') {
    delete s.buildings[vid as never];
    s.buildings[v as never] = { owner: p, kind: 'settlement' };
    return s;
  }
  throw new Error('không có settlement để dời');
}

/** Test-only (chỉ dùng cho bankRatio, không apply command): gỡ công trình của p1 đang nằm trên cảng. */
function emptyOfHarbors(s0: GameState): GameState {
  const s = structuredClone(s0);
  const harborV = new Set<string>(s.board.harbors.flatMap((h) => h.vertices));
  for (const [v, b] of Object.entries(s.buildings)) {
    if (b.owner === 'p1' && harborV.has(v)) delete s.buildings[v as never];
  }
  return s;
}

describe('T-TRD-003 bank/cảng', () => {
  it('4:1 mặc định; cảng chung 3:1; cảng riêng 2:1 chỉ cho đúng loại', () => {
    const s = actionState();
    const onHarbor = (kind: 'generic' | 'specific') => {
      for (const h of s.board.harbors) {
        if ((kind === 'generic') !== (h.kind === 'generic')) continue;
        const v = h.vertices.find((x) => !s.buildings[x]);
        if (v) return { state: placeAt(emptyOfHarbors(s), 'p1', v), harbor: h };
      }
      throw new Error('không có vertex cảng trống');
    };
    const plain = emptyOfHarbors(s);
    expect(bankRatio(plain, 'p1', 'wool')).toBe(4);
    const g = onHarbor('generic');
    expect(bankRatio(g.state, 'p1', 'wool')).toBe(3);
    const sp = onHarbor('specific');
    const kind = sp.harbor.kind as 'wool';
    expect(bankRatio(sp.state, 'p1', kind)).toBe(2);
    const other = (['lumber', 'brick', 'wool', 'grain', 'ore'] as const).find((r) => r !== kind)!;
    expect(bankRatio(sp.state, 'p1', other)).toBe(4);
  });

  it('đổi bank: trừ đúng tỷ lệ, không đổi cùng loại, thiếu lá bị từ chối', () => {
    let s = actionState();
    const ratio = bankRatio(s, 'p1', 'grain');
    s = giveFromBank(s, 'p1', { grain: ratio });
    expectReject(s, 'p1', { type: 'bankTrade', give: 'grain', get: 'grain' }, 'INVALID_TRADE');
    expectReject(s, 'p1', { type: 'bankTrade', give: 'ore', get: 'grain' }, 'INSUFFICIENT_RESOURCES');
    s = play(s, 'p1', { type: 'bankTrade', give: 'grain', get: 'ore' });
    expect(s.players.p1!.hand.grain).toBe(0);
    expect(s.players.p1!.hand.ore).toBe(1);
  });
});

describe('T-TRD-001/004 domestic trade', () => {
  function withCards(): GameState {
    let s = actionState();
    s = giveFromBank(s, 'p1', { brick: 2 });
    s = giveFromBank(s, 'p2', { ore: 2 });
    s = giveFromBank(s, 'p3', { ore: 1 });
    return s;
  }

  it('đề nghị → chấp nhận → xác nhận: chuyển hai chiều nguyên tử', () => {
    let s = withCards();
    s = play(s, 'p1', { type: 'proposeTrade', to: ['p2', 'p3'], offer: { brick: 1 }, request: { ore: 1 } });
    const id = Object.keys(s.proposals)[0]!;
    s = play(s, 'p2', { type: 'respondTrade', proposalId: id, revision: 1, response: 'accept' });
    s = play(s, 'p1', { type: 'confirmTrade', proposalId: id, revision: 1, partner: 'p2' });
    expect(s.players.p1!.hand).toMatchObject({ brick: 1, ore: 1 });
    expect(s.players.p2!.hand).toMatchObject({ brick: 1, ore: 1 });
    expect(s.proposals[id]!.status).toBe('done');
    expectReject(s, 'p1', { type: 'confirmTrade', proposalId: id, revision: 1, partner: 'p2' }, 'INVALID_TRADE');
  });

  it('sửa đề nghị tăng revision và xóa chấp nhận cũ; phản hồi revision cũ bị từ chối', () => {
    let s = withCards();
    s = play(s, 'p1', { type: 'proposeTrade', to: ['p2'], offer: { brick: 1 }, request: { ore: 1 } });
    const id = Object.keys(s.proposals)[0]!;
    s = play(s, 'p2', { type: 'respondTrade', proposalId: id, revision: 1, response: 'accept' });
    s = play(s, 'p1', { type: 'updateTrade', proposalId: id, to: ['p2'], offer: { brick: 1 }, request: { ore: 2 } });
    expect(s.proposals[id]!.revision).toBe(2);
    expect(s.proposals[id]!.acceptedBy).toEqual({});
    expectReject(s, 'p1', { type: 'confirmTrade', proposalId: id, revision: 2, partner: 'p2' }, 'INVALID_TRADE');
    expectReject(s, 'p2', { type: 'respondTrade', proposalId: id, revision: 1, response: 'accept' }, 'STALE_PROPOSAL');
  });

  it('double tap xác nhận (cùng commandId) chỉ thực hiện một lần', () => {
    let s = withCards();
    s = play(s, 'p1', { type: 'proposeTrade', to: ['p2'], offer: { brick: 1 }, request: { ore: 1 } });
    const id = Object.keys(s.proposals)[0]!;
    s = play(s, 'p2', { type: 'respondTrade', proposalId: id, revision: 1, response: 'accept' });
    const c = cmd(s, 'p1', { type: 'confirmTrade', proposalId: id, revision: 1, partner: 'p2' }, 'tap-1');
    const r1 = applyCommand(s, c);
    expect(r1.ok).toBe(true);
    const r2 = r1.ok ? applyCommand(r1.state, c) : r1;
    expect(r2.ok && r2.duplicate).toBe(true);
    if (r2.ok) expect(r2.state.players.p1!.hand.brick).toBe(1);
  });

  it('hai đề nghị dùng chung một lá: chỉ một giao dịch commit được', () => {
    let s = actionState();
    s = giveFromBank(s, 'p1', { brick: 1 });
    s = giveFromBank(s, 'p2', { ore: 1 });
    s = giveFromBank(s, 'p3', { ore: 1 });
    s = play(s, 'p1', { type: 'proposeTrade', to: ['p2'], offer: { brick: 1 }, request: { ore: 1 } });
    s = play(s, 'p1', { type: 'proposeTrade', to: ['p3'], offer: { brick: 1 }, request: { ore: 1 } });
    const [a, b] = Object.keys(s.proposals);
    s = play(s, 'p2', { type: 'respondTrade', proposalId: a!, revision: 1, response: 'accept' });
    s = play(s, 'p3', { type: 'respondTrade', proposalId: b!, revision: 1, response: 'accept' });
    s = play(s, 'p1', { type: 'confirmTrade', proposalId: a!, revision: 1, partner: 'p2' });
    expectReject(s, 'p1', { type: 'confirmTrade', proposalId: b!, revision: 1, partner: 'p3' }, 'INSUFFICIENT_RESOURCES');
  });

  it('ràng buộc: không tặng bài, không đổi cùng loại, chỉ người trong lượt đề nghị, người ngoài đề nghị không phản hồi được', () => {
    let s = withCards();
    expectReject(s, 'p1', { type: 'proposeTrade', to: ['p2'], offer: { brick: 1 }, request: {} }, 'INVALID_TRADE');
    expectReject(s, 'p1', { type: 'proposeTrade', to: ['p2'], offer: { brick: 1 }, request: { brick: 1 } }, 'INVALID_TRADE');
    expectReject(s, 'p1', { type: 'proposeTrade', to: ['p1'], offer: { brick: 1 }, request: { ore: 1 } }, 'INVALID_TRADE');
    expectReject(s, 'p2', { type: 'proposeTrade', to: ['p3'], offer: { ore: 1 }, request: { brick: 1 } }, 'NOT_YOUR_TURN');
    s = play(s, 'p1', { type: 'proposeTrade', to: ['p2'], offer: { brick: 1 }, request: { ore: 1 } });
    const id = Object.keys(s.proposals)[0]!;
    expectReject(s, 'p3', { type: 'respondTrade', proposalId: id, revision: 1, response: 'accept' }, 'NOT_DECISION_OWNER');
    // Người ngoài lượt phản hồi được nhưng không xây/tung được.
    expectReject(s, 'p2', { type: 'rollDice' }, 'NOT_YOUR_TURN');
    // Chấp nhận khi không đủ lá.
    s = play(s, 'p1', { type: 'updateTrade', proposalId: id, to: ['p2'], offer: { brick: 1 }, request: { ore: 3 } });
    expectReject(s, 'p2', { type: 'respondTrade', proposalId: id, revision: 2, response: 'accept' }, 'INSUFFICIENT_RESOURCES');
  });

  it('kết thúc lượt hủy mọi đề nghị đang mở', () => {
    let s = withCards();
    s = play(s, 'p1', { type: 'proposeTrade', to: ['p2'], offer: { brick: 1 }, request: { ore: 1 } });
    s = play(s, 'p1', { type: 'endTurn' });
    expect(Object.values(s.proposals).every((p) => p.status === 'cancelled')).toBe(true);
    expect(s.turn.activePlayerId).toBe('p2');
    expect(s.turn.phase).toBe('PRE_ROLL');
  });
});
