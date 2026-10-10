import { expect } from 'vitest';
import { createRandomSource, seedRng, type RandomSource } from '../../src/shared/random';
import {
  applyCommand,
  createGame,
  getLegalActions,
  type Command,
  type CommandBody,
  type GameConfig,
  type GameState,
  type PlayerId,
  type TransitionResult,
} from '../../src/games/catan-ck/engine';
import { CARD_TYPES, DEV_RULESET_ID, type Bundle, type CardType } from '../../src/games/catan-ck/rules';
import { handTotal } from '../../src/games/catan-ck/engine/queries';

export function makeConfig(n: 3 | 4, openTable = false): GameConfig {
  const all = [
    { id: 'p1', name: 'An', color: '#c0392b', icon: 'shield', seat: 'B' as const },
    { id: 'p2', name: 'Bình', color: '#2471a3', icon: 'leaf', seat: 'T' as const },
    { id: 'p3', name: 'Chi', color: '#d68910', icon: 'star', seat: 'R' as const },
    { id: 'p4', name: 'Dũng', color: '#7d3c98', icon: 'wave', seat: 'L' as const },
  ];
  const players = all.slice(0, n);
  return { rulesetId: DEV_RULESET_ID, rulesetMode: 'dev-unverified', players, turnOrder: players.map((p) => p.id), openTable };
}

export function newGame(seed = 1, n: 3 | 4 = 3, openTable = false): GameState {
  return createGame(makeConfig(n, openTable), seed, `g-${seed}`);
}

let counter = 0;
export function cmd(state: GameState, actorId: PlayerId, body: CommandBody, commandId = `c${++counter}`): Command {
  return { ...body, commandId, expectedRevision: state.revision, actorId } as Command;
}

export function tryCmd(state: GameState, actorId: PlayerId, body: CommandBody): TransitionResult {
  return applyCommand(state, cmd(state, actorId, body));
}

export function play(state: GameState, actorId: PlayerId, body: CommandBody): GameState {
  const r = tryCmd(state, actorId, body);
  if (!r.ok) throw new Error(`${body.type} bị từ chối: ${r.code} ${r.publicReason} ${r.privateReason ?? ''}`);
  return r.state;
}

export function expectReject(state: GameState, actorId: PlayerId, body: CommandBody, code: string): void {
  const r = tryCmd(state, actorId, body);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.code).toBe(code);
}

/**
 * Chỉ dùng trong test để dựng tình huống: chuyển lá từ bank sang tay (giữ bảo toàn).
 * Production UI không có chức năng sửa state.
 */
export function giveFromBank(state: GameState, playerId: PlayerId, b: Bundle): GameState {
  const s = structuredClone(state);
  for (const [t, n] of Object.entries(b) as [CardType, number][]) {
    if (s.bank[t] < n) throw new Error(`bank thiếu ${t}`);
    s.bank[t] -= n;
    s.players[playerId]!.hand[t] += n;
  }
  return s;
}

/** Trả toàn bộ tay về bank (test-only). */
export function emptyHands(state: GameState): GameState {
  const s = structuredClone(state);
  for (const p of Object.values(s.players)) {
    for (const t of CARD_TYPES) {
      s.bank[t] += p.hand[t];
      p.hand[t] = 0;
    }
  }
  return s;
}

/** Setup tự động: chọn vị trí hợp lệ theo rng của test (không phải rng của ván). */
export function autoSetup(state: GameState, rng: RandomSource = createRandomSource(seedRng(99))): GameState {
  let s = state;
  while (s.turn.phase === 'SETUP') {
    const actor = s.turn.activePlayerId;
    const actions = getLegalActions(s, actor);
    const step = s.turn.setup!.step;
    const a = actions.find((x) => x.type === (step === 'building' ? 'placeSetupBuilding' : 'placeSetupRoad'))!;
    const targets = a.targets!;
    const t = targets[rng.nextInt(targets.length)]!;
    s = play(s, actor, step === 'building' ? { type: 'placeSetupBuilding', vertex: t as never } : { type: 'placeSetupRoad', edge: t as never });
  }
  return s;
}

export { handTotal };

/** RandomSource giả trả lần lượt các giá trị cho trước (rồi rơi về rng thật). */
export function rigged(values: number[]): (s: GameState) => RandomSource {
  return (s) => {
    const real = createRandomSource(s.rng);
    const queue = [...values];
    return {
      nextInt: (max: number) => {
        const v = queue.shift();
        if (v === undefined) return real.nextInt(max);
        if (v < 0 || v >= max) throw new Error(`rigged value ${v} ngoài [0,${max})`);
        return v;
      },
      getState: () => real.getState(),
    };
  };
}

/** Tung xúc xắc với kết quả cố định: red, yellow (1–6), event index (0–5). */
export function rollWith(state: GameState, red: number, yellow: number, eventIndex = 0): GameState {
  const r = applyCommand(state, cmd(state, state.turn.activePlayerId, { type: 'rollDice' }), { random: rigged([red - 1, yellow - 1, eventIndex]) });
  if (!r.ok) throw new Error(`roll bị từ chối: ${r.code}`);
  return r.state;
}
