import { createRandomSource, seedRng, shuffleInPlace } from '../../src/shared/random';
import {
  applyCommand,
  bankRatio,
  getLegalActions,
  robberVictims,
  type Command,
  type CommandBody,
  type GameState,
  type PlayerId,
} from '../../src/games/catan-ck/engine';
import { CARD_TYPES, type CardType } from '../../src/games/catan-ck/rules';
import { topologyOf } from '../../src/games/catan-ck/engine/queries';
import { newGame } from './helpers';

/**
 * Người chơi ngẫu nhiên hợp lệ — dùng cho fuzz/replay. RNG của driver tách khỏi RNG của ván.
 */
export function randomPlaythrough(seed: number, n: 3 | 4, maxSteps: number) {
  const initial = newGame(seed, n);
  const drv = createRandomSource(seedRng(seed * 7919 + 1));
  const pick = <T,>(xs: readonly T[]): T => xs[drv.nextInt(xs.length)]!;
  const commands: Command[] = [];
  let state = initial;
  let k = 0;

  const send = (actor: PlayerId, body: CommandBody): boolean => {
    const c = { ...body, commandId: `s${seed}-${k++}`, expectedRevision: state.revision, actorId: actor } as Command;
    const r = applyCommand(state, c);
    if (!r.ok) return false;
    state = r.state;
    commands.push(c);
    return true;
  };

  for (let step = 0; step < maxSteps && state.turn.phase !== 'GAME_OVER'; step++) {
    const active = state.turn.activePlayerId;
    const head = state.pending[0];
    if (state.turn.phase === 'SETUP') {
      const st = state.turn.setup!.step;
      const a = getLegalActions(state, active).find((x) => x.type === (st === 'building' ? 'placeSetupBuilding' : 'placeSetupRoad'))!;
      const t = pick(a.targets!);
      if (!send(active, st === 'building' ? { type: 'placeSetupBuilding', vertex: t as never } : { type: 'placeSetupRoad', edge: t as never })) throw new Error('setup thất bại');
      continue;
    }
    if (head?.kind === 'discard') {
      const p = head.decisionOwnerIds[0]!;
      const hand = state.players[p]!.hand;
      const cards: CardType[] = [];
      for (const t of CARD_TYPES) for (let i = 0; i < hand[t]; i++) cards.push(t);
      shuffleInPlace(cards, drv);
      const chosen: Partial<Record<CardType, number>> = {};
      for (const t of cards.slice(0, head.required[p]!)) chosen[t] = (chosen[t] ?? 0) + 1;
      if (!send(p, { type: 'submitDiscard', pendingId: head.id, cards: chosen })) throw new Error('discard thất bại');
      continue;
    }
    if (head?.kind === 'moveRobber') {
      const hexes = topologyOf(state).hexes.filter((h) => h !== state.board.robberHex);
      const hex = pick(hexes);
      const victims = robberVictims(state, hex, active);
      if (!send(active, { type: 'moveRobber', pendingId: head.id, hex, victim: victims.length ? pick(victims) : null })) throw new Error('robber thất bại');
      continue;
    }
    if (state.turn.phase === 'PRE_ROLL') {
      if (!send(active, { type: 'rollDice' })) throw new Error('roll thất bại');
      continue;
    }
    // ACTION: thử các hành động ngẫu nhiên, ưu tiên xây.
    const acts = getLegalActions(state, active);
    const options: (() => boolean)[] = [];
    for (const type of ['buildCity', 'buildSettlement', 'buildRoad'] as const) {
      const a = acts.find((x) => x.type === type);
      if (a?.enabled && a.targets?.length) {
        const t = pick(a.targets);
        const body = type === 'buildRoad' ? { type, edge: t as never } : { type, vertex: t as never };
        options.push(() => send(active, body), () => send(active, body));
      }
    }
    const hand = state.players[active]!.hand;
    const tradable = CARD_TYPES.filter((t) => hand[t] >= bankRatio(state, active, t));
    if (tradable.length) {
      options.push(() => send(active, { type: 'bankTrade', give: pick(tradable), get: pick(CARD_TYPES.filter((t) => state.bank[t] > 0)) }));
    }
    const others = Object.keys(state.players).filter((p) => p !== active);
    const partner = pick(others);
    const mine = CARD_TYPES.filter((t) => hand[t] > 0);
    const theirs = CARD_TYPES.filter((t) => state.players[partner]!.hand[t] > 0 && !(mine.length === 1 && mine[0] === t));
    if (mine.length && theirs.length) {
      options.push(() => {
        const give = pick(mine);
        const get = pick(theirs.filter((t) => t !== give).length ? theirs.filter((t) => t !== give) : theirs);
        if (give === get) return false;
        if (!send(active, { type: 'proposeTrade', to: [partner], offer: { [give]: 1 }, request: { [get]: 1 } })) return false;
        const id = `t${state.idCounter}`;
        const accept = drv.nextInt(2) === 0;
        send(partner, { type: 'respondTrade', proposalId: id, revision: 1, response: accept ? 'accept' : 'reject' });
        if (accept) send(active, { type: 'confirmTrade', proposalId: id, revision: 1, partner });
        return true;
      });
    }
    options.push(() => send(active, { type: 'endTurn' }));
    if (!pick(options)()) send(active, { type: 'endTurn' });
  }
  return { initial, commands, state };
}
